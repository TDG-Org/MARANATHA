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
// than saying nothing. The second string is the FOLLOW-UP, for the player who
// has already done that and is still being told the same thing — which is the
// state that generated this rewrite:
//
//   "i already went into my settings and turned on 'use graphics acceleration
//    when available'... what the heck else do i need to do for it to use my
//    gpu, is it my actual computer that's gone bad?"
//
// Measured on that exact machine (Edge, fresh profile, acceleration on):
// SystemInfo reports the RTX 3090 active and every powerPreference returns
// "ANGLE (NVIDIA, NVIDIA GeForce RTX 3090 ... D3D11)" — so the computer is
// fine, and the two things that actually keep a browser on the CPU after the
// switch is flipped are (a) it was never fully restarted, because closing every
// window does NOT end the browser process on Windows, and (b) the browser has
// separately disabled WebGL for this profile. Both are visible on one page, so
// send them there instead of repeating the advice they already followed.
function whereIsTheSetting() {
  const ua = globalThis.navigator?.userAgent || '';
  if (/Edg\//.test(ua)) return ['Edge: Settings → System and performance → “Use graphics acceleration when available”', 'edge://gpu'];
  if (/OPR\//.test(ua)) return ['Opera: Settings → System → “Use hardware acceleration when available”', 'opera://gpu'];
  if (/Firefox\//.test(ua)) return ['Firefox: Settings → General → Performance → “Use recommended performance settings”', 'about:support'];
  if (/Chrome\//.test(ua)) return ['Chrome: Settings → System → “Use graphics acceleration when available”', 'chrome://gpu'];
  return ['Look for “hardware acceleration” or “graphics acceleration” in your browser’s settings', ''];
}

let live = null;
// Once per page load, whatever the player chooses. The notice used to be
// offered again on EVERY entry into a 3D scene, so "Not now" bought silence
// only until the next navigation — which reads as the game nagging.
let quietedThisSession = false;

/**
 * Show the notice if — and only if — the context is CPU-rasterized and the
 * player has not dismissed it before. Returns a cleanup function.
 */
export function maybeShowGpuNotice({ storage = globalThis.localStorage } = {}) {
  if (!GPU.software || live || quietedThisSession) return () => {};
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

  const [settingPath, gpuPage] = whereIsTheSetting();

  const body = document.createElement('div');
  body.style.cssText = 'margin-bottom:9px; opacity:0.92;';
  body.textContent = `It is not using your graphics card, which makes the game run several times slower than it should. ${settingPath}.`;

  // The follow-up. Naming the exact page and the exact row turns "what else do
  // I have to do?" into something a player can check in ten seconds.
  const already = document.createElement('div');
  already.style.cssText = 'margin-bottom:11px; font-size:12.5px; opacity:0.72; line-height:1.5;';
  already.textContent = gpuPage
    ? `Already switched on? It only takes effect after a FULL browser restart — closing every window is not enough on Windows. To check, open ${gpuPage} and look at the “WebGL” row: it should say “Hardware accelerated”.`
    : 'Already switched on? It only takes effect after a full browser restart.';

  // What the page is ACTUALLY drawing with, in full and selectable, so it can be
  // read out or pasted into a search. Truncating it to 46 characters cut the
  // driver name off exactly where it stopped being useful.
  const detail = document.createElement('div');
  detail.style.cssText = [
    'font:400 11px ui-monospace,Consolas,monospace', 'opacity:0.55',
    'margin-bottom:10px', 'word-break:break-word', 'line-height:1.45',
    'user-select:text', '-webkit-user-select:text', 'pointer-events:auto',
  ].join(';');
  detail.textContent = GPU.renderer || 'software renderer (name withheld)';

  const row = document.createElement('div');
  row.style.cssText = 'display:flex; gap:9px; justify-content:flex-end; align-items:center;';

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
  const never = mkBtn('Don’t show again', true);

  const close = (remember) => {
    // Either way this is the last time it appears until the page is reloaded.
    quietedThisSession = true;
    if (remember) { try { storage?.setItem(KEY, '1'); } catch { /* private mode */ } }
    root.style.opacity = '0';
    setTimeout(() => { root.remove(); if (live === cleanup) live = null; }, 340);
  };
  later.onclick = () => close(false);
  never.onclick = () => close(true);

  row.append(later, never);
  root.append(title, body, already, detail, row);
  document.body.append(root);
  requestAnimationFrame(() => { root.style.opacity = '1'; });

  const cleanup = () => { root.remove(); if (live === cleanup) live = null; };
  live = cleanup;
  return cleanup;
}

/** Test seam. Clears the once-per-page-load latch as well as any live panel. */
export function resetGpuNotice() { live?.(); live = null; quietedThisSession = false; }
export const GPU_NOTICE_KEY = KEY;
