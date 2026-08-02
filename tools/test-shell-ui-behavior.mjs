// EXECUTED behaviour for the app shell and the DOM UI surfaces the rest of the
// suite could only read as source. Everything here drives the real modules
// against a minimal DOM: navigation before the lazy engine exists, engine-load
// failure recovery, and the interactive contracts of modal / pause / verse
// card / dialogue. Written after the perf branch's adversarial review found a
// crash on a path no test executed.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// ── the minimal DOM ─────────────────────────────────────────────────────────
// The DOM stub this file used to carry inline now lives in tools/harness/dom.mjs
// so the scene-runtime group shares exactly the same one — two copies would
// drift, and a stub that drifts from the thing it stands in for is worse than
// no stub at all.
import { FakeElement, window as win, document as doc, store } from './harness/dom.mjs';


const tick = (ms) => new Promise((r) => setTimeout(r, ms));

const { createApp } = await import('../src/core/app.js');

// ── 1. THE SHELL RUNS BEFORE THE ENGINE EXISTS ──────────────────────────────
// The lazy-engine split made renderer/camera/hud/postFX null until the engine
// chunk lands. A flat→flat navigation in that window is a real player path
// (Settings → Reset → rebuild home) and it must not throw: the reviewed bug
// deref'd the null hud in disposeCurrent AFTER the veil covered and the old
// screen was disposed, stranding the player on permanent black.
{
  const container = new FakeElement('div');
  const app = createApp(container);
  assert.equal(app.renderer, null, 'the shell created a renderer before any 3D navigation');
  assert.equal(app.camera, null, 'the shell created a camera before any 3D navigation');

  const built = [];
  const mkFlat = (key) => ({ app: null, flat: true, update() {}, dispose() { built.push(`dispose:${key}`); } });
  app.register('home', () => { built.push('build:home'); return mkFlat('home'); }, { flat: true });
  app.register('other', () => { built.push('build:other'); return mkFlat('other'); }, { flat: true });

  const errors = [];
  const realError = console.error;
  console.error = (...a) => errors.push(a.join(' '));
  try {
    await app.navigate('home');
    assert.equal(app.currentKey, 'home', 'the first flat navigation did not mount');
    // …and now the exact reviewed path: leave a mounted screen while the
    // engine still does not exist.
    await app.navigate('other');
    assert.equal(app.currentKey, 'other', 'flat→flat navigation before the engine crashed or stalled');
  } finally {
    console.error = realError;
  }
  assert.deepEqual(built, ['build:home', 'dispose:home', 'build:other'],
    'the pre-engine navigation did not build/dispose in order');
  assert.deepEqual(errors, [], `pre-engine navigation logged errors: ${errors.join(' | ')}`);
  assert.equal(app.renderer, null, 'a flat screen pulled the engine in anyway');
}

// ── 2. AN ENGINE THAT CANNOT LOAD RECOVERS TO THE HOME ──────────────────────
// node has no WebGL, so a real non-flat navigation exercises the engine
// FAILURE path end to end: ensureEngine rejects, the cached promise clears,
// and navigation falls back to the eager home instead of hanging on black.
{
  const container = new FakeElement('div');
  const app = createApp(container);
  const seen = [];
  app.register('home', ({ params }) => {
    seen.push(params?.loadError ? `home:${params.loadError.phase}` : 'home');
    return { flat: true, update() {}, dispose() {} };
  }, { flat: true });
  app.register('story', () => { seen.push('story'); return { update() {}, dispose() {} }; });

  const errors = [];
  const realError = console.error;
  console.error = (...a) => errors.push(a.join(' '));
  try {
    await app.navigate('home');
    await app.navigate('story');
  } finally {
    console.error = realError;
  }
  assert.equal(app.currentKey, 'home', 'a failed engine load did not recover to the home screen');
  assert.ok(!seen.includes('story'), 'the story screen was built without an engine');
  assert.ok(seen.includes('home:screen'), 'the recovery home did not receive its loadError');
  assert.ok(errors.some((e) => /failed to build|Engine load/i.test(e)),
    'the engine failure was swallowed silently');
}

