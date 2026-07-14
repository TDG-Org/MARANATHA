import { Character } from '../../engine/Character.js';

// The Joseph cast, drawn procedurally (character-design skill): distinct
// silhouette + one or two signature colours per named person, plus a stride
// pose driven by `swing` so the Character atlas can animate a real walk.
//
// Slice 2 ships the player (Joseph). Jacob and the brothers arrive in Slice 4
// (Scene 1) — the same drawRobedFigure() handles them via options.

function limb(ctx, x1, y1, x2, y2, wide, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = wide;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

// Draw one frame of a robed figure. swing ∈ [-1..1] is the stride phase.
export function drawRobedFigure(ctx, w, h, swing, opts = {}) {
  const cx = w / 2;
  const skin = opts.skin || '#c98d5a';
  const skinShade = opts.skinShade || '#a9713f';
  const robe = opts.robe || '#d8c39a';
  const robeShade = opts.robeShade || '#b79f74';
  const hair = opts.hair || '#3a2c22';
  const bands = opts.bands || null; // ornate coat colours (Joseph)
  const beard = opts.beard || null;
  const staff = opts.staff || false;
  const rim = 'rgba(255,217,160,0.5)'; // sun is upper-LEFT in our scenes

  const groundY = 238;
  const hipY = 190;
  const shoulderY = 74;
  const headY = 40;
  const step = swing * 13;

  ctx.lineJoin = 'round';

  // --- Legs (back then front) + feet ---
  limb(ctx, cx - 6, hipY, cx - 6 - step * 0.5, groundY - 4, 9, skinShade);
  ctx.fillStyle = skinShade;
  ctx.beginPath(); ctx.ellipse(cx - 6 - step * 0.5, groundY - 2, 6, 3.2, 0, 0, Math.PI * 2); ctx.fill();
  limb(ctx, cx + 6, hipY, cx + 6 + step * 0.7, groundY - 4, 9, skin);
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.ellipse(cx + 6 + step * 0.7, groundY - 2, 6.5, 3.4, 0, 0, Math.PI * 2); ctx.fill();

  // --- Far arm (behind the robe), swings opposite the front leg ---
  const armSwing = -swing * 10;
  limb(ctx, cx - 15, shoulderY + 4, cx - 20 - armSwing * 0.4, 150, 8, robeShade);

  // --- Robe body (a soft tapering silhouette that sways with the stride) ---
  const hemSway = swing * 4;
  ctx.fillStyle = robe;
  ctx.beginPath();
  ctx.moveTo(cx - 16, shoulderY);
  ctx.bezierCurveTo(cx - 30, 110, cx - 30 + hemSway, 175, cx - 32 + hemSway, 206);
  ctx.lineTo(cx + 32 + hemSway, 206);
  ctx.bezierCurveTo(cx + 30 + hemSway, 175, cx + 30, 110, cx + 16, shoulderY);
  ctx.closePath();
  ctx.fill();

  // Ornate horizontal bands, clipped to the robe (Joseph's coat of many colours).
  if (bands && bands.length) {
    ctx.save();
    ctx.clip();
    const top = 88;
    const bottom = 204;
    const bandH = (bottom - top) / bands.length;
    bands.forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.fillRect(cx - 40, top + i * bandH, 80, bandH * 0.82);
    });
    ctx.restore();
  }

  // --- Near arm, swings with the stride ---
  limb(ctx, cx + 15, shoulderY + 4, cx + 20 + armSwing * 0.6, 150, 8.5, robe);

  // --- Head + hair (+ optional beard) ---
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.arc(cx, headY, 15, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = hair;
  ctx.beginPath(); ctx.arc(cx, headY - 3, 15, Math.PI * 0.95, Math.PI * 2.05); ctx.fill(); // hair cap
  if (beard) {
    ctx.fillStyle = beard;
    ctx.beginPath();
    ctx.moveTo(cx - 12, headY + 6);
    ctx.quadraticCurveTo(cx, headY + 34, cx + 12, headY + 6);
    ctx.quadraticCurveTo(cx, headY + 18, cx - 12, headY + 6);
    ctx.fill();
  }

  // --- Staff (Jacob) ---
  if (staff) {
    ctx.strokeStyle = '#6b4a2c';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx + 26, 70);
    ctx.lineTo(cx + 30, groundY - 2);
    ctx.stroke();
  }

  // --- Warm rim light on the sun (left) side ---
  ctx.strokeStyle = rim;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.arc(cx, headY, 15, Math.PI * 0.7, Math.PI * 1.25);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - 20, 96);
  ctx.bezierCurveTo(cx - 30, 130, cx - 30 + hemSway, 176, cx - 31 + hemSway, 204);
  ctx.stroke();
}

