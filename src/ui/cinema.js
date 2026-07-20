import { pausableWait } from '../engine/Sequencer.js';

// Cinematic presentation layer (cutscene-director skill): letterbox bars that
// glide in/out, engraved title cards (bottom-right, location · passage), and a
// whisper-alpha mood tint the grading system drives. Pure DOM; one instance
// per scene; dispose removes everything. All holds honour the pause menu
// (isPaused) — a paused player never loses a title card or a fade.
export function createCinema({ isPaused = null, onFade = null } = {}) {
  const hold = (ms) => pausableWait(ms, isPaused);
  const mk = (css) => {
    const el = document.createElement('div');
    el.style.cssText = css;
    document.body.append(el);
    return el;
  };

  const barCss = 'position:fixed;left:0;right:0;height:11vh;background:#08070e;z-index:44;pointer-events:none;transition:transform 560ms cubic-bezier(0.4,0,0.2,1);';
  const top = mk(barCss + 'top:0;transform:translateY(-100%);');
  const bottom = mk(barCss + 'bottom:0;transform:translateY(100%);');

  // Mood tint — a whisper (≤0.14 alpha), driven by grading.
  const tint = mk('position:fixed;inset:0;z-index:26;pointer-events:none;background:#000;opacity:0;transition:opacity 2200ms ease, background-color 2200ms ease;');

  // Dip-to-black — the clean-transition layer (cutscene-director). Sits ABOVE
  // the letterbox bars but BELOW the title card + dialogue, so title cards can
  // play over black.
  const fadeEl = mk('position:fixed;inset:0;z-index:43;pointer-events:none;background:#05040a;opacity:0;');

  // Title card — engraved serif, bottom-right, above the letterbox bar.
  const title = mk([
    'position:fixed', 'right:calc(4vw + env(safe-area-inset-right))', 'bottom:calc(13vh + env(safe-area-inset-bottom))',
    'z-index:46', 'pointer-events:none', 'text-align:right', 'color:#efe3c8',
    'font-family:Georgia,"Times New Roman",serif', 'opacity:0', 'transform:translateY(6px)',
    'transition:opacity 1400ms ease, transform 1400ms ease',
    'text-shadow:0 1px 2px rgba(0,0,0,0.65), 0 0 18px rgba(242,184,128,0.12)',
  ].join(';'));

  let letterboxOn = false;

  return {
    get letterboxOn() { return letterboxOn; },

    letterbox(on) {
      letterboxOn = !!on;
      top.style.transform = on ? 'translateY(0)' : 'translateY(-100%)';
      bottom.style.transform = on ? 'translateY(0)' : 'translateY(100%)';
      return hold(580);
    },

    // fade(true, ms) dips to black; fade(false, ms) lifts. ms 0 = instant.
    // D6: an optional onFade hook lets PostFX ride a soft blur swell under the
    // dip — the smooth cross-transition between beats.
    // `pulse: false` suppresses the blur swell — for fades that reveal INTO an
    // effect that already owns the canvas filter (the dream's eye-open), where
    // a competing blur pulse stomps the ramp mid-flight (D13).
    fade(toBlack, ms = 600, pulse = true) {
      fadeEl.style.transition = ms > 0 ? `opacity ${ms}ms ease` : 'none';
      fadeEl.style.opacity = toBlack ? '1' : '0';
      if (ms > 250 && pulse) onFade?.(toBlack, ms);
      return hold(ms);
    },

    // titleCard({ heading:'HEBRON, CANAAN', sub:'c. 1898 BC · GENESIS 37', holdMs })
    async titleCard({ heading = '', sub = '', holdMs = 3400 } = {}) {
      title.innerHTML =
        `<div style="font-size:clamp(23px,3.6vw,36px);letter-spacing:0.22em;text-transform:uppercase;">${heading}</div>` +
        (sub ? `<div style="font-size:clamp(13px,1.9vw,18px);letter-spacing:0.3em;opacity:0.75;margin-top:8px;text-transform:uppercase;">${sub}</div>` : '');
      title.style.opacity = '1';
      title.style.transform = 'translateY(0)';
      await hold(holdMs);
      title.style.opacity = '0';
      title.style.transform = 'translateY(6px)';
      await hold(900);
    },

    // Grading drives this; alpha is clamped to the whisper ceiling.
    setTint(cssColor, alpha) {
      tint.style.backgroundColor = cssColor;
      tint.style.opacity = String(Math.min(0.14, Math.max(0, alpha)));
    },

    destroy() { top.remove(); bottom.remove(); tint.remove(); title.remove(); fadeEl.remove(); },
  };
}
