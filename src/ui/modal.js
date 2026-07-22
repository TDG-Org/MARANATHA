import { Audio } from '../systems/AudioSystem.js';

// A calm "Are you sure?" confirm dialog. Returns a Promise<boolean>.
// Used by the HOME button and by Settings → Reset progress.
//
// Layering contract: while ANY modal is open it owns Esc/Enter (capture phase,
// stops propagation) — pause/settings check isModalOpen() and stand down.
let openCount = 0;
export const isModalOpen = () => openCount > 0;

export function confirmModal({
  title = 'Are you sure?',
  body = '',
  confirmText = 'Yes',
  cancelText = 'Cancel',
} = {}) {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:70', 'display:flex',
      'align-items:center', 'justify-content:center',
      'background:rgba(8,7,14,0.72)',
      'opacity:0', 'transition:opacity 220ms ease',
      'font-family:Georgia, "Times New Roman", serif',
    ].join(';');

    const panel = document.createElement('div');
    panel.style.cssText = [
      'max-width:min(90vw,380px)', 'margin:20px', 'padding:22px 24px',
      'background:rgba(16,14,26,0.94)', 'border:1px solid rgba(242,184,128,0.18)',
      'border-radius:14px', 'box-shadow:0 12px 40px rgba(0,0,0,0.45)',
      'color:#fdf6e3', 'text-align:center', 'transform:translateY(8px)',
      'transition:transform 220ms ease',
    ].join(';');

    const h = document.createElement('div');
    h.textContent = title;
    h.style.cssText = 'font-size:20px; letter-spacing:0.02em; margin-bottom:8px;';

    const p = document.createElement('div');
    p.textContent = body;
    p.style.cssText = [
      'font-family:"Segoe UI",system-ui,sans-serif', 'font-size:14px',
      'line-height:1.5', 'opacity:0.82', 'margin-bottom:20px',
    ].join(';');
    if (!body) p.style.display = 'none';

    const row = document.createElement('div');
    row.style.cssText = 'display:flex; gap:10px; justify-content:center;';

    const mkBtn = (label, primary) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.style.cssText = [
        'font-family:"Segoe UI",system-ui,sans-serif', 'font-size:14px',
        'padding:10px 18px', 'border-radius:9px', 'cursor:pointer',
        'min-width:96px', 'transition:filter 150ms ease, background 150ms ease',
        primary
          ? 'background:#f2b880; color:#241f38; border:none; font-weight:600;'
          : 'background:rgba(255,255,255,0.06); color:#fdf6e3; border:1px solid rgba(255,255,255,0.16);',
      ].join(';');
      b.onmouseenter = () => { b.style.filter = 'brightness(1.08)'; };
      b.onmouseleave = () => { b.style.filter = 'none'; };
      return b;
    };

    const cancelBtn = mkBtn(cancelText, false);
    const confirmBtn = mkBtn(confirmText, true);
    row.append(cancelBtn, confirmBtn);
    panel.append(h, p, row);
    backdrop.append(panel);
    document.body.append(backdrop);

    // Ease in.
    requestAnimationFrame(() => {
      backdrop.style.opacity = '1';
      panel.style.transform = 'translateY(0)';
    });

    openCount += 1;
    let closed = false;
    const close = (result) => {
      if (closed) return;
      closed = true;
      openCount = Math.max(0, openCount - 1);
      try { Audio.uiClick?.(); } catch { /* ignore */ }
      backdrop.style.opacity = '0';
      panel.style.transform = 'translateY(8px)';
      window.removeEventListener('keydown', onKey, true);
      setTimeout(() => { backdrop.remove(); resolve(result); }, 220);
    };
    // capture + stopImmediatePropagation: the modal OWNS these keys while open
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopImmediatePropagation(); close(false); }
      if (e.key === 'Enter') { e.stopImmediatePropagation(); close(true); }
    };
    cancelBtn.onclick = () => close(false);
    confirmBtn.onclick = () => close(true);
    backdrop.onclick = (e) => { if (e.target === backdrop) close(false); };
    window.addEventListener('keydown', onKey, true);
    // Focus the safe (cancel) option by default.
    setTimeout(() => cancelBtn.focus(), 60);
  });
}
