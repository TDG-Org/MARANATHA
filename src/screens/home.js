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

  // Warm ambience + a whisper of the music bed once audio is unlocked.
  const startBeds = () => { Audio.ambience({ wind: 0.22, birds: 0.18 }); Audio.musicPad(0.028); };
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
    'pointer-events:auto', 'width:min(90vw,440px)', 'margin:0 20px',
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

  // Story path row.
  const path = document.createElement('div');
  path.style.cssText = [
    'pointer-events:auto', 'display:flex', 'gap:8px', 'flex-wrap:wrap',
    'justify-content:center', 'margin:20px 16px 4vh',
  ].join(';');

  const GLYPH = { done: '✔', current: '◆', locked: '🔒' };
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
      startBtn.textContent = 'Coming soon';
      startBtn.disabled = true;
      startBtn.style.opacity = '0.5';
      startBtn.style.cursor = 'default';
      startBtn.style.background = 'rgba(255,255,255,0.12)';
    }
    // Re-highlight nodes.
    [...path.children].forEach((n) => {
      n.style.background = n.dataset.id === id ? 'rgba(242,184,128,0.22)' : 'rgba(16,14,26,0.4)';
      n.style.borderColor = n.dataset.id === id ? 'rgba(242,184,128,0.6)' : 'rgba(255,255,255,0.12)';
    });
  }

  function renderNodes() {
    path.textContent = '';
    for (const story of STORIES) {
      const status = statusOf(story.id);
      const built = !!(story.sceneKey && app.hasScreen(story.sceneKey));
      const node = document.createElement('button');
      node.type = 'button';
      node.dataset.id = story.id;
      node.style.cssText = [
        'pointer-events:auto', 'font-family:"Segoe UI",system-ui,sans-serif',
        'font-size:13px', 'padding:8px 14px', 'border-radius:10px', 'cursor:pointer',
        'color:#fdf6e3', 'border:1px solid rgba(255,255,255,0.12)',
        'background:rgba(16,14,26,0.4)', 'backdrop-filter:blur(3px)',
        'transition:background 150ms ease, border-color 150ms ease',
        'display:flex', 'align-items:center', 'gap:7px', 'white-space:nowrap',
      ].join(';');
      const glyph = built && status !== 'done' ? '▶' : (GLYPH[status] || '');
      node.innerHTML = `<span style="opacity:0.8">${glyph}</span> ${story.title}`;
      node.onclick = () => { Audio.uiClick(); selectStory(story.id); };
      path.append(node);
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

  root.append(title, subtitle, spacer, card, path);
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
    root.remove();
    gear.remove();
    links.remove();
  }

  return { update, dispose };
}
