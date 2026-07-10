import * as THREE from 'three';

// ============================================================================
// FOUNDATION SCENE — the HD-2D proof of look (Phase A).
// Everything the art bible demands, in 3D:
//   • ONE seamless shader-gradient sky with in-shader dithering — no tiles,
//     no stacked layers, no banding, no lines. Ever.
//   • Alto silhouette ridges as flat "set piece" shapes standing at real
//     depths — true parallax from a real moving camera.
//   • Low-poly instanced trees on real rolling ground, hazed by fog.
//   • A flat 2D sprite character (billboarded, yaw only) living IN the world.
//   • Gentle eased camera drift, drifting light motes, a small flock of birds.
// No lights, no shadows, no postprocessing — unlit materials + fog carry the
// whole golden-hour look (performance mandate).
// ============================================================================

const PALETTE = {
  skyTop: 0xf2b880,
  skyBottom: 0xffe9c9,
  haze: 0xffdfba, // fog color — sits between the sky stops so ridges melt into it
  ridgeVeryFar: 0x9a90ad,
  ridgeFar: 0x8a7f9e,
  ridgeMid: 0x5d5378,
  ground: 0x4c4066,
  ink: 0x241f38, // silhouette ink (trees, character)
  rim: 0xffd9a0, // golden-hour rim light
  glow: 0xfff3d6,
};

// Deterministic tiny PRNG so the scene is identical every load.
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const easeInOut = (t) => 0.5 - 0.5 * Math.cos(Math.PI * t);

// --- Canvas texture helpers (all art is procedural — zero image assets) ----

