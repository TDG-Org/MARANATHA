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
export class Sequencer {
  // ctx: { cinema, verseCard, dialogue, camera (director), grading, hud, guide,
  //        setInput(on), sound(key) }
  constructor(ctx) {
    this.ctx = ctx;
    this.running = false;
  }

  async run(steps) {
    this.running = true;
    const c = this.ctx;
    for (const s of steps) {
      switch (s.t) {
        case 'letterbox':
          c.setInput?.(!s.on);
          await c.cinema.letterbox(s.on);
          break;
        case 'title':
          await c.cinema.titleCard(s);
          break;
        case 'verse':
          await c.verseCard.show(s.verse);
          break;
        case 'verseHide':
          c.verseCard.hide();
          break;
        case 'say':
          await c.dialogue.say(s.who, s.text, { color: s.color });
          break;
        case 'dialogueHide':
          c.dialogue.hide();
          break;
        case 'cam':
          c.camera.cinematicMoveTo(s);
          if (s.awaitMs !== false) await wait(s.duration ?? 1400);
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
          await c.grading.grade(s.mood, s.ms ?? 2400);
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
          c.sound?.(s.key);
          break;
        case 'wait':
          await wait(s.ms ?? 500);
          break;
        case 'fn':
          await s.fn?.(c);
          break;
        default:
          console.warn('[sequencer] unknown step', s.t);
      }
    }
    this.running = false;
  }
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
