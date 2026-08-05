// Guards the software-rasterizer path.
//
// The bug this exists for cost more investigation time than any other in the
// project: a browser with hardware acceleration switched off hands back a
// perfectly working WebGL context that runs ~6x slower, and the game's own
// instrumentation cannot see the cost (rasterization happens after submit()
// returns, so `script` and `submit` both read ~5ms beside an 83ms frame).
// Measured on an RTX 3090, same code, same machine, the browser toggle the only
// difference: 72fps hardware vs 12fps software.
//
// Every assertion here is about a decision that is invisible at runtime.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import './harness/dom.mjs'; // installs window/document/localStorage by side effect
import { AdaptiveQuality } from '../src/core/quality.js';
import { GPU, detectSoftwareRenderer, setGpuCapabilityForTest } from '../src/core/gpuCapability.js';

// --- 1. what counts as "no GPU" -------------------------------------------

const glStub = (rendererString) => ({
  getContext: () => ({
    getExtension: (name) => (name === 'WEBGL_debug_renderer_info'
      ? { UNMASKED_RENDERER_WEBGL: 37446 } : null),
    getParameter: () => rendererString,
    RENDERER: 7937,
  }),
});

const SOFTWARE_STRINGS = [
  'Google Inc. (Google), ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)))',
  'Microsoft, Microsoft Basic Render Driver (0x0000008C) Direct3D11 vs_5_0 ps_5_0',
  'ANGLE (Microsoft, Microsoft Basic Render Driver Direct3D11, d3d11-warp-webgl)',
  'Mesa/X.org, llvmpipe (LLVM 15.0.6, 256 bits)',
  'Mesa, softpipe',
  'ANGLE (Software Adapter, Direct3D11)',
];
for (const s of SOFTWARE_STRINGS) {
  const got = detectSoftwareRenderer(glStub(s));
  assert.equal(got.software, true, `must detect as software: ${s}`);
  assert.equal(got.known, true, 'detection must record that it ran');
}

// A real GPU must NEVER trip it. These are the strings the mitigation would
// wrongly punish — a blurry game and a scary banner on perfectly good hardware.
const HARDWARE_STRINGS = [
  'NVIDIA, NVIDIA GeForce RTX 3090 (0x00002204) Direct3D11 vs_5_0 ps_5_0',
  'Google Inc. (NVIDIA), ANGLE (NVIDIA, NVIDIA GeForce RTX 4080, D3D11)',
  'Google Inc. (AMD), ANGLE (AMD, AMD Radeon RX 7900 XTX, D3D11)',
  'Google Inc. (AMD), ANGLE (AMD, AMD Radeon(TM) Graphics Direct3D11 vs_5_0)',
  'Google Inc. (Intel), ANGLE (Intel, Intel(R) Arc(TM) A770 Graphics, D3D11)',
  'Google Inc. (Intel), ANGLE (Intel, Intel(R) UHD Graphics 770, D3D11)',
  'Apple GPU',
  'Apple M2 Pro',
  'Mali-G78',
  'Adreno (TM) 740',
  'WebKit WebGL',
];
for (const s of HARDWARE_STRINGS) {
  assert.equal(detectSoftwareRenderer(glStub(s)).software, false, `must NOT flag hardware: ${s}`);
}

// Silence is not evidence. A privacy-hardened browser that withholds the
// unmasked string must not be told it has no GPU.
assert.equal(detectSoftwareRenderer(glStub('')).software, false, 'empty string is not software');
assert.equal(detectSoftwareRenderer(null).software, false, 'a missing renderer is not software');
assert.equal(detectSoftwareRenderer({ getContext() { throw new Error('lost'); } }).software, false,
  'a thrown context must not be reported as software');

// --- 2. the DPR floor ------------------------------------------------------

const fakeRenderer = () => {
  const calls = [];
  return {
    calls,
    setPixelRatio(r) { calls.push(r); },
    setSize() { /* set() re-applies size so the buffer really changes */ },
    getContext: () => null,
  };
};

// THE ORIGINAL DEFECT, pinned: on a DPR-1 display the default floor is 1, so
// base === min === ratio and the adaptive step can never fire. This is correct
// on hardware (never render a desktop below native) and fatal on a CPU
// rasterizer, which is why the floor became a caller's decision.
{
  const r = fakeRenderer();
  const q = new AdaptiveQuality(r, { basePixelRatio: 1 });
  assert.equal(q.min, 1);
  assert.equal(q.ratio, 1);
  for (let i = 0; i < 400; i += 1) q.frame(100, 1000 / 60); // catastrophic frames
  assert.equal(q.ratio, 1, 'without an explicit floor the ratio must stay at native');
}

// With a floor, the same catastrophic frames must actually shed pixels.
{
  const r = fakeRenderer();
  const q = new AdaptiveQuality(r, { basePixelRatio: 1, floor: 0.5, startAt: 0.65 });
  assert.equal(q.min, 0.5);
  assert.ok(Math.abs(q.ratio - 0.65) < 1e-9, 'startAt must be honoured');
  for (let i = 0; i < 400; i += 1) q.frame(100, 1000 / 60);
  assert.ok(q.ratio <= 0.5 + 1e-9, `must shed to the floor, got ${q.ratio}`);
  assert.ok(q.ratio >= 0.5 - 1e-9, 'must never go below the floor');
}

