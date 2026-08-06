import { Audio } from '../systems/AudioSystem.js';
import { abortReason, makeAbortError } from '../core/async.js';
import { pausableWait } from '../engine/Sequencer.js';
import { isModalOpen } from './modal.js';
import { prefersReducedMotion } from '../core/reducedMotion.js';

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

export function createDialogue({ signal = null, isPaused = null } = {}) {
  const box = document.createElement('div');
  box.className = 'mr-dialogue'; // D8: compact phone sizing lives in index.html
  box.style.cssText = [
    'position:fixed', 'left:50%', 'bottom:calc(26px + env(safe-area-inset-bottom))', 'transform:translateX(-50%) translateY(12px)',
    // D6 mobile pass: wider on phones (96vw), same cap on desktop.
    // border-box: the padding lives INSIDE the width — content-box pushed the
    // box 13px off each side of a 375px phone.
    'box-sizing:border-box', 'z-index:45', 'width:min(96vw,640px)', 'padding:16px 20px 14px',
    `background:${NEUTRAL_STYLE.bg}`, `border:1px solid ${NEUTRAL_STYLE.border}`,
    'border-radius:14px', 'box-shadow:0 12px 40px rgba(0,0,0,0.4)', /* D9: no backdrop-filter over a live canvas */
    'color:#fdf6e3', 'font-family:"Segoe UI",system-ui,sans-serif',
    'opacity:0', 'transition:opacity 220ms ease, transform 220ms ease, background-color 260ms ease, border-color 260ms ease', 'pointer-events:none',
  ].join(';');

  const nameEl = document.createElement('div');
  nameEl.className = 'mr-dlg-name';
  nameEl.style.cssText = 'font-family:Georgia,serif; font-size:16px; font-weight:600; margin-bottom:5px; letter-spacing:0.02em;';

  const textEl = document.createElement('div');
  textEl.className = 'mr-dlg-text';
  textEl.style.cssText = 'font-size:17px; line-height:1.55; min-height:2.6em;';

  const choicesEl = document.createElement('div');
  choicesEl.style.cssText = 'display:none; flex-wrap:wrap; gap:8px; margin-top:12px;';

  // footer row: the ◀ back button (left) + the advance hint (right)
  const footer = document.createElement('div');
  footer.className = 'mr-dlg-footer';
  footer.style.cssText = 'display:flex; align-items:center; justify-content:space-between; margin-top:8px; min-height:22px;';

  const backBtn = document.createElement('button');
  backBtn.type = 'button';
  backBtn.textContent = '◀ Back';
  backBtn.setAttribute('aria-label', 'Re-read the previous line');
  backBtn.style.cssText = [
    'font:600 12px "Segoe UI",system-ui,sans-serif', 'padding:8px 14px', 'border-radius:9px',
    'cursor:pointer', 'color:#f5e6c4', 'background:rgba(242,184,128,0.12)',
    'border:1px solid rgba(242,184,128,0.32)', 'visibility:hidden', 'pointer-events:auto',
    'transition:filter 140ms ease',
  ].join(';');
  backBtn.onmouseenter = () => { backBtn.style.filter = 'brightness(1.15)'; };
  backBtn.onmouseleave = () => { backBtn.style.filter = 'none'; };

  // THE DEAD ZONE IS THE BACK BUTTON, NOT THE FOOTER.
  //
  // A missed tap on the small ◀ Back button used to fire the OPPOSITE action, so
  // the whole footer row was made a dead zone for advance. But the ▸ hint lives
  // in that same row — so the one thing on screen that LOOKS like the advance
  // button became the only place in the entire box that could not advance.
  // ("if i click right on the text then it works, but that shouldnt be the
  // case.") A control that promises an action and refuses it is worse than no
  // control at all (ui-clarity).
  //
  // So the dead zone is a padded wrapper around Back only, and ▸ is now a real
  // button that advances. Both get honest hit areas instead of one swallowing
  // the other.
  const backZone = document.createElement('div');
  backZone.style.cssText = 'display:flex; align-items:center; padding:4px 14px 4px 0;';
  backZone.append(backBtn);

  const hint = document.createElement('button');
  hint.type = 'button';
  hint.textContent = 'Next ▸';
  hint.setAttribute('aria-label', 'Continue');
  // 44px on a coarse pointer is the repo's own touch floor (responsive-ui).
  const coarsePointer = globalThis.matchMedia?.('(pointer: coarse)')?.matches;
  hint.style.cssText = [
    'font:600 12px "Segoe UI",system-ui,sans-serif', 'letter-spacing:0.04em',
    `min-height:${coarsePointer ? 44 : 30}px`, 'padding:6px 12px', 'border-radius:9px',
    'cursor:pointer', 'color:#f5e6c4', 'background:rgba(242,184,128,0.10)',
    'border:1px solid rgba(242,184,128,0.26)', 'opacity:0.78',
    'transition:filter 140ms ease, opacity 140ms ease',
  ].join(';');
  hint.onmouseenter = () => { hint.style.filter = 'brightness(1.18)'; hint.style.opacity = '1'; };
  hint.onmouseleave = () => { hint.style.filter = 'none'; hint.style.opacity = '0.78'; };

  footer.append(backZone, hint);
  // Screen-reader path: each line lands ONCE as full text in a hidden polite
  // log (the typewriter's per-character writes would spam a reader).
  const srLog = document.createElement('div');
  srLog.setAttribute('role', 'log');
  srLog.setAttribute('aria-live', 'polite');
  srLog.style.cssText = 'position:absolute; width:1px; height:1px; overflow:hidden; clip-path:inset(50%); white-space:nowrap;';
  box.append(nameEl, textEl, choicesEl, footer, srLog);
  document.body.append(box);

  let open = false;
  let onKey = null;
  let lastSpeaker = null; // D7: a NEW speaker re-enters the box; the same one doesn't
  const history = []; // {speaker, text, color} for the current conversation
  let activeCancel = null;
  let destroyed = false;
  const pendingTimers = new Set();
  const later = (fn, ms) => {
    const owner = new AbortController();
    pendingTimers.add(owner);
    pausableWait(ms, isPaused, owner.signal).then(() => {
      pendingTimers.delete(owner);
      fn();
    }, (error) => {
      pendingTimers.delete(owner);
      if (error?.name !== 'AbortError') console.error('[dialogue] delayed action failed', error);
    });
    return owner;
  };
  const clearLater = (owner) => {
    if (!owner) return;
    pendingTimers.delete(owner);
    if (!owner.signal.aborted) owner.abort(makeAbortError('Dialogue timer cancelled'));
  };

  const show = () => {
    open = true;
    box.style.pointerEvents = 'auto';
    box.style.opacity = '1';
    box.style.transform = 'translateX(-50%) translateY(0)';
  };
  const hide = () => {
    open = false;
    lastSpeaker = null; // next conversation opens fresh
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
    return null;
  }

  function typeOn(text) {
    let skip = null;
    const promise = new Promise((resolveType) => {
      let i = 0;
      textEl.textContent = '';
      let done = false;
      const owner = new AbortController();
      const finish = () => {
        if (done) return;
        done = true;
        textEl.textContent = text;
        resolveType();
      };
      skip = () => {
        if (!owner.signal.aborted) owner.abort(makeAbortError('Dialogue typewriter skipped'));
        finish();
      };
      (async () => {
        try {
          while (!done && i < text.length) {
            await pausableWait(18, isPaused, owner.signal);
            if (done) return;
            i += 1;
            textEl.textContent = text.slice(0, i);
          }
          finish();
        } catch (error) {
          if (error?.name !== 'AbortError') console.error('[dialogue] typewriter failed', error);
        }
      })();
    });
    return { promise, skip: () => skip?.() };
  }

  function say(speaker, text, { color = '#f2b880' } = {}) {
    if (destroyed || signal?.aborted) return Promise.reject(signal?.aborted ? abortReason(signal) : makeAbortError('Dialogue destroyed'));
    choicesEl.style.display = 'none';
    choicesEl.textContent = '';
    hint.style.display = 'inline-flex';
    hint.style.alignItems = 'center';
    hint.textContent = 'Next ▸'; // a new line always starts live, never mid-re-read
    history.push({ speaker, text, color });
    srLog.textContent = speaker ? `${speaker}: ${text}` : text;
    const liveIdx = history.length - 1;
    let viewIdx = liveIdx;
    // D7: a NEW speaker RE-ENTERS the box — a quick dip-down-and-return so the
    // hand-off is unmissable (the same speaker keeps talking with no animation;
    // color alone wasn't enough signal). Reduced-motion players get the
    // speaker colors without the dip.
    const speakerChanged = !prefersReducedMotion()
      && open && lastSpeaker !== null && speaker !== lastSpeaker;
    lastSpeaker = speaker;
    show();
    Audio.uiClick?.();

    let revealed = false;
    let canceled = false;
    let reveal = null;
    let startTimer = null;
    let restoreTimer = null;
    const startLine = () => {
      if (canceled || reveal || destroyed || signal?.aborted) return;
      clearLater(startTimer);
      startTimer = null;
      reveal = paint(history[liveIdx], { typewrite: true });
      reveal.promise.then(() => { if (!canceled) revealed = true; });
    };
    const enterLine = () => {
      if (canceled || destroyed || signal?.aborted) return;
      box.style.transition = 'opacity 170ms ease-out, transform 170ms ease-out, background-color 170ms ease, border-color 170ms ease';
      box.style.opacity = '1';
      box.style.transform = 'translateX(-50%) translateY(0) scale(1)';
      startLine();
      restoreTimer = later(() => {
        restoreTimer = null;
        if (!canceled && !destroyed) box.style.transition = 'opacity 220ms ease, transform 220ms ease, background-color 260ms ease, border-color 260ms ease';
      }, 190);
    };
    if (speakerChanged) {
      textEl.textContent = ''; // the old line leaves with the old speaker
      box.style.transition = 'opacity 130ms ease-in, transform 130ms ease-in';
      box.style.opacity = '0.12';
      box.style.transform = 'translateX(-50%) translateY(16px) scale(0.985)';
      startTimer = later(() => {
        startTimer = null;
        if (canceled || destroyed || signal?.aborted) return;
        enterLine();
      }, 140);
    } else {
      startLine();
    }

    const updateBack = () => { backBtn.style.visibility = viewIdx > 0 ? 'visible' : 'hidden'; };
    updateBack();

    return new Promise((resolve, reject) => {
      const cancelThis = (error = null) => {
        if (canceled) return;
        canceled = true;
        clearLater(startTimer);
        clearLater(restoreTimer);
        reveal?.skip();
        cleanup();
        if (error) reject(error); else resolve();
      };
      activeCancel = cancelThis;
      const back = () => {
        // stop the LIVE type-on first, or its next tick overwrites the re-read
        // text (nameplate says one speaker, body shows another).
        if (!reveal) enterLine();
        if (!revealed) { reveal?.skip(); revealed = true; }
        if (viewIdx > 0) {
          viewIdx -= 1;
          paint(history[viewIdx]);        // instant re-read, no typewriter
          hint.textContent = 'Forward ▸'; // you're reading back; this returns you
          updateBack();
        }
      };
      const advance = () => {
        // A fast click during the 140ms speaker handoff starts THIS line now;
        // it can never hit a stale global typewriter from the previous line.
        if (!reveal) { enterLine(); reveal?.skip(); revealed = true; return; }
        if (viewIdx < liveIdx) {         // stepping forward through re-reads
          viewIdx += 1;
          paint(history[viewIdx]);
          if (viewIdx === liveIdx) hint.textContent = 'Next ▸';
          updateBack();
          return;
        }
        if (!revealed) { reveal.skip(); revealed = true; return; }
        cleanup();
        resolve();
      };
      const cleanup = () => {
        clearLater(startTimer);
        clearLater(restoreTimer);
        box.removeEventListener('click', onBoxClick);
        backBtn.removeEventListener('click', onBackClick);
        window.removeEventListener('keydown', onKey);
        onKey = null;
        if (activeCancel === cancelThis) activeCancel = null;
      };
      // Only the padded area around ◀ Back is a dead zone, so a missed tap on it
      // still cannot fire the opposite action — and only while Back is actually
      // showing, because a dead zone guarding an invisible button is just a hole
      // in the box. Everything else advances, including the ▸ button, which is
      // what a player aims at first.
      const onBoxClick = (e) => {
        if (backBtn.style.visibility !== 'hidden' && backZone.contains(e.target)) return;
        advance();
      };
      const onBackClick = (e) => { e.stopPropagation(); Audio.uiClick?.(); back(); };
      onKey = (e) => {
        // Ownership: an open modal or the pause stack owns the keys. Without
        // this, Enter/Space in Settings-over-pause fell through to here and
        // consumed story lines behind the frozen game.
        if (isModalOpen() || isPaused?.()) return;
        // Focus on the Back button: let its native activation run — Enter/
        // Space here would fire the OPPOSITE action (the same bug the tap
        // dead-zone fixed, surviving on the keyboard path).
        // BACK'S ZONE ONLY. Widened to the whole footer, this killed the
        // keyboard the moment the player used the ▸ button they were just
        // told to use: clicking it leaves it focused, so Backspace and ← —
        // the documented re-read keys — silently stopped working for the rest
        // of the chapter, with no visible cause. ▸ and Enter do the same
        // thing, so letting the native activation take Enter/Space there is
        // correct and costs nothing.
        if (backZone.contains(document.activeElement)) return;
        if (document.activeElement === hint && (e.key === 'Enter' || e.key === ' ')) return;
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); advance(); }
        else if (e.key === 'Backspace' || e.key === 'ArrowLeft') { e.preventDefault(); back(); }
      };
      box.addEventListener('click', onBoxClick);
      backBtn.addEventListener('click', onBackClick);
      window.addEventListener('keydown', onKey);
    });
  }

  function choose(speaker, text, options, { color = '#f2b880' } = {}) {
    if (destroyed || signal?.aborted) return Promise.reject(signal?.aborted ? abortReason(signal) : makeAbortError('Dialogue destroyed'));
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
    return new Promise((resolve, reject) => {
      const cancelThis = (error = null) => {
        if (activeCancel === cancelThis) activeCancel = null;
        if (error) reject(error); else resolve();
      };
      activeCancel = cancelThis;
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
        b.onclick = () => { Audio.uiClick?.(); if (activeCancel === cancelThis) activeCancel = null; resolve(opt.value); };
        choicesEl.append(b);
      });
    });
  }

  const onAbort = () => activeCancel?.(abortReason(signal));
  signal?.addEventListener('abort', onAbort, { once: true });

  return {
    say,
    choose,
    hide,
    get isOpen() { return open; },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      const error = signal ? (signal.aborted ? abortReason(signal) : makeAbortError('Dialogue destroyed')) : null;
      activeCancel?.(error);
      [...pendingTimers].forEach(clearLater);
      pendingTimers.clear();
      signal?.removeEventListener('abort', onAbort);
      hide(); box.remove();
    },
  };
}
