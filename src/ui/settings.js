import { Audio } from '../systems/AudioSystem.js';
import { Settings } from '../systems/Settings.js';
import { Narrator } from '../systems/Narrator.js';
import { Graphics, GRAPHICS_PRESETS } from '../systems/Graphics.js';
import { resetProgress } from '../systems/SaveSystem.js';
import { confirmModal, isModalOpen } from './modal.js';

// The Settings panel: four audio channels (Master / Music / SFX / Narrator),
// the perf-HUD toggle, and a Reset-progress button behind an "Are you sure?".
let settingsOpen = false; // singleton: a double-tap must not stack two panels
export function openSettings({ onReset } = {}) {
  if (settingsOpen) return Promise.resolve();
  settingsOpen = true;
  let requestClose = null; // set once the close machinery exists (bottom)
  Audio.unlock(); // ensure the graph exists so slider changes are audible

  const backdrop = document.createElement('div');
  backdrop.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:65', 'display:flex',
    'align-items:center', 'justify-content:center',
    'background:rgba(8,7,14,0.72)',
    'opacity:0', 'transition:opacity 220ms ease',
  ].join(';');

  const panel = document.createElement('div');
  panel.style.cssText = [
    'width:min(92vw,420px)', 'max-height:88vh', 'overflow:auto', 'margin:20px',
    'padding:22px 24px', 'background:rgba(16,14,26,0.95)',
    'border:1px solid rgba(242,184,128,0.18)', 'border-radius:16px',
    'box-shadow:0 16px 48px rgba(0,0,0,0.5)', 'color:#fdf6e3',
    'transform:translateY(10px)', 'transition:transform 220ms ease',
    'position:relative', // the corner dismiss anchors here, not to the backdrop
  ].join(';');

  const title = document.createElement('div');
  title.textContent = 'Settings';
  title.style.cssText = 'font-family:Georgia,serif; font-size:22px; margin-bottom:18px; text-align:center;';
  panel.append(title);

  // The dismiss everyone reaches for first. Esc, the backdrop and the bar at
  // the bottom all still work; this is simply where a person looks.
  const dismiss = document.createElement('button');
  dismiss.type = 'button';
  dismiss.className = 'mr-dismiss'; // coarse-pointer 44px floor (index.html)
  dismiss.setAttribute('aria-label', 'Close settings');
  dismiss.textContent = '✕';
  dismiss.style.cssText = [
    'position:absolute', 'top:12px', 'right:12px',
    'width:34px', 'height:34px', 'border-radius:10px', 'padding:0',
    'display:flex', 'align-items:center', 'justify-content:center',
    'font:400 16px/1 "Segoe UI",system-ui,sans-serif', 'color:#fdf6e3',
    'background:transparent', 'border:1px solid rgba(255,255,255,0.14)',
    'cursor:pointer', 'transition:background 150ms ease,border-color 150ms ease',
  ].join(';');
  dismiss.onpointerenter = () => {
    dismiss.style.background = 'rgba(255,255,255,0.09)';
    dismiss.style.borderColor = 'rgba(255,232,190,0.55)';
  };
  dismiss.onpointerleave = () => {
    dismiss.style.background = 'transparent';
    dismiss.style.borderColor = 'rgba(255,255,255,0.14)';
  };
  panel.append(dismiss);

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
      // On release, speak a short sample so the level is verifiable — the real
      // baked narrator voice (audio/vo/ui/voice-test.mp3), not TTS.
      () => Narrator.speak('The Lord was with Joseph.', 'ui/voice-test'),
    ),
  );

  // --- Graphics Quality (Low / Medium / High) ---
  const gfxWrap = document.createElement('div');
  gfxWrap.style.cssText = 'margin:20px 0 6px; font-family:"Segoe UI",system-ui,sans-serif;';
  const gfxHead = document.createElement('div');
  gfxHead.style.cssText = 'display:flex; justify-content:space-between; font-size:13.5px; margin-bottom:8px; opacity:0.9;';
  const gfxName = document.createElement('span'); gfxName.textContent = 'Graphics quality';
  const gfxHint = document.createElement('span');
  gfxHint.style.cssText = 'font-size:11.5px; opacity:0.6;';
  gfxHead.append(gfxName, gfxHint);
  const gfxRow = document.createElement('div');
  gfxRow.style.cssText = 'display:flex; gap:8px;';
  const gfxBtns = {};
  const paintGfx = () => {
    Object.entries(gfxBtns).forEach(([k, b]) => {
      const on = Graphics.name === k;
      b.style.background = on ? '#f2b880' : 'rgba(255,255,255,0.06)';
      b.style.color = on ? '#241f38' : '#fdf6e3';
      b.style.fontWeight = on ? '700' : '500';
    });
    // D14: say plainly whether the game is choosing (and that it self-corrects)
    // or the player has taken over.
    gfxHint.textContent = Graphics.autoDetected
      ? `auto — set to ${Graphics.preset.label} for this device`
      : 'your choice · applied now';
  };
  Object.keys(GRAPHICS_PRESETS).forEach((key) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = GRAPHICS_PRESETS[key].label;
    b.style.cssText = [
      'flex:1', 'padding:9px 0', 'border-radius:9px', 'cursor:pointer',
      'font:600 13px "Segoe UI",system-ui,sans-serif',
      'border:1px solid rgba(242,184,128,0.4)', 'transition:filter 140ms ease',
    ].join(';');
    b.onclick = () => { Audio.uiClick?.(); Graphics.set(key); paintGfx(); };
    gfxBtns[key] = b;
    gfxRow.append(b);
  });
  // "why do i have to reload for it to apply, the user shouldnt have to do
  // that". He shouldn't, and now he doesn't: resolution, particle density,
  // character shadows, fog distance and texture filtering all move the moment
  // a preset is pressed. Two flags genuinely cannot — MSAA and which GPU the
  // canvas asks for are fixed when the WebGL context is created — so say
  // exactly that, in small print, instead of a blanket "fully applies after a
  // reload" that made the whole setting look broken.
  const gfxNote = document.createElement('div');
  gfxNote.style.cssText = 'margin-top:7px; font-size:11px; line-height:1.45; opacity:0.5;';
  gfxNote.textContent = 'Changes apply straight away. Edge smoothing, and which chip a '
    + 'two-GPU laptop uses, settle on the next launch.';
  gfxWrap.append(gfxHead, gfxRow, gfxNote);
  panel.append(gfxWrap);
  paintGfx();

  // --- Colour grade (the one full-screen cost the fps counter cannot see) ----
  // The rich look is a CSS filter over the live canvas. Unlike everything else
  // in here it runs in the COMPOSITOR at the screen's own resolution, so the
  // Graphics preset's pixel-ratio cap cannot touch it and `#debug` never counts
  // it — it shows up only as frames that do not arrive. Two performance audits
  // ranked it the single largest remaining cost in the game.
  //
  // It is a real look, tuned over many passes, so it is not something to remove
  // behind Nate's back. It is a switch, it applies instantly with no reload, and
  // flipping it while watching #debug answers "is this what is costing me?" in
  // about five seconds.
  const gradeWrap = document.createElement('div');
  gradeWrap.style.cssText = 'margin:16px 0 6px; font-family:"Segoe UI",system-ui,sans-serif;';
  const gradeHead = document.createElement('div');
  gradeHead.style.cssText = 'display:flex; justify-content:space-between; font-size:13.5px; margin-bottom:8px; opacity:0.9;';
  const gradeName = document.createElement('span'); gradeName.textContent = 'Colour grade';
  const gradeHint = document.createElement('span');
  gradeHint.style.cssText = 'font-size:11.5px; opacity:0.6;';
  gradeHead.append(gradeName, gradeHint);
  const gradeRow = document.createElement('div');
  gradeRow.style.cssText = 'display:flex; gap:8px;';
  const gradeBtns = {};
  const paintGrade = () => {
    const on = Graphics.colourGrade;
    Object.entries(gradeBtns).forEach(([k, b]) => {
      const sel = (k === 'on') === on;
      b.style.background = sel ? '#f2b880' : 'rgba(255,255,255,0.06)';
      b.style.color = sel ? '#241f38' : '#fdf6e3';
      b.style.fontWeight = sel ? '700' : '500';
    });
    gradeHint.textContent = on ? 'richer colour · costs a full-screen pass' : 'off · cheapest, plainer colour';
  };
  [['on', 'Rich'], ['off', 'Off (faster)']].forEach(([key, label]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.style.cssText = [
      'flex:1', 'padding:9px 0', 'border-radius:9px', 'cursor:pointer', 'min-height:44px',
      'font:600 13px "Segoe UI",system-ui,sans-serif',
      'border:1px solid rgba(242,184,128,0.4)', 'transition:filter 140ms ease',
    ].join(';');
    b.onclick = () => { Audio.uiClick?.(); Graphics.setColourGrade(key === 'on'); paintGrade(); };
    gradeBtns[key] = b;
    gradeRow.append(b);
  });
  gradeWrap.append(gradeHead, gradeRow);
  panel.append(gradeWrap);
  paintGrade();

  // --- Frame rate (the biggest power dial in the app) -----------------------
  // A frame costs GPU work, compositor work and a wake-up. The game used to ask
  // for the panel's own rate, so a 144Hz monitor got 144 frames a second of a
  // slow painterly scene — two to three times the power for something nobody
  // can see here. Every option below still lands on a whole number of refreshes,
  // so none of them judder; they just differ in how many of those frames the
  // machine is asked to draw.
  const rateWrap = document.createElement('div');
  rateWrap.style.cssText = 'margin:16px 0 6px; font-family:"Segoe UI",system-ui,sans-serif;';
  const rateHead = document.createElement('div');
  rateHead.style.cssText = 'display:flex; justify-content:space-between; font-size:13.5px; margin-bottom:8px; opacity:0.9;';
  const rateName = document.createElement('span'); rateName.textContent = 'Frame rate';
  const rateHint = document.createElement('span');
  rateHint.style.cssText = 'font-size:11.5px; opacity:0.6;';
  rateHead.append(rateName, rateHint);
  const rateRow = document.createElement('div');
  rateRow.style.cssText = 'display:flex; gap:8px;';
  const RATE_LABELS = {
    saver: ['Saver', 'coolest and quietest'],
    balanced: ['Balanced', 'smooth, and about half the power of Maximum'],
    max: ['Maximum', 'every frame your screen can show — much more power'],
  };
  const rateBtns = {};
  const paintRate = () => {
    Object.entries(rateBtns).forEach(([k, b]) => {
      const on = Graphics.frameRate === k;
      b.style.background = on ? '#f2b880' : 'rgba(255,255,255,0.06)';
      b.style.color = on ? '#241f38' : '#fdf6e3';
      b.style.fontWeight = on ? '700' : '500';
    });
    rateHint.textContent = RATE_LABELS[Graphics.frameRate]?.[1] || '';
  };
  Object.keys(RATE_LABELS).forEach((key) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = RATE_LABELS[key][0];
    b.style.cssText = [
      'flex:1', 'padding:9px 0', 'border-radius:9px', 'cursor:pointer', 'min-height:44px',
      'font:600 13px "Segoe UI",system-ui,sans-serif',
      'border:1px solid rgba(242,184,128,0.4)', 'transition:filter 140ms ease',
    ].join(';');
    b.onclick = () => { Audio.uiClick?.(); Graphics.setFrameRate(key); paintRate(); };
    rateBtns[key] = b;
    rateRow.append(b);
  });
  rateWrap.append(rateHead, rateRow);
  panel.append(rateWrap);
  paintRate();

  // --- Backdrop (the home map's time of day) --------------------------------
  // Nate: "allow the user in the settings to change the background, and toggle
  // off 'match with time of day' and all that!" Auto follows the clock; picking
  // a sky pins it so the map stops changing under the player. It applies the
  // next time the map is built, which is said plainly rather than implied.
  const SKIES = [
    ['auto', 'Auto'], ['dawn', 'Dawn'], ['day', 'Day'], ['dusk', 'Dusk'], ['night', 'Night'],
  ];
  const skyWrap = document.createElement('div');
  skyWrap.style.cssText = 'margin:20px 0 6px; font-family:"Segoe UI",system-ui,sans-serif;';
  const skyHead = document.createElement('div');
  skyHead.style.cssText = 'display:flex; justify-content:space-between; font-size:13.5px; margin-bottom:8px; opacity:0.9;';
  const skyName = document.createElement('span'); skyName.textContent = 'Map backdrop';
  const skyHint = document.createElement('span');
  skyHint.style.cssText = 'font-size:11.5px; opacity:0.6;';
  skyHead.append(skyName, skyHint);
  const skyRow = document.createElement('div');
  skyRow.style.cssText = 'display:flex; gap:6px; flex-wrap:wrap;';
  const skyBtns = {};
  const paintSky = () => {
    const cur = Settings.get('sky') || 'auto';
    Object.entries(skyBtns).forEach(([k, b]) => {
      const on = cur === k;
      b.style.background = on ? '#f2b880' : 'rgba(255,255,255,0.06)';
      b.style.color = on ? '#241f38' : '#fdf6e3';
      b.style.fontWeight = on ? '700' : '500';
    });
    skyHint.textContent = cur === 'auto'
      ? 'matching the time of day'
      : 'your choice · shows next time the map opens';
  };
  SKIES.forEach(([key, label]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.style.cssText = [
      'flex:1 0 auto', 'min-width:58px', 'padding:8px 6px', 'border-radius:9px', 'cursor:pointer',
      'font:600 12.5px "Segoe UI",system-ui,sans-serif',
      'border:1px solid rgba(242,184,128,0.4)', 'transition:filter 140ms ease',
    ].join(';');
    b.onclick = () => { Audio.uiClick?.(); Settings.set('sky', key); paintSky(); };
    skyBtns[key] = b;
    skyRow.append(b);
  });
  skyWrap.append(skyHead, skyRow);
  panel.append(skyWrap);
  paintSky();

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
      // Close BEFORE the onReset rebuild: a fresh home mounted under the
      // open panel is a non-inert sibling — containment and focus-return
      // both broke in the one flow Settings itself owns.
      requestClose?.();
      onReset?.();
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

  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', 'Settings');
  backdrop.append(panel);
  document.body.append(backdrop);
  // Focus containment: whatever sits behind (home UI, the pause menu) leaves
  // the tab order while the panel is up; focus starts on the dismiss and
  // returns to the opener on close (accessibility law).
  const opener = document.activeElement;
  const inerted = [];
  for (const el of document.body.children) {
    if (el === backdrop || el.inert) continue;
    el.inert = true;
    inerted.push(el);
  }
  dismiss.focus();
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
      settingsOpen = false;
      Audio.uiClick();
      inerted.forEach((el) => { el.inert = false; });
      backdrop.style.opacity = '0';
      panel.style.transform = 'translateY(10px)';
      window.removeEventListener('keydown', onKey, true);
      setTimeout(() => {
        backdrop.remove();
        opener?.focus?.();
        resolve();
      }, 220);
    };
    const onKey = (e) => {
      if (isModalOpen()) return; // a confirm modal above us owns Esc/Enter
      if (e.key === 'Escape') { e.stopImmediatePropagation(); doClose(); }
    };
    requestClose = doClose; // the Reset flow closes the panel before rebuilding
    close.onclick = doClose;
    dismiss.onclick = doClose;
    backdrop.onclick = (e) => { if (e.target === backdrop) doClose(); };
    // capture phase: Settings' Esc wins over any game/pause Esc handling
    window.addEventListener('keydown', onKey, true);
  });
}
