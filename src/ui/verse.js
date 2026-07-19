import { Narrator } from '../systems/Narrator.js';
import { VERSES } from '../data/verses.js';

// The Scripture panel — every beat shows its real BSB verse, subtle but always
// legible (≥4.5:1), narrated fully before the beat advances, tap-to-skip after
// a moment (scripture-accuracy + game-scene skills). One source of truth for
// verse text is src/data/verses.js — pass a key or an explicit { ref, text }.
export function createVerseDisplay() {
  const panel = document.createElement('div');
  panel.style.cssText = [
    'position:fixed', 'left:50%', 'top:11%', 'transform:translateX(-50%) translateY(-8px)',
    'z-index:38', 'width:min(90vw,560px)', 'padding:13px 20px', 'text-align:center',
    'background:rgba(16,14,26,0.72)', 'border:1px solid rgba(242,184,128,0.16)',
    'border-radius:13px', 'box-shadow:0 6px 22px rgba(0,0,0,0.3)', /* D9: no backdrop-filter over a live canvas */
    'opacity:0', 'transition:opacity 600ms ease, transform 600ms ease', 'pointer-events:none',
  ].join(';');

  const textEl = document.createElement('div');
  textEl.style.cssText = [
    'font-family:Georgia,"Times New Roman",serif', 'font-style:italic',
    'font-size:clamp(15px,2.1vw,18px)', 'line-height:1.5', 'color:#f5e6c4',
  ].join(';');

  const refEl = document.createElement('div');
  refEl.style.cssText = [
    'font-family:"Segoe UI",system-ui,sans-serif', 'font-size:12px',
    'letter-spacing:0.12em', 'opacity:0.66', 'margin-top:7px', 'color:#f5e6c4',
  ].join(';');

  panel.append(textEl, refEl);
  document.body.append(panel);

  function show(verse, { narrate = true } = {}) {
    const v = typeof verse === 'string' ? VERSES[verse] : verse;
    if (!v) { console.warn('[verse] unknown verse', verse); return Promise.resolve(); }
    textEl.textContent = `“${v.text}”`;
    refEl.textContent = v.ref;
    panel.style.opacity = '1';
    panel.style.transform = 'translateX(-50%) translateY(0)';

    if (!narrate) return Promise.resolve();

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
      Narrator.speak(v.text).then(finish);
    });
  }

  function hide() {
    panel.style.opacity = '0';
    panel.style.transform = 'translateX(-50%) translateY(-8px)';
  }

  return { show, hide, destroy() { hide(); panel.remove(); }, el: panel };
}