function canvasTexture(size, draw) {
  const c = document.createElement('canvas');
  c.width = size.w;
  c.height = size.h;
  draw(c.getContext('2d'), size.w, size.h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 1;
  return tex;
}

function glowTexture(px = 256) {
  return canvasTexture({ w: px, h: px }, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

// Robed figure with a staff — dark silhouette, warm rim light on the sun
// side. Drawn large so it stays crisp when the camera comes close.
function characterTexture() {
  return canvasTexture({ w: 128, h: 256 }, (ctx) => {
    const ink = '#241f38';
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    // staff
    ctx.strokeStyle = ink;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(92, 58);
    ctx.lineTo(88, 238);
    ctx.stroke();
    // robe — a soft tapering silhouette
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.moveTo(64, 52);
    ctx.bezierCurveTo(42, 60, 38, 96, 40, 150);
    ctx.bezierCurveTo(41, 196, 44, 226, 48, 238);
    ctx.lineTo(82, 238);
    ctx.bezierCurveTo(86, 214, 88, 178, 86, 140);
    ctx.bezierCurveTo(85, 96, 80, 60, 64, 52);
    ctx.closePath();
    ctx.fill();
    // head + hood suggestion
    ctx.beginPath();
    ctx.arc(64, 38, 16, 0, Math.PI * 2);
    ctx.fill();
    // arm reaching to the staff
    ctx.strokeStyle = ink;
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(72, 96);
    ctx.quadraticCurveTo(84, 92, 90, 86);
    ctx.stroke();
    // warm rim light on the sun side
    ctx.strokeStyle = 'rgba(255,217,160,0.55)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(64, 38, 16, -1.1, 0.9);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(84, 62);
    ctx.bezierCurveTo(87, 98, 88, 160, 84, 232);
    ctx.stroke();
  });
}

// A real bird shape (body, head, two tapered wings), not a bare chevron.
function birdTexture() {
  return canvasTexture({ w: 96, h: 56 }, (ctx) => {
    const ink = '#241f38';
    ctx.fillStyle = ink;
    ctx.strokeStyle = ink;
    ctx.lineJoin = 'round';
    // body
    ctx.beginPath();
    ctx.ellipse(48, 34, 13, 6, -0.12, 0, Math.PI * 2);
    ctx.fill();
    // head + beak
    ctx.beginPath();
    ctx.arc(60, 30, 4.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(64, 30);
    ctx.lineTo(70, 31.5);
    ctx.lineTo(64, 33);
    ctx.closePath();
    ctx.fill();
    // tail
    ctx.beginPath();
    ctx.moveTo(36, 33);
    ctx.lineTo(26, 30);
    ctx.lineTo(27, 38);
    ctx.closePath();
    ctx.fill();
    // wings — tapered strokes swept up
    ctx.lineCap = 'round';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(46, 32);
    ctx.quadraticCurveTo(34, 14, 20, 10);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(52, 32);
    ctx.quadraticCurveTo(62, 16, 76, 12);
    ctx.stroke();
  });
}

function shadowTexture() {
  return canvasTexture({ w: 128, h: 64 }, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(16,12,28,0.5)');
    g.addColorStop(1, 'rgba(16,12,28,0)');
    ctx.fillStyle = g;
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(1, 0.5);
    ctx.translate(-w / 2, -h / 2);
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  });
}

// --- Sky: one seamless dithered gradient dome (kills lines AND banding) ----

function makeSky() {
  const geo = new THREE.SphereGeometry(480, 32, 15);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color(PALETTE.skyTop) },
      bottomColor: { value: new THREE.Color(PALETTE.skyBottom) },
      offset: { value: 0.12 },
      exponent: { value: 0.85 },
    },
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
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
      }
      void main() {
        float t = pow(clamp(vDir.y + offset, 0.0, 1.0), exponent);
        vec3 col = mix(bottomColor, topColor, t);
        // Per-pixel dither: ±0.75/255 of noise breaks 8-bit gradient
        // banding without ever reading as texture.
        col += (hash(gl_FragCoord.xy) - 0.5) * (1.5 / 255.0);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const sky = new THREE.Mesh(geo, mat);
  sky.frustumCulled = false;
  return sky;
}

// --- Ridges: Alto silhouette crests as flat set-pieces at real depths ------

function makeRidgeFlat({ width, height, baseline, waves, seed, color, z }) {
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

// --- Ground: a gently rolling heightfield the character stands on ----------

function makeGround() {
  const geo = new THREE.PlaneGeometry(320, 130, 64, 20);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const rnd = mulberry32(77);
  const p1 = rnd() * Math.PI * 2;
  const p2 = rnd() * Math.PI * 2;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    // Gentle swells that flatten near the character's spot at the origin.
    const d = Math.min(1, Math.hypot(x, z) / 14);
    const y = (Math.sin(x * 0.055 + p1) * 1.6 + Math.sin(x * 0.021 + z * 0.045 + p2) * 2.4) * d * d;
    pos.setY(i, y - 0.02);
  }
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({ color: PALETTE.ground, fog: true }),
  );
  mesh.position.z = -25;
  return mesh;
}

// --- Trees: ONE instanced draw call for the whole forest -------------------

function makeTrees() {
  // A pine silhouette: two stacked cones + a stub trunk, merged by hand into
  // a single geometry (three primitives -> one InstancedMesh -> 1 draw call).
  const cone1 = new THREE.ConeGeometry(1.0, 2.2, 7);
  cone1.translate(0, 2.0, 0);
  const cone2 = new THREE.ConeGeometry(0.72, 1.8, 7);
  cone2.translate(0, 3.3, 0);
  const trunk = new THREE.CylinderGeometry(0.13, 0.16, 1.1, 5);
  trunk.translate(0, 0.5, 0);

  const merged = mergeGeometries([cone1, cone2, trunk]);
  const mat = new THREE.MeshBasicMaterial({ color: PALETTE.ink, fog: true });

  const COUNT = 42;
  const trees = new THREE.InstancedMesh(merged, mat, COUNT);
  const dummy = new THREE.Object3D();
  const rnd = mulberry32(2026);
  let placed = 0;
  while (placed < COUNT) {
    const x = (rnd() - 0.5) * 190;
    const z = -6 - rnd() * 62;
    if (Math.hypot(x, z) < 9) continue; // keep the character's clearing open
    const s = 0.8 + rnd() * 1.6;
    dummy.position.set(x, 0, z);
    dummy.scale.set(s, s * (0.9 + rnd() * 0.3), s);
    dummy.rotation.y = rnd() * Math.PI;
    dummy.updateMatrix();
    trees.setMatrixAt(placed, dummy.matrix);
    placed += 1;
  }
  trees.instanceMatrix.needsUpdate = true;
  return trees;
}

