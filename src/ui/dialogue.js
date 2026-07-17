import { Audio } from '../systems/AudioSystem.js';

// Dialogue popups. Every line shows WHO is speaking (storyteller skill: the
// player must always know who each person is). Text types on; the first
// advance completes the reveal, the next resolves.
//
// QoL (D4): a ◀ button (and Backspace / ←) re-reads earlier lines of the
// CURRENT conversation. This is text history ONLY — the game never rewinds;
// advancing steps forward through the history back to the live line, then a
// further advance resolves it. History clears when the box hides.
//
//   const dlg = createDialogue();
//   await dlg.say('Jacob', 'You are my beloved son.', { color: '#d9a86a' });
//
// The scene freezes the player controller while dialogue is open.

// D6: WHO is speaking is also told by the BOX itself — each speaker gets a
// signature dark background + border (name color + box color together = zero
// confusion). Joseph = dark blue · Jacob = dark green · each brother a
// DISTINCT dark red · anyone else keeps the neutral style.
const SPEAKER_STYLES = {
  Joseph: { bg: 'rgba(13, 24, 48, 0.92)', border: 'rgba(120, 160, 230, 0.38)' },
  Jacob: { bg: 'rgba(11, 32, 20, 0.92)', border: 'rgba(120, 200, 150, 0.35)' },
  Reuben: { bg: 'rgba(52, 14, 12, 0.93)', border: 'rgba(230, 130, 110, 0.35)' },
  Judah: { bg: 'rgba(44, 10, 16, 0.93)', border: 'rgba(225, 110, 130, 0.35)' },
  Simeon: { bg: 'rgba(38, 12, 8, 0.93)', border: 'rgba(220, 125, 95, 0.35)' },
  Levi: { bg: 'rgba(46, 16, 24, 0.93)', border: 'rgba(225, 120, 150, 0.35)' },
};
const NEUTRAL_STYLE = { bg: 'rgba(16,14,26,0.9)', border: 'rgba(242,184,128,0.22)' };

