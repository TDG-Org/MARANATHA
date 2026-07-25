// Import the home page's painted backdrop from the Claude Design project.
//
//   node tools/import-home-design.mjs <path-to-Home.dc.html>
//
// Writes src/screens/home/backdrop.js. Re-run this after changing the design;
// never hand-edit the generated file, or the two will drift.
//
// The design doc is authored for a canvas, not a game loop, so the import also
// applies a fixed set of PERFORMANCE TRANSFORMS. Each one is a no-op visually
// (or as near as makes no difference against a night sky) and each removes a
// class of work the compositor is bad at. They are listed in the report the
// tool prints, with counts, so a regression shows up as a changed count.

import fs from 'node:fs';
import path from 'node:path';

const source = process.argv[2];
if (!source) {
  console.error('usage: node tools/import-home-design.mjs <path-to-Home.dc.html>');
  process.exit(1);
}

const src = fs.readFileSync(source, 'utf8');
const lines = src.split('\n');
const slice = (a, b) => lines.slice(a - 1, b).join('\n');

// The design doc's regions. These line numbers are the one thing that can rot
// if the doc is restructured; the assertions below catch it loudly.
const REGION = { backdropStart: 38, backdropEnd: 687, roadStart: 688, roadEnd: 716, vignette: 718 };

let backdrop = slice(REGION.backdropStart, REGION.backdropEnd);
let road = slice(REGION.roadStart, REGION.roadEnd);
const vignette = slice(REGION.vignette, REGION.vignette);

const report = [];
const count = (re, s) => (s.match(re) || []).length;
const expect = (label, got, want) => {
  report.push(`${got === want ? 'ok  ' : 'WARN'} ${label}: ${got}${got === want ? '' : ` (expected ${want})`}`);
  if (got !== want) process.exitCode = 1;
};

if (!/data-sky/.test(backdrop) || !/data-roadwrap/.test(road) || !/radial-gradient/.test(vignette)) {
  console.error('The design doc no longer matches the expected regions — check REGION line numbers.');
  process.exit(1);
}

// ── T1 · cloud banks ────────────────────────────────────────────────────────
// Nine drifting cloud banks were four hard-edged ellipses under filter:blur(26
// -40px) — and each also animates its transform, so the compositor re-rasterised
// a large blur convolution per bank. A pre-softened radial gradient is the same
// picture with no filter at all. The box grows by the old blur radius on every
// side so the cloud keeps its blurred footprint.
const cloudRe = /<div style="position:absolute; left:([\d.]+)px; top:([\d.]+)px; width:([\d.]+)px; height:([\d.]+)px; opacity:([\d.]+); filter:blur\(([\d.]+)px\); (animation:mrDrift[^"]*)">(?:\s*<div[^>]*><\/div>){4}\s*<\/div>/g;
let clouds = 0;
backdrop = backdrop.replace(cloudRe, (_m, l, t, w, h, o, blur, anim) => {
  clouds += 1;
  const b = Number(blur);
  const style = [
    'position:absolute',
    `left:${Number(l) - b}px`, `top:${Number(t) - b}px`,
    `width:${Number(w) + b * 2}px`, `height:${Number(h) + b * 2}px`,
    `opacity:${(Number(o) * 1.25).toFixed(3)}`,
    'border-radius:50%',
    'background:radial-gradient(ellipse at 50% 50%,rgba(196,218,255,.40) 0%,rgba(196,218,255,.26) 34%,rgba(196,218,255,.10) 58%,rgba(196,218,255,0) 78%)',
    anim,
  ].join('; ');
  return `<div style="${style}"></div>`;
});
expect('T1 cloud banks de-blurred', clouds, 9);

// ── T2 · hilltop cross shadows ──────────────────────────────────────────────
// A 2px blur on three tiny SVG paths costs a filter region on the whole band.
// At this scale the softening is invisible; the opacity already sells it.
const crossBlur = count(/ style="filter:blur\([\d.]+px\)"/g, backdrop);
backdrop = backdrop.replace(/ style="filter:blur\([\d.]+px\)"/g, '');
expect('T2 cross shadows de-blurred', crossBlur, 3);

// ── T3 · moon craters ───────────────────────────────────────────────────────
// Four blurred discs inside the moon become soft gradients — same soft mare
// patches, no filter inside an element that is itself animated (mrGlow).
let craters = 0;
backdrop = backdrop.replace(
  /background:rgba\((\d+),(\d+),(\d+),([\d.]+)\); filter:blur\([\d.]+px\)/g,
  (_m, r, g, b, a) => {
    craters += 1;
    return `background:radial-gradient(ellipse at 50% 50%,rgba(${r},${g},${b},${a}) 0%,rgba(${r},${g},${b},${(Number(a) * 0.55).toFixed(3)}) 46%,rgba(${r},${g},${b},0) 72%)`;
  },
);
expect('T3 moon craters de-blurred', craters, 4);

