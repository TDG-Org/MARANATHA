import * as THREE from 'three';
import { canvasTexture, mulberry32, toonMat } from '../../engine/world.js';
import { COLORS } from './arkSpec.js';

// THE ARK IS MADE OF WOOD, AND IT HAS TO LOOK IT.
//
// A 137 m hull covered in one flat brown is a shipping container. What makes
// timber read as timber at a glance is the SEAM: the long horizontal line where
// one strake meets the next, repeated up the whole side. That is a texture's
// job, not geometry's - modelling every plank edge on a hull this size would
// cost more triangles than the entire rest of the scene.
//
// Every texture here is drawn in a canvas at load time (the project ships zero
// image files for art), and every one tiles seamlessly: the plank bands divide
// the canvas height exactly, and anything drawn near an edge is drawn again
// wrapped round the other side.

// Draw something, then draw it again shifted by +-w and +-h, so nothing that
// crosses an edge leaves a visible cut when the texture repeats.
function wrapped(ctx, w, h, x, y, draw) {
  for (let ox = -1; ox <= 1; ox++) {
    for (let oy = -1; oy <= 1; oy++) {
      ctx.save();
      ctx.translate(x + ox * w, y + oy * h);
      draw(ctx);
      ctx.restore();
    }
  }
}

const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;

function mixHex(a, b, t) {
  const ca = new THREE.Color(a);
  const cb = new THREE.Color(b);
  ca.lerp(cb, t);
  return `#${ca.getHexString()}`;
}

// PLANKING — horizontal strakes with a dark caulked seam between each.
// `planks` is how many strakes fit in one tile; keep it an integer so the tile
// repeats without cutting a plank in half.
function plankTexture({
  size = 512,
  planks = 8,
  base,
  light,
  dark,
  seed = 7,
  grain = 0.5,
  knots = 5,
  tar = 0,          // 0..1 — how much tarry pitch mottling sits over the wood
  butts = true,     // the vertical joints where one plank's length ends
}) {
  return canvasTexture(size, size, (ctx, w, h) => {
    const rnd = mulberry32(seed);
    const band = h / planks;

    ctx.fillStyle = hex(base);
    ctx.fillRect(0, 0, w, h);

    // Each strake gets its own tone — real planking is never one colour.
    for (let i = 0; i < planks; i++) {
      const y = i * band;
      const t = rnd();
      ctx.fillStyle = mixHex(base, t > 0.5 ? light : dark, 0.22 + t * 0.4);
      ctx.fillRect(0, y, w, band);

      // grain: long soft streaks along the plank
      const lines = Math.round(5 + grain * 9);
      for (let g = 0; g < lines; g++) {
        const gy = y + 2 + rnd() * (band - 4);
        ctx.strokeStyle = mixHex(base, rnd() > 0.45 ? dark : light, 0.10 + rnd() * 0.16);
        ctx.lineWidth = 0.6 + rnd() * 1.5;
        ctx.beginPath();
        ctx.moveTo(0, gy);
        // a gentle wander so the grain is not a ruled line
        const steps = 6;
        for (let s = 1; s <= steps; s++) {
          ctx.lineTo((s / steps) * w, gy + Math.sin(s * 1.7 + t * 9) * 1.5);
        }
        ctx.stroke();
      }

      // THE SEAM: the caulked joint under this strake. This single line is what
      // makes the whole hull read as planked.
      ctx.fillStyle = mixHex(dark, 0x000000, 0.45);
      ctx.fillRect(0, y + band - 2.5, w, 2.5);
      ctx.fillStyle = mixHex(light, 0xffffff, 0.10);
      ctx.globalAlpha = 0.30;
      ctx.fillRect(0, y + band - 4, w, 1.2); // the lit lip above the seam
      ctx.globalAlpha = 1;

      // butt joints — where one plank ends and the next begins along the run
      if (butts) {
        const n = 1 + Math.floor(rnd() * 2);
        for (let b = 0; b < n; b++) {
          const bx = rnd() * w;
          ctx.fillStyle = mixHex(dark, 0x000000, 0.35);
          ctx.fillRect(bx, y + 1, 2, band - 3.5);
        }
      }
    }

    // knots
    for (let k = 0; k < knots; k++) {
      const kx = rnd() * w;
      const ky = rnd() * h;
      const kr = 3 + rnd() * 6;
      wrapped(ctx, w, h, kx, ky, (c) => {
        c.scale(1, 0.62);
        for (let ring = 3; ring >= 1; ring--) {
          c.beginPath();
          c.arc(0, 0, kr * (ring / 3), 0, Math.PI * 2);
          c.strokeStyle = mixHex(dark, 0x000000, 0.25 + ring * 0.05);
          c.lineWidth = 1.1;
          c.stroke();
        }
        c.beginPath();
        c.arc(0, 0, kr * 0.28, 0, Math.PI * 2);
        c.fillStyle = mixHex(dark, 0x000000, 0.5);
        c.fill();
      });
    }

    // PITCH. Genesis 6:14 — sealed inside and out. Where it is thick it pools in
    // the seams and runs, dulling the grain without hiding the plank forms.
    if (tar > 0) {
      for (let i = 0; i < 26; i++) {
        const px = rnd() * w;
        const py = rnd() * h;
        const pr = 18 + rnd() * 70;
        wrapped(ctx, w, h, px, py, (c) => {
          const g = c.createRadialGradient(0, 0, 0, 0, 0, pr);
          g.addColorStop(0, `rgba(24,16,11,${0.10 + rnd() * 0.16 * tar})`);
          g.addColorStop(1, 'rgba(24,16,11,0)');
          c.fillStyle = g;
          c.beginPath();
          c.arc(0, 0, pr, 0, Math.PI * 2);
          c.fill();
        });
      }
      // runs of pitch down the seams
      for (let i = 0; i < 14; i++) {
        const rx = rnd() * w;
        const ry = rnd() * h;
        wrapped(ctx, w, h, rx, ry, (c) => {
          c.fillStyle = `rgba(20,13,9,${0.14 + rnd() * 0.2 * tar})`;
          c.fillRect(0, 0, 2 + rnd() * 5, band * (0.5 + rnd() * 1.6));
        });
      }
    }
  });
}

