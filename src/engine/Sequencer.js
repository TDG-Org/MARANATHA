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
//   { t:'guide', x, z }  /  { t:'guideOff' }
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
  const schedule = () => {
    if (settled || timer) return;
    if (isPaused?.()) {
      // Browser pause/visibility events wake this exactly once on resume.
      if (!eventDriven) timer = setTimeout(tick, step);
      return;
    }
    const slice = Math.min(step, left);
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
    if (timer) clearTimeout(timer);
    timer = null;
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
        case 'verse':
          await awaitWork(() => c.verseCard.show(s.verse));
          break;
        case 'verseHide':
          c.verseCard.hide();
          break;
        case 'say':
          await awaitWork(() => c.dialogue.say(s.who, s.text, { color: s.color }));
          break;
        case 'dialogueHide':
          c.dialogue.hide();
          break;
        case 'cam':
          // target may be a function — dialogue shots frame LIVE positions
          c.camera.cinematicMoveTo(typeof s.target === 'function' ? { ...s, target: s.target() } : s);
          if (s.awaitMs !== false) await wait(s.duration ?? 1400);
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
        case 'guide':
          c.guide?.setTargetXZ?.(s.x, s.z);
          break;
        case 'guideOff':
          c.guide?.setTarget(null);
          break;
        case 'sound':
          c.sound?.(s.key, s.gain);
          break;
        case 'wait':
          await wait(s.ms ?? 500);
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
