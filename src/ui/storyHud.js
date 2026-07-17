import { Audio } from '../systems/AudioSystem.js';

// The in-story HUD: a HOME button (top-left) and the live objective line that
// tells the player what to do right now. Scenes call setObjective() as goals
// change; pulse() re-nudges an idle player (game-feel law 7).
export function createStoryHud({ onHome } = {}) {
  const home = document.createElement('button');
  home.type = 'button';
  home.setAttribute('aria-label', 'Home');
  home.textContent = '⌂'; // ⌂
  home.style.cssText = [
    'position:fixed', 'top:calc(12px + env(safe-area-inset-top))', 'left:calc(14px + env(safe-area-inset-left))', 'z-index:40',
    'width:46px', 'height:46px', 'border-radius:12px', 'cursor:pointer',
    'display:flex', 'align-items:center', 'justify-content:center',
    'font-size:23px', 'line-height:1', 'color:#fdf6e3',
    'background:rgba(16,14,26,0.55)', 'border:1px solid rgba(255,255,255,0.14)',
    'backdrop-filter:blur(3px)', 'pointer-events:auto',
    'transition:filter 150ms ease, background 150ms ease',
  ].join(';');
  home.onmouseenter = () => { home.style.background = 'rgba(30,26,44,0.7)'; };
  home.onmouseleave = () => { home.style.background = 'rgba(16,14,26,0.55)'; };
  home.onclick = () => { Audio.uiClick?.(); onHome?.(); };

  // The objective banner — TOP-CENTER, just under the letterbox safe zone so
  // it sits near the player's eye-line. Big, warm-white, glowing, with a small
  // marker icon and a brief pulse on change (ui-clarity). A hint rides under it.
  const obj = document.createElement('div');
  obj.style.cssText = [
    'position:fixed',
    'top:calc(11vh + 12px + env(safe-area-inset-top))', 'left:50%', 'transform:translateX(-50%)', 'z-index:40',
    'max-width:min(90vw,560px)', 'padding:11px 20px', 'border-radius:14px', 'text-align:center',
    'font-family:"Segoe UI",system-ui,sans-serif', 'font-size:clamp(16px,2.4vw,21px)', 'font-weight:600',
    'letter-spacing:0.012em', 'color:#fff3d8', 'line-height:1.3',
    'background:rgba(12,10,20,0.7)', 'border:1px solid rgba(242,184,128,0.42)',
    'backdrop-filter:blur(3px)', 'pointer-events:none',
    'text-shadow:0 0 14px rgba(242,184,128,0.45), 0 1px 3px rgba(0,0,0,0.8)',
    'box-shadow:0 3px 18px rgba(0,0,0,0.35), 0 0 22px rgba(242,184,128,0.14)',
    'opacity:0', 'transition:opacity 350ms ease',
  ].join(';');
  const objRow = document.createElement('div');
  objRow.style.cssText = 'display:flex; align-items:center; justify-content:center; gap:9px;';
  const objIcon = document.createElement('span');
  objIcon.textContent = '✦';
  objIcon.style.cssText = 'font-size:0.9em; color:#ffcf8a; flex:0 0 auto; filter:drop-shadow(0 0 6px rgba(242,184,128,0.6));';
  const objText = document.createElement('div');
  objRow.append(objIcon, objText);
  const objHint = document.createElement('div');
  objHint.style.cssText = 'font-size:0.68em; font-weight:400; opacity:0.8; margin-top:4px; display:none; text-shadow:0 1px 2px rgba(0,0,0,0.7);';
  obj.append(objRow, objHint);

  // Center-screen counter for number quests (🐑 2 / 3) — pops, then fades.
  const counter = document.createElement('div');
  counter.style.cssText = [
    'position:fixed', 'left:50%', 'top:34%', 'transform:translate(-50%,-50%)', 'z-index:41',
    'font-family:"Segoe UI",system-ui,sans-serif', 'font-size:clamp(30px,6vw,52px)', 'font-weight:700',
    'color:#fff3d8', 'letter-spacing:0.04em', 'pointer-events:none', 'white-space:nowrap',
    'text-shadow:0 0 26px rgba(242,184,128,0.55), 0 2px 6px rgba(0,0,0,0.8)',
    'opacity:0', 'transition:opacity 500ms ease',
  ].join(';');

  document.body.append(home, obj, counter);

  let current = '';
  function setObjective(text, hint = '') {
    if (!text) { obj.style.opacity = '0'; current = ''; return; }
    if (text === current) { pulse(); return; }
    current = text;
    // Cross-fade the text so it never hard-swaps.
    obj.style.opacity = '0';
    setTimeout(() => {
      objText.textContent = text;
      objHint.textContent = hint;
      objHint.style.display = hint ? 'block' : 'none';
      obj.style.opacity = '1';
      pulse();
    }, 180);
  }

  function pulse() {
    try {
      // keep translateX(-50%) in every keyframe or the centered banner jumps
      obj.animate(
        [
          { transform: 'translateX(-50%) scale(1)', boxShadow: '0 3px 18px rgba(0,0,0,0.35), 0 0 22px rgba(242,184,128,0.14)' },
          { transform: 'translateX(-50%) scale(1.06)', boxShadow: '0 3px 18px rgba(0,0,0,0.35), 0 0 34px rgba(242,184,128,0.42)' },
          { transform: 'translateX(-50%) scale(1)', boxShadow: '0 3px 18px rgba(0,0,0,0.35), 0 0 22px rgba(242,184,128,0.14)' },
        ],
        { duration: 640, easing: 'ease-in-out' },
      );
    } catch { /* animate() unsupported — no-op */ }
  }

  // flashCount('🐑', 2, 3) — the big center pop for number quests.
  let counterTimer = 0;
  function flashCount(icon, n, total) {
    counter.textContent = `${icon} ${n} / ${total}`;
    counter.style.opacity = '1';
    try {
      counter.animate(
        [
          { transform: 'translate(-50%,-50%) scale(0.85)' },
          { transform: 'translate(-50%,-50%) scale(1.1)', offset: 0.55 },
          { transform: 'translate(-50%,-50%) scale(1)' },
        ],
        { duration: 450, easing: 'cubic-bezier(0.34,1.3,0.64,1)' },
      );
    } catch { /* no-op */ }
    clearTimeout(counterTimer);
    counterTimer = setTimeout(() => { counter.style.opacity = '0'; }, 1400);
  }

  function destroy() {
    clearTimeout(counterTimer);
    home.remove();
    obj.remove();
    counter.remove();
  }

  return { setObjective, pulse, flashCount, destroy, homeButton: home, objectiveEl: obj, counterEl: counter };
}
