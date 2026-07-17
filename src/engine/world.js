import * as THREE from 'three';

// ============================================================================
// HD-2D WORLD KIT — the reusable pieces every scene composes from.
// Ported from the proven foundation scene (Phase A) and parameterized so the
// home screen and every story share ONE seamless dithered sky, the same
// haze-ordered ridge flats, ground, glows, motes, and billboarding rules.
// No lights, no shadows, no postprocessing — unlit materials + fog carry the
// look (art-style + performance skills).
// ============================================================================

// Deterministic tiny PRNG so a scene is identical every load.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const easeInOut = (t) => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, t)));
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const lerp = (a, b, t) => a + (b - a) * t;

// --- Canvas texture helper (all art is procedural — zero image assets) ------

export function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 1;
  return tex;
}

// --- Lit materials (D4): the environment is now SHAPED by the sun --------------
// A shared 4-band toon gradient so lit props read stylized (matching the toon
// characters), not smoothly shaded. RedFormat 1D ramp = the three.js idiom.
let _toonGrad = null;
export function toonGradient() {
  if (_toonGrad) return _toonGrad;
  const steps = new Uint8Array([96, 160, 214, 255]);
  const tex = new THREE.DataTexture(steps, steps.length, 1, THREE.RedFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  _toonGrad = tex;
  return tex;
}

// toonMat — banded toon shading for props (lit by the sun + hemi fill).
export function toonMat(color, opts = {}) {
  return new THREE.MeshToonMaterial({ color, fog: true, gradientMap: toonGradient(), ...opts });
}

// litMat — smooth Lambert shading for big surfaces (ground) where banding would
// look harsh; still shaped by the sun.
export function litMat(color, opts = {}) {
  return new THREE.MeshLambertMaterial({ color, fog: true, ...opts });
}

export function glowTexture(px = 256) {
  return canvasTexture(px, px, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

// A soft radial blob shadow plane (never a real shadow).
export function blobShadow(width = 1.7, tint = '16,12,28') {
  const tex = canvasTexture(128, 64, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, `rgba(${tint},0.5)`);
    g.addColorStop(1, `rgba(${tint},0)`);
    ctx.fillStyle = g;
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(1, 0.5);
    ctx.translate(-w / 2, -h / 2);
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  });
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, width * 0.5),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.02;
  return mesh;
}

// --- Sky: one seamless dithered gradient dome (kills lines AND banding) -----
// Returns { mesh, setColors(top, bottom, ms) } — colors tween so environment
// mood shifts never cut (art-style + environment-vibes).

export function makeSky({ top = 0xf2b880, bottom = 0xffe9c9, offset = 0.12, exponent = 0.85 } = {}) {
  const uniforms = {
    topColor: { value: new THREE.Color(top) },
    bottomColor: { value: new THREE.Color(bottom) },
    offset: { value: offset },
    exponent: { value: exponent },
  };
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      uniform float offset;
      uniform float exponent;
      varying vec3 vDir;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main() {
        float t = pow(clamp(vDir.y + offset, 0.0, 1.0), exponent);
        vec3 col = mix(bottomColor, topColor, t);
        col += (hash(gl_FragCoord.xy) - 0.5) * (1.5 / 255.0);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(480, 32, 15), mat);
  mesh.frustumCulled = false;

  // Eased uniform tween (drives sky mood transitions).
  let tween = null;
  const fromTop = new THREE.Color();
  const fromBottom = new THREE.Color();
  const toTop = new THREE.Color();
  const toBottom = new THREE.Color();
  function setColors(nextTop, nextBottom, ms = 2000) {
    if (ms <= 0) {
      uniforms.topColor.value.set(nextTop);
      uniforms.bottomColor.value.set(nextBottom);
      tween = null;
      return;
    }
    fromTop.copy(uniforms.topColor.value);
    fromBottom.copy(uniforms.bottomColor.value);
    toTop.set(nextTop);
    toBottom.set(nextBottom);
    tween = { t: 0, ms };
  }
  function update(dt) {
    if (!tween) return;
    tween.t = Math.min(1, tween.t + dt / tween.ms);
    const k = easeInOut(tween.t);
    uniforms.topColor.value.copy(fromTop).lerp(toTop, k);
    uniforms.bottomColor.value.copy(fromBottom).lerp(toBottom, k);
    if (tween.t >= 1) tween = null;
  }
  return { mesh, setColors, update, uniforms };
}

