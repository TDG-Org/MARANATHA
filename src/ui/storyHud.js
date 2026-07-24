import { Audio } from '../systems/AudioSystem.js';
import { abortReason, makeAbortError } from '../core/async.js';
import { isObjectivePrepaintActive } from './objectivePrepaint.js';

// The in-story HUD: a HOME button (top-left) and the live objective line that
// tells the player what to do right now. Scenes call setObjective() as goals
// change; pulse() re-nudges an idle player (game-feel law 7).
export function createStoryHud({ onHome, signal = null, isPaused = null } = {}) {
  const home = document.createElement('button');
  home.type = 'button';
  home.setAttribute('aria-label', 'Home');
  home.textContent = '⌂'; // ⌂
  home.style.cssText = [
    'position:fixed', 'top:calc(12px + env(safe-area-inset-top))', 'left:calc(14px + env(safe-area-inset-left))', 'z-index:40',
    'width:46px', 'height:46px', 'border-radius:12px', 'cursor:pointer',
    'display:flex', 'align-items:center', 'justify-content:center',
    'font-size:23px', 'line-height:1', 'color:#fdf6e3',
    'background:rgba(16,14,26,0.72)', 'border:1px solid rgba(255,255,255,0.14)',
    'pointer-events:auto', /* D9: no backdrop-filter over a live canvas (per-frame blur readback) */
    'transition:filter 150ms ease, background 150ms ease',
  ].join(';');
  home.onmouseenter = () => { home.style.background = 'rgba(30,26,44,0.82)'; };
  home.onmouseleave = () => { home.style.background = 'rgba(16,14,26,0.72)'; }; // matches the D9 base
  home.onclick = () => { Audio.uiClick?.(); onHome?.(); };

  // The objective banner — TOP-CENTER, just under the letterbox safe zone so
  // it sits near the player's eye-line. Big, warm-white, glowing, with a small
  // marker icon and a brief pulse on change (ui-clarity). A hint rides under it.
  const obj = document.createElement('div');
  obj.setAttribute('role', 'status');
  obj.setAttribute('aria-live', 'polite');
  obj.setAttribute('aria-atomic', 'true');
  obj.setAttribute('aria-hidden', 'true');
  obj.style.cssText = [
    'position:fixed',
    'top:calc(11vh + 12px + env(safe-area-inset-top))', 'left:50%', 'transform:translateX(-50%)', 'z-index:40',
    // D6 mobile pass: wider on phones so quest text never wraps to a wall
    'width:min(94vw,560px)', 'max-width:calc(100vw - 12px)', 'box-sizing:border-box',
    'padding:11px 20px', 'border-radius:14px', 'text-align:center',
    'font-family:"Segoe UI",system-ui,sans-serif', 'font-size:clamp(16px,2.4vw,21px)', 'font-weight:600',
    'letter-spacing:0.012em', 'color:#fff3d8', 'line-height:1.3',
    'background:rgba(12,10,20,0.82)', 'border:1px solid rgba(242,184,128,0.42)',
    'pointer-events:none', /* D9: no backdrop-filter over a live canvas */
    'text-shadow:0 0 14px rgba(242,184,128,0.45), 0 1px 3px rgba(0,0,0,0.8)',
    'box-shadow:0 3px 18px rgba(0,0,0,0.35), 0 0 22px rgba(242,184,128,0.14)',
    'opacity:0', 'transition:opacity 350ms ease',
  ].join(';');
  const objRow = document.createElement('div');
  objRow.style.cssText = 'display:flex; align-items:center; justify-content:center; gap:9px;';
  const objIcon = document.createElement('span');
  objIcon.textContent = '✦';
  objIcon.style.cssText = 'font-size:0.9em; color:#ffcf8a; flex:0 0 auto; filter:drop-shadow(0 0 6px rgba(242,184,128,0.6));';
  const objText = document.createElement('div');
  objRow.append(objIcon, objText);
  const objHint = document.createElement('div');
  objHint.style.cssText = 'font-size:0.68em; font-weight:400; opacity:0.8; margin-top:4px; display:none; text-shadow:0 1px 2px rgba(0,0,0,0.7);';
  obj.append(objRow, objHint);

  // Center-screen counter for number quests (🐑 2 / 3) — pops, then fades.
  const counter = document.createElement('div');
  counter.style.cssText = [
    'position:fixed', 'left:50%', 'top:34%', 'transform:translate(-50%,-50%)', 'z-index:41',
    'font-family:"Segoe UI",system-ui,sans-serif', 'font-size:clamp(30px,6vw,52px)', 'font-weight:700',
    'color:#fff3d8', 'letter-spacing:0.04em', 'pointer-events:none', 'white-space:nowrap',
    'text-shadow:0 0 26px rgba(242,184,128,0.55), 0 2px 6px rgba(0,0,0,0.8)',
    'opacity:0', 'transition:opacity 500ms ease',
  ].join(';');

  // D11 (Nate): a small right-side EMOTION line — "Joseph is sad" / "Joseph is
  // dreaming" — slides in, holds a moment, fades. Visible during cutscenes
  // (that's where the feelings live); never blocks anything.
  const emoteEl = document.createElement('div');
  emoteEl.style.cssText = [
    // top 55%: clear of the verse card above and the dialogue box below at
    // every tested size (390×844 → 2560×1080)
    'position:fixed', 'right:calc(18px + env(safe-area-inset-right))', 'top:55%', 'z-index:39',
    'font:italic 500 clamp(13px,1.8vw,16px) Georgia,"Times New Roman",serif',
    'color:#f5e6c4', 'letter-spacing:0.04em', 'pointer-events:none', 'white-space:nowrap',
    'padding:8px 14px', 'border-radius:10px', 'background:rgba(16,14,26,0.55)',
    'border-right:2px solid rgba(242,184,128,0.55)', 'text-shadow:0 1px 4px rgba(0,0,0,0.7)',
    'opacity:0', 'transform:translateX(14px)',
    'transition:opacity 420ms ease, transform 420ms ease',
  ].join(';');

  document.body.append(home, obj, counter, emoteEl);

  let current = '';
  let destroyed = false;
  const timers = new Set();
  const clockNow = () => globalThis.performance?.now?.() ?? Date.now();
  const later = (fn, ms) => {
    const win = globalThis.window;
    const doc = globalThis.document;
    const eventDriven = !!(
      isPaused
      && win?.addEventListener && win?.removeEventListener
      && doc?.addEventListener && doc?.removeEventListener
    );
    const owner = {
      timer: null,
      remaining: Math.max(0, ms),
      startedAt: 0,
      settled: false,
      cancel: null,
    };
    const cleanup = () => {
      if (owner.timer !== null) clearTimeout(owner.timer);
      owner.timer = null;
      if (eventDriven) {
        win.removeEventListener('maranatha-pausechange', onPauseState);
        doc.removeEventListener('visibilitychange', onPauseState);
      }
      timers.delete(owner);
    };
    const finish = () => {
      if (owner.settled) return;
      owner.settled = true;
      cleanup();
      fn();
    };
    const suspend = () => {
      if (owner.timer === null) return;
      clearTimeout(owner.timer);
      owner.timer = null;
      owner.remaining = Math.max(0, owner.remaining - (clockNow() - owner.startedAt));
    };
    const arm = () => {
      if (owner.settled || owner.timer !== null || isPaused?.()) return;
      owner.startedAt = clockNow();
      owner.timer = setTimeout(finish, owner.remaining);
    };
    const onPauseState = () => {
      if (isPaused?.()) suspend();
      else arm();
    };
    owner.cancel = () => {
      if (owner.settled) return;
      owner.settled = true;
      cleanup();
    };
    timers.add(owner);
    if (eventDriven) {
      win.addEventListener('maranatha-pausechange', onPauseState);
      doc.addEventListener('visibilitychange', onPauseState);
    }
    arm();
    return owner;
  };
  const clearLater = (owner) => {
    if (!owner) return;
    owner.cancel?.();
  };
  let objectiveTimer = null;
  let activeCompletion = null;
  // D6: the banner AUTO-HIDES while a cutscene sequence runs (the Sequencer
  // drives this) — quest UI and narrator verse cards never share the frame.
  let inCutscene = false;
  let letterboxOn = false;
  const setRenderedVisible = (visible) => {
    obj.style.opacity = visible ? '1' : '0';
    // Opacity alone leaves stale quest text in the accessibility tree. Keep
    // assistive technology in the same state as the visual banner.
    obj.setAttribute('aria-hidden', visible ? 'false' : 'true');
  };
  const applyVisible = () => {
    setRenderedVisible(Boolean(current && !inCutscene && !letterboxOn));
  };
  function setCutscene(on) {
    inCutscene = !!on;
    applyVisible();
  }
  // Sequence depth and letterbox ownership are deliberately separate. A
  // sequence can end while its authored bars stay up (for example while NPCs
  // walk into a circle). In that gap the previous quest must remain hidden.
  function setLetterbox(on) {
    letterboxOn = !!on;
    applyVisible();
  }
  function resetObjectiveChrome() {
    objIcon.textContent = '✦';
    objIcon.style.color = '#ffcf8a';
    objIcon.style.filter = 'drop-shadow(0 0 6px rgba(242,184,128,0.6))';
  }
  // Atomic ownership handoff for gameplay goals. Hiding is presentation;
  // clearing ends the logical objective, cancels every delayed write, and
  // leaves no stale text for a later cutscene gap to restore.
  function clearObjective() {
    if (destroyed) return;
    activeCompletion?.cancel?.();
    clearLater(objectiveTimer);
    objectiveTimer = null;
    current = '';
    setRenderedVisible(false);
    objText.textContent = '';
    objHint.textContent = '';
    objHint.style.display = 'none';
    resetObjectiveChrome();
  }
  function setObjective(text, hint = '') {
    if (destroyed || signal?.aborted) return;
    activeCompletion?.cancel?.();
    clearLater(objectiveTimer);
    objectiveTimer = null;
    // A new quest can supersede a completion while its green check is still
    // visible. Reclaim all shared banner chrome before scheduling new text.
    resetObjectiveChrome();
    if (!text) { clearObjective(); return; }
    if (text === current) { if (!inCutscene) pulse(); return; }
    current = text;
    if (isObjectivePrepaintActive()) {
      objText.textContent = text;
      objHint.textContent = hint;
      objHint.style.display = hint ? 'block' : 'none';
      applyVisible();
      if (!inCutscene) pulse();
      return;
    }
    // Cross-fade the text so it never hard-swaps.
    setRenderedVisible(false);
    objectiveTimer = later(() => {
      objectiveTimer = null;
      if (destroyed || signal?.aborted || current !== text) return;
      objText.textContent = text;
      objHint.textContent = hint;
      objHint.style.display = hint ? 'block' : 'none';
      applyVisible();
      if (!inCutscene) pulse();
    }, 180);
  }

  // D9 (Nate): a finished quest gets its MOMENT — the banner turns into a big
  // glowing green-gold check and HOLDS before the next objective may appear.
  // Resolves when the celebration is over; beats await it.
  function completeObjective(text, holdMs = 2800) {
    if (destroyed || signal?.aborted) return Promise.reject(signal?.aborted ? abortReason(signal) : makeAbortError('Story HUD destroyed'));
    activeCompletion?.cancel?.(); // one banner owner; a newer completion supersedes the old
    clearLater(objectiveTimer);
    objectiveTimer = null;
    current = `✓ ${text}`;
    setRenderedVisible(false);
    return new Promise((resolve, reject) => {
      let settled = false;
      const ownedTimers = new Set();
      const schedule = (fn, ms) => {
        let owner = null;
        owner = later(() => { ownedTimers.delete(owner); fn(); }, ms);
        ownedTimers.add(owner);
      };
      const finish = (error = null) => {
        if (settled) return;
        settled = true;
        for (const owner of ownedTimers) clearLater(owner);
        ownedTimers.clear();
        if (activeCompletion?.finish === finish) activeCompletion = null;
        if (error) reject(error); else resolve();
      };
      activeCompletion = { finish, cancel: () => finish() };
      schedule(() => {
        if (destroyed || signal?.aborted) {
          finish(signal?.aborted ? abortReason(signal) : makeAbortError('Story HUD destroyed'));
          return;
        }
        objIcon.textContent = '✓';
        objIcon.style.color = '#9fe8a0';
        objIcon.style.filter = 'drop-shadow(0 0 8px rgba(140,230,150,0.7))';
        objText.textContent = text;
        objHint.textContent = '';
        objHint.style.display = 'none';
        applyVisible();
        if (!inCutscene) pulse();
        schedule(() => {
          // hand the banner back to normal objectives
          resetObjectiveChrome();
          setRenderedVisible(false);
          current = '';
          objText.textContent = '';
          objHint.textContent = '';
          objHint.style.display = 'none';
          finish();
        }, holdMs);
      }, 180);
    });
  }

  const onAbort = () => {
    activeCompletion?.finish?.(abortReason(signal));
    clearLater(objectiveTimer);
    objectiveTimer = null;
    clearLater(counterTimer);
    counterTimer = null;
    clearLater(emoteTimer);
    emoteTimer = null;
  };
  signal?.addEventListener('abort', onAbort, { once: true });

  function pulse() {
    try {
      // keep translateX(-50%) in every keyframe or the centered banner jumps
      obj.animate(
        [
          { transform: 'translateX(-50%) scale(1)', boxShadow: '0 3px 18px rgba(0,0,0,0.35), 0 0 22px rgba(242,184,128,0.14)' },
          { transform: 'translateX(-50%) scale(1.06)', boxShadow: '0 3px 18px rgba(0,0,0,0.35), 0 0 34px rgba(242,184,128,0.42)' },
          { transform: 'translateX(-50%) scale(1)', boxShadow: '0 3px 18px rgba(0,0,0,0.35), 0 0 22px rgba(242,184,128,0.14)' },
        ],
        { duration: 640, easing: 'ease-in-out' },
      );
    } catch { /* animate() unsupported — no-op */ }
  }

  // emote('Joseph is sad') — the right-side feeling line. Re-calls restart the
  // hold; it always fades itself out.
  let emoteTimer = null;
  function emote(text, holdMs = 2800) {
    if (destroyed || signal?.aborted) return;
    emoteEl.textContent = text;
    emoteEl.style.opacity = '1';
    emoteEl.style.transform = 'translateX(0)';
    clearLater(emoteTimer);
    emoteTimer = later(() => {
      emoteTimer = null;
      emoteEl.style.opacity = '0';
      emoteEl.style.transform = 'translateX(14px)';
    }, holdMs);
  }

  // flashCount('🐑', 2, 3) — the big center pop for number quests.
  let counterTimer = null;
  function flashCount(icon, n, total) {
    if (destroyed || signal?.aborted) return;
    counter.textContent = `${icon} ${n} / ${total}`;
    counter.style.opacity = '1';
    try {
      counter.animate(
        [
          { transform: 'translate(-50%,-50%) scale(0.85)' },
          { transform: 'translate(-50%,-50%) scale(1.1)', offset: 0.55 },
          { transform: 'translate(-50%,-50%) scale(1)' },
        ],
        { duration: 450, easing: 'cubic-bezier(0.34,1.3,0.64,1)' },
      );
    } catch { /* no-op */ }
    clearLater(counterTimer);
    counterTimer = later(() => {
      counterTimer = null;
      counter.style.opacity = '0';
    }, 1400);
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    clearLater(objectiveTimer);
    objectiveTimer = null;
    const error = signal ? (signal.aborted ? abortReason(signal) : makeAbortError('Story HUD destroyed')) : null;
    activeCompletion?.finish?.(error);
    for (const owner of [...timers]) clearLater(owner);
    clearLater(counterTimer);
    counterTimer = null;
    clearLater(emoteTimer);
    emoteTimer = null;
    signal?.removeEventListener('abort', onAbort);
    home.remove();
    obj.remove();
    counter.remove();
    emoteEl.remove();
  }

  return {
    setObjective, clearObjective, completeObjective, setCutscene, setLetterbox,
    pulse, flashCount, emote, destroy,
    get objectiveText() { return current; },
    homeButton: home, objectiveEl: obj, counterEl: counter, emoteEl,
  };
}
