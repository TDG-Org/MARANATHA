// "Why is this so slow on my good computer?"
//
// When the browser is rasterizing WebGL on the CPU there is nothing the game
// can do that comes close to the fix. Measured on an RTX 3090: turning the
// browser's own hardware acceleration back on is worth about 6x. Shedding
// pixels and dropping the colour grade — everything the engine can do by
// itself — is worth maybe 2x. So the honest move is to hand the player the
// real fix in plain words, once, and let them dismiss it forever.
//
// Deliberately NOT a modal: it must never block a player who cannot change the
// setting (a locked-down school or work machine) from just playing the game.
import { GPU } from '../core/gpuCapability.js';
import { prefersReducedMotion } from '../core/reducedMotion.js';

const KEY = 'maranatha-gpu-notice-dismissed';

// Where the setting lives, per browser. Edge and Chrome word it identically but
// file it in different places, and sending someone to the wrong menu is worse
// than saying nothing.
function whereIsTheSetting() {
  const ua = globalThis.navigator?.userAgent || '';
  if (/Edg\//.test(ua)) return 'Edge: Settings → System and performance → “Use graphics acceleration when available”';
  if (/OPR\//.test(ua)) return 'Opera: Settings → System → “Use hardware acceleration when available”';
  if (/Firefox\//.test(ua)) return 'Firefox: Settings → General → Performance → “Use recommended performance settings”';
  if (/Chrome\//.test(ua)) return 'Chrome: Settings → System → “Use graphics acceleration when available”';
  return 'Look for “hardware acceleration” or “graphics acceleration” in your browser’s settings';
}

let live = null;

/**
 * Show the notice if — and only if — the context is CPU-rasterized and the
 * player has not dismissed it before. Returns a cleanup function.
 */
export function maybeShowGpuNotice({ storage = globalThis.localStorage } = {}) {
  if (!GPU.software || live) return () => {};
  try { if (storage?.getItem(KEY) === '1') return () => {}; } catch { /* private mode */ }

  const root = document.createElement('div');
  root.className = 'mr-gpu-notice';
  // Bottom-centre: out of the eye-line of the objective banner (top-centre) and
  // clear of the home gear and the volume control.
  // The touch joystick lives bottom-LEFT at z-index 35 and this panel sits at
  // 60, so an opaque bottom-centre box that accepts pointers swallows every
  // press on the stick: measured at 390x844 the stick is ENTIRELY inside this
  // panel and the player simply cannot move. The panel is therefore
  // click-through (only its buttons take pointers, like dialogue.js), and on a
  // touch device it also sits clear ABOVE the stick rather than over it.
  const coarse = globalThis.matchMedia?.('(pointer: coarse)')?.matches;
  root.style.cssText = [
    'position:fixed', 'left:50%', 'transform:translateX(-50%)',
    `bottom:calc(${coarse ? 150 : 18}px + env(safe-area-inset-bottom, 0px))`, 'z-index:60',
    'pointer-events:none',
    'width:min(560px, calc(100vw - 28px))', 'box-sizing:border-box',
    'padding:14px 16px', 'border-radius:14px',
    'background:rgba(28,24,44,0.94)', 'border:1px solid rgba(242,184,128,0.45)',
    'box-shadow:0 12px 34px rgba(0,0,0,0.45)', 'color:#fdf6e3',
    'font:400 14px/1.5 "Segoe UI",system-ui,sans-serif',
    // Every DOM surface in the project asks the one shared gate (accessibility
    // skill); a fade nobody asked for is still a fade.
    'opacity:0', `transition:opacity ${prefersReducedMotion() ? 1 : 320}ms ease`,
  ].join(';');
  // Polite: this is advice, not an error, and it must not interrupt narration.
  root.setAttribute('role', 'status');
  root.setAttribute('aria-live', 'polite');

  const title = document.createElement('div');
  title.style.cssText = 'font-weight:700; margin-bottom:5px; color:#f2b880;';
  title.textContent = 'Your browser is drawing this game with the CPU';

  const body = document.createElement('div');
  body.style.cssText = 'margin-bottom:11px; opacity:0.92;';
  body.textContent = `It is not using your graphics card, which makes the game run several times slower than it should. ${whereIsTheSetting()} — then restart the browser.`;

  const row = document.createElement('div');
  row.style.cssText = 'display:flex; gap:9px; justify-content:flex-end; align-items:center;';

  const detail = document.createElement('span');
  detail.style.cssText = 'margin-right:auto; font-size:11.5px; opacity:0.6;';
  detail.textContent = GPU.renderer ? GPU.renderer.slice(0, 46) : 'software renderer';

  const mkBtn = (label, primary) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.style.cssText = [
      // The panel is click-through; its controls are not. 44px on a coarse
      // pointer is the repo's own responsive-ui floor (index.html) — 36 was
      // below it.
      'pointer-events:auto',
      `min-height:${coarse ? 44 : 36}px`,
      'padding:8px 14px', 'border-radius:10px', 'cursor:pointer',
      'font:600 13px "Segoe UI",system-ui,sans-serif',
      primary ? 'background:#f2b880' : 'background:rgba(255,255,255,0.08)',
      primary ? 'color:#241f38' : 'color:#fdf6e3',
      primary ? 'border:none' : 'border:1px solid rgba(255,255,255,0.16)',
    ].join(';');
    return b;
  };

  const later = mkBtn('Not now', false);
  const never = mkBtn('Got it', true);

  const close = (remember) => {
    if (remember) { try { storage?.setItem(KEY, '1'); } catch { /* private mode */ } }
    root.style.opacity = '0';
    setTimeout(() => { root.remove(); if (live === cleanup) live = null; }, 340);
  };
  later.onclick = () => close(false);
  never.onclick = () => close(true);

  row.append(detail, later, never);
  root.append(title, body, row);
  document.body.append(root);
  requestAnimationFrame(() => { root.style.opacity = '1'; });

  const cleanup = () => { root.remove(); if (live === cleanup) live = null; };
  live = cleanup;
  return cleanup;
}

/** Test seam. */
export function resetGpuNotice() { live?.(); live = null; }
export const GPU_NOTICE_KEY = KEY;