// ── 3. CONFIRM MODAL: Enter acts on the FOCUSED button ──────────────────────
// The reviewed save-wipe: a global "Enter = confirm" fired while focus sat on
// the deliberately-focused Cancel.
{
  const { confirmModal } = await import('../src/ui/modal.js');
  const press = (key) => win.dispatchEvent({ type: 'keydown', key });

  const cancelled = confirmModal({ title: 'Reset all progress?' });
  await tick(80); // the dialog focuses Cancel on a 60ms timer
  press('Enter');
  assert.equal(await cancelled, false, 'Enter on a focused Cancel still confirmed — saves can be wiped');

  const confirmed = confirmModal({ title: 'Reset all progress?' });
  await tick(80);
  // Tab moves to the confirm button (the trap keeps focus inside the dialog)
  press('Tab');
  press('Enter');
  assert.equal(await confirmed, true, 'Enter on a focused confirm button did not confirm');

  const escaped = confirmModal({ title: 'Reset all progress?' });
  await tick(80);
  press('Escape');
  assert.equal(await escaped, false, 'Escape did not cancel');

  // key repeat must not drive a dialog at all
  const held = confirmModal({ title: 'Reset all progress?' });
  await tick(80);
  win.dispatchEvent({ type: 'keydown', key: 'Enter', repeat: true });
  let settled = false;
  held.then(() => { settled = true; });
  await tick(40);
  assert.equal(settled, false, 'a repeated Enter drove the dialog');
  press('Escape');
  await held;
}

// ── 4. VERSE CARD: an invisible card holds no surface ───────────────────────
{
  const { createVerseCard } = await import('../src/ui/verseCard.js');
  const card = createVerseCard();
  const panel = card.el;
  panel.scrollHeight = 400; // a long verse on a short viewport
  panel.clientHeight = 100;
  card.show({ ref: 'Genesis 37:1', text: 'x'.repeat(400) }, { narrate: false, holdMs: 0 });
  assert.equal(panel.style.pointerEvents, 'auto', 'an overflowing verse card stayed unscrollable');
  assert.equal(panel.getAttribute('tabindex'), '0', 'an overflowing verse card took no tab stop');
  card.hide();
  assert.equal(panel.style.pointerEvents, 'none', 'a hidden verse card still eats clicks');
  assert.equal(panel.getAttribute('tabindex'), null, 'a hidden verse card still holds a tab stop');

  panel.scrollHeight = 40;
  panel.clientHeight = 100; // a short verse never becomes interactive
  card.show({ ref: 'Genesis 37:1', text: 'short' }, { narrate: false, holdMs: 0 });
  assert.equal(panel.style.pointerEvents, 'none', 'a fitting verse card became a click target');
  card.destroy();
}

// ── 5. PAUSE: the blur survives a reopen, and the ghost is inert ────────────
{
  const { createPauseMenu } = await import('../src/ui/pause.js');
  const app = { setPaused() {}, paused: false };
  const pause = createPauseMenu({
    app, setInput() {}, isInputOn: () => true, onHome() {}, onSettings() {},
  });
  const overlay = doc.body.children.find((el) => String(el.style?.zIndex) === '58');
  assert.ok(overlay, 'the pause overlay was not mounted');
  assert.equal(overlay.style.backdropFilter, 'blur(6px)',
    'setup: the overlay should declare its blur in cssText');

  pause.open();
  assert.equal(overlay.style.backdropFilter, 'blur(6px)', 'the pause overlay lost its frozen-frame blur');
  assert.equal(overlay.style.opacity, '1');
  pause.close();
  assert.equal(overlay.style.backdropFilter, 'none', 'the fading ghost kept blurring a LIVE canvas');
  assert.equal(overlay.style.pointerEvents, 'none', 'the fading ghost still ate clicks');
  assert.equal(overlay.inert, true, 'the fading ghost kept its buttons keyboard-activatable');
  assert.equal(overlay.style.display, 'flex', 'the overlay was removed before its fade could run');
  await tick(260);
  assert.equal(overlay.style.display, 'none', 'the overlay never finished hiding');

  pause.open(); // THE REGRESSION: '' would have deleted the inline declaration
  assert.equal(overlay.style.backdropFilter, 'blur(6px)',
    'the blur did not come back on reopen — style.x = "" deletes a cssText declaration');
  assert.equal(overlay.inert, false, 'the reopened overlay stayed inert');
  pause.close();
  await tick(260);
  pause.destroy?.();
}

