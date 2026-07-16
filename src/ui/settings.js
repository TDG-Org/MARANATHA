import { Audio } from '../systems/AudioSystem.js';
import { Settings } from '../systems/Settings.js';
import { Narrator } from '../systems/Narrator.js';
import { resetProgress } from '../systems/SaveSystem.js';
import { confirmModal } from './modal.js';

// The Settings panel: four audio channels (Master / Music / SFX / Narrator),
// the perf-HUD toggle, and a Reset-progress button behind an "Are you sure?".
export function openSettings({ onReset } = {}) {
  Audio.unlock(); // ensure the graph exists so slider changes are audible

  const backdrop = document.createElement('div');
  backdrop.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:65', 'display:flex',
    'align-items:center', 'justify-content:center',
    'background:rgba(8,7,14,0.55)', 'backdrop-filter:blur(2px)',
    'opacity:0', 'transition:opacity 220ms ease',
  ].join(';');

  const panel = document.createElement('div');
  panel.style.cssText = [
    'width:min(92vw,420px)', 'max-height:88vh', 'overflow:auto', 'margin:20px',
    'padding:22px 24px', 'background:rgba(16,14,26,0.95)',
    'border:1px solid rgba(242,184,128,0.18)', 'border-radius:16px',
    'box-shadow:0 16px 48px rgba(0,0,0,0.5)', 'color:#fdf6e3',
    'transform:translateY(10px)', 'transition:transform 220ms ease',
  ].join(';');

  const title = document.createElement('div');
  title.textContent = 'Settings';
  title.style.cssText = 'font-family:Georgia,serif; font-size:22px; margin-bottom:18px; text-align:center;';
  panel.append(title);

  // --- a labelled slider row ---
  const sliderRow = (label, getValue, onInput, onChange) => {
    const row = document.createElement('div');
    row.style.cssText = 'margin:14px 0; font-family:"Segoe UI",system-ui,sans-serif;';
    const head = document.createElement('div');
    head.style.cssText = 'display:flex; justify-content:space-between; font-size:13.5px; margin-bottom:6px; opacity:0.9;';
    const name = document.createElement('span'); name.textContent = label;
    const val = document.createElement('span');
    const input = document.createElement('input');
    input.type = 'range'; input.min = '0'; input.max = '100'; input.step = '1';
    input.value = String(Math.round(getValue() * 100));
    input.setAttribute('aria-label', label);
    input.style.cssText = 'width:100%; height:26px; accent-color:#f2b880; cursor:pointer; background:transparent;';
    val.textContent = `${input.value}%`;
    input.addEventListener('input', () => {
      const v = Number(input.value) / 100;
      val.textContent = `${input.value}%`;
      onInput(v);
    });
    if (onChange) input.addEventListener('change', () => onChange(Number(input.value) / 100));
    head.append(name, val);
    row.append(head, input);
    return row;
  };

  panel.append(
    sliderRow('Master', () => Settings.master, (v) => Settings.setMaster(v)),
    sliderRow('Music', () => Settings.get('music'), (v) => Settings.set('music', v)),
    sliderRow('Sound effects', () => Settings.get('sfx'), (v) => { Settings.set('sfx', v); Audio.uiClick(); }),
    sliderRow(
      'Narrator', () => Settings.get('voice'),
      (v) => Settings.set('voice', v),
      // On release, speak a short sample so the level is verifiable.
      () => Narrator.speak('The Lord was with Joseph.'),
    ),
  );

  // --- HUD toggle ---
  const hudRow = document.createElement('label');
  hudRow.style.cssText = [
    'display:flex', 'align-items:center', 'justify-content:space-between',
    'gap:10px', 'margin:18px 0 6px', 'font-family:"Segoe UI",system-ui,sans-serif',
    'font-size:13.5px', 'cursor:pointer',
  ].join(';');
  const hudText = document.createElement('span');
  hudText.textContent = 'Show performance meter';
  const hudBox = document.createElement('input');
  hudBox.type = 'checkbox';
  hudBox.checked = !!Settings.get('hud');
  hudBox.style.cssText = 'width:20px; height:20px; accent-color:#f2b880; cursor:pointer;';
  hudBox.addEventListener('change', () => Settings.set('hud', hudBox.checked));
  hudRow.append(hudText, hudBox);
  panel.append(hudRow);

  // --- Reset progress ---
  const reset = document.createElement('button');
  reset.type = 'button';
  reset.textContent = 'Reset progress';
  reset.style.cssText = [
    'width:100%', 'margin-top:16px', 'padding:11px', 'border-radius:10px',
    'font-family:"Segoe UI",system-ui,sans-serif', 'font-size:13.5px', 'cursor:pointer',
    'background:rgba(200,90,80,0.12)', 'color:#f4c9c2',
    'border:1px solid rgba(200,90,80,0.4)', 'transition:filter 150ms ease',
  ].join(';');
  reset.onmouseenter = () => { reset.style.filter = 'brightness(1.1)'; };
  reset.onmouseleave = () => { reset.style.filter = 'none'; };
  reset.onclick = async () => {
    const ok = await confirmModal({
      title: 'Reset all progress?',
      body: 'This clears every completed story and starts you over. This cannot be undone.',
      confirmText: 'Reset',
      cancelText: 'Keep my progress',
    });
    if (ok) {
      resetProgress();
      onReset?.();
      reset.textContent = 'Progress reset';
      setTimeout(() => { reset.textContent = 'Reset progress'; }, 1600);
    }
  };
  panel.append(reset);

  // --- Close ---
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = 'Close';
  close.style.cssText = [
    'width:100%', 'margin-top:10px', 'padding:11px', 'border-radius:10px',
    'font-family:"Segoe UI",system-ui,sans-serif', 'font-size:14px', 'cursor:pointer',
    'background:#f2b880', 'color:#241f38', 'border:none', 'font-weight:600',
  ].join(';');
  panel.append(close);

  backdrop.append(panel);
  document.body.append(backdrop);
  requestAnimationFrame(() => {
    backdrop.style.opacity = '1';
    panel.style.transform = 'translateY(0)';
  });

  // Resolves when the panel closes (the pause menu awaits this so its own
  // Esc handling stays out of the way while Settings is up).
  return new Promise((resolve) => {
    let closed = false;
    const doClose = () => {
      if (closed) return;
      closed = true;
      Audio.uiClick();
      backdrop.style.opacity = '0';
      panel.style.transform = 'translateY(10px)';
      window.removeEventListener('keydown', onKey, true);
      setTimeout(() => { backdrop.remove(); resolve(); }, 220);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopImmediatePropagation(); doClose(); }
    };
    close.onclick = doClose;
    backdrop.onclick = (e) => { if (e.target === backdrop) doClose(); };
    // capture phase: Settings' Esc wins over any game/pause Esc handling
    window.addEventListener('keydown', onKey, true);
  });
}
