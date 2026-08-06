import { abortReason, throwIfAborted, withAbort } from '../core/async.js';

// Data-driven cutscene sequencer (cutscene-director skill). A sequence is an
// array of plain step objects executed in order; gameplay gates live BETWEEN
// sequences as awaited promises. The scene wires the systems once (ctx), and
// beats become pure data. Skip semantics: the narrator Skip button ends the
// current LINE only — steps themselves are never skipped.
//
// Steps:
//   { t:'letterbox', on }                     — glide bars + toggle player input
//   { t:'title', heading, sub, holdMs }       — engraved title card
//   { t:'verse', verse }                      — verse card, narrated, awaited
//   { t:'verseHide' }
//   { t:'say', who, text, color }             — dialogue line (speaker named)
//   { t:'dialogueHide' }
//   { t:'cam', ...cinematicMoveTo args }      — authored camera move
//   { t:'camRelease', ms }
//   { t:'anim', char, state }                 — character animation state
//   { t:'coat', char, on }                    — equip/remove the coat
//   { t:'grade', mood, ms }                   — mood shift (awaited)
//   { t:'objective', text }                   — top-left objective + arrow via ctx
//   { t:'sound', key }                        — manifest one-shot
//   { t:'wait', ms }
//   { t:'fn', fn }                            — escape hatch (async ok)
// A wait that honours pause + hidden-tab ownership. In the browser it sleeps
// event-driven with NO polling wakeups while paused; the small polling fallback
// exists only for non-DOM harnesses whose arbitrary predicate has no event.
export const pausableWait = (ms, isPaused = null, signal = null) => new Promise((resolve, reject) => {
  if (signal?.aborted) { reject(abortReason(signal)); return; }
  if (!ms || ms <= 0) { resolve(); return; }
  let left = ms;
  const step = 50;
  let settled = false;
  let timer = null;
  const win = globalThis.window;
  const doc = globalThis.document;
  const eventDriven = !!(
    isPaused
    && win?.addEventListener && win?.removeEventListener
    && doc?.addEventListener && doc?.removeEventListener
  );
  const finish = (error = null) => {
    if (settled) return;
    settled = true;
    if (timer) clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
    if (eventDriven) {
      win.removeEventListener('maranatha-pausechange', onPauseState);
      doc.removeEventListener('visibilitychange', onPauseState);
    }
    if (error) reject(error); else resolve();
  };
  const onAbort = () => finish(abortReason(signal));
  // In the browser, sleep the WHOLE remaining hold in one timer.
  //
  // This used to tick every 50ms so it could notice a pause, which meant a
  // four-second title card scheduled eighty sequential wake-ups — and the
  // cinema layer is nothing but holds, so a five-minute scene woke the main
  // thread thousands of times for no reason beyond asking "still paused?". It
  // never needed to ask: pause and visibility both fire events, and those
  // events already re-schedule. Only the non-DOM harness, whose predicate has
  // no event to listen to, still polls.
  const now = () => (globalThis.performance?.now?.() ?? Date.now());
  let startedAt = 0;
  const schedule = () => {
    if (settled || timer) return;
    if (isPaused?.()) {
      // Browser pause/visibility events wake this exactly once on resume.
      if (!eventDriven) timer = setTimeout(tick, step);
      return;
    }
    const slice = eventDriven ? left : Math.min(step, left);
    startedAt = now();
    timer = setTimeout(() => tick(slice), slice);
  };
  const tick = (elapsed = 0) => {
    timer = null;
    if (isPaused?.()) { schedule(); return; }
    left -= elapsed || Math.min(step, left);
    if (left <= 0) finish();
    else schedule();
  };
  const onPauseState = () => {
    if (!timer) { schedule(); return; }
    // Pausing mid-sleep: bank the time actually served, then wait out the rest
    // when play resumes. Without this the single long timer would either lose
    // the elapsed portion or ignore the pause entirely.
    clearTimeout(timer);
    timer = null;
    if (eventDriven && !settled) {
      left = Math.max(0, left - (now() - startedAt));
      if (left <= 0) { finish(); return; }
    }
    schedule();
  };
  signal?.addEventListener('abort', onAbort, { once: true });
  if (eventDriven) {
    win.addEventListener('maranatha-pausechange', onPauseState);
    doc.addEventListener('visibilitychange', onPauseState);
  }
  schedule();
});

export class Sequencer {
  // ctx: { cinema, verseCard, dialogue, camera (director), grading, hud, guide,
  //        setInput(on), sound(key), isPaused() }
  constructor(ctx) {
    this.ctx = ctx;
    this.signal = ctx.signal || null;
    this.running = false;
  }

