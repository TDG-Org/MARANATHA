import { Audio } from '../../systems/AudioSystem.js';

// A DELIBERATELY TINY HUD.
//
// There is no story in this scene yet, so there is nothing to tell the player
// except how to move and where they are standing. Everything else would be
// furniture. The readout earns its place because in a 137 m interior with three
// identical-looking decks, "which deck am I on" is a real question.

const BTN = [
  'pointer-events:auto',
  'font:600 clamp(12px,1.5vw,13.5px) "Segoe UI",system-ui,sans-serif',
  'min-width:44px', 'min-height:44px',   // coarse-pointer floor (accessibility)
  'padding:10px 15px', 'border-radius:11px', 'cursor:pointer', 'color:#f6efe0',
  'background:rgba(18,16,13,0.55)', 'border:1px solid rgba(214,178,120,0.30)',
  'transition:filter 150ms ease',
].join(';');

function mkBtn(label, title, onClick) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  b.setAttribute('aria-label', title);
  b.title = title;
  b.style.cssText = BTN;
  b.onmouseenter = () => { b.style.filter = 'brightness(1.2)'; };
  b.onmouseleave = () => { b.style.filter = 'none'; };
  b.onclick = () => { Audio.uiClick?.(); onClick(); };
  return b;
}

const DECK_NAMES = {
  deck1: 'Lower deck',
  deck2: 'Second deck',
  deck3: 'Third deck',
  ramp12: 'Ramp — lower to second',
  ramp23: 'Ramp — second to third',
  boarding: 'Boarding ramp',
};

export function buildHud({ onHome, onSettings }) {
  const root = document.createElement('div');
  root.style.cssText = 'position:fixed; inset:0; z-index:24; pointer-events:none; font-family:"Segoe UI",system-ui,sans-serif; color:#f6efe0; text-shadow:0 1px 3px rgba(0,0,0,0.55);';

  const title = document.createElement('div');
  title.innerHTML = 'THE ARK <span style="opacity:0.55; font-weight:400">— Genesis 6</span>';
  title.style.cssText = 'position:fixed; top:calc(14px + env(safe-area-inset-top)); left:0; right:0; text-align:center; font-size:clamp(13px,2vw,17px); letter-spacing:0.16em; opacity:0.9;';

  const hint = document.createElement('div');
  hint.textContent = 'WASD or arrows to walk · Shift to run · walk up the ramp and in through the door';
  hint.style.cssText = 'position:fixed; top:calc(42px + env(safe-area-inset-top)); left:0; right:0; text-align:center; font-size:clamp(10px,1.4vw,12.5px); opacity:0.62; padding:0 16px;';

  // Where you are. Polite live region: it changes rarely (only on a real deck
  // change), so a screen reader announcing it is useful rather than a firehose.
  const readout = document.createElement('div');
  readout.setAttribute('aria-live', 'polite');
  readout.style.cssText = 'position:fixed; left:0; right:0; bottom:calc(22px + env(safe-area-inset-bottom)); text-align:center; font-size:clamp(11px,1.6vw,14px); letter-spacing:0.08em; opacity:0.8;';

  const home = mkBtn('⌂', 'Return home', onHome);
  home.style.cssText += ';position:fixed; top:calc(12px + env(safe-area-inset-top)); left:calc(14px + env(safe-area-inset-left));';
  const gear = mkBtn('⚙', 'Settings', onSettings);
  gear.style.cssText += ';position:fixed; top:calc(12px + env(safe-area-inset-top)); right:calc(14px + env(safe-area-inset-right));';

  root.append(title, hint, readout, home, gear);
  document.body.append(root);

  let lastLabel = null;
  let hintHidden = false;

  return {
    // Called every frame, so it writes to the DOM only when the text would
    // actually change (a layout pass per frame for a label that says the same
    // thing is the exact cost this project keeps hunting down).
    setReadout(pos, deck, insideK) {
      const label = insideK > 0.5
        ? (DECK_NAMES[deck] || 'Aboard')
        : (deck === 'boarding' ? DECK_NAMES.boarding : 'The building site');
      if (label !== lastLabel) {
        lastLabel = label;
        readout.textContent = label;
      }
      // Once they are aboard they have plainly worked out the controls.
      if (!hintHidden && insideK > 0.6) {
        hintHidden = true;
        hint.style.transition = 'opacity 700ms ease';
        hint.style.opacity = '0';
      }
    },
    destroy() { root.remove(); },
  };
}