// ── 6. MOOD GRADING: a superseded tween settles its awaited promise ─────────
{
  const THREE = await import('three');
  const { MoodGrading } = await import('../src/engine/MoodGrading.js');
  const refs = {
    sky: { setColors() {} },
    fog: { color: new THREE.Color(), near: 10 },
    keyLight: { color: new THREE.Color(), intensity: 1, position: new THREE.Vector3() },
    hemiLight: { color: new THREE.Color(), intensity: 1 },
    ridges: null,
    cinema: { setTint() {} },
  };
  const grading = new MoodGrading(refs);
  let firstSettled = false;
  const first = grading.grade('dusk', 4000).then(() => { firstSettled = true; });
  grading.update(16); // in flight, nowhere near done
  assert.equal(firstSettled, false, 'the tween resolved before it ran');
  grading.grade('goldenHour', 100); // supersede it
  await tick(0);
  assert.equal(firstSettled, true,
    'a superseded grade dropped its resolve — an awaited grade step can hang forever');
  await first;
}

// ── 7. SETTINGS/VOLUME PERSISTENCE: debounced, but never lost ───────────────
{
  const { Settings } = await import('../src/systems/Settings.js');
  store.delete('maranatha-settings-v1');
  for (let i = 0; i < 20; i += 1) Settings.set('music', i / 20); // a slider drag
  assert.equal(store.has('maranatha-settings-v1'), false,
    'a slider drag still wrote localStorage synchronously per input event');
  await tick(300);
  const saved = JSON.parse(store.get('maranatha-settings-v1'));
  assert.equal(saved.music, 19 / 20, 'the debounced settings write never landed');

  Settings.set('music', 0.5);
  doc.hidden = true;
  doc.dispatchEvent({ type: 'visibilitychange' }); // the tab goes away mid-debounce
  doc.hidden = false;
  assert.equal(JSON.parse(store.get('maranatha-settings-v1')).music, 0.5,
    'a pending settings write was lost when the page was hidden');
}

// ── 8. THE DROP-A-FILE CONTRACT for the two direct-call cues ───────────────
// Every call site invokes Audio.uiClick()/footstep() directly, so dropping a
// real ui_click/footstep file used to change nothing. They now prefer a
// decoded sample — without losing the procedural voice or the retry.
{
  const { Audio } = await import('../src/systems/AudioSystem.js');
  const played = [];
  Audio.play = (key) => { played.push(key); };
  Audio.tone = () => { played.push('procedural:tone'); };
  Audio.noiseHit = () => { played.push('procedural:noise'); };

  Audio.samples = {};
  Audio.uiClick();
  Audio.footstep();
  assert.deepEqual(played, ['procedural:tone', 'procedural:noise'],
    'with no sample present the procedural voice must still play');

  played.length = 0;
  Audio.samples = { 'ui.click': {}, 'sfx.footstep': {} };
  Audio.uiClick();
  Audio.footstep();
  assert.deepEqual(played, ['ui.click', 'sfx.footstep'],
    'a dropped real file is ignored — the drop-a-file contract is still broken');
}

// ── 9. PANEL FOCUS CONTAINMENT is real, and nests safely ───────────────────
// pointer-events on a dimmed background blocks clicks but NOT the keyboard.
// Panels must inert what they cover, and a panel opened OVER another must not
// un-inert what the first one owns when it closes.
{
  const { openAboutPanel } = await import('../src/screens/pages.js');
  const behind = new FakeElement('div');
  doc.body.append(behind);
  const opener = new FakeElement('button');
  doc.body.append(opener);
  opener.focus();
  assert.equal(doc.activeElement, opener);

  const closeAbout = openAboutPanel({ onClose() {} });
  assert.equal(behind.inert, true, 'an open panel left the screen behind it keyboard-reachable');
  const panelRoot = doc.body.children.at(-1);
  assert.equal(panelRoot.inert, false, 'the panel inerted itself');
  assert.notEqual(doc.activeElement, opener, 'focus never moved into the panel');
  const insidePanel = panelRoot.contains(doc.activeElement);
  assert.equal(insidePanel, true, 'focus did not land inside the panel');

  // a second overlay over the first must not steal ownership of `behind`
  const alreadyInert = behind.inert;
  const closeSecond = openAboutPanel({ onClose() {} });
  assert.equal(behind.inert, true, 'the nested panel un-inerted a covered layer');
  closeSecond();
  assert.equal(behind.inert, alreadyInert,
    'closing the nested panel released a layer the FIRST panel still owns');

  closeAbout();
  assert.equal(behind.inert, false, 'closing the last panel left the screen permanently inert');
  assert.equal(doc.activeElement, opener, 'focus did not return to the opener');
  behind.remove();
  opener.remove();
}

