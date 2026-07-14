import { Audio } from '../systems/AudioSystem.js';

// Dialogue popups. Every line shows WHO is speaking (storyteller skill: the
// player must always know who each person is). Text types on; the first
// advance completes the reveal, the next resolves. Optional choice buttons.
//
//   const dlg = createDialogue();
//   await dlg.say('Jacob', 'You are my beloved son.', { color: '#d9a86a' });
//   const pick = await dlg.choose('Joseph', 'What do you say?', [
//     { label: 'Thank him', value: 'thanks' }, { label: 'Stay silent', value: 'silent' },
//   ]);
//
// The scene freezes the player controller while dialogue is open.
export function createDialogue() {
  const box = document.createElement('div');
  box.style.cssText = [
    'position:fixed', 'left:50%', 'bottom:26px', 'transform:translateX(-50%) translateY(12px)',
    'z-index:45', 'width:min(92vw,620px)', 'padding:16px 20px 14px',
    'background:rgba(16,14,26,0.9)', 'border:1px solid rgba(242,184,128,0.22)',
    'border-radius:14px', 'box-shadow:0 12px 40px rgba(0,0,0,0.4)', 'backdrop-filter:blur(4px)',
    'color:#fdf6e3', 'font-family:"Segoe UI",system-ui,sans-serif',
    'opacity:0', 'transition:opacity 220ms ease, transform 220ms ease', 'pointer-events:none',
  ].join(';');

  const nameEl = document.createElement('div');
  nameEl.style.cssText = 'font-family:Georgia,serif; font-size:16px; font-weight:600; margin-bottom:5px; letter-spacing:0.02em;';

  const textEl = document.createElement('div');
  textEl.style.cssText = 'font-size:15.5px; line-height:1.55; min-height:2.6em;';

  const choicesEl = document.createElement('div');
  choicesEl.style.cssText = 'display:none; flex-wrap:wrap; gap:8px; margin-top:12px;';

  const hint = document.createElement('div');
  hint.textContent = '▸';
  hint.style.cssText = 'text-align:right; font-size:13px; opacity:0.5; margin-top:6px; animation:none;';

  box.append(nameEl, textEl, choicesEl, hint);
  document.body.append(box);

  let open = false;
  let onKey = null;

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
    if (onKey) { window.removeEventListener('keydown', onKey); onKey = null; }
  };

  function typewrite(text) {
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
      // expose a completer so an advance can skip the typing
      typewrite._skip = () => { clearInterval(timer); if (!done) finish(); };
    });
  }

  function say(speaker, text, { color = '#f2b880' } = {}) {
    choicesEl.style.display = 'none';
    choicesEl.textContent = '';
    hint.style.display = 'block';
    nameEl.textContent = speaker || '';
    nameEl.style.color = color;
    show();
    Audio.uiClick?.();

    let revealed = false;
    const typing = typewrite(text).then(() => { revealed = true; });

    return new Promise((resolve) => {
      const advance = () => {
        if (!revealed && typewrite._skip) { typewrite._skip(); revealed = true; return; }
        cleanup();
        resolve();
      };
      const cleanup = () => {
        box.removeEventListener('click', advance);
        window.removeEventListener('keydown', onKey);
        onKey = null;
      };
      onKey = (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); advance(); }
      };
      box.addEventListener('click', advance);
      window.addEventListener('keydown', onKey);
      typing; // ensure the promise runs
    });
  }

  function choose(speaker, text, options, { color = '#f2b880' } = {}) {
    nameEl.textContent = speaker || '';
    nameEl.style.color = color;
    textEl.textContent = text;
    hint.style.display = 'none';
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
