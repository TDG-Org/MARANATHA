import { Narrator } from '../systems/Narrator.js';
import { pausableWait } from '../engine/Sequencer.js';

// The scripture surface for 3D scenes (core game pillar): translation-exact
// verse text + reference, gently faded in, narrated (file-first VO via lineId),
// never blocking gameplay UI. Skipping a line is the Skip BUTTON's job alone
// (cutscene-director rule) — stray clicks do nothing here. Pass verse objects
// ({ ref, text, vo }) from the scene's verse data — the card renders exactly
// what it's given (wording is verified at the data layer).
//
// Position: clamped into the letterbox SAFE ZONE — the top edge always clears
// the 11vh cinema bar (whichever is lower: 10% or bar + gap), and max-height
// keeps the card off the bottom bar on short viewports.
export function createVerseCard({ signal = null, isPaused = null } = {}) {
  const panel = document.createElement('div');
  panel.className = 'mr-versecard'; // D8: compact phone sizing lives in index.html
  panel.style.cssText = [
    'position:fixed', 'left:50%',
    'top:max(calc(10% + env(safe-area-inset-top)), calc(11vh + 14px))',
    'transform:translateX(-50%) translateY(-8px)', 'z-index:38',
    'width:min(88vw,600px)', 'padding:14px 22px', 'text-align:center',
    'max-height:calc(74vh - 42px)', 'overflow-y:auto',
    'background:rgba(12,10,20,0.68)', 'border:1px solid rgba(242,184,128,0.2)',
    'border-radius:13px', 'box-shadow:0 6px 24px rgba(0,0,0,0.35)', /* D9: no backdrop-filter over a live canvas */
    'opacity:0', 'transition:opacity 700ms ease, transform 700ms ease', 'pointer-events:none',
  ].join(';');

  const textEl = document.createElement('div');
  textEl.className = 'mr-verse-text';
  textEl.style.cssText = [
    'font-family:Georgia,"Times New Roman",serif', 'font-style:italic',
    'font-size:clamp(14.5px,2vw,18px)', 'line-height:1.55', 'color:#f5e6c4',
  ].join(';');
  const refEl = document.createElement('div');
  refEl.className = 'mr-verse-ref';
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

    if (!narrate) return pausableWait(holdMs, isPaused, signal);

    // The awaited line ends when narration ends — or when the Skip BUTTON
    // resolves it through Narrator.skip(). No other input can end it.
    return Narrator.speak(verse.text, verse.vo || null, { signal });
  }

  function hide() {
    panel.style.opacity = '0';
    panel.style.transform = 'translateX(-50%) translateY(-8px)';
  }

  return { show, hide, el: panel, destroy() { hide(); panel.remove(); } };
}
