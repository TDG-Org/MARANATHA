// THE HEADLESS DOM — shared by every test that needs to run real game code
// without a browser.
//
// Verifying through the Browser pane meant a dev server, a navigation, an
// HMR reload that wiped every patch, 30-second timeouts, duplicate module
// instances from console imports, and a pane that cannot composite a frame
// anyway. This boots the same modules in-process in about a second, and what
// it proves stays proven because it lives in the suite.
//
// Extracted verbatim from test-shell-ui-behavior.mjs (which now imports it),
// then extended with the canvas/Image surface a 3D scene needs.

class FakeTarget {
  constructor() { this._l = new Map(); }
  addEventListener(type, fn) {
    if (!this._l.has(type)) this._l.set(type, new Set());
    this._l.get(type).add(fn);
  }
  removeEventListener(type, fn) { this._l.get(type)?.delete(fn); }
  dispatchEvent(event) {
    event.target ??= this;
    event.preventDefault ??= () => { event.defaultPrevented = true; };
    event.stopPropagation ??= () => {};
    event.stopImmediatePropagation ??= () => {};
    for (const fn of [...(this._l.get(event.type) || [])]) fn(event);
    return !event.defaultPrevented;
  }
  listenerCount(type) { return this._l.get(type)?.size || 0; }
}

class FakeClassList {
  constructor() { this._s = new Set(); }
  add(c) { this._s.add(c); }
  remove(c) { this._s.delete(c); }
  toggle(c, on) { if (on === undefined) { if (this._s.has(c)) this._s.delete(c); else this._s.add(c); } else if (on) this._s.add(c); else this._s.delete(c); }
  contains(c) { return this._s.has(c); }
}

// A CSSStyleDeclaration behaves in one way this suite must reproduce exactly:
// `cssText` POPULATES the individual properties, so writing '' to one of them
// later DELETES that declaration rather than reverting to the cssText value.
// That is the whole shape of the pause-blur defect below; a plain {} stub
// would have let the bug pass.
class FakeStyle {
  set cssText(text) {
    for (const decl of String(text).split(';')) {
      const i = decl.indexOf(':');
      if (i < 0) continue;
      const prop = decl.slice(0, i).trim().replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      if (prop) this[prop] = decl.slice(i + 1).trim();
    }
  }
  get cssText() { return Object.keys(this).map((k) => `${k}:${this[k]}`).join(';'); }
}

class FakeElement extends FakeTarget {
  constructor(tag = 'div') {
    super();
    this.tagName = tag.toUpperCase();
    this.style = new FakeStyle();
    this.children = [];
    this.parentNode = null;
    this.textContent = '';
    this.className = '';
    this.dataset = {};
    this.attributes = new Map();
    this.classList = new FakeClassList();
    this.inert = false;
    this.offsetWidth = 100;
    this.scrollHeight = 40;
    this.clientHeight = 40;
    this.focusCount = 0;
  }
  append(...nodes) { for (const n of nodes) { n.parentNode = this; this.children.push(n); } }
  appendChild(n) { this.append(n); return n; }
  remove() {
    if (!this.parentNode) return;
    const i = this.parentNode.children.indexOf(this);
    if (i >= 0) this.parentNode.children.splice(i, 1);
    this.parentNode = null;
  }
  setAttribute(n, v) { this.attributes.set(n, String(v)); }
  getAttribute(n) { return this.attributes.get(n) ?? null; }
  removeAttribute(n) { this.attributes.delete(n); }
  hasAttribute(n) { return this.attributes.has(n); }
  contains(node) { return node === this || this.children.some((c) => c.contains?.(node)); }
  getBoundingClientRect() { return { left: 0, top: 0, width: 800, height: 600 }; }
  animate() { return { cancel() {} }; }
  focus() { this.focusCount += 1; document.activeElement = this; }
  blur() { if (document.activeElement === this) document.activeElement = document.body; }
}

const win = new FakeTarget();
win.innerWidth = 800;
win.innerHeight = 600;
win.devicePixelRatio = 1;
win.matchMedia = () => ({ matches: false });
win.location = { hash: '' };
win.requestIdleCallback = () => {}; // deterministic: no engine prefetch mid-test
const doc = new FakeTarget();
doc.hidden = false;
doc.body = new FakeElement('body');
doc.head = new FakeElement('head');
doc.createElement = (tag) => new FakeElement(tag);
doc.getElementById = () => null;
doc.activeElement = doc.body;

globalThis.window = win;
globalThis.document = doc;
// node 24 exposes a getter-only navigator — redefine rather than assign
Object.defineProperty(globalThis, 'navigator', {
  value: { userAgent: 'node', hardwareConcurrency: 8, deviceMemory: 8 },
  configurable: true,
});
globalThis.screen = { width: 1920, height: 1080 };
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
globalThis.requestAnimationFrame = (fn) => setTimeout(() => fn(performance.now()), 0);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);

