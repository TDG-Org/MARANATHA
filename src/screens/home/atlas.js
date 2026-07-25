import { STORIES } from '../../data/stories.js';

// The map's geometry and painted furniture: where each chapter stands along
// the road, the road itself, and the ambient particle fields.
//
// Everything here works in the design's 1440x810 coordinate space (index.js
// scales that space to the viewport as one composited transform).

const GAP = { major: 208, standard: 162, minor: 128 };
const SIZE = { major: 94, standard: 64, minor: 44 };

// The road's height on the hillside. It was authored at 628 with a ±72 wave,
// which put the chapter labels almost on top of the era ribbon on a short
// screen. Raised to 574 with a tighter wave: the highest stop now sits at
// y≈513, still a clear 50px BELOW the farthest ridge's crest (y≈462), so every
// chapter keeps its feet on the hill instead of floating in the sky.
const ROAD_Y = 596; // Nate: a touch lower on the hillside
const ROAD_WAVE = 46;
const ROAD_ROLL = 15;

// How far past the last playable chapter the player may travel, and how far
// the road is drawn beyond that before it runs into the dark.
const REACH_AHEAD = 1;
const DRAW_AHEAD = 2;

const ROMAN = [
  '', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII',
  'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI', 'XXII',
  'XXIII', 'XXIV', 'XXV', 'XXVI', 'XXVII', 'XXVIII', 'XXIX', 'XXX', 'XXXI',
  'XXXII', 'XXXIII', 'XXXIV', 'XXXV',
];

// One seeded LCG for every particle field, so the sky, the embers and the
// fireflies land in exactly the same places on every device and every reload —
// the vista is authored, not re-rolled.
function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

// Catmull-Rom through the chapter stops, emitted as cubic beziers: the road
// bends between stops instead of kinking at them.
function smooth(pts) {
  if (pts.length < 2) return '';
  let d = `M${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${c1x.toFixed(0)} ${c1y.toFixed(0)}, ${c2x.toFixed(0)} ${c2y.toFixed(0)}, ${p2.x} ${p2.y}`;
  }
  return d;
}

// Lay the chapters out left to right, spaced by how big each one reads, on a
// gentle two-frequency wave so the road rises and falls like real country.
//
// Only the part of the journey the player can actually reach is built. The
// road stops a couple of chapters past that and fades into the dark, which is
// both the honest picture (one story exists) and the reason this screen is
// cheap: the painted world is ~2.6k wide instead of 6.4k.
export function buildAtlas(isBuilt) {
  let x = 330;
  let prevTier = null;
  const all = STORIES.map((story, i) => {
    const tier = story.tier || 'standard';
    if (i > 0) x += Math.round((GAP[prevTier] + GAP[tier]) / 2);
    prevTier = tier;
    const y = Math.round(ROAD_Y + ROAD_WAVE * Math.sin(i * 0.62 + 0.4) + ROAD_ROLL * Math.cos(i * 0.29));
    return {
      id: story.id,
      title: story.title,
      passage: story.passage,
      blurb: story.blurb,
      era: story.era,
      tier,
      built: isBuilt(story),
      index: i,
      x,
      y,
      size: SIZE[tier],
      num: i + 1,
      ord: ROMAN[i + 1] || String(i + 1),
    };
  });

  const lastBuilt = all.reduce((acc, n, i) => (n.built ? i : acc), 0);
  const reachIndex = Math.min(all.length - 1, lastBuilt + REACH_AHEAD);
  const drawIndex = Math.min(all.length - 1, reachIndex + DRAW_AHEAD);
  const nodes = all.slice(0, drawIndex + 1);
  nodes.forEach((n) => { n.reachable = n.index <= reachIndex; });

  const worldW = nodes[nodes.length - 1].x + 420;
  const byId = new Map(nodes.map((n) => [n.id, n]));

  // The road runs on past the last stop drawn, so it reads as a journey that
  // continues rather than a line that stops.
  const pts = [
    { x: 40, y: nodes[0].y + 72 },
    ...nodes.map((n) => ({ x: n.x, y: n.y })),
    { x: worldW - 60, y: nodes[nodes.length - 1].y - 78 },
  ];
  const roadPath = smooth(pts);
  const lastWalked = nodes.filter((n) => n.built).slice(-1)[0];
  const walkedPath = lastWalked ? smooth(pts.slice(0, nodes.indexOf(lastWalked) + 2)) : '';

  // Where the road is barred, and the vertical band it occupies — the only
  // place a drag is allowed to grab, so the sky and the hills stay still under
  // the cursor. It has to cover the stops (circle + numeral above + name
  // below) AND the road's own dip past the last one, plus the bed's halo.
  // It hugs the storyline: the chapter numerals above the circles, the names
  // below them, and the road bed's halo — plus a little grab room. Anything
  // outside is sky or hillside, and holds still under the cursor.
  const gateX = nodes[reachIndex].x + Math.round(nodes[reachIndex].size / 2) + 120;
  const nodeYs = nodes.map((n) => n.y);
  const pathYs = pts.map((p) => p.y);
  const halfMax = Math.max(...nodes.map((n) => n.size)) / 2;
  const BED_HALO = 30; // half the widest road-bed stroke, so it is never cut
  const bandTop = Math.round(Math.min(Math.min(...nodeYs) - halfMax - 60, Math.min(...pathYs) - BED_HALO));
  const bandBottom = Math.round(Math.max(Math.max(...nodeYs) + halfMax + 84, Math.max(...pathYs) + BED_HALO));

  return {
    nodes, byId, worldW, roadPath, walkedPath,
    reachIndex, lastBuilt, gateX, bandTop, bandBottom,
    total: all.length,
  };
}