// A cut end / rough sawn timber: grain running one way, no strakes.
function sawnTexture({ size = 256, base, light, dark, seed = 21 }) {
  return canvasTexture(size, size, (ctx, w, h) => {
    const rnd = mulberry32(seed);
    ctx.fillStyle = hex(base);
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) {
      const y = rnd() * h;
      ctx.strokeStyle = mixHex(base, rnd() > 0.5 ? dark : light, 0.12 + rnd() * 0.25);
      ctx.lineWidth = 0.7 + rnd() * 2.2;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let s = 1; s <= 5; s++) ctx.lineTo((s / 5) * w, y + Math.sin(s * 2.1 + i) * 2.4);
      ctx.stroke();
    }
    // saw marks across the grain
    for (let i = 0; i < 16; i++) {
      const x = rnd() * w;
      ctx.strokeStyle = mixHex(dark, 0x000000, 0.14);
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + (rnd() - 0.5) * 10, h);
      ctx.stroke();
    }
  });
}

// One owner for every texture the ark uses, so the scene disposes them together.
export function createWood() {
  const textures = [];
  const keep = (t, rx, ry) => {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rx, ry);
    textures.push(t);
    return t;
  };

  // The pitched exterior. Big repeat: the hull is 137 m long, so one tile covers
  // a real stretch of planking rather than smearing.
  const pitched = keep(plankTexture({
    size: 512, planks: 8, base: COLORS.pitch, light: COLORS.pitchLight,
    dark: COLORS.pitchDark, seed: 11, tar: 1, knots: 4, grain: 0.35,
  }), 1, 1);

  // The interior skin: the same planking, but lamplit and dusty rather than
  // tarred, so an interior does not read as the inside of a boot.
  const inner = keep(plankTexture({
    size: 512, planks: 7, base: COLORS.innerWall, light: COLORS.timberLight,
    dark: COLORS.timberDark, seed: 23, tar: 0.25, knots: 6, grain: 0.7,
  }), 1, 1);

  // Decks: worn paler by traffic, planks running across.
  const deck = keep(plankTexture({
    size: 512, planks: 9, base: COLORS.deckPlank, light: 0xa07a4e,
    dark: COLORS.timberDark, seed: 37, tar: 0.12, knots: 7, grain: 0.8,
  }), 1, 1);

  // Fresh-cut structural timber, for beams, scaffolding and the timber stacks.
  const sawn = keep(sawnTexture({
    size: 256, base: COLORS.timber, light: COLORS.timberLight, dark: COLORS.timberDark, seed: 53,
  }), 1, 1);

  return {
    pitched,
    inner,
    deck,
    sawn,
    // Materials. Toon-shaded like every other prop in the game so the ark
    // belongs to the same world as the camp.
    matExterior: () => toonMat(0xffffff, { map: pitched, vertexColors: true }),
    matInner: () => toonMat(0xffffff, { map: inner, vertexColors: true, side: THREE.FrontSide }),
    matDeck: () => toonMat(0xffffff, { map: deck, vertexColors: true }),
    matTimber: () => toonMat(0xffffff, { map: sawn, vertexColors: true }),
    dispose() { textures.forEach((t) => t.dispose()); textures.length = 0; },
  };
}
