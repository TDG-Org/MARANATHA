import { Narrator } from '../systems/Narrator.js';

// The scripture surface for 3D scenes (core game pillar): translation-exact
// verse text + reference, gently faded in, narrated (file-first VO via lineId),
// tap-to-skip after a moment, never blocking gameplay UI. Pass verse objects
// ({ ref, text, vo }) from the scene's verse data — the card renders exactly
// what it's given (wording is verified at the data layer).
export function createVerseCard() {
  const panel = document.createElement('div');
  panel.style.cssText = [
    'position:fixed', 'left:50%', 'top:calc(10% + env(safe-area-inset-top))',
    'transform:translateX(-50%) translateY(-8px)', 'z-index:38',
    'width:min(88vw,600px)', 'padding:14px 22px', 'text-align:center',
    'background:rgba(12,10,20,0.68)', 'border:1px solid rgba(242,184,128,0.2)',
    'border-radius:13px', 'backdrop-filter:blur(3px)', 'box-shadow:0 6px 24px rgba(0,0,0,0.35)',
    'opacity:0', 'transition:opacity 700ms ease, transform 700ms ease', 'pointer-events:none',
  ].join(';');

  const textEl = document.createElement('div');
  textEl.style.cssText = [
    'font-family:Georgia,"Times New Roman",serif', 'font-style:italic',
    'font-size:clamp(14.5px,2vw,18px)', 'line-height:1.55', 'color:#f5e6c4',
  ].join(';');
  const refEl = document.createElement('div');
  refEl.style.cssText = [
    'font-family:"Segoe UI",system-ui,sans-serif', 'font-size:clamp(10.5px,1.3vw,12px)',
    'letter-spacing:0.16em', 'opacity:0.64', 'margin-top:7px', 'color:#f5e6c4', 'text-transform:uppercase',
  ].join(';');
  panel.append(textEl, refEl);
  document.body.append(panel);

  function show(verse, { narrate = true, holdMs = 0 } = {}) {
    if (!verse || !verse.text) return Promise.resolve();
    textEl.textContent = `“${verse.text}”`;
    refEl.textContent = verse.ref || '';
    panel.style.opacity = '1';
    panel.style.transform = 'translateX(-50%) translateY(0)';

    if (!narrate) return holdMs ? new Promise((r) => setTimeout(r, holdMs)) : Promise.resolve();

    return new Promise((done) => {
      let finished = false;
      let skipEnabled = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        window.removeEventListener('pointerdown', onTap);
        done();
      };
      const onTap = () => { if (skipEnabled) { Narrator.skip(); finish(); } };
      setTimeout(() => { skipEnabled = true; window.addEventListener('pointerdown', onTap); }, 1200);
      Narrator.speak(verse.text, verse.vo || null).then(finish);
    });
  }

  function hide() {
    panel.style.opacity = '0';
    panel.style.transform = 'translateX(-50%) translateY(-8px)';
  }

  return { show, hide, el: panel, destroy() { hide(); panel.remove(); } };
}