// ── WHAT A 3D SCENE ADDITIONALLY NEEDS ──────────────────────────────────────
// All the art in this game is drawn into a canvas at load time, and textures
// stream through Image. Neither is ever READ in Node — three.js only uploads
// them to a GL context that does not exist here — so a recording no-op is
// enough, and it keeps the harness dependency-free.

const noop = () => {};
class FakeCanvasContext {
  constructor() {
    this.calls = 0;
    this.filter = 'none';
    this.globalAlpha = 1;
    this.globalCompositeOperation = 'source-over';
  }
  _hit() { this.calls += 1; }
}
for (const m of [
  'fillRect', 'clearRect', 'strokeRect', 'beginPath', 'closePath', 'moveTo',
  'lineTo', 'arc', 'ellipse', 'rect', 'fill', 'stroke', 'save', 'restore',
  'translate', 'scale', 'rotate', 'setTransform', 'drawImage', 'clip',
  'quadraticCurveTo', 'bezierCurveTo', 'fillText', 'strokeText', 'putImageData',
]) FakeCanvasContext.prototype[m] = function () { this._hit(); };
FakeCanvasContext.prototype.createRadialGradient = function () { this._hit(); return { addColorStop: noop }; };
FakeCanvasContext.prototype.createLinearGradient = function () { this._hit(); return { addColorStop: noop }; };
FakeCanvasContext.prototype.createPattern = function () { this._hit(); return {}; };
FakeCanvasContext.prototype.measureText = function () { return { width: 10 }; };
FakeCanvasContext.prototype.getImageData = function (x, y, w, h) {
  return { data: new Uint8ClampedArray(Math.max(1, w * h * 4)), width: w, height: h };
};

const baseCreate = doc.createElement.bind(doc);
doc.createElement = (tag) => {
  const el = baseCreate(tag);
  if (String(tag).toLowerCase() === 'canvas') {
    el.width = 300;
    el.height = 150;
    const ctx = new FakeCanvasContext();
    el.getContext = () => ctx;
    el.toDataURL = () => 'data:image/png;base64,';
  }
  return el;
};

// Textures "load" immediately and successfully: a scene's readiness contract
// waits on decode, and nothing here is going to produce pixels anyway.
class FakeImage {
  constructor() {
    this.width = 4; this.height = 4;
    this.naturalWidth = 4; this.naturalHeight = 4;
    this.complete = false;
    this._src = '';
  }
  addEventListener(type, fn) { if (type === 'load') this._onload = fn; }
  removeEventListener() {}
  decode() { return Promise.resolve(); }
  set src(v) {
    this._src = v;
    this.complete = true;
    queueMicrotask(() => { this.onload?.(); this._onload?.(); });
  }
  get src() { return this._src; }
}
globalThis.Image = FakeImage;
globalThis.HTMLImageElement = FakeImage;
globalThis.HTMLCanvasElement = class {};
globalThis.KeyboardEvent = class KeyboardEvent {
  constructor(type, init = {}) { this.type = type; this.key = init.key ?? ''; Object.assign(this, init); }
};
globalThis.CustomEvent = class CustomEvent {
  constructor(type, init = {}) { this.type = type; this.detail = init.detail; }
};
globalThis.Event = globalThis.Event || class { constructor(type) { this.type = type; } };

export { win as window, doc as document, store, FakeElement, FakeTarget, FakeStyle, FakeClassList };

// THE MODEL FILES ARE NOT REACHABLE FROM NODE, AND THAT MUST FAIL CLEANLY.
//
// `fetch('models/character-base.glb')` throws SYNCHRONOUSLY in Node (a relative
// URL with no base cannot be parsed), and three's FileLoader dedupes in-flight
// requests through a module-level map. A synchronous throw escapes before that
// entry is cleaned up, so the FIRST load fails fast and every later one attaches
// to a dead entry and hangs forever — which is exactly how a second scene boot
// stopped resolving. (Confirmed harness-only: the browser re-enters the scene
// repeatedly with a clean leak census, because there the files exist.)
//
// An asynchronous rejection is what a real missing file produces, and the game
// already has a path for it: CharacterFactory falls back to capsule stand-ins.
// The throw is in `new Request(url)`, BEFORE fetch is ever called — which is
// why stubbing fetch alone did not help. Give Request a parser that accepts a
// relative path, and the rejection then happens asynchronously in fetch, where
// three's own error path cleans the in-flight entry up properly.
globalThis.Request = class Request {
  constructor(url, init = {}) { this.url = String(url); Object.assign(this, init); }
};
globalThis.Response = globalThis.Response || class Response {};
globalThis.Headers = globalThis.Headers || class Headers { get() { return null; } };
globalThis.fetch = () => Promise.reject(new Error('harness: no network'));
globalThis.XMLHttpRequest = class {
  open() {} setRequestHeader() {} overrideMimeType() {}
  addEventListener(type, fn) { if (type === 'error') this._err = fn; }
  send() { queueMicrotask(() => this._err?.(new Error('harness: no network'))); }
};