// The floor may never exceed the base (a 0.5 floor on a base of 0.4 is absurd).
{
  const q = new AdaptiveQuality(fakeRenderer(), { basePixelRatio: 0.4, floor: 0.5 });
  assert.ok(q.min <= 0.4, 'floor must be clamped to the base');
}

// Hardware behaviour must be BIT-IDENTICAL to before the change: a 2x display
// still steps 2 -> 1 and stops there.
{
  const q = new AdaptiveQuality(fakeRenderer(), { basePixelRatio: 2 });
  assert.equal(q.min, 1);
  for (let i = 0; i < 800; i += 1) q.frame(100, 1000 / 60);
  assert.equal(q.ratio, 1, 'a hardware display must still floor at native, never below');
}

// setBase (an automatic preset change) must not raise a shed ratio back up,
// and must keep respecting a lowered floor.
{
  const q = new AdaptiveQuality(fakeRenderer(), { basePixelRatio: 1, floor: 0.5, startAt: 0.5 });
  q.setBase(1, { raise: false });
  assert.ok(q.ratio <= 0.5 + 1e-9, 'an automatic preset change must not restore pixels');
  // NOTE: this assertion originally demanded that raise:true restore the full
  // base — which is precisely the defect the review caught. While a capability
  // ceiling is declared, an explicit player choice may not exceed it either.
  q.setBase(1, { raise: true });
  assert.ok(q.ratio <= 0.5 + 1e-9,
    'a declared capability ceiling outranks an explicit preset choice');
}

// --- 3. the grade is dropped only on a CPU context -------------------------

setGpuCapabilityForTest({ software: true, renderer: 'llvmpipe' });
assert.equal(GPU.software, true);
const { PostFX } = await import('../src/engine/PostFX.js');
const canvasStub = { style: {} };
const fx = new PostFX(canvasStub);
assert.equal(fx._base, '',
  'the full-screen colour grade is a CPU colour-matrix over the whole canvas when '
  + 'GPU compositing is off — it must not run on a software context');

setGpuCapabilityForTest({ software: false, renderer: 'NVIDIA GeForce RTX 3090' });
assert.ok(fx._base.length > 0, 'on hardware the grade must be exactly as it was');

// ...and the NAMED looks too. Dropping only the base grade left the cold open —
// where the heaviest full-frame filter runs — still paying for it, and left the
// transition blur, which is the most expensive thing a CPU compositor can do.
{
  setGpuCapabilityForTest({ software: true, renderer: 'llvmpipe' });
  const fx2 = new PostFX({ style: {} });
  fx2.filter = 'future';
  fx2._compose('blur(5px)');
  assert.equal(fx2.canvas.style.filter, 'none',
    'a software context must carry NO canvas filter — not the named look, not the blur');
  setGpuCapabilityForTest({ software: false, renderer: 'NVIDIA' });
  const fx3 = new PostFX({ style: {} });
  fx3.filter = 'future';
  fx3._compose('blur(5px)');
  assert.match(fx3.canvas.style.filter, /blur\(5px\)/, 'hardware still composes exactly as before');
}

// --- 4. capability is not a preference -------------------------------------

// `raise` exists so an explicit preset choice hands the player their pixels
// back. But Graphics notifies 'explicit' for the FRAME-RATE and COLOUR-GRADE
// buttons too, so merely opening Settings and tapping either one restored full
// DPR on a CPU rasterizer and undid the entire fix (measured 0.50 -> 1.00).
{
  const q = new AdaptiveQuality(fakeRenderer(), { basePixelRatio: 1, floor: 0.5, startAt: 0.65 });
  q.setBase(1, { raise: true });
  assert.ok(q.ratio <= 0.65 + 1e-9,
    `an explicit preset choice must not exceed the capability ceiling, got ${q.ratio}`);
  q.set(1);
  assert.ok(q.ratio <= 0.65 + 1e-9, 'nothing may raise the ratio above the capability ceiling');
}
// Without a declared ceiling the cap must simply track the base, or a browser
// zoom / display change would be clamped by a stale number forever.
{
  const q = new AdaptiveQuality(fakeRenderer(), { basePixelRatio: 1 });
  q.setBase(2, { raise: true });
  assert.ok(q.ratio >= 2 - 1e-9, 'an uncapped instance must still follow a raised base');
}

// --- 5. the notice must never take a press meant for the game --------------

{
  setGpuCapabilityForTest({ software: true, renderer: 'llvmpipe' });
  const notice = readFileSync(new URL('../src/ui/gpuNotice.js', import.meta.url), 'utf8');
  // The touch joystick is bottom-left at z-index 35; this panel is z-index 60.
  // Measured at 390x844 the stick sits ENTIRELY inside the panel, so an opaque
  // box that accepts pointers means the player cannot move at all.
  assert.match(notice, /'pointer-events:none'/,
    'the notice panel must be click-through — it overlaps the touch joystick');
  assert.match(notice, /'pointer-events:auto'/,
    '...but its own buttons must still take pointers');
  assert.match(notice, /coarse \? 44 : 36/,
    'touch targets must meet the 44px coarse-pointer floor the repo mandates');
  assert.match(notice, /prefersReducedMotion\(\)/,
    'every DOM surface asks the one shared reduced-motion gate');
}

console.log(
  `gpu fallback passed: ${SOFTWARE_STRINGS.length} software strings detected, `
  + `${HARDWARE_STRINGS.length} real GPUs untouched, silence treated as unknown, `
  + 'DPR floor sheds only when a caller declares a CPU context, hardware path identical, '
  + 'colour grade dropped on software only.',
);
