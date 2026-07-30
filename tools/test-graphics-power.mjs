import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  GRAPHICS_PRESETS,
  GraphicsSystem,
  particleCapacity,
} from '../src/systems/Graphics.js';
import { AdaptiveQuality, RateGovernor } from '../src/core/quality.js';
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
  // The home is now a flat DOM screen: it submits no GPU frames and runs no
  // per-frame JS at all. Its motion is CSS, so the power contract moved from
  // "the governed loop owns it" to "the compositor owns it and can be stopped".
  const homeSource = readFileSync(new URL('../src/screens/home/index.js', import.meta.url), 'utf8');
  assert.match(homeSource, /update\(\) \{\}/,
    'the flat home regained per-frame JS work');
  // Exactly one rAF is allowed: the single-shot reveal that flips `is-in` after
  // the first paint. Anything more is a private animation loop running outside
  // the governor, which is how a "free" menu quietly costs a core.
  assert.equal(
    (homeSource.match(/requestAnimationFrame/g) || []).length, 1,
    'the home gained a private rAF loop outside the frame governor',
  );
  assert.match(homeSource, /requestAnimationFrame\(reveal\)/,
    'the home’s one allowed rAF is no longer the single-shot reveal');

  // Every home keyframe must animate ONLY transform/opacity. Those are the two
  // properties the compositor animates by itself; anything else (the design's
  // marching `stroke-dashoffset`, a colour, a filter, a size) drags the main
  // thread into a repaint on every single frame for as long as the menu is up.
  const stylesSource = readFileSync(new URL('../src/screens/home/styles.js', import.meta.url), 'utf8');
  const keyframeBlocks = stylesSource.match(/@keyframes\s+\w+\s*\{[\s\S]*?\n?\}/g) || [];
  assert.ok(keyframeBlocks.length >= 10, 'home keyframes were not found to audit');
  for (const block of keyframeBlocks) {
    const name = block.match(/@keyframes\s+(\w+)/)[1];
    const props = [...block.matchAll(/([a-z-]+)\s*:/gi)].map((m) => m[1].toLowerCase());
    for (const prop of props) {
      assert.ok(
        prop === 'transform' || prop === 'opacity',
        `@keyframes ${name} animates "${prop}" — only transform/opacity stay on the compositor`,
      );
    }
  }
  // ── AND NEITHER MAY A TRANSITION ────────────────────────────────────────
  // The keyframe law above only covers the vista's idle motion. Everything the
  // player actually TOUCHES is a `transition`, and those were never audited:
  // the Start Story button animated `letter-spacing`, so hovering the one
  // button the whole menu is built around ran a layout pass over the panel
  // subtree on every frame of a 300ms transition. The full-screen map band
  // animated `filter`, re-running a 7px blur over the entire viewport ~18 times
  // every time the player opened About.
  //
  // Banned outright: anything that forces LAYOUT, and anything that re-filters
  // a full-screen surface. Paint-only properties on small controls (background,
  // border-color, colour) stay allowed — they are a different order of cost.
  const FORBIDDEN_TRANSITIONS = [
    'letter-spacing', 'word-spacing', 'width', 'height', 'top', 'left', 'right',
    'bottom', 'margin', 'padding', 'font-size', 'line-height', 'filter',
    'backdrop-filter', 'all',
  ];
  for (const [, selector, body] of stylesSource.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const transition = body.match(/(?:^|;)\s*transition:\s*([^;]+)/);
    if (!transition) continue;
    for (const part of transition[1].split(',')) {
      const prop = part.trim().split(/\s+/)[0].toLowerCase();
      assert.ok(
        !FORBIDDEN_TRANSITIONS.includes(prop),
        `"${selector.trim()}" transitions "${prop}" — that is a layout or full-surface repaint on every frame of the transition`,
      );
    }
  }

  // The hover light is MARKUP in atlas.js and a SELECTOR in styles.js. A typo in
  // either leaves the stops with no hover feedback at all and nothing to see —
  // the same silent-failure shape as a pose driver that never runs. Check they
  // still refer to the same thing, and that the paint-y version is gone.
  {
    const { nodeHtml } = await import('../src/screens/home/atlas.js');
    const markup = nodeHtml({
      id: 'joseph', ord: 'I', title: 'Joseph', passage: 'Gen 37', era: 'patriarchs',
      size: 44, x: 100, y: 200, tier: 'major', status: 'todo', built: true,
      reachable: true, blurb: '',
    });
    assert.match(markup, /data-hoverglow="1"/, 'chapter stops lost their hover light');
    assert.match(markup, /data-hoverglow[^>]*transition:opacity/, 'the hover light no longer fades');
    assert.doesNotMatch(markup, /brightness/, 'a brightness filter came back onto the stops');
    assert.match(
      stylesSource, /\.mr-node:hover \[data-hoverglow\][^{]*\{[^}]*opacity: *1/,
      'the stylesheet no longer lights the hover glow it is paired with',
    );
    assert.doesNotMatch(
      stylesSource, /\.mr-node:hover[^{]*\{[^}]*filter:/,
      'the chapter stops hover with a filter again',
    );
  }

  // The road's dashes may never march again: the generated backdrop still ships
  // the design's mrDash, so the screen has to keep rewriting it on the way in.
  assert.match(homeSource, /animRe\('Dash'\), 'animation:mrShimmer/,
    'the road no longer converts the design’s stroke-dashoffset march to a composited shimmer');
  assert.doesNotMatch(stylesSource, /@keyframes mrDash/,
    'the stroke-dashoffset keyframe came back');

  // Hidden OR unfocused parks the vista. A visible-but-unfocused window is the
  // second-monitor case the browser does NOT throttle for us.
  assert.match(homeSource, /document\.hidden \|\| !document\.hasFocus\(\)/,
    'the home no longer parks its animations when nobody is watching');
  for (const event of ['visibilitychange', 'blur', 'focus']) {
    assert.ok(
      homeSource.includes(`removeEventListener('${event}', syncMotion)`),
      `home leaks its ${event} motion listener`,
    );
  }
  assert.match(stylesSource, /\.mr-still .mr-band \*[^}]*animation-play-state: paused/,
    'the parked-menu class no longer pauses the vista');
  // The number of point lights in the scene is part of every lit material's
  // shader cache key. Hiding a light REMOVES it from the light list, so a stage
  // that toggles visibility makes the whole world recompile its programs the
  // first time that stage appears — a hitch landing exactly on a cut. Lights
  // may be dimmed; they may not be hidden.
  const josephSource = readFileSync(new URL('../src/scenes/joseph3d/index.js', import.meta.url), 'utf8');
  const pitSource = readFileSync(new URL('../src/scenes/joseph3d/pit.js', import.meta.url), 'utf8');
  assert.doesNotMatch(josephSource, /light\.visible\s*=/,
    'a stage hides a light again — that changes the point-light count and recompiles shaders on a cut');
  assert.match(josephSource, /if \(!campOn\) for \(const f of fireLights\) f\.light\.intensity = 0;/,
    'off-stage fire lights are no longer dimmed to zero');
  assert.match(josephSource, /scene\.add\(pit\.shaftLight\)/,
    'the pit shaft light went back inside the hidden stage group');
  assert.doesNotMatch(pitSource, /group\.add\(shaftLight\)/,
    'the pit shaft light is parented to the stage group again');

  // The sky dome writes no depth and sits on the camera, so the default sort
  // draws it first and every one of its pixels is shaded then painted over.
  const worldSource = readFileSync(new URL('../src/engine/world.js', import.meta.url), 'utf8');
  assert.match(worldSource, /mesh\.renderOrder = 999/,
    'the sky dome no longer draws last — its fill is being shaded and then overdrawn');

  const loaderSource = readFileSync(new URL('../src/ui/loader.js', import.meta.url), 'utf8');
  assert.match(loaderSource, /visible && !document\.hidden && !prefersReducedMotion\(\) \? 'running' : 'paused'/,
    'loader animation state does not follow visibility + reduced-motion');
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
  const postFxSource = readFileSync(new URL('../src/engine/PostFX.js', import.meta.url), 'utf8');
  assert.doesNotMatch(
    postFxSource,
    /mix-blend-mode:screen/,
    'dream still forces a full-frame screen-blend compositor surface',
  );
  assert.match(
    postFxSource,
    /dream:\s*''/,
    'dream still stacks a second live-canvas color filter over its authored mood lighting',
  );
  assert.match(
    postFxSource,
    /next === this\._lastCanvasFilter[\s\S]*return false/,
    'unchanged full-canvas filter writes are not change-gated',
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
  // An unknown desktop must ask for 'default', NOT 'low-power'. Forcing
  // low-power handed a gaming PC's whole game to its integrated GPU and there
  // was no way to see it from the outside — the browser already knows about
  // mains/battery, the display's GPU, and the OS power profile.
  assert.equal(rendererPowerPreference(detected), 'default',
    'an unknown desktop is being forced onto low-power graphics again');
  assert.equal(rendererPowerPreference({ name: 'low', provenance: 'auto' }), 'low-power',
    'the Low preset should still ask for the efficient GPU');
  assert.equal(rendererPowerPreference({ name: 'high', provenance: 'explicit' }), 'high-performance',
    'an explicit High no longer asks for the fast GPU');

  for (let i = 0; i < 20; i += 1) detected.sampleFrame(5);
  assert.equal(detected.name, 'medium', 'paced fast deltas must never promote');

  // ...but MEASURED WORK may. A machine finishing a frame in a third of its
  // budget is not being served by Medium, and before this the only route up was
  // the player finding the setting by hand.
  const roomy = new GraphicsSystem({
    storage: new MemoryStorage(), detectedPreset: 'high', sampleFrames: 4, cooldownFrames: 0,
  });
  assert.equal(roomy.name, 'medium');
  for (let i = 0; i < 4; i += 1) roomy.sampleWork(3.2);
  assert.equal(roomy.name, 'high', 'a machine with obvious headroom never reached High');
  assert.equal(roomy.provenance, 'auto', 'an automatic promotion must not masquerade as a player choice');
  for (let i = 0; i < 8; i += 1) roomy.sampleWork(3.2);
  assert.equal(roomy.name, 'high', 'promotion must happen at most once per session');

  // A machine that is merely keeping up must be left alone.
  const busy = new GraphicsSystem({
    storage: new MemoryStorage(), detectedPreset: 'high', sampleFrames: 4, cooldownFrames: 0,
  });
  for (let i = 0; i < 12; i += 1) busy.sampleWork(11);
  assert.equal(busy.name, 'medium', 'a frame already using most of its budget was promoted anyway');

  // One near-budget frame in the window is enough to stand down.
  const spiky = new GraphicsSystem({
    storage: new MemoryStorage(), detectedPreset: 'high', sampleFrames: 4, cooldownFrames: 0,
  });
  spiky.sampleWork(3); spiky.sampleWork(3); spiky.sampleWork(3); spiky.sampleWork(13);
  assert.equal(spiky.name, 'medium', 'an occasional heavy frame did not block promotion');

  // A hand-picked preset is sacred in both directions.
  const chosen = new GraphicsSystem({
    storage: new MemoryStorage(), detectedPreset: 'high', sampleFrames: 4, cooldownFrames: 0,
  });
  chosen.set('medium');
  for (let i = 0; i < 12; i += 1) chosen.sampleWork(2);
  assert.equal(chosen.name, 'medium', 'automatic promotion overrode an explicit player choice');

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

// A session that demoted to Low must still be able to earn the designed
// low→medium work promotion. sampleFrame is the only cooldown decrementer,
// and hiding that decrement behind its Low early-return froze the cooldown
// forever — sampleWork then returned early for the rest of the session.
{
  const graphics = new GraphicsSystem({
    storage: new MemoryStorage(), detectedPreset: 'medium', sampleFrames: 4, cooldownFrames: 6,
  });
  for (let i = 0; i < 4; i += 1) graphics.sampleFrame(26);
  assert.equal(graphics.name, 'low', 'setup: sustained slowness should demote to Low');
  for (let i = 0; i < 6; i += 1) graphics.sampleFrame(16); // the cooldown must drain even at Low
  for (let i = 0; i < 4; i += 1) graphics.sampleWork(3);
  assert.equal(graphics.name, 'medium',
    'the low→medium work promotion is unreachable after a demotion to Low (frozen cooldown)');
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

// ── EVERY "IS THIS MACHINE KEEPING UP?" JUDGEMENT IS BUDGET-RELATIVE ───────
// The thresholds used to be absolute milliseconds, which quietly assumed the
// game was capped at 60fps. It no longer is: a 144Hz panel is paced to 72 and
// has a 13.9ms budget, so a flat 20.5ms "struggling" line would never fire no
// matter how badly that machine was doing, and a 7ms "has room to spare" line
// would promote a machine with none.
{
  const budget = 1000 / 72; // a 144Hz panel, every second refresh
  const graphics = new GraphicsSystem({
    storage: new MemoryStorage(), detectedPreset: 'medium', sampleFrames: 60, cooldownFrames: 0,
  });
  // 18ms frames are healthy at 60fps and hopeless at 72.
  for (let i = 0; i < 60; i += 1) graphics.sampleFrame(18, budget);
  assert.equal(graphics.name, 'low', 'a struggling high-refresh machine was judged against a 60fps budget');

  const roomy = new GraphicsSystem({
    storage: new MemoryStorage(), detectedPreset: 'medium', sampleFrames: 60, cooldownFrames: 0,
  });
  // 6ms of work is 36% of a 16.7ms budget (promote) but 43% of a 13.9ms one.
  for (let i = 0; i < 60; i += 1) roomy.sampleWork(6, budget);
  assert.equal(roomy.name, 'medium', 'promotion ignored the tighter high-refresh budget');
  for (let i = 0; i < 60; i += 1) roomy.sampleWork(6, 1000 / 60);
  assert.equal(roomy.name, 'high', 'the same work at a 60fps budget should still promote');

  // A 60fps budget must behave EXACTLY as it did before the change.
  const legacy = new GraphicsSystem({
    storage: new MemoryStorage(), detectedPreset: 'medium', sampleFrames: 60, cooldownFrames: 0,
  });
  for (let i = 0; i < 60; i += 1) legacy.sampleFrame(18);
  assert.equal(legacy.name, 'medium', '18ms frames at 60fps are healthy and must not demote');
}

// The full-rate ceiling is sticky-down: a machine that cannot hold its panel's
// rate steps to the next whole divisor rather than serving uneven frames, and
// one healthy stretch can never be undone by a single hitch.
{
  const holding = new RateGovernor({ ceiling: 144, floor: 60, sampleFrames: 60 });
  for (let i = 0; i < 60; i += 1) holding.frame(1000 / 144, 1000 / 144);
  assert.equal(holding.ceiling, 144, 'a machine holding its panel rate was demoted');

  const hitch = new RateGovernor({ ceiling: 144, floor: 60, sampleFrames: 60 });
  for (let i = 0; i < 59; i += 1) hitch.frame(1000 / 144, 1000 / 144);
  hitch.frame(120, 1000 / 144);
  assert.equal(hitch.ceiling, 144, 'one hitch halved the frame rate');

  const struggling = new RateGovernor({ ceiling: 144, floor: 60, sampleFrames: 60 });
  for (let i = 0; i < 60; i += 1) struggling.frame(1000 / 90, 1000 / 144);
  assert.equal(struggling.ceiling, 72, 'a machine that cannot hold 144 stayed there');
  for (let i = 0; i < 60; i += 1) struggling.frame(1000 / 40, 1000 / 72);
  assert.equal(struggling.ceiling, 60, 'the ceiling did not reach its floor');
  for (let i = 0; i < 120; i += 1) struggling.frame(1000 / 20, 1000 / 60);
  assert.equal(struggling.ceiling, 60, 'the ceiling fell through its floor');
  struggling.reset();
  assert.equal(struggling.ceiling, 144, 'an explicit preset change must restore the ceiling');
}

// eco is what the governor ASKED for, never "a number below 60": on a 165Hz
// panel full rate is paced to 55, and mistaking that for eco would disable
// adaptive quality entirely.
{
  const appSource = readFileSync(new URL('../src/core/app.js', import.meta.url), 'utf8');
  assert.match(appSource, /const eco = requestedFps <= POWER\.ecoFps/);
  assert.doesNotMatch(appSource, /fps *< *60/);
  assert.match(appSource, /const budgetMs = 1000 \/ \(pacing\?\.pacedFps/);
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
  // High is only *requested* when the player asked for it; an automatic High
  // still leaves the choice of chip to the browser rather than forcing either
  // extreme. Medium likewise — 'low-power' is reserved for Low and for phones.
  assert.equal(rendererPowerPreference({ name: 'high', provenance: 'auto' }), 'default');
  assert.equal(rendererPowerPreference({ name: 'medium', provenance: 'explicit' }), 'default');
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
