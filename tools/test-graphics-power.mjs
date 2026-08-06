import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  GRAPHICS_PRESETS,
  GraphicsSystem,
  MAX_PIXEL_RATIO,
  particleCapacity,
  targetPixelRatio,
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
    quality.setBase(targetPixelRatio(dpr, state), { raise: change?.source === 'explicit' });
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
  // Aimed at the GUARANTEE, not at one spelling of it: the resize path must
  // recompute the base from the LIVE preset and must never raise. Written as a
  // verbatim source match it failed the moment the arithmetic moved into
  // Graphics.targetPixelRatio — a green test can only be worth its noise if it
  // breaks on behaviour rather than on formatting.
  const appSource = readFileSync(new URL('../src/core/app.js', import.meta.url), 'utf8');
  const resizeCall = appSource.match(/quality\.setBase\(([^;]*?),\s*\{\s*raise:\s*false\s*\}\)/);
  assert.ok(resizeCall, 'the resize path must re-base the pixel ratio without raising it');
  assert.match(resizeCall[1], /Graphics/,
    'the resize path must read the live preset, not a value captured at boot');
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

// ── THE COLOUR GRADE IS A SWITCH ────────────────────────────────────────────
// Nate: "the game is just way too laggy... and choppy". The 3D scene measures
// tiny (44 draws / 93k tris / ~2.5ms at 720p), so the frames are not being lost
// to geometry. The one always-on full-screen cost left is this CSS filter over
// the live canvas: it runs in the COMPOSITOR at screen resolution, so dprCap
// cannot shrink it and the fps counter cannot see it. It has to be switchable
// so the cost can be isolated on the machine that actually has the problem.
{
  const gfx = readFileSync(new URL('../src/systems/Graphics.js', import.meta.url), 'utf8');
  const fx = readFileSync(new URL('../src/engine/PostFX.js', import.meta.url), 'utf8');

  assert.match(gfx, /setColourGrade\s*\(/, 'Graphics must expose a colour-grade switch');
  // Keyed to the GUARANTEE, not the call's shape. This used to require the
  // readKey(...) call to contain no closing parenthesis, so giving the key its
  // own validator — the fix for the grade never being read back AT ALL — broke
  // a test whose intent it satisfied. That the setting genuinely survives a
  // reload is now asserted BEHAVIOURALLY in test:traps, over real storage.
  const gradeLoad = gfx.slice(gfx.indexOf('this.colourGrade ='), gfx.indexOf('this.colourGrade =') + 200);
  assert.match(gradeLoad, /readKey\(/, 'the grade must be READ back from storage, not just written');
  assert.match(gradeLoad, /GRADE_KEY/, 'the grade must be read from its own key');
  assert.match(gradeLoad, /!==\s*'off'/, 'the grade must default to ON (it is the tuned look)');
  // Flipping it must notify as 'explicit', which is what makes PostFX re-compose
  // with no reload — the whole point is A/B-ing it against a live fps readout.
  const setter = gfx.slice(gfx.indexOf('setColourGrade'), gfx.indexOf('setColourGrade') + 600);
  assert.match(setter, /source:\s*'explicit'/, 'the switch must notify explicitly so the grade applies live');

  // Keyed to the GUARANTEE, not to the formatting. This assertion used to
  // require `return Graphics.colourGrade ?` to be the first thing inside the
  // getter, so adding a second condition to it broke a test whose intent was
  // untouched — the same failure as keying a guard to the literal "ms: 300".
  const baseGetter = fx.slice(fx.indexOf('get _base()'), fx.indexOf('get _base()') + 500);
  assert.match(baseGetter, /Graphics\.colourGrade\s*\?/,
    'PostFX must drop the base grade entirely when the switch is off');
  // ...and on a CPU-rasterized context, where this CSS filter stops being the
  // cheap compositor path it was chosen as and becomes a colour-matrix plus a
  // blit over the whole surface, on the same cores already drawing the scene.
  assert.match(baseGetter, /GPU\.software/,
    'PostFX must also drop the base grade when there is no GPU behind the canvas');

  // Low has never carried the grade; the switch must not resurrect it there.
  assert.match(fx, /low:\s*''/, 'Low still ships with no base grade at all');
  console.log('colour grade: switchable, persisted, defaults on, live-applied');
}

// ── FRAME RATE IS THE BIGGEST POWER DIAL, SO IT MUST ACTUALLY TURN ──────────
// The app used to ask for the panel's own rate, so a 144Hz monitor drew 144
// frames a second of a slow painterly scene — 2-3x the GPU, compositor and
// wake-up cost of a rate nobody can tell apart here. Every option must still
// land on a WHOLE number of refreshes (an even 72 beats an uneven 144), and
// Saver must actually save on the commonest panel there is.
{
  const { FRAME_TARGETS, Graphics: G } = await import('../src/systems/Graphics.js');
  const { snapToRefresh } = await import('../src/core/framePacer.js');
  const RATE_FLOOR_LOCAL = 48;
  // Mirrors core/app.js fullRateFps EXACTLY — including the mobile/Low branch,
  // which the first version of this helper simply did not have. That omission
  // let a real HIGH-severity bug through green: the app REPLACED the player's
  // choice with a flat 60 on phones and Low instead of capping it there, so the
  // Saver dial saved nothing on precisely the devices it exists for.
  const delivered = (hz, pref, { mobile = false, low = false } = {}) => {
    const raw = FRAME_TARGETS[pref];
    const want = (mobile || low) ? Math.min(60, raw) : raw;
    const floor = Math.min(RATE_FLOOR_LOCAL, want, hz);
    const ask = Math.max(floor, Math.min(hz, 144, want));
    // renderer.js sets allowOvershoot false for mobile / Low.
    return 1000 / snapToRefresh(ask, 1000 / hz, { allowOvershoot: !(mobile || low) });
  };

  assert.equal(G.frameRate ?? 'balanced', 'balanced', 'the efficient option must be the default');
  assert.ok(FRAME_TARGETS.balanced < 144, 'balanced must not chase a high-refresh panel');

  for (const hz of [60, 75, 120, 144, 165, 240]) {
    const period = 1000 / hz;
    for (const pref of Object.keys(FRAME_TARGETS)) {
      const fps = delivered(hz, pref);
      // Whole number of refreshes: the interval must divide evenly by the period.
      const refreshes = (1000 / fps) / period;
      assert.ok(
        Math.abs(refreshes - Math.round(refreshes)) < 1e-6,
        `${hz}Hz '${pref}' delivers ${fps.toFixed(1)}fps — ${refreshes.toFixed(3)} refreshes, not a whole number (that is judder)`,
      );
      assert.ok(fps >= 28, `${hz}Hz '${pref}' fell to ${fps.toFixed(1)}fps`);
    }
    // ...and the dial must actually change something on a high-refresh panel.
    if (hz >= 120) {
      assert.ok(
        delivered(hz, 'balanced') < delivered(hz, 'max') * 0.75,
        `${hz}Hz: balanced (${delivered(hz, 'balanced').toFixed(0)}) saves too little against max (${delivered(hz, 'max').toFixed(0)})`,
      );
    }
    // Saver must save on EVERY panel, including the commonest one.
    assert.ok(
      delivered(hz, 'saver') <= delivered(hz, 'balanced'),
      `${hz}Hz: Saver (${delivered(hz, 'saver').toFixed(0)}) is not below Balanced (${delivered(hz, 'balanced').toFixed(0)})`,
    );
  }
  // The commonest panel there is, named explicitly so it can never regress.
  assert.ok(
    Math.abs(delivered(60, 'saver') - 30) < 0.5,
    `60Hz Saver should be every 2nd refresh (30fps), got ${delivered(60, 'saver').toFixed(2)}`,
  );
  assert.ok(
    Math.abs(delivered(144, 'saver') - 36) < 0.5,
    `144Hz Saver should be every 4th refresh (36fps), got ${delivered(144, 'saver').toFixed(2)}`,
  );

  const saved144 = 1 - delivered(144, 'balanced') / delivered(144, 'max');
  const saved165 = 1 - delivered(165, 'balanced') / delivered(165, 'max');
  console.log(`frame rate: balanced draws ${Math.round(saved144 * 100)}% fewer frames than max on 144Hz, `
    + `${Math.round(saved165 * 100)}% on 165Hz — every option a whole number of refreshes`);
}

// ── THE DIAL MUST WORK ON THE DEVICES IT EXISTS FOR ─────────────────────────
// Phones and the Low preset are exactly who "Saver" is for, and the app used to
// discard the choice there. Settings shows the option unconditionally, so a
// player tapping it got a control that did nothing.
{
  const { FRAME_TARGETS } = await import('../src/systems/Graphics.js');
  const { snapToRefresh } = await import('../src/core/framePacer.js');
  const FLOOR = 48;
  const deliver = (hz, pref, { mobile = false, low = false } = {}) => {
    const raw = FRAME_TARGETS[pref];
    const want = (mobile || low) ? Math.min(60, raw) : raw;
    const floor = Math.min(FLOOR, want, hz);
    const ask = Math.max(floor, Math.min(hz, 144, want));
    return 1000 / snapToRefresh(ask, 1000 / hz, { allowOvershoot: !(mobile || low) });
  };

  for (const opts of [{ mobile: true }, { low: true }]) {
    for (const hz of [60, 90, 120, 144]) {
      const s = deliver(hz, 'saver', opts);
      const b = deliver(hz, 'balanced', opts);
      assert.ok(
        s <= b * 0.8,
        `${hz}Hz ${JSON.stringify(opts)}: Saver delivers ${s.toFixed(1)} against Balanced ${b.toFixed(1)} — the dial does nothing`,
      );
      // ...and a phone still never chases a high-refresh panel.
      assert.ok(deliver(hz, 'max', opts) <= 60.01,
        `${hz}Hz ${JSON.stringify(opts)}: Maximum ran past the 60 cap`);
    }
  }
  assert.ok(Math.abs(deliver(60, 'saver', { mobile: true }) - 30) < 0.5,
    'a 60Hz phone on Saver should render every 2nd refresh');

  // A DISPLAY SLOWER THAN THE FLOOR must still be given a whole multiple of its
  // own refresh, not a rate it physically cannot serve.
  for (const hz of [24, 30, 40, 48]) {
    const fps = deliver(hz, 'balanced');
    const refreshes = (1000 / fps) / (1000 / hz);
    assert.ok(Math.abs(refreshes - Math.round(refreshes)) < 1e-6,
      `${hz}Hz delivered ${fps.toFixed(1)}fps = ${refreshes.toFixed(3)} refreshes — unsnapped`);
    assert.ok(fps <= hz + 0.01, `${hz}Hz was asked for ${fps.toFixed(1)}fps, more than it can serve`);
  }
  console.log('frame rate: the dial works on mobile/Low, and slow displays still get whole refreshes');
}

// A QUALITY SETTING THAT CHANGES NOTHING IS NOT A QUALITY SETTING.
//
// Nate: "low graphics and high, i honestly cannot tell a single difference, i
// think this is bad and needs to be fixed!"
//
// He was reporting a real thing. Pixel count is the dominant lever, and it was
// derived as min(devicePixelRatio, dprCap) — a CEILING, which on an ordinary
// desktop monitor (devicePixelRatio 1, measured on his) clamped Low, Medium and
// High to exactly 1.0. Three buttons, one image. The setting only ever
// separated on a retina laptop or a phone, which is precisely where a player is
// least likely to go looking for it.
{
  // The display he actually plays on.
  const ONE_X = 1;
  const ratios = {};
  for (const name of ['low', 'medium', 'high']) {
    const graphics = new GraphicsSystem({ storage: new MemoryStorage(), detectedPreset: 'medium' });
    graphics.set(name);
    ratios[name] = targetPixelRatio(ONE_X, graphics);
  }
  assert.ok(ratios.low < ratios.medium && ratios.medium < ratios.high,
    `on a 1x display the presets must render different numbers of pixels — got `
    + `low=${ratios.low} medium=${ratios.medium} high=${ratios.high}`);
  // Not merely different: different enough to SEE. A 20% linear step is ~44%
  // of the pixels, which reads immediately on text edges and thin geometry.
  assert.ok(ratios.medium / ratios.low >= 1.2, 'Low is not visibly softer than Medium');
  assert.ok(ratios.high / ratios.medium >= 1.2, 'High is not visibly sharper than Medium');

  // The ceiling still holds where it was always needed: a phone must never be
  // asked for 3x, and supersampling must never be allowed to square away a
  // retina laptop's frame budget.
  for (const dpr of [2, 3, 4]) {
    for (const name of ['low', 'medium', 'high']) {
      const graphics = new GraphicsSystem({ storage: new MemoryStorage(), detectedPreset: 'medium' });
      graphics.set(name);
      const ratio = targetPixelRatio(dpr, graphics);
      assert.ok(ratio <= MAX_PIXEL_RATIO + 1e-9,
        `${name} at dpr ${dpr} asked for ${ratio}, above the hard ceiling`);
      assert.ok(ratio <= GRAPHICS_PRESETS[name].dprCap + 1e-9,
        `${name} at dpr ${dpr} broke its own cap`);
    }
  }
  // Garbage in must not produce a zero-pixel buffer.
  for (const bad of [0, -1, NaN, undefined, Infinity]) {
    const ratio = targetPixelRatio(bad, { preset: GRAPHICS_PRESETS.medium });
    assert.ok(Number.isFinite(ratio) && ratio > 0, `devicePixelRatio ${bad} produced ${ratio}`);
  }

  // And the change must LAND without a reload: pressing a preset has to push a
  // new ratio through to the renderer, not merely record a preference.
  const renderer = new RendererFake();
  const graphics = new GraphicsSystem({ storage: new MemoryStorage(), detectedPreset: 'medium' });
  const quality = new AdaptiveQuality(renderer, { basePixelRatio: targetPixelRatio(ONE_X, graphics) });
  wire(graphics, quality, ONE_X);
  const before = renderer.ratios.length;
  graphics.set('high');
  assert.ok(renderer.ratios.length > before,
    'choosing High never reached the renderer — the preset would only appear after a reload');
  assert.equal(quality.ratio, ratios.high, 'High did not deliver its full pixel ratio');
  graphics.set('low');
  assert.equal(quality.ratio, ratios.low, 'Low did not shed pixels immediately');

  console.log(`graphics presets separate on a 1x display: low ${ratios.low} · medium `
    + `${ratios.medium} · high ${ratios.high}, applied live with no reload`);
}