// --- Ridge flats: Alto silhouette crests standing at real depths ------------

export function makeRidgeFlat({ width, height, baseline, waves, seed, color, z }) {
  const rnd = mulberry32(seed);
  const phases = waves.map(() => rnd() * Math.PI * 2);
  const shape = new THREE.Shape();
  const steps = 110;
  shape.moveTo(-width / 2, -40);
  for (let i = 0; i <= steps; i++) {
    const x = -width / 2 + (i / steps) * width;
    let y = baseline;
    waves.forEach(([f, a], j) => {
      y += Math.sin((i / steps) * Math.PI * 2 * f + phases[j]) * a;
    });
    shape.lineTo(x, Math.min(y, height));
  }
  shape.lineTo(width / 2, -40);
  shape.closePath();
  const mesh = new THREE.Mesh(
    new THREE.ShapeGeometry(shape),
    new THREE.MeshBasicMaterial({ color, fog: true }),
  );
  mesh.position.z = z;
  return mesh;
}

// A standard 3-ridge backdrop at proven depths. Pass a palette to re-tint.
export function makeRidges(pal = {}) {
  const veryFar = pal.veryFar ?? 0x9a90ad;
  const far = pal.far ?? 0x8a7f9e;
  const mid = pal.mid ?? 0x5d5378;
  const group = new THREE.Group();
  group.add(makeRidgeFlat({ width: 700, height: 120, baseline: 42, z: -210, color: veryFar, waves: [[1, 34], [2, 15], [5, 5]], seed: 100 }));
  group.add(makeRidgeFlat({ width: 560, height: 90, baseline: 26, z: -150, color: far, waves: [[1, 22], [2, 11], [5, 4]], seed: 101 }));
  group.add(makeRidgeFlat({ width: 440, height: 60, baseline: 12, z: -95, color: mid, waves: [[2, 9], [4, 4.5], [9, 1.6]], seed: 102 }));
  return group;
}

// --- Ground: a gently rolling unlit heightfield, flattened near the origin --

// The walkable areas stay dead flat: every story STAGE (camp, dream field,
// pit, interiors…) carves its own flat PAD — `pads: [{x, z, flatCore,
// falloff}]` in world space — and swells only ramp in beyond ALL pads
// (level-layout law 1: un-carved stages get pierced by terrain). The default
// single pad around the origin keeps old callers working. Flattening is
// computed in WORLD space so the mesh's z offset can't push a flat spot off
// its stage (that bug made the ground rise up and occlude the character).
export function makeGround({
  color = 0x4c4066, seed = 77, width = 320, depth = 130,
  flatCore = 17, falloff = 46, z = -25, flattenWorldZ = 0,
  pads = null, segX = 64, segZ = 20, mottle = null,
} = {}) {
  const padList = pads ?? [{ x: 0, z: flattenWorldZ, flatCore, falloff }];
  const geo = new THREE.PlaneGeometry(width, depth, segX, segZ);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const rnd = mulberry32(seed);
  const p1 = rnd() * Math.PI * 2;
  const p2 = rnd() * Math.PI * 2;

  // Optional vertex-color mottling: patches of nearby earth tones so the
  // ground reads alive and sun-warmed instead of one flat sheet.
  let colAttr = null;
  const base = new THREE.Color(color);
  const tones = (mottle || []).map((m) => new THREE.Color(m));
  if (tones.length) {
    colAttr = new Float32Array(pos.count * 3);
    geo.setAttribute('color', new THREE.BufferAttribute(colAttr, 3));
  }
  const tmp = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const zz = pos.getZ(i);
    const worldZ = zz + z; // this vertex's world z (mesh is offset by z)
    let d = 1;
    for (const p of padList) {
      const dist = Math.hypot(x - p.x, worldZ - p.z);
      const pd = Math.min(1, Math.max(0, (dist - p.flatCore) / p.falloff));
      if (pd < d) d = pd;
    }
    const y = (Math.sin(x * 0.055 + p1) * 1.6 + Math.sin(x * 0.021 + zz * 0.045 + p2) * 2.4) * d * d;
    pos.setY(i, y - 0.02);

    if (colAttr) {
      // two soft sine fields pick a tone + strength — organic, deterministic
      const n1 = Math.sin(x * 0.21 + worldZ * 0.17 + p1 * 3) * Math.sin(x * 0.06 - worldZ * 0.11 + p2);
      const n2 = Math.sin(x * 0.045 + worldZ * 0.05 + p2 * 2);
      const t = tones[(n2 > 0 ? 0 : 1) % tones.length] || tones[0];
      const k = Math.max(0, n1) * 0.55;
      tmp.copy(base).lerp(t, k);
      colAttr[i * 3] = tmp.r;
      colAttr[i * 3 + 1] = tmp.g;
      colAttr[i * 3 + 2] = tmp.b;
    }
  }
  geo.computeVertexNormals();
  // D4: the ground is now LIT by the sun (Lambert) — swells catch light, dirt
  // and grass patches read with real form instead of a flat sheet.
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial(
    colAttr ? { vertexColors: true, fog: true } : { color, fog: true },
  ));
  mesh.position.z = z;
  return mesh;
}