export function createDialogue() {
  const box = document.createElement('div');
  box.style.cssText = [
    'position:fixed', 'left:50%', 'bottom:calc(26px + env(safe-area-inset-bottom))', 'transform:translateX(-50%) translateY(12px)',
    // D6 mobile pass: wider on phones (96vw), same cap on desktop.
    // border-box: the padding lives INSIDE the width — content-box pushed the
    // box 13px off each side of a 375px phone.
    'box-sizing:border-box', 'z-index:45', 'width:min(96vw,640px)', 'padding:16px 20px 14px',
    `background:${NEUTRAL_STYLE.bg}`, `border:1px solid ${NEUTRAL_STYLE.border}`,
    'border-radius:14px', 'box-shadow:0 12px 40px rgba(0,0,0,0.4)', 'backdrop-filter:blur(4px)',
    'color:#fdf6e3', 'font-family:"Segoe UI",system-ui,sans-serif',
    'opacity:0', 'transition:opacity 220ms ease, transform 220ms ease, background-color 260ms ease, border-color 260ms ease', 'pointer-events:none',
  ].join(';');

  const nameEl = document.createElement('div');
  nameEl.style.cssText = 'font-family:Georgia,serif; font-size:16px; font-weight:600; margin-bottom:5px; letter-spacing:0.02em;';

  const textEl = document.createElement('div');
  // D6 mobile pass: text scales up a touch on small screens (readable at arm's length)
  textEl.style.cssText = 'font-size:clamp(15.5px, 2.2vw + 8px, 17px); line-height:1.55; min-height:2.6em;';

  const choicesEl = document.createElement('div');
  choicesEl.style.cssText = 'display:none; flex-wrap:wrap; gap:8px; margin-top:12px;';

  // footer row: the ◀ back button (left) + the advance hint (right)
  const footer = document.createElement('div');
  footer.style.cssText = 'display:flex; align-items:center; justify-content:space-between; margin-top:8px; min-height:22px;';

  const backBtn = document.createElement('button');
  backBtn.type = 'button';
  backBtn.textContent = '◀ Back';
  backBtn.setAttribute('aria-label', 'Re-read the previous line');
  backBtn.style.cssText = [
    'font:600 12px "Segoe UI",system-ui,sans-serif', 'padding:5px 11px', 'border-radius:9px',
    'cursor:pointer', 'color:#f5e6c4', 'background:rgba(242,184,128,0.12)',
    'border:1px solid rgba(242,184,128,0.32)', 'visibility:hidden', 'pointer-events:auto',
    'transition:filter 140ms ease',
  ].join(';');
  backBtn.onmouseenter = () => { backBtn.style.filter = 'brightness(1.15)'; };
  backBtn.onmouseleave = () => { backBtn.style.filter = 'none'; };

  const hint = document.createElement('div');
  hint.textContent = '▸';
  hint.style.cssText = 'font-size:13px; opacity:0.5;';

  footer.append(backBtn, hint);
  box.append(nameEl, textEl, choicesEl, footer);
  document.body.append(box);

  let open = false;
  let onKey = null;
  const history = []; // {speaker, text, color} for the current conversation

  const show = () => {
    open = true;
    box.style.pointerEvents = 'auto';
    box.style.opacity = '1';
    box.style.transform = 'translateX(-50%) translateY(0)';
  };
  const hide = () => {
    open = false;
    box.style.pointerEvents = 'none';
    box.style.opacity = '0';
    box.style.transform = 'translateX(-50%) translateY(12px)';
    history.length = 0; // conversation over — clear the re-read history
    backBtn.style.visibility = 'hidden';
    if (onKey) { window.removeEventListener('keydown', onKey); onKey = null; }
  };

  // Paint a history entry. `live` = the newest line (types on); older re-reads
  // appear instantly and dim the speaker a touch to read as "earlier".
  function paint(entry, { typewrite = false } = {}) {
    nameEl.textContent = entry.speaker || '';
    nameEl.style.color = entry.color || '#f2b880';
    // the box wears the speaker's signature dark tone (D6)
    const st = SPEAKER_STYLES[entry.speaker] || NEUTRAL_STYLE;
    box.style.background = st.bg;
    box.style.borderColor = st.border;
    if (typewrite) return typeOn(entry.text);
    textEl.textContent = entry.text;
    return Promise.resolve();
  }

  function typeOn(text) {
    return new Promise((resolveType) => {
      let i = 0;
      textEl.textContent = '';
      let done = false;
      const finish = () => { done = true; textEl.textContent = text; resolveType(); };
      const timer = setInterval(() => {
        if (done) { clearInterval(timer); return; }
        i += 1;
        textEl.textContent = text.slice(0, i);
        if (i >= text.length) { clearInterval(timer); done = true; resolveType(); }
      }, 18);
      typeOn._skip = () => { clearInterval(timer); if (!done) finish(); };
    });
  }

  function say(speaker, text, { color = '#f2b880' } = {}) {
    choicesEl.style.display = 'none';
    choicesEl.textContent = '';
    hint.style.display = 'block';
    history.push({ speaker, text, color });
    const liveIdx = history.length - 1;
    let viewIdx = liveIdx;
    show();
    Audio.uiClick?.();

    let revealed = false;
    paint(history[liveIdx], { typewrite: true }).then(() => { revealed = true; });

    const updateBack = () => { backBtn.style.visibility = viewIdx > 0 ? 'visible' : 'hidden'; };
    updateBack();

    return new Promise((resolve) => {
      const back = () => {
        // stop the LIVE type-on first, or its next tick overwrites the re-read
        // text (nameplate says one speaker, body shows another).
        if (!revealed && typeOn._skip) { typeOn._skip(); revealed = true; }
        if (viewIdx > 0) {
          viewIdx -= 1;
          paint(history[viewIdx]);      // instant re-read, no typewriter
          hint.textContent = '▸ ▸';     // subtle cue: you're reading back
          updateBack();
        }
      };
      const advance = () => {
        if (viewIdx < liveIdx) {         // stepping forward through re-reads
          viewIdx += 1;
          paint(history[viewIdx]);
          if (viewIdx === liveIdx) hint.textContent = '▸';
          updateBack();
          return;
        }
        if (!revealed && typeOn._skip) { typeOn._skip(); revealed = true; return; }
        cleanup();
        resolve();
      };
      const cleanup = () => {
        box.removeEventListener('click', onBoxClick);
        backBtn.removeEventListener('click', onBackClick);
        window.removeEventListener('keydown', onKey);
        onKey = null;
      };
      const onBoxClick = (e) => { if (e.target === backBtn) return; advance(); };
      const onBackClick = (e) => { e.stopPropagation(); Audio.uiClick?.(); back(); };
      onKey = (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); advance(); }
        else if (e.key === 'Backspace' || e.key === 'ArrowLeft') { e.preventDefault(); back(); }
      };
      box.addEventListener('click', onBoxClick);
      backBtn.addEventListener('click', onBackClick);
      window.addEventListener('keydown', onKey);
    });
  }

  function choose(speaker, text, options, { color = '#f2b880' } = {}) {
    nameEl.textContent = speaker || '';
    nameEl.style.color = color;
    const st = SPEAKER_STYLES[speaker] || NEUTRAL_STYLE;
    box.style.background = st.bg;
    box.style.borderColor = st.border;
    textEl.textContent = text;
    hint.style.display = 'none';
    backBtn.style.visibility = 'hidden';
    show();
    choicesEl.style.display = 'flex';
    choicesEl.textContent = '';
    return new Promise((resolve) => {
      options.forEach((opt) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = opt.label;
        b.style.cssText = [
          'font-family:"Segoe UI",system-ui,sans-serif', 'font-size:14px',
          'padding:9px 15px', 'border-radius:9px', 'cursor:pointer',
          'background:rgba(242,184,128,0.14)', 'color:#fdf6e3',
          'border:1px solid rgba(242,184,128,0.4)', 'transition:filter 150ms ease',
        ].join(';');
        b.onmouseenter = () => { b.style.filter = 'brightness(1.12)'; };
        b.onmouseleave = () => { b.style.filter = 'none'; };
        b.onclick = () => { Audio.uiClick?.(); resolve(opt.value); };
        choicesEl.append(b);
      });
    });
  }

  return {
    say,
    choose,
    hide,
    get isOpen() { return open; },
    destroy() { hide(); box.remove(); },
  };
}
