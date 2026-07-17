import * as THREE from 'three';
import { makeSky, makeRidges, makeGround, makeSun, makeMotes, easeInOut } from '../engine/world.js';
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

  // Gentle idle drift between two nearby poses (keeps the sun framed upper-left).
  const poseA = { pos: new THREE.Vector3(3.5, 5.2, 19), look: new THREE.Vector3(-1, 3.4, -26) };
  const poseB = { pos: new THREE.Vector3(-4.5, 4.4, 17.5), look: new THREE.Vector3(1.5, 3.0, -24) };
  const camPos = new THREE.Vector3();
  const camLook = new THREE.Vector3();

  // Warm ambience + REAL soft looping music once audio is unlocked (D6 —
  // the camp theme at low gain; falls back to the procedural pad if missing).
  let homeMusic = null;
  const startBeds = () => {
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
  subtitle.textContent = 'Walk through the real events of the Bible';
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
  const mapStyle = document.createElement('style');
  mapStyle.textContent = `
    @keyframes mr-node-float { 0%,100% { transform: translate(-50%,-50%) translateY(0); } 50% { transform: translate(-50%,-50%) translateY(-5px); } }
    @keyframes mr-node-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(242,184,128,0.4), 0 6px 24px rgba(0,0,0,0.4); } 50% { box-shadow: 0 0 0 12px rgba(242,184,128,0), 0 6px 24px rgba(0,0,0,0.4); } }
    @keyframes mr-path-shimmer { to { stroke-dashoffset: -64; } }
  `;
  document.head.append(mapStyle);

  const map = document.createElement('div');
  map.style.cssText = [
    'pointer-events:auto', 'position:relative',
    'width:min(92vw,620px)', 'height:clamp(190px, 30vh, 290px)', 'margin:8px 0 2px',
  ].join(';');

  // node layout: Joseph centred and BIG; the locked stories arranged around him
  const NODE_POS = { joseph: [50, 46], creation: [15, 26], fall: [30, 76], noah: [76, 72] };
  const PATH_ORDER = ['creation', 'fall', 'noah', 'joseph']; // the dotted thread of the Book

  // the dotted path (SVG underlay, animated dash shimmer)
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.style.cssText = 'position:absolute; inset:0; width:100%; height:100%; pointer-events:none; opacity:0.5;';
  {
    let d = '';
    PATH_ORDER.forEach((id, i) => {
      const [x, y] = NODE_POS[id];
      if (i === 0) { d += `M ${x} ${y}`; return; }
      const [px, py] = NODE_POS[PATH_ORDER[i - 1]];
      d += ` Q ${(px + x) / 2 + (i % 2 ? 9 : -9)} ${(py + y) / 2}, ${x} ${y}`;
    });
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', d);
    p.setAttribute('fill', 'none');
    p.setAttribute('stroke', '#f2b880');
    p.setAttribute('stroke-width', '0.7');
    p.setAttribute('stroke-dasharray', '0.2 3.2');
    p.setAttribute('stroke-linecap', 'round');
    p.style.animation = 'mr-path-shimmer 9s linear infinite';
    svg.append(p);
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
      const big = built; // the playable story is the hero of the map
      const node = document.createElement('button');
      node.type = 'button';
      node.dataset.id = story.id;
      node.dataset.locked = built ? '0' : '1';
      node.setAttribute('aria-label', `${story.title}${built ? '' : ' (locked)'}`);
      node.style.cssText = [
        `position:absolute`, `left:${x}%`, `top:${y}%`, 'transform:translate(-50%,-50%)',
        `width:${big ? 84 : 54}px`, `height:${big ? 84 : 54}px`, 'border-radius:50%',
        'cursor:pointer', 'pointer-events:auto',
        `font-size:${big ? 30 : 19}px`, 'display:flex', 'align-items:center', 'justify-content:center',
        `color:${big ? '#241f38' : 'rgba(253,246,227,0.75)'}`,
        `background:${big ? 'radial-gradient(circle at 34% 30%, #ffe9c9, #f2b880 62%, #d99a5e)' : 'rgba(16,14,26,0.55)'}`,
        `border:2px solid ${big ? 'rgba(242,184,128,0.55)' : 'rgba(255,255,255,0.18)'}`,
        'backdrop-filter:blur(3px)',
        `animation: mr-node-float ${5 + (x % 3)}s ease-in-out ${y % 4}s infinite${big ? ', mr-node-pulse 2.6s ease-in-out infinite' : ''}`,
        'transition:border-color 200ms ease, filter 160ms ease',
      ].join(';');
      node.textContent = built ? (status === 'done' ? '✔' : '▶') : '🔒';
      node.onmouseenter = () => { node.style.filter = 'brightness(1.12)'; };
      node.onmouseleave = () => { node.style.filter = 'none'; };
      node.onclick = () => { Audio.uiClick(); selectStory(story.id); };
      // the name floats under every node — the map reads without clicking
      const label = document.createElement('div');
      label.className = 'mr-node-label';
      label.textContent = story.title;
      label.style.cssText = [
        'position:absolute', `left:${x}%`, `top:calc(${y}% + ${big ? 52 : 36}px)`, 'transform:translateX(-50%)',
        `font:600 ${big ? 15 : 12.5}px "Segoe UI",system-ui,sans-serif`,
        `color:${big ? '#ffe9c9' : 'rgba(253,246,227,0.7)'}`, 'letter-spacing:0.06em', 'white-space:nowrap',
        'text-shadow:0 1px 6px rgba(15,12,26,0.8)', 'pointer-events:none',
      ].join(';');
      map.append(node, label);
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
    const k = easeInOut((Math.sin(t * (Math.PI * 2 / 34)) + 1) / 2);
    camPos.lerpVectors(poseA.pos, poseB.pos, k);
    camPos.y += Math.sin(t * 0.8) * 0.06;
    camLook.lerpVectors(poseA.look, poseB.look, k);
    camera.position.copy(camPos);
    camera.lookAt(camLook);
  }

  function dispose() {
    window.removeEventListener('pointerdown', startBeds);
    homeMusic?.stop(0.8);
    Audio.ambience({ wind: 0, birds: 0 });
    root.remove();
    gear.remove();
    links.remove();
    mapStyle.remove();
  }

  return { update, dispose };
}