console.log(
  'shell + UI behaviour passed: pre-engine flat navigation clean, engine-failure recovery to home,'
  + ' modal Enter follows focus, verse card releases its surface, pause blur survives reopen,'
  + ' superseded grade settles, settings persist debounced + flushed,'
  + ' click/footstep prefer a dropped real file.',
);

// ── THE STORY MAP MUST LET YOU PICK A STORY ─────────────────────────────────
// Nate: "it wont let me select different stories". Two causes, both real.
{
  const { buildAtlas, nodeHtml } = await import('../src/screens/home/atlas.js');
  const { STORIES } = await import('../src/data/stories.js');

  // (1) EVERY DRAWN STOP IS A CHOICE. Two chapters used to be painted on the
  // road and then be inert — plain divs, aria-hidden, no handler — so clicking
  // a chapter you could plainly see did nothing at all, silently.
  const atlas = buildAtlas((s) => !!s.sceneKey);
  assert.ok(atlas.nodes.length > 0, 'the map draws chapters');
  for (const n of atlas.nodes) {
    const html = nodeHtml(n);
    assert.ok(
      html.includes(`data-node="${n.id}"`),
      `${n.id} is drawn on the road but is not selectable`,
    );
    assert.ok(
      !html.includes('aria-hidden="true"'),
      `${n.id} is drawn on the road but hidden from assistive tech`,
    );
    assert.ok(n.reachable, `${n.id} is drawn but flagged unreachable`);
  }

  // (2) The label must say WHICH of the three states a stop is in, so a locked
  // chapter and a walkable one are never told apart only by trying them.
  const built = atlas.nodes.filter((n) => n.built);
  const unbuilt = atlas.nodes.filter((n) => !n.built);
  assert.ok(built.length && unbuilt.length, 'the map has both built and unbuilt stops to distinguish');
  for (const n of unbuilt) {
    assert.match(nodeHtml(n), /coming soon/i, `${n.id} must read as not-yet-built`);
  }
  for (const n of built) {
    assert.doesNotMatch(nodeHtml(n), /coming soon/i, `${n.id} is playable and must not say coming soon`);
    const expect = n.explore ? /walk around/i : /ready to play/i;
    assert.match(nodeHtml(n), expect, `${n.id} must name its playable state`);
  }

  // (3) POINTER CAPTURE RETARGETS THE CLICK. The road captures the pointer so a
  // drag survives leaving it, and a captured pointer fires its click AT the
  // capturing element — so `e.target.closest('[data-node]')` was null on every
  // real press and the selection was dropped. A scripted el.click() never goes
  // through capture, which is exactly why this shipped.
  const homeSrc = await readFile(new URL('../src/screens/home/index.js', import.meta.url), 'utf8');
  assert.match(
    homeSrc, /pressNode\s*=\s*e\.target\.closest\?\.\('\[data-node\]'\)/,
    'the chapter under the press must be recorded on pointerdown',
  );
  assert.match(
    homeSrc, /closest\?\.\('\[data-node\]'\)\s*\|\|\s*started/,
    'the click handler must fall back to the chapter the press began on',
  );
  assert.ok(
    homeSrc.includes('setPointerCapture'),
    'guard assumes the road still takes pointer capture; re-check if that changed',
  );

  console.log(`story map: ${atlas.nodes.length} stops drawn, all selectable `
    + `(${built.length} playable, ${unbuilt.length} coming soon)`);
}
