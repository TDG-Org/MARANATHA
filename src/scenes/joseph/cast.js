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

// The player. Youthful, no beard, wearing the ornate robe (his identity until
// the pit). Muted jewel bands so he's recognizable at a glance.
export function makeJoseph() {
  return new Character({
    name: 'Joseph',
    height: 2.0,
    draw: (ctx, w, h, swing) => drawRobedFigure(ctx, w, h, swing, {
      robe: '#e2d3ac',
      robeShade: '#c3b183',
      skin: '#cf9a63',
      hair: '#2f2620',
      bands: ['#b5643c', '#cf9a4e', '#6f8256', '#8a5a72', '#3f7a86'],
    }),
  });
}
