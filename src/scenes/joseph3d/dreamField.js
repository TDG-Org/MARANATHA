import * as THREE from 'three';
import { mulberry32, mergeGeometries } from '../../engine/world.js';
import { Graphics } from '../../systems/Graphics.js';

// --- the DREAM: a moonlit farm field where the sky bows (Gen 37:7,9) ---------
// A proper wheat field under a cool night, heavy fog banks behind, a visible
// moonbeam, floating dream motes — you know instantly it's a dream. The 7
// sheaves still bow (dream 1); then sun + moon + 11 stars descend and bow
// (dream 2) in one authored cinematic.
export function buildDreamField() {
  const group = new THREE.Group();
  const FIELD = { x: 62, z: 0 };
  const rnd = mulberry32(808);

  // the ground is a REAL crop field (D6): tilled rows — dark furrows and
  // moon-caught ridge lines — generated as a canvas texture. Warm earth under
  // cool light; never a gray disc.
  const tilledTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const tctx = c.getContext('2d');
    tctx.fillStyle = '#4a3826'; tctx.fillRect(0, 0, 256, 256); // turned earth
    const rows = 14;
    for (let i = 0; i < rows; i++) {
      const y = (i / rows) * 256;
      tctx.fillStyle = '#5d4930'; tctx.fillRect(0, y, 256, 9);          // ridge
      tctx.fillStyle = '#6b563a'; tctx.fillRect(0, y + 2.5, 256, 3);    // moon-lit crest
      tctx.fillStyle = '#3a2b1c'; tctx.fillRect(0, y + 11, 256, 5);     // furrow shadow
    }
    // grain noise so the rows don't read as vector stripes
    for (let i = 0; i < 900; i++) {
      const x = rnd() * 256, y = rnd() * 256;
      tctx.fillStyle = rnd() > 0.5 ? 'rgba(120,98,66,0.18)' : 'rgba(30,22,14,0.2)';
      tctx.fillRect(x, y, 1.6, 1.2);
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(4, 4);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const disc = new THREE.Mesh(new THREE.CircleGeometry(16, 32), new THREE.MeshBasicMaterial({ color: 0x9a8a72, map: tilledTex, fog: true }));
  disc.rotation.x = -Math.PI / 2;
  disc.position.set(FIELD.x, 0.01, FIELD.z);
  group.add(disc);

  // THE WHEAT (D7 v2): PAINTED wheat cards, not bare geometry — a canvas
  // plant (curved stalks, drooping grain heads with visible kernels, fine
  // awns) on two crossed alpha-tested planes per clump, instanced. One draw
  // for the whole field, and it finally looks like wheat.
  const wheatCardTex = (() => {
    const c = document.createElement('canvas'); c.width = 128; c.height = 256;
    const g = c.getContext('2d');
    const stalk = (x0, lean, h, tone) => {
      // curved stalk
      g.strokeStyle = tone; g.lineWidth = 3; g.lineCap = 'round';
      g.beginPath();
      g.moveTo(x0, 256);
      g.quadraticCurveTo(x0 + lean * 0.4, 256 - h * 0.6, x0 + lean, 256 - h);
      g.stroke();
      // the drooping grain head: overlapping kernel strokes down both sides
      const hx = x0 + lean, hy = 256 - h;
      const droop = lean * 0.35;
      g.lineWidth = 5.5;
      for (let k = 0; k < 7; k++) {
        const t = k / 6;
        const kx = hx + droop * t, ky = hy + t * 34 - 30;
        g.strokeStyle = k % 2 ? '#e8c56f' : '#d4a94f';
        g.beginPath(); g.moveTo(kx - 5, ky); g.lineTo(kx + 1, ky - 8); g.stroke();
        g.beginPath(); g.moveTo(kx + 5, ky); g.lineTo(kx - 1, ky - 8); g.stroke();
      }
      // fine awns fanning up from the head
      g.lineWidth = 1;
      g.strokeStyle = 'rgba(238,208,130,0.75)';
      for (let a = -2; a <= 2; a++) {
        g.beginPath(); g.moveTo(hx, hy - 26);
        g.lineTo(hx + a * 7 + droop, hy - 62 - Math.abs(a) * -6);
        g.stroke();
      }
    };
    stalk(42, -10, 168, '#8a6b34');
    stalk(64, 4, 208, '#a3813f');
    stalk(86, 14, 178, '#8f7036');
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const wheatSpots = [];
  for (let row = -13; row <= 13; row += 1.6) {
    for (let col = -13; col <= 13; col += 1.1) {
      const jx = (rnd() - 0.5) * 0.7, jz = (rnd() - 0.5) * 0.8;
      const x = col + jx, z = row + jz;
      const r = Math.hypot(x, z);
      if (r > 14.5 || r < 6.4) continue; // inside the field, outside the clearing
      wheatSpots.push([x, z, 0.75 + rnd() * 0.55, rnd() * Math.PI * 2]);
    }
  }
  // crossed planes so the clump reads from every angle; merged = still 1 draw
  const cardA = new THREE.PlaneGeometry(1.0, 1.85);
  cardA.translate(0, 0.925, 0);
  const cardB = cardA.clone();
  cardB.rotateY(Math.PI / 2);
  const stalkGeo = mergeGeometries([cardA, cardB]);
  // ROOTED (D6): instances in FIELD-LOCAL coords, the mesh at the field center
  // (world-coord instances once swayed around a 62u-distant pivot = bouncing).
  // D8: the BACKGROUND wheat sits LOW in the ground and cool-dimmed — only the
  // seven interactive sheaves stand tall and golden, so what to touch is
  // instantly obvious.
  const wheat = new THREE.InstancedMesh(
    stalkGeo,
    new THREE.MeshBasicMaterial({ map: wheatCardTex, color: 0x8f96b4, alphaTest: 0.4, side: THREE.DoubleSide, fog: true }),
    wheatSpots.length,
  );
  const wd = new THREE.Object3D();
  wheatSpots.forEach((s, i) => {
    wd.position.set(s[0], -0.12, s[1]); // local to the field center, feet sunk
    wd.scale.set(s[2] * 0.62, s[2] * 0.42, s[2] * 0.62); // a LOW, hushed field
    wd.rotation.set(0, s[3], 0);
    wd.updateMatrix();
    wheat.setMatrixAt(i, wd.matrix);
  });
  wheat.instanceMatrix.needsUpdate = true;
  wheat.position.set(FIELD.x, 0, FIELD.z);
  group.add(wheat);

  // a sheaf (D7 v2) = a PAINTED tied bundle — thick straw column, cream tie
  // band, heads fanning wide — on crossed alpha-tested cards. One draw each
  // (they were 2), and they read as real harvest bundles.
  const sheafCardTex = (() => {
    const c = document.createElement('canvas'); c.width = 128; c.height = 192;
    const g = c.getContext('2d');
    g.lineCap = 'round';
    // the straw column: many leaning strokes gathered at the waist
    for (let i = 0; i < 13; i++) {
      const t = i / 12;
      const baseX = 30 + t * 68 + (Math.sin(i * 7.3) * 5);
      const topX = 64 + (baseX - 64) * 1.75;
      g.strokeStyle = i % 3 === 0 ? '#c9a552' : i % 3 === 1 ? '#b8923f' : '#daba6c';
      g.lineWidth = 4.2;
      g.beginPath();
      g.moveTo(baseX, 192);
      g.quadraticCurveTo(64 + (baseX - 64) * 0.25, 118, topX, 42);
      g.stroke();
      // a kernel head at each stalk tip
      g.fillStyle = i % 2 ? '#e8c56f' : '#d4a94f';
      g.beginPath(); g.ellipse(topX, 36, 4.4, 10, (topX - 64) * 0.01, 0, Math.PI * 2); g.fill();
    }
    // fine awns above the heads
    g.strokeStyle = 'rgba(238,208,130,0.7)'; g.lineWidth = 1;
    for (let i = 0; i < 9; i++) {
      const x = 20 + i * 11;
      g.beginPath(); g.moveTo(x + 6, 34); g.lineTo(x + (x - 64) * 0.28, 4); g.stroke();
    }
    // the cream tie band at the waist
    g.strokeStyle = '#e9dcbf'; g.lineWidth = 9;
    g.beginPath(); g.moveTo(38, 122); g.quadraticCurveTo(64, 130, 90, 122); g.stroke();
    g.strokeStyle = 'rgba(140,110,60,0.55)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(38, 127); g.quadraticCurveTo(64, 135, 90, 127); g.stroke();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const sheafGeoA = new THREE.PlaneGeometry(1.15, 1.75); sheafGeoA.translate(0, 0.875, 0);
  const sheafGeoB = sheafGeoA.clone(); sheafGeoB.rotateY(Math.PI / 2);
  const sheafCardGeo = mergeGeometries([sheafGeoA, sheafGeoB]);
  const mkSheaf = (x, z, scale = 1) => {
    const g = new THREE.Group();
    // D8: the interactive sheaves glow WARM and stand tall over the low cool
    // field — the one thing in the frame that says "walk to me".
    const card = new THREE.Mesh(sheafCardGeo, new THREE.MeshBasicMaterial({ map: sheafCardTex, color: 0xffedbe, alphaTest: 0.4, side: THREE.DoubleSide, fog: true }));
    g.add(card);
    g.position.set(x, 0, z);
    g.scale.setScalar(scale * 1.12);
    return g;
  };
  const center = mkSheaf(FIELD.x, FIELD.z, 1.25);
  group.add(center);
  const outer = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const s = mkSheaf(FIELD.x + Math.cos(a) * 5.0, FIELD.z + Math.sin(a) * 5.0);
    s.userData = { bowK: 0, bowed: false, toCenter: a + Math.PI };
    outer.push(s);
    group.add(s);
  }

  // D9 (Nate): a BORDER the player can read — tall dream-dark bushes and
  // boulders ring the crop field so nobody wanders off into the void. A gap
  // stays open to the north where the cairn path climbs to the mountain.
  let borderBush = null, borderRock = null;
  {
    const bushGeo = (() => {
      const a = new THREE.SphereGeometry(0.55, 7, 6); a.translate(0, 1.0, 0); a.scale(1, 1.5, 1);
      const b = new THREE.SphereGeometry(0.38, 6, 5); b.translate(0.3, 1.7, 0.1);
      return mergeGeometries([a, b]);
    })();
    const rockGeo2 = new THREE.DodecahedronGeometry(0.55, 0); rockGeo2.translate(0, 0.3, 0);
    const bushSpots = [], rockSpots = [];
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2 + rnd() * 0.1;
      let da = a - Math.PI; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
      if (Math.abs(da) < 0.42) continue; // the northern gap — the way up the mountain
      const r = 14.3 + rnd() * 1.1;
      const spot = [FIELD.x + Math.sin(a) * r, FIELD.z + Math.cos(a) * r, 0.85 + rnd() * 0.7, rnd() * 6];
      (i % 3 === 0 ? rockSpots : bushSpots).push(spot);
    }
    const mkRing = (geo, color, spots) => {
      const m = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color, fog: true }), spots.length);
      const o = new THREE.Object3D();
      spots.forEach((s, i) => { o.position.set(s[0], 0, s[1]); o.scale.setScalar(s[2]); o.rotation.y = s[3]; o.updateMatrix(); m.setMatrixAt(i, o.matrix); });
      m.instanceMatrix.needsUpdate = true;
      group.add(m);
      return m;
    };
    borderBush = mkRing(bushGeo, 0x2a3555, bushSpots);
    borderRock = mkRing(rockGeo2, 0x394260, rockSpots);
  }

  // fog banks — big soft planes standing behind the field (dream haze)
  const softTex = (rgb) => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, `rgba(${rgb},0.5)`); g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c); return t;
  };
  const fogTex = softTex('150,160,205');
  const fogBanks = [];
  for (let i = 0; i < 6; i++) {
    const a = -1.1 + i * 0.44;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(15, 8), new THREE.MeshBasicMaterial({ map: fogTex, color: 0x6b7196, transparent: true, opacity: 0.46, depthWrite: false, fog: false }));
    m.position.set(FIELD.x + Math.sin(a) * 15, 3.4, FIELD.z + Math.cos(a) * 15 - 3);
    m.userData = { phase: i * 1.3, baseX: m.position.x };
    fogBanks.push(m); group.add(m);
  }

  // DREAM V2 · distinct fog GLOOM — broad, dark, low sheets of mist hugging the
  // field so it reads instantly as a heavy dream haze, not clear night air.
  const mistTex = softTex('90,100,140');
  const groundMist = [];
  for (let i = 0; i < 2; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(42, 42), new THREE.MeshBasicMaterial({ map: mistTex, color: 0x232b47, transparent: true, opacity: 0.3, depthWrite: false, fog: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(FIELD.x, 0.55 + i * 0.5, FIELD.z);
    m.userData = { phase: i * 2.3 };
    groundMist.push(m); group.add(m);
  }

  // the MOONBEAM — a visible cool shaft of light down onto the field.
  // (beamTex is CAPTURED so dispose() can free it — an inline softTex here
  // would leak one GPU texture on every scene exit.)
  const beamTex = softTex('200,215,255');
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.5, 5.0, 16, 20, 1, true),
    new THREE.MeshBasicMaterial({ map: beamTex, color: 0xcfe0ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }),
  );
  beam.position.set(FIELD.x + 3, 8, FIELD.z - 3);
  beam.rotation.z = -0.12;
  group.add(beam);
  // a soft MOON disc at the head of the shaft — the source of the moonlight
  const moonDiscTex = softTex('215,228,255');
  const moonDisc = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonDiscTex, color: 0xdfe9ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  moonDisc.scale.setScalar(5.5);
  moonDisc.position.set(FIELD.x + 3.4, 15.5, FIELD.z - 4);
  group.add(moonDisc);

  // floating dream motes (cool, drift upward)
  const moteCount = 60;
  const mp = new Float32Array(moteCount * 3);
  const mseed = new Float32Array(moteCount);
  for (let i = 0; i < moteCount; i++) {
    mp[i * 3] = FIELD.x + (rnd() - 0.5) * 26;
    mp[i * 3 + 1] = rnd() * 9;
    mp[i * 3 + 2] = FIELD.z + (rnd() - 0.5) * 26;
    mseed[i] = rnd() * Math.PI * 2;
  }
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute('position', new THREE.BufferAttribute(mp, 3));
  const motes = new THREE.Points(moteGeo, new THREE.PointsMaterial({ map: fogTex, color: 0xdfe7ff, size: 0.5, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, fog: false }));
  group.add(motes);

  // D6: dream FIREFLIES — low warm-green sparks weaving through the wheat,
  // blinking softly (the motes drift high and cool; these live at stalk height)
  const FIREFLY_N = Math.max(14, Math.round(44 * Graphics.particleScale));
  const fireflyGeo = new THREE.BufferGeometry();
  {
    const pts = new Float32Array(FIREFLY_N * 3);
    for (let i = 0; i < FIREFLY_N; i++) {
      pts[i * 3] = FIELD.x + (rnd() - 0.5) * 24;
      pts[i * 3 + 1] = 0.3 + rnd() * 1.8;
      pts[i * 3 + 2] = FIELD.z + (rnd() - 0.5) * 24;
    }
    fireflyGeo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
  }
  const fireflySeed = new Float32Array(FIREFLY_N);
  for (let i = 0; i < FIREFLY_N; i++) fireflySeed[i] = rnd() * Math.PI * 2;
  const fireflyPts = new THREE.Points(fireflyGeo, new THREE.PointsMaterial({ map: fogTex, color: 0xd8f0b8, size: 0.32, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, fog: false }));
  group.add(fireflyPts);

  // --- the celestial bodies: sun, moon, 11 stars (layered glow) ---
  const glowTex = softTex('255,255,255');
  const mkBody = (size, color, coreBoost = 1, layered = true) => {
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    halo.scale.setScalar(size);
    const b = new THREE.Group();
    b.add(halo);
    let core = null;
    if (layered) { // sun + moon get a bright inner core; stars stay single-sprite (perf)
      core = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      core.scale.setScalar(size * 0.42 * coreBoost);
      b.add(core);
    }
    b.userData = { halo, core, twinkle: rnd() * Math.PI * 2 };
    return b;
  };
  const sun = mkBody(4.6, 0xffe6a8);
  const moon = mkBody(3.4, 0xd2e0ff);
  const stars = [];
  for (let i = 0; i < 11; i++) stars.push(mkBody(1.15, 0xfff6df, 1, false));
  const bodies = [sun, moon, ...stars];
  bodies.forEach((b) => group.add(b));

  // three key positions per body: HIGH (start), MID (descended), LOW (bowed).
  const setPath = (b, hx, hy, hz, mx, my, mz, lx, ly, lz) => {
    b.userData.high = new THREE.Vector3(FIELD.x + hx, hy, FIELD.z + hz);
    b.userData.mid = new THREE.Vector3(FIELD.x + mx, my, FIELD.z + mz);
    b.userData.low = new THREE.Vector3(FIELD.x + lx, ly, FIELD.z + lz);
    b.position.copy(b.userData.high);
  };
  // D9 (Nate): the bow ends with the bodies STILL HIGH in the sky and in the
  // distance — they lower themselves toward him, they never come down to the
  // earth. (Old lows sat at ~y 4–5 right beside the summit — too low, too close.)
  setPath(sun, -7, 22, -19, -5.5, 14, -13, -3.2, 8.8, -10);
  setPath(moon, 7, 23, -19, 5.5, 14.6, -13, 3.2, 9.2, -10);
  stars.forEach((s, i) => {
    const a = (i / 10) * Math.PI;
    setPath(s,
      Math.cos(a) * 11, 15 + Math.sin(a) * 4, -17,
      Math.cos(a) * 8, 11 + Math.sin(a) * 2.5, -11,
      Math.cos(a) * 5.5, 7.6 + Math.sin(a) * 1.8, -9);
  });

  // --- DREAM V2: the MOUNTAIN to climb + the SUMMIT where the sky bows --------
  const darkRock = (col) => new THREE.MeshBasicMaterial({ color: col, fog: true });
  // the looming massif to the NORTH — the dreamer climbs toward it (Gen 37:9)
  const mountainGroup = new THREE.Group();
  {
    const parts = [];
    const peak = (x, z, r, h) => { const c = new THREE.ConeGeometry(r, h, 6); c.translate(FIELD.x + x, h / 2, FIELD.z + z); parts.push(c); };
    peak(0, -24, 12, 21); peak(-8, -22, 7, 13); peak(9, -23, 8, 15);
    mountainGroup.add(new THREE.Mesh(mergeGeometries(parts), darkRock(0x171d33)));
  }
  group.add(mountainGroup);

  // a path of faintly glowing cairns leading from the clearing up to the base
  const cairnGeo = new THREE.DodecahedronGeometry(0.28, 0);
  const cairns = new THREE.InstancedMesh(cairnGeo, new THREE.MeshBasicMaterial({ color: 0x7f8cc4, fog: true }), 6);
  {
    const o = new THREE.Object3D();
    for (let i = 0; i < 6; i++) {
      o.position.set(FIELD.x + (i % 2 ? 0.6 : -0.6), 0.2, FIELD.z - 6 - i * 1.15);
      o.scale.setScalar(0.7 + (i % 2) * 0.3);
      o.updateMatrix(); cairns.setMatrixAt(i, o.matrix);
    }
    cairns.instanceMatrix.needsUpdate = true;
  }
  group.add(cairns);

  // the SUMMIT set — hidden until the climb ends. The dreamer is lifted onto the
  // peak (root.y = SUMMIT_Y, set by the beat); a sea of cloud rolls below and
  // lower peaks stand beyond → a real summit silhouette against the sky.
  const SUMMIT_Y = 3.6;
  const cloudTex = softTex('185,196,230');
  const summitGroup = new THREE.Group();
  summitGroup.visible = false;
  {
    // D9 (Nate): the peak is FLAT on top — a truncated cone whose top surface
    // sits just under the dreamer's feet, so his FULL body stands clear of the
    // rock (the old sharp cone poked up through the shot and swallowed him).
    const rockH = SUMMIT_Y + 1.55;
    const rock = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 3.6, rockH, 7), darkRock(0x121830));
    rock.position.set(FIELD.x, (SUMMIT_Y - 0.02) - rockH / 2, FIELD.z + 0.2);
    summitGroup.add(rock);
    // lower peaks beyond, in silhouette
    [[-11, -7, 5, 8], [12, -9, 6, 10], [-16, -13, 7, 6], [17, -14, 5, 7]].forEach(([x, z, r, h]) => {
      const p = new THREE.Mesh(new THREE.ConeGeometry(r, h, 6), darkRock(0x0f1428));
      p.position.set(FIELD.x + x, h / 2 - 1.2, FIELD.z + z);
      summitGroup.add(p);
    });
    // the cloud sea just below the summit
    const clouds = [];
    for (let i = 0; i < 4; i++) {
      const a = i * 1.7;
      const c = new THREE.Mesh(new THREE.PlaneGeometry(34, 34), new THREE.MeshBasicMaterial({ map: cloudTex, color: 0x39456e, transparent: true, opacity: 0.5, depthWrite: false, fog: false }));
      c.rotation.x = -Math.PI / 2;
      c.position.set(FIELD.x + Math.cos(a) * 6, 1.3 + (i % 2) * 0.5, FIELD.z + Math.sin(a) * 6 - 1);
      c.userData = { phase: a, baseX: c.position.x };
      clouds.push(c); summitGroup.add(c);
    }
    summitGroup.userData.clouds = clouds;
    // D7: a soft glow-wash hanging in the sky NORTH of the dreamer — from the
    // up-tilted finale camera it sits behind his head and shoulders, rimming
    // the silhouette against the night.
    const rim = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, color: 0x8f9cd8, transparent: true, opacity: 0.34, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    rim.scale.set(10, 7, 1);
    rim.position.set(FIELD.x, SUMMIT_Y + 2.4, FIELD.z - 7);
    summitGroup.add(rim);
  }
  group.add(summitGroup);

  // field elements that HIDE when we cut to the summit (they were dream 1)
  const fieldEls = [disc, wheat, center, ...outer, ...fogBanks, ...groundMist, beam, moonDisc, mountainGroup, cairns, fireflyPts, motes, borderBush, borderRock];
  const setSummit = (on) => { summitGroup.visible = on; fieldEls.forEach((e) => { e.visible = !on; }); };

  let skyState = 0; // 0 idle · 1 descending (→mid) · 2 bowing (→low)
  const setOpacity = (k) => bodies.forEach((b) => {
    b.userData.halo.material.opacity = k * (b === sun ? 0.9 : b === moon ? 0.8 : 0.95);
    if (b.userData.core) b.userData.core.material.opacity = k * 0.9;
  });

  return {
    group, FIELD, center, outer, sun, moon, stars, beam, SUMMIT_Y,
    showSummit: setSummit,
    // the moon shaft over the wheat field (dream 1)
    showMoon(k) { beam.material.opacity = k * 0.22; moonDisc.material.opacity = k * 0.9; },
    showSky(k) { setOpacity(k); },
    descendSky() { skyState = 1; },
    bowSky() { skyState = 2; },
    resetSky() {
      skyState = 0;
      setOpacity(0);
      beam.material.opacity = 0; moonDisc.material.opacity = 0;
      setSummit(false);
      bodies.forEach((b) => b.position.copy(b.userData.high));
    },
    update(dt, t) {
      if (!this.group.visible) return;
      // at the summit: drift the cloud sea + a touch of body motion only
      if (summitGroup.visible) {
        summitGroup.userData.clouds.forEach((c) => {
          c.position.x = c.userData.baseX + Math.sin(t * 0.12 + c.userData.phase) * 1.6;
          c.material.opacity = 0.42 + Math.sin(t * 0.3 + c.userData.phase) * 0.1;
        });
        bodies.forEach((b) => {
          // D7: SLOW, ceremonial descent — and the bodies swell gently as they
          // near the summit (presence), on top of the twinkle.
          const u = b.userData;
          const span = Math.max(0.001, u.high.y - u.low.y);
          const nearness = Math.min(1, Math.max(0, (u.high.y - b.position.y) / span));
          const tw = (1 + Math.sin(t * 2 + u.twinkle) * 0.08) * (1 + nearness * 0.4);
          if (u.core) u.core.material.rotation = t * 0.3 + u.twinkle;
          b.scale.setScalar(tw);
          if (skyState === 1) b.position.lerp(u.mid, Math.min(dt * 0.00026, 1));
          else if (skyState === 2) b.position.lerp(u.low, Math.min(dt * 0.00048, 1));
        });
        return;
      }
      // field-wide wheat sway — CALM: a whisper of lean around the field's own
      // center (rooted; ≤9cm at the rim — never the old 1u bounce)
      wheat.rotation.z = Math.sin(t * 0.55) * 0.006;
      wheat.rotation.x = Math.cos(t * 0.4) * 0.004;
      // low ground mist breathes
      groundMist.forEach((m) => { m.material.opacity = 0.24 + Math.sin(t * 0.25 + m.userData.phase) * 0.08; });
      // dream fireflies: slow drift + soft per-point blink
      const fp = fireflyGeo.attributes.position;
      for (let i = 0; i < FIREFLY_N; i++) {
        fp.setY(i, fp.getY(i) + Math.sin(t * 0.6 + fireflySeed[i]) * dt * 0.00018);
        fp.setX(i, fp.getX(i) + Math.cos(t * 0.35 + fireflySeed[i] * 2) * dt * 0.00012);
      }
      fp.needsUpdate = true;
      fireflyPts.material.opacity = 0.55 + Math.sin(t * 1.6) * 0.25;
      // fog banks drift + breathe
      fogBanks.forEach((m) => {
        m.position.x = m.userData.baseX + Math.sin(t * 0.15 + m.userData.phase) * 1.2;
        m.material.opacity = 0.32 + Math.sin(t * 0.4 + m.userData.phase) * 0.1;
      });
      // dream motes drift upward, wrap
      const pos = moteGeo.attributes.position;
      for (let i = 0; i < moteCount; i++) {
        let y = pos.getY(i) + dt * 0.0004 * (1 + Math.sin(mseed[i]));
        if (y > 10) y -= 10;
        pos.setY(i, y);
        pos.setX(i, pos.getX(i) + Math.sin(t * 0.3 + mseed[i]) * dt * 0.00015);
      }
      pos.needsUpdate = true;
      // outer sheaves ease into their bow
      for (const s of outer) {
        const target = s.userData.bowed ? 1 : 0;
        s.userData.bowK += (target - s.userData.bowK) * Math.min(dt * 0.004, 1);
        const k = s.userData.bowK;
        s.rotation.x = Math.sin(s.userData.toCenter) * k * 0.85;
        s.rotation.z = -Math.cos(s.userData.toCenter) * k * 0.85;
      }
      const rise = outer.filter((s) => s.userData.bowed).length / outer.length;
      center.scale.setScalar(1.25 + rise * 0.35);
      // celestial bodies: twinkle + descend/bow toward their target
      bodies.forEach((b) => {
        const tw = 1 + Math.sin(t * 2 + b.userData.twinkle) * 0.08;
        if (b.userData.core) b.userData.core.material.rotation = t * 0.3 + b.userData.twinkle;
        b.scale.setScalar(tw);
        if (skyState === 1) b.position.lerp(b.userData.mid, Math.min(dt * 0.0006, 1));
        else if (skyState === 2) b.position.lerp(b.userData.low, Math.min(dt * 0.0012, 1));
      });
    },
    dispose() {
      glowTex.dispose(); fogTex.dispose(); beamTex.dispose();
      mistTex.dispose(); moonDiscTex.dispose(); cloudTex.dispose();
      tilledTex.dispose(); wheatCardTex.dispose(); sheafCardTex.dispose();
      group.traverse((o) => {
        if (o.isInstancedMesh) o.dispose(); // frees the wheat instance buffers
        if (o.isMesh || o.isSprite || o.isPoints) { o.geometry?.dispose?.(); o.material?.dispose?.(); }
      });
      group.parent?.remove(group);
    },
  };
}
