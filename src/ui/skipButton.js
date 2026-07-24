import { Narrator } from '../systems/Narrator.js';
import { Audio } from '../systems/AudioSystem.js';

// The Skip button — bottom-right, visible ONLY while the narrator is speaking.
// It skips the current line and nothing else (no volume change ever skips).
export function mountSkipButton() {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.setAttribute('aria-label', 'Skip narration');
  btn.textContent = 'Skip narration ⏭';
  btn.style.cssText = [
    'position:fixed',
    'right:calc(14px + env(safe-area-inset-right))',
    'bottom:calc(16px + env(safe-area-inset-bottom))',
    'z-index:47', 'display:none',
    'padding:clamp(8px,1.4vw,11px) clamp(13px,2vw,17px)', 'border-radius:22px', 'cursor:pointer',
    'font:600 clamp(12px,1.6vw,14px) "Segoe UI",system-ui,sans-serif',
    'color:#fdf6e3', 'background:rgba(16,14,26,0.72)',
    'border:1px solid rgba(242,184,128,0.35)', /* D9: no backdrop-filter over a live canvas */
    'box-shadow:0 3px 14px rgba(0,0,0,0.3)', 'transition:filter 150ms ease',
  ].join(';');
  btn.onmouseenter = () => { btn.style.filter = 'brightness(1.12)'; };
  btn.onmouseleave = () => { btn.style.filter = 'none'; };
  btn.onclick = () => { Audio.uiClick?.(); Narrator.skip(); };
  document.body.append(btn);

  // Loading and muted reading holds remain skippable without claiming that an
  // audible transport is running (Narrator.speaking still owns eco pacing).
  Narrator.onActiveLine = (on) => { btn.style.display = on ? 'block' : 'none'; };
  btn.style.display = Narrator.activeLine ? 'block' : 'none';
  return btn;
}
