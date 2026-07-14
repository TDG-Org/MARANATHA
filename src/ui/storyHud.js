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
    'position:fixed', 'top:12px', 'left:14px', 'z-index:40',
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

  const obj = document.createElement('div');
  obj.style.cssText = [
    'position:fixed', 'top:17px', 'left:72px', 'z-index:40',
    'max-width:min(64vw,420px)', 'padding:9px 14px', 'border-radius:11px',
    'font-family:"Segoe UI",system-ui,sans-serif', 'font-size:13.5px',
    'letter-spacing:0.01em', 'color:#f7edd8',
    'background:rgba(16,14,26,0.5)', 'border:1px solid rgba(242,184,128,0.16)',
    'backdrop-filter:blur(3px)', 'pointer-events:none',
    'opacity:0', 'transition:opacity 350ms ease', 'box-shadow:0 3px 14px rgba(0,0,0,0.28)',
  ].join(';');

  document.body.append(home, obj);

  let current = '';
  function setObjective(text) {
    if (!text) { obj.style.opacity = '0'; current = ''; return; }
    if (text === current) { pulse(); return; }
    current = text;
    // Cross-fade the text so it never hard-swaps.
    obj.style.opacity = '0';
    setTimeout(() => {
      obj.textContent = text;
      obj.style.opacity = '1';
      pulse();
    }, 180);
  }

  function pulse() {
    try {
      obj.animate(
        [{ transform: 'scale(1)' }, { transform: 'scale(1.045)' }, { transform: 'scale(1)' }],
        { duration: 640, easing: 'ease-in-out' },
      );
    } catch { /* animate() unsupported — no-op */ }
  }

  function destroy() {
    home.remove();
    obj.remove();
  }

  return { setObjective, pulse, destroy, homeButton: home, objectiveEl: obj };
}