// A chapter stop. Built chapters are warm and lit with a play arrow; the rest
// are cold stone — locked (with a padlock) or, for the quieter stops between
// landmarks, just a marker on the road. Stops past the gate are drawn dimmer
// still and cannot be picked: they are scenery, not choices.
export function nodeHtml(n) {
  const done = n.status === 'done';
  const lit = n.built;
  const half = Math.round(n.size / 2);
  const isLock = !lit && n.tier !== 'minor';
  const isDot = !lit && n.tier === 'minor';
  const ordSize = n.tier === 'major' ? 12 : n.tier === 'standard' ? 10.5 : 9.5;
  const labelSize = n.tier === 'major' ? 19 : n.tier === 'standard' ? 15 : 12;
  const arrowH = n.tier === 'major' ? 16 : 12;
  const arrowW = n.tier === 'major' ? 26 : 19;
  const arrowPad = n.tier === 'major' ? 7 : 5;

  const halo = lit
    ? `<span data-halo="1" style="position:absolute; left:0; top:0; width:${Math.round(n.size * 2.3)}px; height:${Math.round(n.size * 2.3)}px; transform:translate(-50%,-50%); border-radius:50%; background:radial-gradient(circle,rgba(255,206,140,.3) 0%,rgba(255,206,140,0) 66%); pointer-events:none"></span>`
    : '';

  const glyph = lit
    ? (done
      ? '<span style="font-size:26px; line-height:1; color:#2b1a10">✔</span>'
      : `<span style="width:0; height:0; border-top:${arrowH}px solid transparent; border-bottom:${arrowH}px solid transparent; border-left:${arrowW}px solid #2b1a10; margin-left:${arrowPad}px"></span>`)
    : isLock
      ? `<span style="font-size:${n.tier === 'major' ? 21 : 16}px; color:rgba(253,246,227,.62); line-height:1">🔒</span>`
      : isDot
        ? '<span style="width:9px; height:9px; border-radius:50%; background:rgba(255,232,190,.42)"></span>'
        : '';

  const bg = lit
    ? 'linear-gradient(180deg,#ffdfae,#f2b880 42%,#dd9350 76%,#bd7a3e)'
    : 'radial-gradient(circle at 36% 30%,#22505f,#0c2231)';
  const border = lit ? '#fff2d8' : 'rgba(255,232,190,.26)';
  const shadow = lit
    ? '0 0 38px 9px rgba(255,186,100,.45),0 14px 32px rgba(4,14,20,.5)'
    : 'inset 0 2px 12px rgba(0,0,0,.5),0 10px 24px rgba(0,0,0,.42)';
  const ordColor = lit ? '#ffeccd' : 'rgba(255,240,214,.4)';
  const labelColor = lit
    ? '#fff6e6'
    : n.tier === 'minor' ? 'rgba(253,246,227,.6)' : 'rgba(253,246,227,.82)';

  // Past the gate the stop is scenery: not a button, not focusable, not read
  // out as a choice.
  if (!n.reachable) {
    return `<div class="mr-node mr-node-beyond" data-beyond="1" aria-hidden="true"
      style="position:absolute; left:${n.x}px; top:${n.y}px; width:0; height:0">
      <span data-circle="1" style="position:absolute; left:0; top:0; width:${n.size}px; height:${n.size}px; transform:translate(-50%,-50%); border-radius:50%; display:flex; align-items:center; justify-content:center; background:${bg}; border:2px solid ${border}; box-shadow:${shadow}">${glyph}</span>
      <span style="position:absolute; left:0; top:${half + 13}px; transform:translateX(-50%); font:600 ${labelSize}px 'Segoe UI',system-ui,sans-serif; color:${labelColor}; letter-spacing:.04em; white-space:nowrap; text-shadow:0 2px 9px rgba(4,14,20,.85)">${n.title}</span>
    </div>`;
  }

  const label = `Chapter ${n.ord} — ${n.title}, ${n.passage}${lit ? '' : ' (coming soon)'}`;
  return `<button type="button" class="mr-node" data-node="${n.id}" aria-label="${label}"
    style="position:absolute; left:${n.x}px; top:${n.y}px; width:0; height:0; padding:0; border:0; background:none; color:inherit; font:inherit; cursor:pointer">
    ${halo}
    <span data-circle="1" style="position:absolute; left:0; top:0; width:${n.size}px; height:${n.size}px; transform:translate(-50%,-50%); border-radius:50%; display:flex; align-items:center; justify-content:center; background:${bg}; border:2px solid ${border}; box-shadow:${shadow}">${glyph}</span>
    <span style="position:absolute; left:0; top:${-half - 26}px; transform:translateX(-50%); font:600 ${ordSize}px Georgia,serif; letter-spacing:.24em; color:${ordColor}; white-space:nowrap; pointer-events:none">${n.ord}</span>
    <span style="position:absolute; left:0; top:${half + 13}px; transform:translateX(-50%); font:600 ${labelSize}px 'Segoe UI',system-ui,sans-serif; color:${labelColor}; letter-spacing:.04em; white-space:nowrap; text-shadow:0 2px 9px rgba(4,14,20,.85); pointer-events:none">${n.title}</span>
  </button>`;
}