  async run(steps) {
    this.lastVerseSkipped = false;
    this.running = true;
    const c = this.ctx;
    // D6: the quest banner stands down whenever a sequence is playing (it must
    // never share the frame with verse cards / title cards). Depth-counted so
    // overlapping runs can't flicker it.
    this._depth = (this._depth || 0) + 1;
    if (this._depth === 1) c.hud?.setCutscene?.(true);
    const signal = this.signal;
    const wait = (ms) => pausableWait(ms, c.isPaused, signal);
    const awaitWork = (work) => withAbort(work, signal);
    try {
    for (const s of steps) {
      throwIfAborted(signal);
      switch (s.t) {
        case 'letterbox':
          c.setInput?.(!s.on);
          c.hud?.setLetterbox?.(!!s.on);
          // NEVER-STATIC default (cutscene-director): while the bars are up,
          // the camera is always on a slow authored drift.
          c.camera.setDrift?.(!!s.on);
          await awaitWork(() => c.cinema.letterbox(s.on));
          break;
        case 'title':
          await awaitWork(() => c.cinema.titleCard(s));
          break;
        case 'verse': {
          // Remember whether the player SKIPPED this line. Everything authored
          // after a verse — the hold on the frame, the reaction beat — exists to
          // give the narration room, so if the narration was cut short those
          // holds must collapse with it. Without this, Skip stopped the voice
          // and then the scene sat through several seconds of timed steps, which
          // reads as "skip did nothing" (Nate, on the closing line).
          const verseResult = await awaitWork(() => c.verseCard.show(s.verse));
          this.lastVerseSkipped = verseResult?.status === 'skipped';
          break;
        }
        case 'verseHide':
          c.verseCard.hide();
          break;
        case 'say':
          await awaitWork(() => c.dialogue.say(s.who, s.text, { color: s.color }));
          break;
        case 'dialogueHide':
          c.dialogue.hide();
          break;
        // A SKIP STOPS AT THE NEXT CUT.
        //
        // `lastVerseSkipped` used to live for the whole run, so one Skip on
        // Genesis 37:24 collapsed every hold that followed — including one six
        // steps and two fades later that was the BODY of the closing shot
        // ("the camera is slowly panning away from the well"), leaving a
        // fade-in immediately followed by a fade-out. But it must still collapse
        // several holds inside the SAME shot, which is why it cannot simply be
        // spent on the first one.
        //
        // The honest boundary is the picture: a skip shortens the pauses in the
        // shot it happened in, and ends when the shot does.
        case 'cam':
          this.lastVerseSkipped = false;
          // target may be a function — dialogue shots frame LIVE positions
          {
            const spec = typeof s.target === 'function' ? { ...s, target: s.target() } : s;
            const isCoveredCut = (spec.duration ?? 1400) <= 1 && c.camera.cutTo;
            const moveMs = isCoveredCut
              ? c.camera.cutTo(spec)
              : c.camera.cinematicMoveTo(spec);
            // CameraDirector may lengthen a group route to uphold its maximum
            // travel speed. Never advance the story before the pixels arrive.
            if (s.awaitMs !== false) await wait(moveMs ?? s.duration ?? 1400);
          }
          break;
        case 'fade':
          await awaitWork(() => c.cinema.fade(s.on !== false, s.ms ?? 600, s.pulse !== false));
          break;
        case 'camRelease':
          c.camera.release(s.ms ?? 1400);
          break;
        case 'anim':
          s.char?.play(s.state);
          break;
        case 'coat':
          s.char?.setCoat(s.on !== false);
          break;
        case 'grade':
          await awaitWork(() => c.grading.grade(s.mood, s.ms ?? 2400));
          break;
        case 'objective':
          c.hud?.setObjective(s.text ?? '');
          break;
        case 'sound':
          c.sound?.(s.key, s.gain);
          break;
        case 'wait':
          await wait(s.ms ?? 500);
          break;
        // A hold that belongs to the narration: full length normally, gone the
        // instant the player skips the line it was giving room to.
        case 'hold':
          if (!this.lastVerseSkipped) await wait(s.ms ?? 500);
          break;
        case 'fn':
          await awaitWork(() => s.fn?.(c));
          break;
        default:
          console.warn('[sequencer] unknown step', s.t);
      }
      throwIfAborted(signal);
    }
    } finally {
      // a throwing step must never leave the quest banner stuck hidden
      this._depth -= 1;
      if (this._depth === 0) c.hud?.setCutscene?.(false);
      this.running = this._depth > 0;
    }
  }
}
