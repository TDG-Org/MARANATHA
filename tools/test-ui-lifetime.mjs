import assert from 'node:assert/strict';
import * as THREE from 'three';

class FakeTarget {
  constructor() { this._listeners = new Map(); }
  addEventListener(type, fn) {
    if (!this._listeners.has(type)) this._listeners.set(type, new Set());
    this._listeners.get(type).add(fn);
  }
  removeEventListener(type, fn) { this._listeners.get(type)?.delete(fn); }
  dispatchEvent(event) {
    event.target ??= this;
    event.preventDefault ??= () => {};
    event.stopPropagation ??= () => {};
    event.stopImmediatePropagation ??= () => {};
    for (const fn of [...(this._listeners.get(event.type) || [])]) fn(event);
  }
  listenerCount(type) { return this._listeners.get(type)?.size || 0; }
}

class FakeElement extends FakeTarget {
  constructor(tag = 'div') {
    super();
    this.tagName = tag.toUpperCase();
    this.style = {};
    this.children = [];
    this.parentNode = null;
    this.textContent = '';
    this.className = '';
    this.dataset = {};
    this.attributes = new Map();
  }
  append(...nodes) { for (const node of nodes) { node.parentNode = this; this.children.push(node); } }
  prepend(...nodes) { for (const node of nodes.reverse()) { node.parentNode = this; this.children.unshift(node); } }
  remove() {
    if (!this.parentNode) return;
    const i = this.parentNode.children.indexOf(this);
    if (i >= 0) this.parentNode.children.splice(i, 1);
    this.parentNode = null;
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  contains(node) { return node === this || this.children.some((child) => child.contains?.(node)); }
  getBoundingClientRect() { return { left: 0, top: 0, width: 800, height: 600 }; }
  animate() { return { cancel() {} }; }
}

const fakeWindow = new FakeTarget();
fakeWindow.innerWidth = 800;
fakeWindow.innerHeight = 600;
fakeWindow.matchMedia = () => ({ matches: false });
const fakeDocument = new FakeTarget();
fakeDocument.hidden = false;
fakeDocument.body = new FakeElement('body');
fakeDocument.createElement = (tag) => new FakeElement(tag);

globalThis.window = fakeWindow;
globalThis.document = fakeDocument;
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0);

const { makeAbortError, withAbort } = await import('../src/core/async.js');
const { createDialogue } = await import('../src/ui/dialogue.js');
const { createStoryHud } = await import('../src/ui/storyHud.js');
const { withObjectivePrepaint } = await import('../src/ui/objectivePrepaint.js');
const { Interactables } = await import('../src/engine/Interactables.js');
const baselineKeyListeners = fakeWindow.listenerCount('keydown');

const click = (el) => el.dispatchEvent({ type: 'click', target: el });
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Typewriter and speaker-handoff timers must sleep behind pause rather than
// continuing DOM writes (or polling) under the frozen overlay.
{
  const lifetime = new AbortController();
  let paused = true;
  const dialogue = createDialogue({
    signal: lifetime.signal,
    isPaused: () => paused,
  });
  const box = fakeDocument.body.children.find((el) => el.className === 'mr-dialogue');
  const text = box.children[1];
  const line = dialogue.say('Joseph', 'This line waits for the player.');
  await delay(80);
  assert.equal(text.textContent, '', 'dialogue typewriter advanced behind pause');
  paused = false;
  fakeWindow.dispatchEvent({ type: 'maranatha-pausechange' });
  await delay(60);
  assert.ok(text.textContent.length > 0, 'dialogue typewriter did not resume');
  lifetime.abort(makeAbortError('paused dialogue test exit'));
  await assert.rejects(line, { name: 'AbortError' });
  dialogue.destroy();
}