// The soft dark bed the road lies on, so the line and the stops read against a
// busy hillside. Concentric strokes of the same path fade outwards — a blur's
// look with none of a blur's cost, and it rasterises once with the road.
//
// It used to be a 132px-wide hard-stepped band with blunt round caps, which
// read as a black stripe painted across the hillside and stopping dead at both
// ends. Now it is less than half as wide, and a mask dissolves it into the
// landscape at the head and tail instead of cutting it off.
export const BED_WIDTH = 56;
export function roadBedHtml(d) {
  if (!d) return '';
  const band = [[BED_WIDTH, 0.17], [38, 0.17], [22, 0.2]];
  const strokes = band
    .map(([w, o]) => `<path d="${d}" fill="none" stroke="#01030c" stroke-opacity="${o}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"></path>`)
    .join('');
  return `<defs><linearGradient id="mrBedFade" x1="0" x2="1">
      <stop offset="0" stop-color="#000"></stop>
      <stop offset="0.06" stop-color="#fff"></stop>
      <stop offset="0.88" stop-color="#fff"></stop>
      <stop offset="1" stop-color="#000"></stop>
    </linearGradient>
    <mask id="mrBedMask" maskUnits="userSpaceOnUse" x="0" y="0" width="100%" height="100%">
      <rect x="0" y="0" width="100%" height="100%" fill="url(#mrBedFade)"></rect>
    </mask></defs>
    <g mask="url(#mrBedMask)">${strokes}</g>`;
}

