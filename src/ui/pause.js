import { Audio } from '../systems/AudioSystem.js';
import { Narrator } from '../systems/Narrator.js';
import { isModalOpen } from './modal.js';

// The PAUSE layer: Esc (or the ⏸ button, top-right under the volume control)
// truly pauses the game — the app loop freezes (app.setPaused), the audio
// context suspends, narration pauses, and NO input bleeds through (capture-
// phase swallow). Background dims + blurs the held frame. Esc closes it too.
//
//   createPauseMenu({ app, isInputOn, setInput, onSettings, onHome })
//
// isInputOn/setInput belong to the SCENE (input may already be off inside a
// cutscene — resume must restore that state, never force input on).
export function createPauseMenu({ app, isInputOn, setInput, onSettings, onHome }) {
  let open = false;
  let subOpen = false; // a settings/confirm layer sits above us — ignore Esc

  // --- the ⏸ button (top-right, below the volume control; ≥44px target) ----
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.setAttribute('aria-label', 'Pause');
  btn.textContent = '⏸';
  btn.style.cssText = [
    'position:fixed', 'top:calc(56px + env(safe-area-inset-top))', 'right:calc(14px + env(safe-area-inset-right))',
    'z-index:40', 'width:46px', 'height:46px', 'border-radius:12px', 'cursor:pointer',
    'display:flex', 'align-items:center', 'justify-content:center',
    'font-size:19px', 'line-height:1', 'color:#fdf6e3',
    'background:rgba(16,14,26,0.55)', 'border:1px solid rgba(255,255,255,0.14)',
    'backdrop-filter:blur(3px)', 'transition:filter 150ms ease',
  ].join(';');
  btn.onmouseenter = () => { btn.style.filter = 'brightness(1.15)'; };
  btn.onmouseleave = () => { btn.style.filter = 'none'; };
  btn.onclick = () => { Audio.uiClick?.(); toggle(); };

  // --- the menu overlay ------------------------------------------------------
  const overlay = document.createElement('div');
  overlay.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:58', 'display:none',
    'align-items:center', 'justify-content:center', 'flex-direction:column',
    'background:rgba(8,7,14,0.52)', 'backdrop-filter:blur(6px)',
    'opacity:0', 'transition:opacity 200ms ease',
  ].join(';');

  const title = document.createElement('div');
  title.textContent = 'Paused';
  title.style.cssText = [
    'font-family:Georgia,"Times New Roman",serif', 'font-size:clamp(26px,4.5vw,38px)',
    'color:#f5e6c4', 'letter-spacing:0.14em', 'text-transform:uppercase', 'margin-bottom:26px',
    'text-shadow:0 2px 10px rgba(0,0,0,0.6)',
  ].join(';');

  const col = document.createElement('div');
  col.style.cssText = 'display:flex; flex-direction:column; gap:12px; width:min(78vw,260px);';

  const mkItem = (label, fn) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.style.cssText = [
      'font:600 clamp(15px,2vw,17px) "Segoe UI",system-ui,sans-serif',
      'padding:13px 18px', 'border-radius:12px', 'cursor:pointer', 'color:#fdf6e3',
      'background:rgba(16,14,26,0.82)', 'border:1px solid rgba(242,184,128,0.3)',
      'transition:filter 140ms ease, transform 140ms ease',
    ].join(';');
    b.onmouseenter = () => { b.style.filter = 'brightness(1.18)'; b.style.transform = 'scale(1.02)'; };
    b.onmouseleave = () => { b.style.filter = 'none'; b.style.transform = 'scale(1)'; };
    b.onclick = (e) => { e.stopPropagation(); Audio.uiClick?.(); fn(); };
    col.append(b);
    return b;
  };

  mkItem('Resume', () => close());
  mkItem('Settings', async () => {
    subOpen = true;
    try { await onSettings?.(); } finally { subOpen = false; }
  });
  mkItem('Home', async () => {
    subOpen = true;
    let leave = false;
    try { leave = await onHome?.(); } finally { subOpen = false; }
    if (leave) close({ navigating: true });
  });

  const hint = document.createElement('div');
  hint.textContent = window.matchMedia?.('(pointer: coarse)')?.matches ? '' : 'Esc resumes';
  hint.style.cssText = 'margin-top:22px; font:12px "Segoe UI",system-ui,sans-serif; color:#f5e6c4; opacity:0.55;';

  overlay.append(title, col, hint);
  document.body.append(btn, overlay);

  // --- true pause ------------------------------------------------------------
  function freeze(on) {
    app.setPaused?.(on);
    if (on) {
      setInput?.(false);
      Narrator.pause?.();
      // holdSuspend stops AudioSystem's global unlock/visibility listeners
      // from silently resuming the soundscape while we're frozen
      Audio.holdSuspend = true;
      Audio.ctx?.suspend?.().catch?.(() => {});
    } else {
      Audio.holdSuspend = false;
      if (Audio.enabled) Audio.ctx?.resume?.().catch?.(() => {});
      Narrator.resume?.();
      // restore the SCENE's current truth — a cutscene may have legally
      // changed input state while we were paused (real-time steps)
      setInput?.(isInputOn ? isInputOn() : true);
    }
  }

  function show() {
    if (open) return;
    open = true;
    freeze(true);
    overlay.style.display = 'flex';
    requestAnimationFrame(() => { overlay.style.opacity = '1'; });
    overlay.style.opacity = '1'; // hidden-tab safe (no rAF)
  }

  function close({ navigating = false } = {}) {
    if (!open) return;
    open = false;
    overlay.style.opacity = '0';
    overlay.style.display = 'none';
    if (!navigating) freeze(false);
    else app.setPaused?.(false); // leaving the scene: unfreeze the loop only
  }

  function toggle() { if (open) close(); else show(); }

  // --- input: Esc toggles; while open, nothing leaks to the game -------------
  const onKey = (e) => {
    if (isModalOpen()) return; // an open confirm modal owns Esc/Enter
    if (e.key === 'Escape' && !subOpen) {
      e.preventDefault();
      e.stopImmediatePropagation();
      toggle();
      return;
    }
    if (open && !subOpen) {
      // swallow everything else at capture so no game listener sees it
      e.stopImmediatePropagation();
    }
  };
  const onPointer = (e) => {
    if (isModalOpen()) return;
    if (open && !subOpen && !overlay.contains(e.target) && e.target !== btn) {
      e.stopImmediatePropagation();
      e.preventDefault();
    }
  };
  window.addEventListener('keydown', onKey, true);
  window.addEventListener('pointerdown', onPointer, true);

  return {
    get isOpen() { return open; },
    open: show,
    close,
    destroy() {
      if (open) freeze(false);
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('pointerdown', onPointer, true);
      btn.remove();
      overlay.remove();
    },
  };
}
