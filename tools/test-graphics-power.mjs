import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  GRAPHICS_PRESETS,
  GraphicsSystem,
  particleCapacity,
} from '../src/systems/Graphics.js';
import { AdaptiveQuality } from '../src/core/quality.js';
import { createFramePacer } from '../src/core/framePacer.js';
import { rendererAntialias, rendererPowerPreference, startLoop } from '../src/core/renderer.js';

class MemoryStorage {
  constructor(entries = {}) { this.values = new Map(Object.entries(entries)); }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
}

class RendererFake {
  constructor() {
    this.ratios = [];
    this.sizes = [];
  }

  setPixelRatio(ratio) { this.ratios.push(ratio); }
  setSize(width, height) { this.sizes.push([width, height]); }
}

function wire(graphics, quality, dpr = 2) {
  return graphics.subscribe((state, change) => {
    const base = Math.min(dpr, state.dprCap);
    quality.setBase(base, { raise: change?.source === 'explicit' });
  });
}

function slowFrames(graphics, count) {
  for (let i = 0; i < count; i += 1) graphics.sampleFrame(26);
}

// Hover motion alone must not pin the whole app at 60fps. Intentional input
// events still wake full-rate mode; Interactables owns coalesced hover work.
{
  const appSource = readFileSync(new URL('../src/core/app.js', import.meta.url), 'utf8');
  assert.doesNotMatch(appSource, /addEventListener\(['"]pointermove['"],\s*noteActivity/);
  for (const event of ['pointerdown', 'keydown', 'wheel', 'touchstart']) {
    assert.match(appSource, new RegExp(`addEventListener\\(['\"]${event}['\"],\\s*noteActivity`));
  }
  const homeSource = readFileSync(new URL('../src/screens/home.js', import.meta.url), 'utf8');
  assert.doesNotMatch(homeSource, /animation:\s*[^;'"]*infinite/,
    'home bypasses the frame governor with an infinite CSS animation');
  assert.match(homeSource, /for \(const a of animatedNodes\)/,
    'home node motion is not owned by the governed update loop');
  const loaderSource = readFileSync(new URL('../src/ui/loader.js', import.meta.url), 'utf8');
  assert.match(loaderSource, /visible && !document\.hidden \? 'running' : 'paused'/,
    'loader animation state does not follow visibility');
  assert.match(loaderSource, /addEventListener\('visibilitychange', syncAnimation\)/,
    'a hidden loader can keep waking the compositor');
  const sceneSource = readFileSync(new URL('../src/scenes/joseph3d/index.js', import.meta.url), 'utf8');
  assert.match(
    sceneSource,
    /const applyLiveGraphics[\s\S]*scene\.fog\.far = graphics\.fogFar[\s\S]*setActiveCount[\s\S]*setParticleScale[\s\S]*syncContactShadows/,
    'live preset demotion updates only DPR and leaves scene extras at the old tier',
  );
  assert.match(sceneSource, /unsubscribeGraphics = Graphics\.subscribe[\s\S]*unsubscribeGraphics\(\)/,
    'Scene 1 leaks its live graphics subscription');
  for (const base of [16, 26, 30, 70]) {
    assert.equal(
      particleCapacity(base),
      Math.round(base * GRAPHICS_PRESETS.high.particleScale),
      `particle capacity for ${base} cannot restore the High preset`,
    );
  }
  assert.match(
    sceneSource,
    /makeMotes\(\{ count: particleCapacity\(70\)[\s\S]*makeSmoke\(\{ count: particleCapacity\(30\)[\s\S]*makeEmbers\(\{ count: particleCapacity\(16\)[\s\S]*makeFireflies\(\{ count: particleCapacity\(26\)/,
    'Scene 1 allocates particles at the entry preset and cannot promote live',
  );
  const dreamSource = readFileSync(new URL('../src/scenes/joseph3d/dreamField.js', import.meta.url), 'utf8');
  assert.match(
    dreamSource,
    /const moteCount = particleCapacity\(MOTE_BASE\)[\s\S]*const FIREFLY_N = particleCapacity\(FIREFLY_BASE\)/,
    'dream particles cannot restore High density after a lower entry preset',
  );
}

// New and remembered automatic policy may never boot above Medium.
{
  const detected = new GraphicsSystem({
    storage: new MemoryStorage(),
    detectedPreset: 'high',
    sampleFrames: 4,
    cooldownFrames: 2,
  });
  assert.equal(detected.name, 'medium');
  assert.equal(detected.provenance, 'auto');
  assert.equal(detected.autoDetected, true);
  assert.equal(detected.contactShadow, true,
    'default Medium lost the one-draw character grounding cue');
  assert.equal(detected.anisotropy, 4, 'default Medium lost signed-off ground filtering');
  assert.equal(rendererPowerPreference(detected), 'low-power');
  for (let i = 0; i < 20; i += 1) detected.sampleFrame(5);
  assert.equal(detected.name, 'medium', 'paced fast deltas must never promote');

  const storage = new MemoryStorage({ 'maranatha-graphics-auto': 'high' });
  const remembered = new GraphicsSystem({ storage, detectedPreset: 'low' });
  assert.equal(remembered.name, 'low');
  assert.equal(remembered.anisotropy, 1, 'Low still pays for high anisotropic filtering');
  assert.equal(storage.getItem('maranatha-graphics-auto'), 'low');

  const rememberedMedium = new GraphicsSystem({
    storage: new MemoryStorage({ 'maranatha-graphics-auto': 'medium' }),
    detectedPreset: 'low',
  });
  assert.equal(rememberedMedium.name, 'low',
    'a prior desktop auto result overrode current low-end detection');
}

// Exact 60-render/s cadence on fractional high-refresh displays alternates
// short and long frame deltas. The integrated pacer+tuner must never mistake
// that healthy schedule for sustained slowness.
for (const hz of [60, 85, 90, 120, 140, 144, 165, 240]) {
  const graphics = new GraphicsSystem({
    storage: new MemoryStorage(),
    detectedPreset: 'medium',
    sampleFrames: 600,
    cooldownFrames: 0,
  });
  const pacer = createFramePacer(0);
  let now = 0;
  let samples = 0;
  while (samples < 620) {
    now += 1000 / hz;
    if (!pacer.advance(now, 60)) continue;
    graphics.sampleFrame(pacer.dt);
    samples += 1;
  }
  assert.equal(graphics.name, 'medium', `${hz}Hz healthy cadence falsely demoted`);
}

// Alternating fast/late frames used to cancel in the old +1/-1 vote forever,
// even though the game was delivering an uneven 50fps. Both the preset tuner
// and the DPR governor must now respond to that bounded-window evidence.
{
  const graphics = new GraphicsSystem({
    storage: new MemoryStorage(),
    detectedPreset: 'medium',
    sampleFrames: 120,
    cooldownFrames: 0,
  });
  const renderer = new RendererFake();
  const quality = new AdaptiveQuality(renderer, { basePixelRatio: 1.5 });
  for (let i = 0; i < 120; i += 1) {
    const dt = i % 2 === 0 ? 10 : 30;
    graphics.sampleFrame(dt);
    quality.frame(dt);
  }
  assert.equal(graphics.name, 'low', 'alternating 10/30ms pressure did not lower the auto preset');
  assert.equal(quality.ratio, 1.25, 'alternating 10/30ms pressure did not lower DPR');
}

// Defensive legacy-state proof: repeated sustained samples step
// High -> Medium -> Low, with a cooldown and a monotonically falling DPR.
// Production clamps this state to Medium at boot, but the tuner remains safe
// if an already-running/legacy state ever presents High.
{
  const graphics = new GraphicsSystem({
    storage: new MemoryStorage(),
    detectedPreset: 'medium',
  });
  graphics.name = 'high';
  const renderer = new RendererFake();
  const quality = new AdaptiveQuality(renderer, { basePixelRatio: 2 });
  const ratios = [quality.ratio];
  const presets = [graphics.name];
  graphics.subscribe((state, change) => {
    quality.setBase(state.dprCap, { raise: change?.source === 'explicit' });
    presets.push(state.name);
    ratios.push(quality.ratio);
  });

  slowFrames(graphics, 600);
  assert.equal(graphics.name, 'medium');
  slowFrames(graphics, 300);
  assert.equal(graphics.name, 'medium', 'cooldown must prevent an immediate second step');
  slowFrames(graphics, 600);
  assert.equal(graphics.name, 'low');
  assert.deepEqual(presets, ['high', 'medium', 'low']);
  assert.deepEqual(ratios, [2, 1.5, 1]);
  assert.ok(ratios.every((ratio, index) => index === 0 || ratio <= ratios[index - 1]));

  slowFrames(graphics, 20);
  assert.equal(graphics.name, 'low', 'automatic quality must never promote');
}

// Browser zoom can report a native DPR below 1; the automatic clamp must not
// raise that ratio either.
{
  const renderer = new RendererFake();
  const quality = new AdaptiveQuality(renderer, { basePixelRatio: 0.8 });
  quality.setBase(0.8);
  assert.equal(quality.ratio, 0.8);
  quality.setBase(1.5, { raise: false });
  assert.equal(quality.ratio, 0.8,
    'a native-DPR rise silently raised a sticky-down sub-1 render ratio');
}

// A native-DPR drop is monotonic even if a later resize reports more pixels;
// only a fresh explicit preset action may raise the buffer again.
{
  const renderer = new RendererFake();
  const quality = new AdaptiveQuality(renderer, { basePixelRatio: 2 });
  quality.setBase(1, { raise: false });
  assert.equal(quality.ratio, 1);
  quality.setBase(2, { raise: false });
  assert.equal(quality.ratio, 1);
  const appSource = readFileSync(new URL('../src/core/app.js', import.meta.url), 'utf8');
  assert.match(appSource, /quality\.setBase\(Math\.min\(dpr\(\), Graphics\.dprCap\), \{ raise: false \}\)/);
}

// Regression for the original inversion: if adaptive DPR already reached 1,
// an automatic High -> Medium demotion must not restore it to 1.5.
{
  const graphics = new GraphicsSystem({
    storage: new MemoryStorage(),
    detectedPreset: 'medium',
    sampleFrames: 4,
    cooldownFrames: 0,
  });
  graphics.name = 'high';
  const renderer = new RendererFake();
  const quality = new AdaptiveQuality(renderer, { basePixelRatio: 2 });
  quality.set(1);
  wire(graphics, quality);
  slowFrames(graphics, 4);
  assert.equal(graphics.name, 'medium');
  assert.equal(quality.base, GRAPHICS_PRESETS.medium.dprCap);
  assert.equal(quality.ratio, 1);
}

// A player's choice is sacred: it restores the requested base, records
// explicit provenance, is never auto-demoted, and only explicit High asks for
// the high-performance GPU.
{
  const storage = new MemoryStorage();
  const graphics = new GraphicsSystem({
    storage,
    detectedPreset: 'medium',
    sampleFrames: 4,
    cooldownFrames: 0,
  });
  const renderer = new RendererFake();
  const quality = new AdaptiveQuality(renderer, { basePixelRatio: 1.5 });
  quality.set(1);
  wire(graphics, quality);

  graphics.set('high');
  assert.equal(graphics.name, 'high');
  assert.equal(graphics.provenance, 'explicit');
  assert.equal(graphics.autoDetected, false);
  assert.equal(storage.getItem('maranatha-graphics-v1'), 'high');
  assert.equal(quality.base, 2);
  assert.equal(quality.ratio, 2);
  assert.equal(rendererPowerPreference(graphics), 'high-performance');

  slowFrames(graphics, 40);
  assert.equal(graphics.name, 'high');
  quality.set(1);
  graphics.set('high');
  assert.equal(quality.ratio, 2, 'reselecting explicit High may restore its full DPR');
  assert.equal(rendererPowerPreference({ name: 'high', provenance: 'auto' }), 'low-power');
  assert.equal(rendererPowerPreference({ name: 'medium', provenance: 'explicit' }), 'low-power');
  assert.equal(rendererAntialias({ name: 'high' }), true);
  assert.equal(rendererAntialias({ name: 'medium' }), true);
  assert.equal(rendererAntialias({ name: 'low' }), false,
    'Low should not pay the MSAA storage/resolve cost');
}

// Selecting the same auto preset still makes it an explicit player choice.
{
  const storage = new MemoryStorage();
  const graphics = new GraphicsSystem({ storage, detectedPreset: 'medium' });
  graphics.set('medium');
  assert.equal(graphics.provenance, 'explicit');
  assert.equal(storage.getItem('maranatha-graphics-v1'), 'medium');
}

// Manual pause/navigation ownership must survive hide→show. Visibility may
// restart a normally enabled loop, but never one the app explicitly stopped.
{
  const originalDocument = globalThis.document;
  const originalRAF = globalThis.requestAnimationFrame;
  const originalCancelRAF = globalThis.cancelAnimationFrame;
  let visibilityHandler = null;
  let nextRAF = 0;
  const pending = new Set();
  globalThis.document = {
    hidden: false,
    addEventListener(type, fn) {
      if (type === 'visibilitychange') visibilityHandler = fn;
    },
  };
  globalThis.requestAnimationFrame = () => {
    nextRAF += 1;
    pending.add(nextRAF);
    return nextRAF;
  };
  globalThis.cancelAnimationFrame = (id) => pending.delete(id);

  const loop = startLoop(() => {});
  assert.equal(pending.size, 1);
  loop.stop();
  assert.equal(pending.size, 0);
  globalThis.document.hidden = true;
  visibilityHandler();
  globalThis.document.hidden = false;
  visibilityHandler();
  assert.equal(pending.size, 0, 'tab show restarted a manually paused loop');
  loop.start();
  assert.equal(pending.size, 1);
  loop.stop();

  if (originalDocument === undefined) delete globalThis.document;
  else globalThis.document = originalDocument;
  if (originalRAF === undefined) delete globalThis.requestAnimationFrame;
  else globalThis.requestAnimationFrame = originalRAF;
  if (originalCancelRAF === undefined) delete globalThis.cancelAnimationFrame;
  else globalThis.cancelAnimationFrame = originalCancelRAF;
}

console.log('Graphics quality and GPU power policy checks passed.');