// ── T4 · blend modes ────────────────────────────────────────────────────────
// mix-blend-mode:screen forces the compositor to keep reading back what is
// underneath, which disables the fast path for the whole stacking context.
// Every one of these sits on a near-black night sky, where screen(a, ~0) ≈ a —
// so plain compositing is the same picture for a fraction of the cost.
const blends = count(/mix-blend-mode:screen; ?/g, backdrop);
backdrop = backdrop.replace(/mix-blend-mode:screen; ?/g, '');
expect('T4 blend modes removed', blends, 7);

// ── T5 · dead layer ─────────────────────────────────────────────────────────
const photo = count(/<div data-photo="1"[^>]*><\/div>\s*/g, backdrop);
backdrop = backdrop.replace(/<div data-photo="1"[^>]*><\/div>\s*/g, '');
expect('T5 unused photo layer removed', photo, 1);

// ── T6 · band tagging + far-band sway ───────────────────────────────────────
// Each parallax band is tagged so the screen can promote it to its own
// composited layer and clip it to the reachable world.
//
// Sway survives only on the NEAREST band. A running animation stops its band
// from being rasterised once and reused, and on the three far bands it moves
// silhouettes a few pixels tall by 1.4 degrees over 12 seconds — invisible, and
// it was costing three static bands their static-ness. The near band keeps its
// sway (and the screen thins it further by graphics preset).
const bandOrder = [];
backdrop = backdrop.replace(/<div data-par="([\d.]+)"/g, (_m, par) => {
  const index = bandOrder.length;
  bandOrder.push(par);
  return `<div data-band="${index}" data-par="${par}"`;
});
expect('T6 bands tagged', bandOrder.length, 5);

const bandStarts = bandOrder.map((_p, i) => backdrop.indexOf(`<div data-band="${i}"`));
const nearBandStart = bandStarts[bandStarts.length - 1];
const beforeNear = backdrop.slice(0, nearBandStart);
const nearBand = backdrop.slice(nearBandStart);
const farSway = count(/animation:mrSway[^;"]*;?/g, beforeNear);
const nearSway = count(/animation:mrSway[^;"]*;?/g, nearBand);
backdrop = beforeNear.replace(/animation:mrSway[^;"]*;?/g, '') + nearBand;
expect('T6 far-band sway dropped', farSway, 64);
expect('T6 near-band sway kept', nearSway, 54);

// ── slots ───────────────────────────────────────────────────────────────────
const slots = ['stars', 'sparkles', 'embers', 'fireflies', 'motes'];
let filled = 0;
backdrop = backdrop.replace(/<sc-for[\s\S]*?<\/sc-for>/g, () => `<!--slot:${slots[filled++]}-->`);
road = road.replace(/<sc-for[\s\S]*?<\/sc-for>/g, '<!--slot:nodes-->');
expect('slots marked', filled, slots.length);
expect('node slot marked', count(/<!--slot:nodes-->/g, road), 1);

// Leftovers that would ship broken template syntax.
expect('no template tags left', count(/<sc-(for|if)/g, backdrop + road), 0);
expect('no bindings left', count(/\{\{/g, backdrop + road), 0);
expect('no live blurs left', count(/filter:\s*blur/g, backdrop), 0);
expect('no blend modes left', count(/mix-blend-mode/g, backdrop), 0);

const esc = (s) => s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
const out = `// GENERATED by tools/import-home-design.mjs from the Claude Design project's
// "Home.dc.html". DO NOT HAND-EDIT — change the design, then re-run:
//
//   node tools/import-home-design.mjs <path-to-Home.dc.html>
//
// The painted night world, verbatim apart from the importer's performance
// transforms (de-blurred cloud banks, no mix-blend-mode, no live filters,
// far-band sway dropped, bands tagged data-band). Slots (<!--slot:name-->) are
// filled at runtime by index.js.

export const BACKDROP_HTML = \`${esc(backdrop)}\`;

export const ROAD_HTML = \`${esc(road)}\`;

export const VIGNETTE_HTML = \`${esc(vignette)}\`;
`;

const dest = path.join(process.cwd(), 'src/screens/home/backdrop.js');
fs.writeFileSync(dest, out);

report.push(`--- wrote ${path.relative(process.cwd(), dest)} · ${(out.length / 1024).toFixed(1)} kB`);
console.log(report.join('\n'));
