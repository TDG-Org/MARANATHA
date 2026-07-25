import { STORIES } from '../../data/stories.js';

// The map's geometry and painted furniture: where each chapter stands along
// the road, the road itself, and the ambient particle fields.
//
// Everything here works in the design's 1440x810 coordinate space (index.js
// scales that space to the viewport as one composited transform), so the
// numbers below are the design's numbers, unchanged.

const GAP = { major: 208, standard: 162, minor: 128 };
const SIZE = { major: 94, standard: 64, minor: 44 };

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
export function buildAtlas(isBuilt) {
  let x = 330;
  let prevTier = null;
  const nodes = STORIES.map((story, i) => {
    const tier = story.tier || 'standard';
    if (i > 0) x += Math.round((GAP[prevTier] + GAP[tier]) / 2);
    prevTier = tier;
    const y = Math.round(628 + 54 * Math.sin(i * 0.62 + 0.4) + 18 * Math.cos(i * 0.29));
    const size = SIZE[tier];
    const built = isBuilt(story);
    return {
      id: story.id,
      title: story.title,
      passage: story.passage,
      blurb: story.blurb,
      era: story.era,
      tier,
      built,
      x,
      y,
      size,
      num: i + 1,
      ord: ROMAN[i + 1] || String(i + 1),
    };
  });

  const roadW = x + 380;
  const byId = new Map(nodes.map((n) => [n.id, n]));

  // The road runs on past the last chapter anyone can walk — the journey is
  // longer than what is built.
  const pts = [
    { x: 40, y: nodes[0].y + 108 },
    ...nodes.map((n) => ({ x: n.x, y: n.y })),
    { x: roadW - 60, y: nodes[nodes.length - 1].y - 92 },
  ];
  const roadPath = smooth(pts);
  const lastBuilt = nodes.filter((n) => n.built).slice(-1)[0];
  const walkedPath = lastBuilt ? smooth(pts.slice(0, nodes.indexOf(lastBuilt) + 2)) : '';

  return { nodes, byId, roadW, roadPath, walkedPath };
}

// A chapter stop. Built chapters are warm and lit with a play arrow; the rest
// are cold stone — locked (with a padlock) or, for the quieter stops between
// landmarks, just a marker on the road.
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

  const label = `Chapter ${n.ord} — ${n.title}, ${n.passage}${lit ? '' : ' (coming soon)'}`;

  return `<button type="button" class="mr-node" data-node="${n.id}" aria-label="${label}"
    style="position:absolute; left:${n.x}px; top:${n.y}px; width:0; height:0; padding:0; border:0; background:none; color:inherit; font:inherit; cursor:pointer">
    ${halo}
    <span data-circle="1" style="position:absolute; left:0; top:0; width:${n.size}px; height:${n.size}px; transform:translate(-50%,-50%); border-radius:50%; display:flex; align-items:center; justify-content:center; background:${bg}; border:2px solid ${border}; box-shadow:${shadow}"
      >${glyph}</span>
    <span style="position:absolute; left:0; top:${-half - 26}px; transform:translateX(-50%); font:600 ${ordSize}px Georgia,serif; letter-spacing:.24em; color:${ordColor}; white-space:nowrap; pointer-events:none">${n.ord}</span>
    <span style="position:absolute; left:0; top:${half + 13}px; transform:translateX(-50%); font:600 ${labelSize}px 'Segoe UI',system-ui,sans-serif; color:${labelColor}; letter-spacing:.04em; white-space:nowrap; text-shadow:0 2px 9px rgba(4,14,20,.85); pointer-events:none">${n.title}</span>
  </button>`;
}

// The ambient fields. `counts` arrives already scaled by the player's Graphics
// preset, so Low draws a quieter sky rather than a different one.
export function particleHtml(counts) {
  const r = seeded(9173);
  const out = {};

  out.stars = Array.from({ length: counts.stars }, () => {
    const x = Math.round(r() * 1420);
    const y = Math.round(r() * 480);
    const s = r() > 0.78 ? 4 : r() > 0.4 ? 3 : 2;
    const sh = r() > 0.72 ? '0 0 8px 2px rgba(214,228,255,.55)' : 'none';
    const dur = (3.4 + r() * 3.6).toFixed(1);
    const d = (r() * 5).toFixed(1);
    return `<div style="position:absolute; left:${x}px; top:${y}px; width:${s}px; height:${s}px; border-radius:50%; background:#eef4ff; box-shadow:${sh}; animation:mrTwinkle ${dur}s ease-in-out ${d}s infinite"></div>`;
  }).join('');

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

  out.motes = Array.from({ length: counts.motes }, () => {
    const x = Math.round(120 + r() * 1240);
    const y = Math.round(540 + r() * 240);
    const s = r() > 0.7 ? 6 : r() > 0.35 ? 5 : 4;
    const dur = (12 + r() * 8).toFixed(1);
    const d = (r() * 12).toFixed(1);
    return `<div style="position:absolute; left:${x}px; top:${y}px; width:${s}px; height:${s}px; border-radius:50%; background:#dfe8ff; opacity:.5; animation:mrMote ${dur}s linear ${d}s infinite; pointer-events:none"></div>`;
  }).join('');

  // Embers rise from the two far camps only — the near camp is small enough
  // that its own flames read on their own.
  const camps = [[2303, 657], [4606, 672]];
  const perCamp = Math.max(2, Math.round(counts.embers / camps.length));
  out.embers = camps.flatMap(([cx, cy]) => Array.from({ length: perCamp }, () => {
    const x = Math.round(cx - 8 + r() * 22);
    const y = Math.round(cy - r() * 10);
    const s = r() > 0.66 ? 5 : r() > 0.33 ? 4 : 3;
    const dx = Math.round(-10 + r() * 40);
    const dur = (2.6 + r() * 2.6).toFixed(1);
    const d = (r() * 4).toFixed(1);
    return `<div style="position:absolute; left:${x}px; top:${y}px; width:${s}px; height:${s}px; border-radius:50%; background:#ffc27a; box-shadow:0 0 9px 2px rgba(255,168,84,.55); animation:mrEmber ${dur}s ease-out ${d}s infinite; --dx:${dx}px"></div>`;
  })).join('');

  out.fireflies = Array.from({ length: counts.fireflies }, () => {
    const x = Math.round(160 + r() * 1180);
    const y = Math.round(560 + r() * 200);
    const dur = (7 + r() * 6).toFixed(1);
    const d = (r() * 8).toFixed(1);
    return `<div style="position:absolute; left:${x}px; top:${y}px; width:5px; height:5px; border-radius:50%; background:#ffe9a8; box-shadow:0 0 11px 3px rgba(255,214,120,.5); animation:mrFly ${dur}s ease-in-out ${d}s infinite"></div>`;
  }).join('');

  return out;
}