// --- Sun: layered glow (tight core + wide halo), additive, fog-exempt -------

export function makeSun({ x = -58, y = 52, z = -200, color = 0xfff3d6, core = 56, halo = 150 } = {}) {
  const tex = glowTexture();
  const mk = (scale, opacity) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex, color, transparent: true, opacity,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    }));
    s.scale.setScalar(scale);
    s.position.set(x, y, z);
    return s;
  };
  const group = new THREE.Group();
  group.add(mk(halo, 0.32), mk(core, 0.9));
  return group;
}

// --- Motes: one THREE.Points of drifting golden air -------------------------

export function makeMotes({ count = 110, color = 0xfff3d6, spanX = 120, spanZ = 80, seedN = 9 } = {}) {
  const rnd = mulberry32(seedN);
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (rnd() - 0.5) * spanX;
    pos[i * 3 + 1] = 0.5 + rnd() * 13;
    pos[i * 3 + 2] = 12 - rnd() * spanZ;
    seed[i] = rnd() * Math.PI * 2;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const points = new THREE.Points(geo, new THREE.PointsMaterial({
    map: glowTexture(64), color, size: 0.55, sizeAttenuation: true,
    transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending,
    depthWrite: false, fog: true,
  }));
  const half = spanX / 2 + 2;
  function update(dt, t) {
    const mp = geo.attributes.position;
    for (let i = 0; i < count; i++) {
      let x = mp.getX(i) - dt * 0.0006 * (6 + Math.sin(seed[i]) * 3);
      if (x < -half) x += half * 2;
      mp.setX(i, x);
      mp.setY(i, mp.getY(i) + Math.sin(t * 0.6 + seed[i]) * dt * 0.0004);
    }
    mp.needsUpdate = true;
  }
  return { points, update };
}

// --- Billboarding: yaw-only so sprites stay upright as the camera moves -----

export function yawToCamera(obj, camera) {
  obj.rotation.y = Math.atan2(camera.position.x - obj.position.x, camera.position.z - obj.position.z);
}

// --- Minimal geometry merge (positions + uvs) so we skip the addons bundle --

export function mergeGeometries(geos) {
  let vertCount = 0;
  let indexCount = 0;
  for (const g of geos) {
    vertCount += g.attributes.position.count;
    indexCount += g.index ? g.index.count : g.attributes.position.count;
  }
  const positions = new Float32Array(vertCount * 3);
  const uvs = new Float32Array(vertCount * 2);
  const indices = new Uint16Array(indexCount);
  let vOff = 0;
  let iOff = 0;
  for (const g of geos) {
    positions.set(g.attributes.position.array, vOff * 3);
    if (g.attributes.uv) uvs.set(g.attributes.uv.array, vOff * 2);
    const idx = g.index ? g.index.array : [...Array(g.attributes.position.count).keys()];
    for (let i = 0; i < idx.length; i++) indices[iOff + i] = idx[i] + vOff;
    vOff += g.attributes.position.count;
    iOff += idx.length;
    g.dispose();
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  merged.setIndex(new THREE.BufferAttribute(indices, 1));
  return merged;
}