// Where the road is barred. The dark gathers across it and a sign says why, in
// the same words the player would use.
export function gateHtml(atlas) {
  const { gateX, bandTop, bandBottom } = atlas;
  const h = bandBottom - bandTop;
  return `<div class="mr-gate" style="position:absolute; left:${gateX}px; top:${bandTop}px; width:${atlas.worldW - gateX}px; height:${h}px; pointer-events:none">
    <div style="position:absolute; inset:0; background:linear-gradient(90deg,rgba(1,3,10,0) 0%,rgba(1,3,10,.62) 34%,rgba(1,3,10,.88) 68%,rgba(1,3,10,.96) 100%)"></div>
    <div class="mr-gate-sign" style="position:absolute; left:96px; top:${Math.round(h / 2)}px">
      <span class="mr-gate-lock">🔒</span>
      <span class="mr-gate-text">Walk this story first<br><i>the road opens as you go</i></span>
    </div>
  </div>`;
}

// The ambient fields.
//
// The design gave every star, mote, firefly and ember its own infinite
// animation — around 130 of them, and each running animation is its own
// compositor layer. They are GROUPED instead: a handful of layers, each with
// its own duration and delay, holding members drawn from all over the field
// (group = i % groups, never a contiguous block). The sky still twinkles out
// of step and the motes still drift apart, because no two groups share a
// phase — but the compositor carries ~18 layers instead of ~130.
export function particleHtml(counts) {
  const r = seeded(9173);
  const groupsFor = (n, per) => Math.max(2, Math.min(8, Math.round(n / per)));

  // Spread `n` members across `g` groups, interleaved so each group is
  // scattered across the whole field rather than clumped in one corner.
  const grouped = (n, g, make, wrap) => {
    const buckets = Array.from({ length: g }, () => []);
    for (let i = 0; i < n; i++) buckets[i % g].push(make(i));
    return buckets.map((members, gi) => wrap(members.join(''), gi)).join('');
  };

  const out = {};

  const starGroups = groupsFor(counts.stars, 8);
  out.stars = grouped(counts.stars, starGroups, () => {
    const x = Math.round(r() * 1420);
    const y = Math.round(r() * 480);
    const s = r() > 0.78 ? 4 : r() > 0.4 ? 3 : 2;
    const sh = r() > 0.72 ? '0 0 8px 2px rgba(214,228,255,.55)' : 'none';
    return `<div style="position:absolute; left:${x}px; top:${y}px; width:${s}px; height:${s}px; border-radius:50%; background:#eef4ff; box-shadow:${sh}"></div>`;
  }, (inner, gi) => {
    const dur = (3.4 + (gi / starGroups) * 3.6).toFixed(1);
    const d = ((gi * 1.37) % 5).toFixed(1);
    return `<div style="position:absolute; inset:0; animation:mrTwinkle ${dur}s ease-in-out ${d}s infinite">${inner}</div>`;
  });

  out.sparkles = Array.from({ length: counts.sparkles }, () => {
    const x = Math.round(60 + r() * 1320);
    const y = Math.round(40 + r() * 400);
    const w = Math.round(16 + r() * 16);
    const dur = (5 + r() * 5).toFixed(1);
    const d = (r() * 7).toFixed(1);
    return `<div style="position:absolute; left:${x}px; top:${y}px; width:${w}px; height:${w}px; animation:mrPulse ${dur}s ease-in-out ${d}s infinite">
      <div style="position:absolute; left:50%; top:0; width:1.5px; height:100%; transform:translateX(-50%); background:linear-gradient(180deg,rgba(255,255,255,0),#ffffff 50%,rgba(255,255,255,0))"></div>
      <div style="position:absolute; top:50%; left:0; height:1.5px; width:100%; transform:translateY(-50%); background:linear-gradient(90deg,rgba(255,255,255,0),#ffffff 50%,rgba(255,255,255,0))"></div>
      <div style="position:absolute; left:50%; top:50%; width:3.5px; height:3.5px; transform:translate(-50%,-50%); border-radius:50%; background:#ffffff; box-shadow:0 0 9px 3px rgba(223,232,255,.85)"></div>
    </div>`;
  }).join('');

  const moteGroups = groupsFor(counts.motes, 8);
  out.motes = grouped(counts.motes, moteGroups, () => {
    const x = Math.round(120 + r() * 1240);
    const y = Math.round(540 + r() * 240);
    const s = r() > 0.7 ? 6 : r() > 0.35 ? 5 : 4;
    return `<div style="position:absolute; left:${x}px; top:${y}px; width:${s}px; height:${s}px; border-radius:50%; background:#dfe8ff; opacity:.5"></div>`;
  }, (inner, gi) => {
    const dur = (12 + (gi / moteGroups) * 8).toFixed(1);
    const d = ((gi * 4.1) % 12).toFixed(1);
    return `<div style="position:absolute; inset:0; pointer-events:none; animation:mrMote ${dur}s linear ${d}s infinite">${inner}</div>`;
  });

  // Embers rise from the two far camps; each camp gets its own pair of drifts.
  // Those camps sit at x 2303 and 4606, and the band that holds them is clipped
  // to roughly 1630px on every screen — so this field has never been visible to
  // anyone. It stays switched off unless a count is deliberately asked for.
  const camps = [[2303, 657], [4606, 672]];
  const perCamp = Math.max(2, Math.round((counts.embers || 0) / camps.length));
  out.embers = !counts.embers ? '' : camps.map(([cx, cy]) => grouped(perCamp, 2, () => {
    const x = Math.round(cx - 8 + r() * 22);
    const y = Math.round(cy - r() * 10);
    const s = r() > 0.66 ? 5 : r() > 0.33 ? 4 : 3;
    return `<div style="position:absolute; left:${x}px; top:${y}px; width:${s}px; height:${s}px; border-radius:50%; background:#ffc27a; box-shadow:0 0 9px 2px rgba(255,168,84,.55)"></div>`;
  }, (inner, gi) => {
    const dx = gi === 0 ? 12 : 30;
    const dur = (2.6 + gi * 1.3).toFixed(1);
    const d = (gi * 1.6).toFixed(1);
    return `<div style="position:absolute; inset:0; --dx:${dx}px; animation:mrEmber ${dur}s ease-out ${d}s infinite">${inner}</div>`;
  })).join('');

  const flyGroups = groupsFor(counts.fireflies, 6);
  out.fireflies = grouped(counts.fireflies, flyGroups, () => {
    const x = Math.round(160 + r() * 1180);
    const y = Math.round(560 + r() * 200);
    return `<div style="position:absolute; left:${x}px; top:${y}px; width:5px; height:5px; border-radius:50%; background:#ffe9a8; box-shadow:0 0 11px 3px rgba(255,214,120,.5)"></div>`;
  }, (inner, gi) => {
    const dur = (7 + (gi / flyGroups) * 6).toFixed(1);
    const d = ((gi * 2.6) % 8).toFixed(1);
    return `<div style="position:absolute; inset:0; animation:mrFly ${dur}s ease-in-out ${d}s infinite">${inner}</div>`;
  });

  return out;
}