// The player. Youthful, no beard. He starts in a plain shepherd's robe and
// receives the robe of many colors at the gift (giveCoat) — so the coat is
// truly *given*, not worn from the start.
const josephPlain = { robe: '#cdbf9e', robeShade: '#ad9f78', skin: '#cf9a63', hair: '#2f2620' };
const josephCoat = { ...josephPlain, bands: ['#b5643c', '#cf9a4e', '#6f8256', '#8a5a72', '#3f7a86'] };

export function makeJoseph() {
  return new Character({
    name: 'Joseph',
    height: 2.0,
    draw: (ctx, w, h, swing) => drawRobedFigure(ctx, w, h, swing, josephPlain),
  });
}

// Give Joseph the robe of many colors (called at the coat beat, Gen 37:3).
export function giveCoat(joseph) {
  joseph.setDraw((ctx, w, h, swing) => drawRobedFigure(ctx, w, h, swing, josephCoat));
}

// Jacob / Israel — older, grey-bearded, deep russet robe, leaning on a staff.
export function makeJacob() {
  return new Character({
    name: 'Jacob',
    height: 2.06,
    draw: (ctx, w, h, swing) => drawRobedFigure(ctx, w, h, swing, {
      robe: '#8a5a3c', robeShade: '#6e4630', skin: '#b98a55',
      hair: '#8f8a82', beard: '#c3bdb0', staff: true,
    }),
  });
}

// Reuben — the eldest: tallest, broad, muted blue, steadier bearing.
export function makeReuben() {
  return new Character({
    name: 'Reuben',
    height: 2.12,
    draw: (ctx, w, h, swing) => drawRobedFigure(ctx, w, h, swing, {
      robe: '#5a6b86', robeShade: '#47566e', skin: '#c98d5a',
      hair: '#3a2c22', beard: '#4a3a2c',
    }),
  });
}

// Judah — strong, plain, ochre/brown; stands a little forward of the group.
export function makeJudah() {
  return new Character({
    name: 'Judah',
    height: 2.0,
    draw: (ctx, w, h, swing) => drawRobedFigure(ctx, w, h, swing, {
      robe: '#a9773f', robeShade: '#8a5f31', skin: '#c07d45',
      hair: '#2f2620', beard: '#3a2c1e',
    }),
  });
}

// A believable knot of other brothers — vary tone/height so they aren't clones.
const BROTHER_LOOKS = [
  { robe: '#7a6a56', robeShade: '#5f5344', skin: '#c1854e', hair: '#2f2620', beard: '#3a2c1e', height: 1.98 },
  { robe: '#6b5d6e', robeShade: '#544857', skin: '#b87c46', hair: '#241f1a', beard: null, height: 1.92 },
  { robe: '#8a7a5a', robeShade: '#6d6046', skin: '#cf9a63', hair: '#3a2c22', beard: '#4a3a2c', height: 2.03 },
];
export function makeBrother(i = 0) {
  const o = BROTHER_LOOKS[i % BROTHER_LOOKS.length];
  return new Character({ name: `Brother ${i + 1}`, height: o.height, draw: (ctx, w, h, s) => drawRobedFigure(ctx, w, h, s, o) });
}

// --- Sheep: a woolly, idle camp animal (single frame + breath) --------------
function drawSheep(ctx, w, h) {
  const cx = w / 2, groundY = h - 6;
  ctx.strokeStyle = '#4a4034'; ctx.lineWidth = 4; ctx.lineCap = 'round';
  [-14, -5, 6, 15].forEach((dx) => { ctx.beginPath(); ctx.moveTo(cx + dx, groundY - 16); ctx.lineTo(cx + dx, groundY); ctx.stroke(); });
  // woolly body — several soft cream lumps
  ctx.fillStyle = '#efe9dc';
  [[-12, -20, 12], [0, -24, 15], [13, -20, 12], [-4, -14, 14], [8, -14, 12]].forEach(([dx, dy, r]) => {
    ctx.beginPath(); ctx.arc(cx + dx, groundY + dy, r, 0, Math.PI * 2); ctx.fill();
  });
  // head
  ctx.fillStyle = '#5a4d3f';
  ctx.beginPath(); ctx.ellipse(cx + 20, groundY - 20, 6.5, 8, 0.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#efe9dc'; // little forehead tuft
  ctx.beginPath(); ctx.arc(cx + 18, groundY - 27, 4, 0, Math.PI * 2); ctx.fill();
}
export function makeSheep() {
  return new Character({ name: 'sheep', height: 0.9, frameW: 96, frameH: 64, walkPoses: [], strideLen: 1, bobAmp: 0.02, draw: drawSheep });
}
