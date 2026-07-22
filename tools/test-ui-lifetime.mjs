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
  }
  append(...nodes) { for (const node of nodes) { node.parentNode = this; this.children.push(node); } }
  prepend(...nodes) { for (const node of nodes.reverse()) { node.parentNode = this; this.children.unshift(node); } }
  remove() {
    if (!this.parentNode) return;
    const i = this.parentNode.children.indexOf(this);
    if (i >= 0) this.parentNode.children.splice(i, 1);
    this.parentNode = null;
  }
  setAttribute() {}
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
const { Interactables } = await import('../src/engine/Interactables.js');
const baselineKeyListeners = fakeWindow.listenerCount('keydown');

const click = (el) => el.dispatchEvent({ type: 'click', target: el });
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

// Raw gameplay gates get the same immediate lifetime settlement as Sequencer
// waits, even when their underlying trigger has not fired.
{
  const lifetime = new AbortController();
  const gate = withAbort(() => new Promise(() => {}), lifetime.signal);
  lifetime.abort(makeAbortError('gate test exit'));
  await assert.rejects(gate, { name: 'AbortError' });
}

console.log('Dialogue, HUD, interaction, and gameplay-gate lifetime checks passed.');
