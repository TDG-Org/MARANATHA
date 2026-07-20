import * as THREE from 'three';
import { makeSky, makeRidges, makeGround, makeSun, makeMotes, easeInOut, canvasTexture } from '../engine/world.js';
import { STORIES } from '../data/stories.js';
import { statusOf } from '../systems/SaveSystem.js';
import { Audio } from '../systems/AudioSystem.js';
import { openSettings } from '../ui/settings.js';

// HOME — the calm HD-2D landing + story map. A golden-hour backdrop with a
// gentle camera drift, over which a DOM overlay shows the title, the story
// path, a preview of the selected story, and Start / Settings.
//
// Phase C note: entry is gated by "is this story's scene built" (registered in
// the app) rather than by progression lock — so Joseph is playable now, before
// the Creation prologue (Phase B) exists.
export function buildHome({ scene, camera, app }) {
  scene.fog = new THREE.Fog(0xffdfba, 46, 250);

  const sky = makeSky({ top: 0xf2b880, bottom: 0xffe9c9 });
  scene.add(sky.mesh);
  // D6: the home ground is REAL sunlit grass, never an untextured sheet
  // (world-density hard rule) — same texture + mottle language as the camp.
  const grassTex = new THREE.TextureLoader().load('textures/grass.jpg');
  grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping;
  grassTex.repeat.set(16, 7); // wider tiles — home views the field at a shallow angle
  grassTex.colorSpace = THREE.SRGBColorSpace;
  grassTex.anisotropy = 4;
  // vertex colors recentred on WHITE: the grass photo already carries the
  // green; a green vertex tint would multiply it into mud (the black-ground
  // bug). White base + near-white mottle = variety without the crush.
  scene.add(makeGround({ color: 0xffffff, mottle: [0xeaf7c0, 0xd8b98a], map: grassTex }));
  // home is always golden hour — a generous warm sun + hemi so the Lambert
  // grass reads sunlit (it rendered near-black unlit before — the gray bug)
  scene.add(new THREE.HemisphereLight(0xffe4b6, 0x6a7a44, 1.2));
  const homeSun = new THREE.DirectionalLight(0xffe1ad, 1.5);
  homeSun.position.set(-9, 13, 6);
  scene.add(homeSun);
  scene.add(makeRidges());
  scene.add(makeSun());
  const motes = makeMotes({ count: 90 });
  scene.add(motes.points);

  // BIRDS over the vista (D7): a small flock crossing the golden sky — eased
  // orbits around a slowly drifting anchor, wings flapping. Same painted bird
  // as the foundation scene.
  const birdTex = canvasTexture(96, 56, (bctx) => {
    const ink = '#241f38';
    bctx.fillStyle = ink; bctx.strokeStyle = ink; bctx.lineJoin = 'round'; bctx.lineCap = 'round';
    bctx.beginPath(); bctx.ellipse(48, 34, 13, 6, -0.12, 0, Math.PI * 2); bctx.fill();
    bctx.beginPath(); bctx.arc(60, 30, 4.6, 0, Math.PI * 2); bctx.fill();
    bctx.beginPath(); bctx.moveTo(64, 30); bctx.lineTo(70, 31.5); bctx.lineTo(64, 33); bctx.closePath(); bctx.fill();
    bctx.beginPath(); bctx.moveTo(36, 33); bctx.lineTo(26, 30); bctx.lineTo(27, 38); bctx.closePath(); bctx.fill();
    bctx.lineWidth = 5;
    bctx.beginPath(); bctx.moveTo(46, 32); bctx.quadraticCurveTo(34, 14, 20, 10); bctx.stroke();
    bctx.beginPath(); bctx.moveTo(52, 32); bctx.quadraticCurveTo(62, 16, 76, 12); bctx.stroke();
  });
  const birds = [];
  for (let i = 0; i < 5; i++) {
    const b = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 0.88),
      new THREE.MeshBasicMaterial({ map: birdTex, transparent: true, alphaTest: 0.02, depthWrite: false, fog: true, side: THREE.DoubleSide }),
    );
    b.userData = { phase: i * 1.35, r: 3.2 + i * 1.1, h: i * 0.6 };
    birds.push(b); scene.add(b);
  }
  const flockAnchor = new THREE.Vector3();

  // D8 · a LIVING vista: painted clouds drifting slowly across the golden sky
  // at two depths, and a few faint first-stars twinkling near the zenith —
  // the storefront breathes, it doesn't sit still.
  const cloudTex = canvasTexture(160, 96, (cctx) => {
    const puff = (x, y, r, a) => {
      const g = cctx.createRadialGradient(x, y, r * 0.2, x, y, r);
      g.addColorStop(0, `rgba(255,244,224,${a})`);
      g.addColorStop(1, 'rgba(255,244,224,0)');
      cctx.fillStyle = g;
      cctx.beginPath(); cctx.arc(x, y, r, 0, Math.PI * 2); cctx.fill();
    };
    puff(50, 58, 34, 0.75); puff(84, 50, 40, 0.8); puff(116, 60, 30, 0.7); puff(72, 66, 44, 0.55);
  });
  const clouds = [];
  for (let i = 0; i < 5; i++) {
    const far = i % 2 === 0;
    const c = new THREE.Mesh(
      new THREE.PlaneGeometry(far ? 26 : 16, far ? 12 : 8),
      new THREE.MeshBasicMaterial({ map: cloudTex, transparent: true, opacity: far ? 0.5 : 0.68, depthWrite: false, fog: false }),
    );
    c.position.set(-70 + i * 34, 16 + (i % 3) * 5, far ? -150 : -110);
    c.userData = { speed: far ? 0.35 : 0.6, span: 95 };
    clouds.push(c); scene.add(c);
  }
  const starTex = canvasTexture(32, 32, (sctx) => {
    const g = sctx.createRadialGradient(16, 16, 1, 16, 16, 14);
    g.addColorStop(0, 'rgba(255,250,235,0.95)'); g.addColorStop(1, 'rgba(255,250,235,0)');
    sctx.fillStyle = g; sctx.fillRect(0, 0, 32, 32);
  });
  const starGeo = new THREE.BufferGeometry();
  const starN = 12;
  {
    const pts = new Float32Array(starN * 3);
    for (let i = 0; i < starN; i++) {
      pts[i * 3] = -90 + Math.random() * 180;
      pts[i * 3 + 1] = 34 + Math.random() * 22;
      pts[i * 3 + 2] = -170;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
  }
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ map: starTex, color: 0xfff4da, size: 1.6, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, fog: false }));
  scene.add(stars);

  // Gentle idle drift between two nearby poses (keeps the sun framed upper-left).
  const poseA = { pos: new THREE.Vector3(3.5, 5.2, 19), look: new THREE.Vector3(-1, 3.4, -26) };
  const poseB = { pos: new THREE.Vector3(-4.5, 4.4, 17.5), look: new THREE.Vector3(1.5, 3.0, -24) };
  const camPos = new THREE.Vector3();
  const camLook = new THREE.Vector3();

  // Warm ambience + REAL soft looping music once audio is unlocked (D6 —
  // the camp theme at low gain; falls back to the procedural pad if missing).
  let homeMusic = null;
  let disposed = false;
  const startBeds = () => {
    if (disposed) return; // fired after leaving home — must not start anything
    Audio.ambience({ wind: 0.22, birds: 0.18 });
    homeMusic = Audio.playLoop('music.camp_warm', { gain: 0.45 });
  };
  if (Audio.on) startBeds();
  else window.addEventListener('pointerdown', startBeds, { once: true });

  // ---- DOM overlay ---------------------------------------------------------
  const root = document.createElement('div');
  root.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:20', 'pointer-events:none',
    'color:#fdf6e3', 'font-family:"Segoe UI",system-ui,sans-serif',
    'display:flex', 'flex-direction:column', 'align-items:center',
    'opacity:0', 'transition:opacity 600ms ease',
  ].join(';');

  const title = document.createElement('div');
  title.textContent = 'MARANATHA';
  title.style.cssText = [
    'margin-top:7vh', 'font-family:Georgia,"Times New Roman",serif',
    'font-size:clamp(30px,6vw,52px)', 'letter-spacing:0.42em', 'text-indent:0.42em',
    'text-shadow:0 2px 12px rgba(15,12,26,0.5)',
  ].join(';');

  const subtitle = document.createElement('div');
  subtitle.textContent = 'A Bible game — walk through the Bible'; // D8 tagline (Nate)
  subtitle.style.cssText = [
    'margin-top:10px', 'font-size:clamp(12px,1.8vw,15px)', 'letter-spacing:0.16em',
    'opacity:0.72', 'text-shadow:0 1px 6px rgba(15,12,26,0.6)',
  ].join(';');

  const spacer = document.createElement('div');
  spacer.style.flex = '1';

  // Preview card for the selected story.
  const card = document.createElement('div');
  card.style.cssText = [
    'pointer-events:auto', 'width:min(90vw,440px)', 'margin:0 20px 3.5vh', 'box-sizing:border-box',
    'padding:18px 22px', 'text-align:center',
    'background:rgba(16,14,26,0.42)', 'border:1px solid rgba(242,184,128,0.16)',
    'border-radius:16px', 'backdrop-filter:blur(4px)',
    'box-shadow:0 10px 34px rgba(0,0,0,0.3)', 'transition:opacity 300ms ease',
  ].join(';');

  const cardTitle = document.createElement('div');
  cardTitle.style.cssText = 'font-family:Georgia,serif; font-size:26px; margin-bottom:2px;';
  const cardPassage = document.createElement('div');
  cardPassage.style.cssText = 'font-size:12.5px; letter-spacing:0.12em; opacity:0.62; margin-bottom:12px;';
  const cardBlurb = document.createElement('div');
  cardBlurb.style.cssText = 'font-size:14px; line-height:1.55; opacity:0.9; margin-bottom:18px; font-style:italic;';

  const startBtn = document.createElement('button');
  startBtn.type = 'button';
  startBtn.style.cssText = [
    'font-family:"Segoe UI",system-ui,sans-serif', 'font-size:16px', 'font-weight:600',
    'padding:12px 26px', 'border-radius:11px', 'cursor:pointer', 'border:none',
    'background:#f2b880', 'color:#241f38', 'transition:filter 150ms ease, transform 150ms ease',
  ].join(';');
  startBtn.onmouseenter = () => { startBtn.style.filter = 'brightness(1.07)'; startBtn.style.transform = 'translateY(-1px)'; };
  startBtn.onmouseleave = () => { startBtn.style.filter = 'none'; startBtn.style.transform = 'none'; };

  card.append(cardTitle, cardPassage, cardBlurb, startBtn);

  // THE STORY MAP (D6 v2): a real map, not a button row. Joseph — the playable
  // story — sits big at the CENTER with a pulsing gold ring; the future
  // stories float around him as smaller LOCKED nodes (🔒 + name), joined by a
  // slowly-shimmering dotted path. Everything drifts gently — the storefront
  // breathes. Pure DOM/CSS + one SVG; no per-frame JS.
  // D12 power: the old pulse/glow keyframes animated BOX-SHADOW — a repaint of
  // every node, every frame, forever, on the screen people park on. The pulse
  // is now a ring pseudo-element animating transform+opacity only (composited,
  // no rasterization), over a STATIC glow shadow.
  const mapStyle = document.createElement('style');
  mapStyle.textContent = `
    @keyframes mr-node-float { 0%,100% { transform: translate(-50%,-50%) translateY(0); } 50% { transform: translate(-50%,-50%) translateY(-5px); } }
    @keyframes mr-ring-pulse { 0% { transform: scale(0.92); opacity: 0.6; } 70% { transform: scale(1.32); opacity: 0; } 100% { transform: scale(1.32); opacity: 0; } }
    @keyframes mr-seal-breathe { 0%,100% { opacity: 0.3; } 50% { opacity: 0.75; } }
    @keyframes mr-path-shimmer { to { stroke-dashoffset: -64; } }
  `;
  document.head.append(mapStyle);

  const map = document.createElement('div');
  map.style.cssText = [
    'pointer-events:auto', 'position:relative',
    'width:min(92vw,640px)', 'height:clamp(200px, 31vh, 300px)', 'margin:8px 0 2px',
  ].join(';');

  // D7 — an ACTUAL story timeline: the chapters read left→right in Bible
  // order along an S-curving road; Joseph (the playable chapter, IV) stands
  // biggest at the road's living end, and the road fades on beyond him toward
  // the chapters still unwritten.
  const NODE_POS = { creation: [11, 30], fall: [33, 72], noah: [56, 28], joseph: [80, 58] };
  const PATH_ORDER = ['creation', 'fall', 'noah', 'joseph'];
  const ORDINAL = { creation: 'I', fall: 'II', noah: 'III', joseph: 'IV' };

  // the ROAD (SVG): a soft wide under-glow + the crisp animated dotted line on
  // top + a faded continuation past Joseph — layered, it reads as a real path.
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.style.cssText = 'position:absolute; inset:0; width:100%; height:100%; pointer-events:none;';
  {
    let d = '';
    PATH_ORDER.forEach((id, i) => {
      const [x, y] = NODE_POS[id];
      if (i === 0) { d += `M ${x} ${y}`; return; }
      const [px, py] = NODE_POS[PATH_ORDER[i - 1]];
      d += ` Q ${(px + x) / 2} ${py + (y - py) * 0.15}, ${x} ${y}`;
    });
    const mk = (dd, stroke, width, opacity, dash, anim) => {
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', dd);
      p.setAttribute('fill', 'none');
      p.setAttribute('stroke', stroke);
      p.setAttribute('stroke-width', String(width));
      p.setAttribute('stroke-opacity', String(opacity));
      if (dash) p.setAttribute('stroke-dasharray', dash);
      p.setAttribute('stroke-linecap', 'round');
      if (anim) p.style.animation = anim;
      svg.append(p);
      return p;
    };
    mk(d, '#f2b880', 3.4, 0.16);                                    // the warm road bed
    mk(d, '#ffe9c9', 0.85, 0.85, '0.01 2.6', 'mr-path-shimmer 8s linear infinite'); // the walked dots
    // …and the road that hasn't been walked yet, fading past Joseph
    const [jx, jy] = NODE_POS.joseph;
    mk(`M ${jx} ${jy} Q ${jx + 10} ${jy - 8}, ${jx + 17} ${jy - 16}`, '#f2b880', 1.6, 0.1);
    mk(`M ${jx} ${jy} Q ${jx + 10} ${jy - 8}, ${jx + 17} ${jy - 16}`, '#ffe9c9', 0.7, 0.3, '0.01 3.4', 'mr-path-shimmer 11s linear infinite');
  }
  map.append(svg);

  let selectedId = null;

  function selectStory(id) {
    selectedId = id;
    const story = STORIES.find((s) => s.id === id);
    const built = !!(story.sceneKey && app.hasScreen(story.sceneKey));
    cardTitle.textContent = story.title;
    cardPassage.textContent = story.passage;
    cardBlurb.textContent = story.blurb;
    if (built) {
      startBtn.textContent = '▶ Start Story';
      startBtn.disabled = false;
      startBtn.style.opacity = '1';
      startBtn.style.cursor = 'pointer';
      startBtn.style.background = '#f2b880';
    } else {
      startBtn.textContent = '🔒 Coming soon';
      startBtn.disabled = true;
      startBtn.style.opacity = '0.5';
      startBtn.style.cursor = 'default';
      startBtn.style.background = 'rgba(255,255,255,0.12)';
    }
    // Re-ring the selected node.
    [...map.querySelectorAll('button')].forEach((n) => {
      const sel = n.dataset.id === id;
      n.style.borderColor = sel ? 'rgba(242,184,128,0.9)' : (n.dataset.locked === '1' ? 'rgba(255,255,255,0.18)' : 'rgba(242,184,128,0.55)');
    });
  }

  function renderNodes() {
    [...map.querySelectorAll('button, .mr-node-label')].forEach((n) => n.remove());
    for (const story of STORIES) {
      const built = !!(story.sceneKey && app.hasScreen(story.sceneKey));
      const status = statusOf(story.id);
      const [x, y] = NODE_POS[story.id] ?? [50, 50];
      const big = built; // the playable chapter is the hero of the timeline
      const node = document.createElement('button');
      node.type = 'button';
      node.dataset.id = story.id;
      node.dataset.locked = built ? '0' : '1';
      node.setAttribute('aria-label', `Chapter ${ORDINAL[story.id] ?? ''} — ${story.title}${built ? '' : ' (locked)'}`);
      node.style.cssText = [
        `position:absolute`, `left:${x}%`, `top:${y}%`, 'transform:translate(-50%,-50%)',
        `width:${big ? 88 : 56}px`, `height:${big ? 88 : 56}px`, 'border-radius:50%',
        'cursor:pointer', 'pointer-events:auto',
        `font-size:${big ? 31 : 19}px`, 'display:flex', 'align-items:center', 'justify-content:center',
        `color:${big ? '#241f38' : 'rgba(253,246,227,0.75)'}`,
        `background:${big ? 'radial-gradient(circle at 34% 30%, #ffe9c9, #f2b880 62%, #d99a5e)' : 'radial-gradient(circle at 36% 32%, rgba(40,36,58,0.72), rgba(14,12,24,0.68))'}`,
        `border:2px solid ${big ? 'rgba(242,184,128,0.55)' : 'rgba(255,255,255,0.18)'}`,
        // static glow (the pulse ring animates separately, composited-only)
        `box-shadow:${big ? '0 0 30px 7px rgba(255,196,120,0.45), 0 6px 24px rgba(0,0,0,0.4)' : 'inset 0 0 14px rgba(0,0,0,0.45), 0 4px 14px rgba(0,0,0,0.3), 0 0 14px 3px rgba(242,184,128,0.16)'}`,
        'backdrop-filter:blur(3px)',
        `animation: mr-node-float ${5 + (x % 3)}s ease-in-out ${y % 4}s infinite`,
        'transition:border-color 200ms ease, filter 160ms ease',
      ].join(';');
      node.textContent = built ? (status === 'done' ? '✔' : '▶') : '🔒';
      const ring = document.createElement('span');
      ring.style.cssText = big
        ? 'position:absolute; inset:-5px; border-radius:50%; border:2px solid rgba(242,184,128,0.65); pointer-events:none; will-change:transform,opacity; animation: mr-ring-pulse 2.6s ease-out infinite;'
        : `position:absolute; inset:-3px; border-radius:50%; border:1px solid rgba(242,184,128,0.4); pointer-events:none; will-change:opacity; animation: mr-seal-breathe ${3.4 + (x % 2)}s ease-in-out infinite;`;
      node.append(ring);
      node.onmouseenter = () => { node.style.filter = 'brightness(1.12)'; };
      node.onmouseleave = () => { node.style.filter = 'none'; };
      node.onclick = () => { Audio.uiClick(); selectStory(story.id); };
      // CHAPTER numeral riding the top of each stop — the timeline reads in order
      const ord = document.createElement('div');
      ord.className = 'mr-node-label';
      ord.textContent = `Chapter ${ORDINAL[story.id] ?? ''}`;
      ord.style.cssText = [
        'position:absolute', `left:${x}%`, `top:calc(${y}% - ${big ? 62 : 44}px)`, 'transform:translateX(-50%)',
        `font:600 ${big ? 11.5 : 10}px Georgia,serif`, 'letter-spacing:0.22em', 'text-transform:uppercase',
        `color:${big ? 'rgba(255,233,201,0.9)' : 'rgba(253,246,227,0.45)'}`, 'white-space:nowrap',
        'text-shadow:0 1px 5px rgba(15,12,26,0.8)', 'pointer-events:none',
      ].join(';');
      // the name beneath — and under JOSEPH, the living PLAY pill
      const label = document.createElement('div');
      label.className = 'mr-node-label';
      label.textContent = story.title;
      label.style.cssText = [
        'position:absolute', `left:${x}%`, `top:calc(${y}% + ${big ? 54 : 37}px)`, 'transform:translateX(-50%)',
        `font:600 ${big ? 15.5 : 12.5}px "Segoe UI",system-ui,sans-serif`,
        `color:${big ? '#ffe9c9' : 'rgba(253,246,227,0.7)'}`, 'letter-spacing:0.06em', 'white-space:nowrap',
        'text-shadow:0 1px 6px rgba(15,12,26,0.8)', 'pointer-events:none',
      ].join(';');
      map.append(node, ord, label);
      // (the old '▶ PLAY NOW' pill under this node is GONE — D11, Nate: two
      // "start" affordances confused; the card's Start Story button is THE one)
    }
    if (selectedId) selectStory(selectedId);
  }

  startBtn.onclick = () => {
    const story = STORIES.find((s) => s.id === selectedId);
    if (!story || !story.sceneKey || !app.hasScreen(story.sceneKey)) return;
    Audio.uiClick();
    app.navigate(story.sceneKey, { storyId: story.id });
  };

  // Settings gear (bottom-right, clear of the volume control top-right).
  const gear = document.createElement('button');
  gear.type = 'button';
  gear.setAttribute('aria-label', 'Settings');
  gear.textContent = '⚙';
  gear.style.cssText = [
    'position:fixed', 'right:calc(14px + env(safe-area-inset-right))', 'bottom:calc(14px + env(safe-area-inset-bottom))', 'z-index:22', 'pointer-events:auto',
    'width:44px', 'height:44px', 'border-radius:12px', 'cursor:pointer',
    'font-size:20px', 'color:#fdf6e3', 'background:rgba(16,14,26,0.5)',
    'border:1px solid rgba(255,255,255,0.14)', 'backdrop-filter:blur(3px)',
    'transition:background 150ms ease',
  ].join(';');
  gear.onmouseenter = () => { gear.style.background = 'rgba(30,26,44,0.7)'; };
  gear.onmouseleave = () => { gear.style.background = 'rgba(16,14,26,0.5)'; };
  gear.onclick = () => { Audio.uiClick(); openSettings({ onReset: renderNodes }); };

  // Small tasteful About · Support links (bottom-left, clear of the gear).
  const links = document.createElement('div');
  links.style.cssText = [
    'position:fixed', 'left:calc(16px + env(safe-area-inset-left))', 'bottom:calc(16px + env(safe-area-inset-bottom))',
    'z-index:22', 'pointer-events:auto', 'display:flex', 'gap:14px',
    'font:500 13px "Segoe UI",system-ui,sans-serif',
  ].join(';');
  [['About', 'about'], ['Support', 'support']].forEach(([label, key]) => {
    const a = document.createElement('button');
    a.type = 'button';
    a.textContent = label;
    a.style.cssText = [
      'background:none', 'border:none', 'cursor:pointer', 'color:#fdf6e3', 'opacity:0.72',
      'text-shadow:0 1px 5px rgba(15,12,26,0.7)', 'transition:opacity 150ms ease', 'padding:4px 2px',
    ].join(';');
    a.onmouseenter = () => { a.style.opacity = '1'; };
    a.onmouseleave = () => { a.style.opacity = '0.72'; };
    a.onclick = () => { Audio.uiClick(); app.navigate(key); };
    links.append(a);
  });

  root.append(title, subtitle, spacer, map, card);
  document.body.append(root, gear, links);
  requestAnimationFrame(() => { root.style.opacity = '1'; });

  // Default selection: the first built story (so Start is actionable), else the
  // current story in progression.
  const firstBuilt = STORIES.find((s) => s.sceneKey && app.hasScreen(s.sceneKey));
  const currentStory = STORIES.find((s) => statusOf(s.id) === 'current');
  renderNodes();
  selectStory((firstBuilt || currentStory || STORIES[0]).id);

  function update(dt, tMs) {
    const t = tMs / 1000;
    sky.update(dt);
    motes.update(dt, t);
    // the flock crosses the golden sky, slow and eased, wings flapping
    const fx = ((t * 2.1 + 40) % 150) - 75;
    flockAnchor.set(fx, 10.5 + Math.sin(t * 0.23) * 1.4, -56);
    for (const b of birds) {
      const u = b.userData;
      const a = t * 0.5 + u.phase;
      b.position.x += (flockAnchor.x + Math.cos(a) * u.r - b.position.x) * 0.03;
      b.position.y += (flockAnchor.y + Math.sin(a * 0.7) * 1.1 + u.h - b.position.y) * 0.03;
      b.position.z += (flockAnchor.z + Math.sin(a) * 2.2 - b.position.z) * 0.03;
      b.scale.y = 0.72 + Math.abs(Math.sin(t * 6.5 + u.phase)) * 0.5; // wing beat
    }
    // D8: the clouds drift, wrap, and breathe; the first stars twinkle
    for (const c of clouds) {
      c.position.x += c.userData.speed * dt * 0.001;
      if (c.position.x > c.userData.span) c.position.x = -c.userData.span;
      c.material.opacity += (Math.sin(t * 0.14 + c.position.z) * 0.0025);
    }
    stars.material.opacity = 0.34 + (Math.sin(t * 0.9) + Math.sin(t * 1.7)) * 0.09;
    const k = easeInOut((Math.sin(t * (Math.PI * 2 / 34)) + 1) / 2);
    camPos.lerpVectors(poseA.pos, poseB.pos, k);
    camPos.y += Math.sin(t * 0.8) * 0.06;
    camLook.lerpVectors(poseA.look, poseB.look, k);
    camera.position.copy(camPos);
    camera.lookAt(camLook);
  }

  function dispose() {
    disposed = true; // a late startBeds (queued gesture) must become a no-op
    window.removeEventListener('pointerdown', startBeds);
    homeMusic?.stop(0.8);
    Audio.ambience({ wind: 0, birds: 0 });
    cloudTex.dispose(); starTex.dispose();
    root.remove();
    gear.remove();
    links.remove();
    mapStyle.remove();
  }

  return { update, dispose };
}