// Story HUD time is gameplay time: objective crossfades, completion holds,
// counters, and emotes must retain their full remaining duration while the app
// is paused or the tab is hidden. No short polling callback may wake underneath
// either frozen state; the app/visibility event re-arms work exactly on resume.
{
  const lifetime = new AbortController();
  let appPaused = true;
  const timePaused = () => appPaused || fakeDocument.hidden;
  const nativeSetTimeout = globalThis.setTimeout;
  let frozenTimerCallbacks = 0;
  globalThis.setTimeout = (fn, ms, ...args) => nativeSetTimeout(() => {
    if (timePaused()) frozenTimerCallbacks += 1;
    fn(...args);
  }, ms);
  const waitNative = (ms) => new Promise((resolve) => nativeSetTimeout(resolve, ms));
  const hud = createStoryHud({
    signal: lifetime.signal,
    isPaused: timePaused,
  });
  try {
    hud.setObjective('Wait for the player.', 'Nothing changes while paused.');
    await waitNative(240);
    assert.equal(hud.objectiveEl.children[0].children[1].textContent, '',
      'objective crossfade advanced behind app pause');
    assert.equal(frozenTimerCallbacks, 0, 'Story HUD timer woke while app-paused');

    appPaused = false;
    fakeWindow.dispatchEvent({ type: 'maranatha-pausechange' });
    await waitNative(220);
    assert.equal(hud.objectiveEl.children[0].children[1].textContent, 'Wait for the player.');
    assert.equal(hud.objectiveEl.style.opacity, '1', 'objective crossfade did not resume');

    const completion = hud.completeObjective('Done', 120);
    let completionSettled = false;
    completion.then(() => { completionSettled = true; });
    await waitNative(220); // reveal the completion, then freeze during its hold
    assert.equal(hud.objectiveEl.children[0].children[1].textContent, 'Done');
    fakeDocument.hidden = true;
    fakeDocument.dispatchEvent({ type: 'visibilitychange' });
    await waitNative(180);
    assert.equal(completionSettled, false, 'completion hold elapsed in a hidden tab');
    assert.equal(hud.objectiveEl.children[0].children[1].textContent, 'Done');
    assert.equal(frozenTimerCallbacks, 0, 'Story HUD timer woke while hidden');
    fakeDocument.hidden = false;
    fakeDocument.dispatchEvent({ type: 'visibilitychange' });
    await completion;
    assert.equal(hud.objectiveEl.children[0].children[1].textContent, '',
      'completion did not finish after visibility resume');

    hud.flashCount('3', 2, 3);
    assert.equal(hud.counterEl.style.opacity, '1');
    appPaused = true;
    fakeWindow.dispatchEvent({ type: 'maranatha-pausechange' });
    await waitNative(1500);
    assert.equal(hud.counterEl.style.opacity, '1', 'counter faded behind app pause');
    assert.equal(frozenTimerCallbacks, 0, 'counter timer woke while app-paused');
    appPaused = false;
    fakeWindow.dispatchEvent({ type: 'maranatha-pausechange' });
    await waitNative(1480);
    assert.equal(hud.counterEl.style.opacity, '0', 'counter did not resume its fade timer');

    hud.emote('Joseph is sad', 120);
    assert.equal(hud.emoteEl.style.opacity, '1');
    fakeDocument.hidden = true;
    fakeDocument.dispatchEvent({ type: 'visibilitychange' });
    await waitNative(180);
    assert.equal(hud.emoteEl.style.opacity, '1', 'emote faded in a hidden tab');
    assert.equal(frozenTimerCallbacks, 0, 'emote timer woke while hidden');
    fakeDocument.hidden = false;
    fakeDocument.dispatchEvent({ type: 'visibilitychange' });
    await waitNative(160);
    assert.equal(hud.emoteEl.style.opacity, '0', 'emote did not resume its fade timer');
  } finally {
    globalThis.setTimeout = nativeSetTimeout;
    lifetime.abort(makeAbortError('Story HUD pause test exit'));
    hud.destroy();
    fakeDocument.hidden = false;
  }
}

// A fast click during the speaker dip must own the new line's typewriter. The
// old 140ms timer must never wake later and overwrite the following speaker.
{
  const lifetime = new AbortController();
  const dialogue = createDialogue({ signal: lifetime.signal });
  const box = fakeDocument.body.children.find((el) => el.className === 'mr-dialogue');
  const text = box.children[1];

  const first = dialogue.say('Jacob', 'First');
  click(box); click(box);
  await first;

  const second = dialogue.say('Joseph', 'Second');
  click(box); click(box); // both clicks land before the old 140ms handoff
  await second;

  const third = dialogue.say('Jacob', 'Third line');
  await delay(600);
  assert.equal(text.textContent, 'Third line', 'stale speaker timer overwrote the live line');

  const started = performance.now();
  lifetime.abort(makeAbortError('dialogue test exit'));
  await assert.rejects(third, { name: 'AbortError' });
  assert.ok(performance.now() - started < 50, 'active dialogue did not abort synchronously');
  assert.equal(fakeWindow.listenerCount('keydown'), baselineKeyListeners, 'dialogue left a zombie key listener');
  await assert.rejects(dialogue.say('Joseph', 'Too late'), { name: 'AbortError' });
  dialogue.destroy();
}

// Objective celebrations used to keep their 180ms + hold timer alive after
// navigation. Abort must settle immediately and prevent the delayed DOM write.
{
  const lifetime = new AbortController();
  const hud = createStoryHud({ signal: lifetime.signal });
  const objective = fakeDocument.body.children[1];
  const objectiveText = objective.children[0].children[1];
  const completion = hud.completeObjective('Done', 5000);
  const started = performance.now();
  lifetime.abort(makeAbortError('hud test exit'));
  await assert.rejects(completion, { name: 'AbortError' });
  assert.ok(performance.now() - started < 50, 'HUD completion did not abort synchronously');
  await delay(240);
  assert.notEqual(objectiveText.textContent, 'Done', 'aborted HUD timer mutated removed state');
  hud.destroy();
}