// Minimal geometry merge (positions + normals + uvs) so we don't pull the
// whole addons bundle in for one helper.
function mergeGeometries(geos) {
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

// --- The scene --------------------------------------------------------------

export function buildFoundation({ scene, camera }) {
  scene.fog = new THREE.Fog(PALETTE.haze, 42, 250);

  const sky = makeSky();
  scene.add(sky);
  scene.add(makeGround());

  scene.add(makeRidgeFlat({
    width: 700, height: 120, baseline: 42, z: -210, color: PALETTE.ridgeVeryFar,
    waves: [[1, 34], [2, 15], [5, 5]], seed: 100,
  }));
  scene.add(makeRidgeFlat({
    width: 560, height: 90, baseline: 26, z: -150, color: PALETTE.ridgeFar,
    waves: [[1, 22], [2, 11], [5, 4]], seed: 101,
  }));
  scene.add(makeRidgeFlat({
    width: 440, height: 60, baseline: 12, z: -95, color: PALETTE.ridgeMid,
    waves: [[2, 9], [4, 4.5], [9, 1.6]], seed: 102,
  }));

  scene.add(makeTrees());

  // Sun: a layered glow (tight core + wide halo) low over the far ridges.
  const glowTex = glowTexture();
  const mkGlow = (scale, opacity) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: PALETTE.glow, transparent: true, opacity,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    }));
    s.scale.setScalar(scale);
    return s;
  };
  // Positioned in clear sky above the ridge crests so no foreground tree
  // can occlude the glow from any pose on the camera path.
  const sunHalo = mkGlow(150, 0.32);
  const sunCore = mkGlow(56, 0.9);
  sunHalo.position.set(-58, 52, -200);
  sunCore.position.copy(sunHalo.position);
  scene.add(sunHalo, sunCore);

  // Character: a flat sprite living in the 3D world (yaw-only billboard so
  // it stays upright and 2D while the camera moves around it).
  const charTex = characterTexture();
  const CHAR_H = 2.0;
  const character = new THREE.Mesh(
    new THREE.PlaneGeometry(CHAR_H / 2, CHAR_H),
    new THREE.MeshBasicMaterial({
      map: charTex, transparent: true, alphaTest: 0.02, depthWrite: false, fog: true,
    }),
  );
  character.position.set(0, CHAR_H / 2, 0);
  scene.add(character);

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.7, 0.85),
    new THREE.MeshBasicMaterial({
      map: shadowTexture(), transparent: true, depthWrite: false, fog: false,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(0, 0.02, 0);
  scene.add(shadow);

  // Light motes drifting through the golden air.
  const MOTES = 110;
  const motePos = new Float32Array(MOTES * 3);
  const moteSeed = new Float32Array(MOTES);
  const rnd = mulberry32(9);
  for (let i = 0; i < MOTES; i++) {
    motePos[i * 3] = (rnd() - 0.5) * 120;
    motePos[i * 3 + 1] = 0.5 + rnd() * 13;
    motePos[i * 3 + 2] = 12 - rnd() * 80;
    moteSeed[i] = rnd() * Math.PI * 2;
  }
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
  const motes = new THREE.Points(moteGeo, new THREE.PointsMaterial({
    map: glowTexture(64), color: PALETTE.glow, size: 0.55, sizeAttenuation: true,
    transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending,
    depthWrite: false, fog: true,
  }));
  scene.add(motes);

  // A small flock: eased orbits around a slowly drifting anchor (no rough,
  // jittery birds — every position is smoothed).
  const birdTex = birdTexture();
  const birds = [];
  for (let i = 0; i < 5; i++) {
    const b = new THREE.Mesh(
      new THREE.PlaneGeometry(1.6, 0.93),
      new THREE.MeshBasicMaterial({
        map: birdTex, transparent: true, alphaTest: 0.02, depthWrite: false,
        fog: true, side: THREE.DoubleSide,
      }),
    );
    b.userData = {
      r: 3 + rnd() * 6,
      a: rnd() * Math.PI * 2,
      speed: 0.55 + rnd() * 0.5,
      flap: rnd() * Math.PI * 2,
      pos: new THREE.Vector3(-40 - i * 3, 10, -60),
    };
    b.position.copy(b.userData.pos);
    birds.push(b);
    scene.add(b);
  }
  const flockAnchor = new THREE.Vector3();

  // Camera: a slow, eased drift between two poses — the "gentle camera move"
  // that proves real depth. Ping-pongs forever; sin() gives built-in easing.
  const poseA = { pos: new THREE.Vector3(11, 4.8, 17), look: new THREE.Vector3(0, 2.4, -14) };
  const poseB = { pos: new THREE.Vector3(-7.5, 2.4, 11.5), look: new THREE.Vector3(1.5, 2.0, -10) };
  const camPos = new THREE.Vector3();
  const camLook = new THREE.Vector3();

  const yawTo = (obj) => {
    obj.rotation.y = Math.atan2(camera.position.x - obj.position.x, camera.position.z - obj.position.z);
  };

  function update(dt, tMs) {
    const t = tMs / 1000;

    // Camera drift.
    const k = easeInOut((Math.sin(t * (Math.PI * 2 / 26)) + 1) / 2);
    camPos.lerpVectors(poseA.pos, poseB.pos, k);
    camPos.y += Math.sin(t * 0.9) * 0.08; // breath
    camLook.lerpVectors(poseA.look, poseB.look, k);
    camera.position.copy(camPos);
    camera.lookAt(camLook);

    // Character: upright 2D sprite, always facing the camera (yaw only),
    // with a quiet idle breath.
    yawTo(character);
    const breathe = 1 + Math.sin(t * 1.7) * 0.012;
    character.scale.set(1, breathe, 1);

    // Motes drift.
    const mp = moteGeo.attributes.position;
    for (let i = 0; i < MOTES; i++) {
      let x = mp.getX(i) - dt * 0.0006 * (6 + Math.sin(moteSeed[i]) * 3);
      if (x < -62) x += 124;
      mp.setX(i, x);
      mp.setY(i, mp.getY(i) + Math.sin(t * 0.6 + moteSeed[i]) * dt * 0.0004);
    }
    mp.needsUpdate = true;

    // Flock: anchor wanders; birds ease around it and flap.
    flockAnchor.set(
      Math.sin(t * 0.11) * 30,
      10.5 + Math.sin(t * 0.23) * 2.4,
      -42 + Math.sin(t * 0.07) * 16,
    );
    for (const b of birds) {
      const u = b.userData;
      u.a += u.speed * dt * 0.001;
      const tx = flockAnchor.x + Math.cos(u.a) * u.r;
      const ty = flockAnchor.y + Math.sin(u.a * 0.9) * u.r * 0.22;
      const tz = flockAnchor.z + Math.sin(u.a) * u.r * 0.6;
      u.pos.x += (tx - u.pos.x) * Math.min(dt * 0.0025, 1);
      u.pos.y += (ty - u.pos.y) * Math.min(dt * 0.0025, 1);
      u.pos.z += (tz - u.pos.z) * Math.min(dt * 0.0025, 1);
      b.position.copy(u.pos);
      yawTo(b);
      u.flap += dt * 0.011;
      b.scale.y = 0.55 + Math.abs(Math.sin(u.flap)) * 0.55;
      b.scale.x = tx > u.pos.x ? -1 : 1; // face the way it flies
    }
  }

  return { update };
}