// A completed gameplay objective is logical state, not merely a hidden DOM
// surface. Clearing it during a letterboxed handoff must cancel delayed writes,
// empty the accessibility status, and never restore when bars/sequences end.
{
  const lifetime = new AbortController();
  const hud = createStoryHud({ signal: lifetime.signal });
  const objective = fakeDocument.body.children[1];
  const objectiveText = objective.children[0].children[1];
  hud.setObjective('Tell your brothers your dream.', 'Walk to the fire.');
  await delay(220);
  assert.equal(hud.objectiveText, 'Tell your brothers your dream.');
  assert.equal(objective.style.opacity, '1');
  assert.equal(objective.attributes.get('role'), 'status');
  assert.equal(objective.attributes.get('aria-live'), 'polite');
  assert.equal(objective.attributes.get('aria-hidden'), 'false');

  hud.setLetterbox(true);
  assert.equal(objective.style.opacity, '0');
  assert.equal(objective.attributes.get('aria-hidden'), 'true',
    'letterboxed objective remained exposed to assistive technology');
  hud.clearObjective();
  hud.setCutscene(true);
  hud.setCutscene(false);
  hud.setLetterbox(false);
  await delay(220);
  assert.equal(hud.objectiveText, '');
  assert.equal(objectiveText.textContent, '');
  assert.equal(objective.style.opacity, '0', 'cleared objective resurfaced after cutscene handoff');
  assert.equal(objective.attributes.get('aria-hidden'), 'true');
  hud.destroy();
}

// A new objective may arrive while the previous completion check is visible.
// It must atomically reclaim both the banner text and its normal gold chrome.
{
  const hud = createStoryHud();
  const objective = fakeDocument.body.children[1];
  const objectiveRow = objective.children[0];
  const objectiveIcon = objectiveRow.children[0];
  const objectiveText = objectiveRow.children[1];
  const completion = hud.completeObjective('Sheep are safe.', 5000);
  await delay(220);
  assert.equal(objectiveIcon.textContent, '✓');
  assert.equal(objectiveIcon.style.color, '#9fe8a0');
  assert.equal(objective.attributes.get('aria-hidden'), 'false');

  hud.setObjective('Talk to Jacob.', 'Walk into the tent.');
  assert.equal(objectiveIcon.textContent, '✦', 'new objective inherited the completion check');
  assert.equal(objectiveIcon.style.color, '#ffcf8a', 'new objective inherited green completion chrome');
  assert.equal(objective.attributes.get('aria-hidden'), 'true',
    'cross-faded objective stayed exposed while visually hidden');
  await completion;
  await delay(220);
  assert.equal(objectiveText.textContent, 'Talk to Jacob.');
  assert.equal(objective.style.opacity, '1');
  assert.equal(objective.attributes.get('aria-hidden'), 'false');
  hud.destroy();
}

// Checkpoint entry gets one explicit synchronous paint window while the cinema
// veil is still opaque. Ordinary objective changes keep their authored
// crossfade before and after that window.
{
  const hud = createStoryHud();
  const objective = hud.objectiveEl;
  const objectiveText = objective.children[0].children[1];
  const objectiveHint = objective.children[1];

  hud.setObjective('Ordinary objective.');
  assert.equal(objectiveText.textContent, '', 'ordinary objective lost its crossfade');
  assert.equal(objective.attributes.get('aria-hidden'), 'true');
  await delay(220);
  assert.equal(objectiveText.textContent, 'Ordinary objective.');
  assert.equal(objective.attributes.get('aria-hidden'), 'false');

  hud.clearObjective();
  withObjectivePrepaint(() => {
    hud.setObjective('Checkpoint objective.', 'Ready before reveal.');
  });
  assert.equal(objectiveText.textContent, 'Checkpoint objective.',
    'checkpoint objective was not painted synchronously');
  assert.equal(objectiveHint.textContent, 'Ready before reveal.');
  assert.equal(objectiveHint.style.display, 'block');
  assert.equal(objective.style.opacity, '1');
  assert.equal(objective.attributes.get('aria-hidden'), 'false');

  hud.setObjective('Crossfade restored.');
  assert.equal(objectiveText.textContent, 'Checkpoint objective.',
    'prepaint mode leaked into a later ordinary objective');
  assert.equal(objective.attributes.get('aria-hidden'), 'true');
  await delay(220);
  assert.equal(objectiveText.textContent, 'Crossfade restored.');
  assert.equal(objective.attributes.get('aria-hidden'), 'false');
  hud.destroy();
}

// Interactions suppress expected lifetime aborts only. Real callback failures
// still reach the error channel, and dispose clears every registered gate.
{
  const lifetime = new AbortController();
  const camera = new THREE.PerspectiveCamera(46, 4 / 3, 0.1, 50);
  camera.position.set(0, 2, 5);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  const canvas = new FakeElement('canvas');
  const interactions = new Interactables({ camera, dom: canvas, signal: lifetime.signal, getPlayerPos: () => ({ x: 0, z: 0 }) });
  const seen = [];
  const originalError = console.error;
  console.error = (...args) => seen.push(args);
  try {
    interactions._active = { onInteract: () => Promise.reject(makeAbortError('expected exit')) };
    await interactions._interact();
    assert.equal(seen.length, 0, 'expected AbortError was logged as a game error');

    interactions._active = { onInteract: () => Promise.reject(new Error('real failure')) };
    await interactions._interact();
    assert.equal(seen.length, 1, 'real interaction failure was suppressed');
  } finally {
    console.error = originalError;
  }
  interactions.addPrompt({ id: 'p' });
  interactions.addTrigger({ id: 't' });
  lifetime.abort(makeAbortError('interaction test exit'));
  assert.equal(interactions.enabled, false);
  interactions.dispose();
  assert.equal(interactions.prompts.length, 0);
  assert.equal(interactions.triggers.length, 0);
}

// Pointer hover is frame-owned: a 1000 Hz gaming mouse must not perform 1000
// skinned-hierarchy raycasts outside the app governor. Pointerdown remains the
// separate immediate interaction path.
{
  const camera = new THREE.PerspectiveCamera(46, 4 / 3, 0.1, 50);
  camera.position.set(0, 2, 5);
  camera.lookAt(0, 1, 0);
  camera.updateMatrixWorld(true);
  const canvas = new FakeElement('canvas');
  const interactions = new Interactables({ camera, dom: canvas, getPlayerPos: () => ({ x: 0, z: 0 }) });
  interactions.addPrompt({
    id: 'hover', label: 'Talk', x: 0, z: 0, r: 3,
    object: new THREE.Object3D(), onInteract() {},
  });
  let casts = 0;
  interactions._castHit = () => { casts += 1; return true; };
  const hoverScratch = interactions._hoverPoint;
  for (let i = 0; i < 1000; i++) {
    canvas.dispatchEvent({ type: 'pointermove', target: canvas, clientX: i % 800, clientY: i % 600 });
  }
  assert.equal(casts, 0, 'pointermove raycast escaped the frame governor');
  assert.equal(interactions._hoverPoint, hoverScratch, 'pointermove allocated a new point object');
  interactions.update();
  assert.equal(casts, 1, 'more than one hover raycast ran in one update');
  interactions.update();
  assert.equal(casts, 1, 'unchanged pointer was raycast again');
  interactions.dispose();
}

// Character clicks accept only the primary pointer's primary button. A
// right-click or a second touch contact must never advance a story gate.
{
  const camera = new THREE.PerspectiveCamera(46, 4 / 3, 0.1, 50);
  const canvas = new FakeElement('canvas');
  const interactions = new Interactables({ camera, dom: canvas, getPlayerPos: () => ({ x: 0, z: 0 }) });
  interactions._active = { object: new THREE.Object3D() };
  interactions._castHit = () => true;
  let activations = 0;
  interactions._interact = () => { activations += 1; };

  canvas.dispatchEvent({
    type: 'pointerdown', target: canvas, clientX: 0, clientY: 0,
    pointerType: 'mouse', isPrimary: true, button: 2,
  });
  canvas.dispatchEvent({
    type: 'pointerdown', target: canvas, clientX: 0, clientY: 0,
    pointerType: 'touch', isPrimary: false, button: 0,
  });
  assert.equal(activations, 0, 'secondary pointer advanced an interaction');

  canvas.dispatchEvent({
    type: 'pointerdown', target: canvas, clientX: 0, clientY: 0,
    pointerType: 'mouse', isPrimary: true, button: 0,
  });
  assert.equal(activations, 1, 'primary pointer did not activate the interaction');
  interactions.dispose();
}

// Raw gameplay gates get the same immediate lifetime settlement as Sequencer
// waits, even when their underlying trigger has not fired.
{
  const lifetime = new AbortController();
  const gate = withAbort(() => new Promise(() => {}), lifetime.signal);
  lifetime.abort(makeAbortError('gate test exit'));
  await assert.rejects(gate, { name: 'AbortError' });
}

console.log('Dialogue, HUD, interaction, and gameplay-gate lifetime checks passed.');
