import { STORIES, ERAS } from '../../data/stories.js';
import { statusOf } from '../../systems/SaveSystem.js';
import { Audio } from '../../systems/AudioSystem.js';
import { Graphics } from '../../systems/Graphics.js';
import { openSettings } from '../../ui/settings.js';
import { BACKDROP_HTML, ROAD_HTML, VIGNETTE_HTML } from './backdrop.js';
import { PALETTES, paletteKeyForNow } from './palettes.js';
import { buildAtlas, nodeHtml, roadBedHtml, gateHtml, particleHtml } from './atlas.js';
import { KEYFRAMES_CSS, UI_CSS } from './styles.js';

// HOME — the story map: one long night road through the Bible, with the
// chapters standing along it as lit or waiting stops.
//
// This screen is DOM/CSS/SVG only. It declares `flat`, so the app hides the
// WebGL canvas and stops submitting frames for it entirely while we are here —
// the vista's motion belongs to the compositor, not to the frame loop.
//
// Coordinate spaces, kept strictly apart:
//   · THE STAGE is the design's 1440x810 space. The painted world lives here
//     and the whole space is scaled to cover the viewport with ONE composited
//     transform, so the composition is identical on every screen.
//   · THE OVERLAY is viewport space. Title, story panel, era ribbon and chrome
//     live here at real CSS sizes, so text stays crisp and legible on a phone.
//
// Everything that moves while panning is a promoted layer translated by whole
// pixels; nothing on this screen repaints per frame.

const DESIGN_W = 1440;
const DESIGN_H = 810;

// Ambient field sizes at Medium; Graphics.particles() scales them per preset.
const PARTICLE_BASE = { stars: 64, sparkles: 9, motes: 24, embers: 18, fireflies: 18 };

const animRe = (name) => new RegExp(`animation:\\s*mr${name}[^;"]*;?`, 'g');
const strip = (html, name) => html.replace(animRe(name), '');

// Keep one running instance in every `keep` (0 = none, 1 = all).
function thinAnimations(html, name, keep) {
  if (keep === 1) return html;
  if (keep <= 0) return strip(html, name);
  let i = 0;
  return html.replace(animRe(name), (m) => (i++ % keep === 0 ? m : ''));
}

export function buildHome({ app, params = {} }) {
  let disposed = false;

  const query = new URLSearchParams(window.location.hash.split('?')[1] || '');
  const paletteKey = paletteKeyForNow(query.get('time'));
  const palette = PALETTES[paletteKey];
  const quiet = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;

  const isBuilt = (story) => !!(story.sceneKey && app.hasScreen(story.sceneKey));
  const atlas = buildAtlas(isBuilt);
  atlas.nodes.forEach((n) => { n.status = statusOf(n.id); });
  const gateNode = atlas.nodes[atlas.reachIndex];

  // ---- style ---------------------------------------------------------------
  const style = document.createElement('style');
  style.textContent = KEYFRAMES_CSS + UI_CSS;
  document.head.append(style);

  // ---- shell ---------------------------------------------------------------
  const root = document.createElement('div');
  root.className = 'mr-home';
  if (quiet) root.classList.add('mr-quiet');

  const band = document.createElement('div'); // clips the scaled world
  band.className = 'mr-band';
  const stage = document.createElement('div'); // the 1440x810 design space
  stage.className = 'mr-stage';

  // The importer already dropped sway from the three far bands. What is left
  // is the near band, where the plants are big enough for the motion to read —
  // and even that is thinned by preset, because a running animation is a
  // compositor layer.
  const swayKeep = { low: 0, medium: 2, high: 1 }[Graphics.name] ?? 2;
  const backdrop = thinAnimations(
    Graphics.name === 'low' ? strip(BACKDROP_HTML, 'Smoke') : BACKDROP_HTML,
    'Sway',
    swayKeep,
  );

  const counts = {};
  for (const [key, base] of Object.entries(PARTICLE_BASE)) counts[key] = Graphics.particles(base);
  const fields = particleHtml(counts);

  stage.innerHTML =
    backdrop.replace(/<!--slot:(\w+)-->/g, (_, k) => fields[k] || '')
    + ROAD_HTML.replace('<!--slot:nodes-->', atlas.nodes.map(nodeHtml).join('') + gateHtml(atlas))
    + VIGNETTE_HTML;

  band.append(stage);
  root.append(band);

  // ---- the road ------------------------------------------------------------
  const roadWrap = stage.querySelector('[data-roadwrap]');
  const road = stage.querySelector('[data-road]');
  const roadSvg = road.querySelector('svg');
  road.querySelector('[data-roadglow]').setAttribute('d', atlas.roadPath);
  road.querySelector('[data-roadline]').setAttribute('d', atlas.roadPath);
  road.querySelector('[data-roadwalked]').setAttribute('d', atlas.walkedPath);
  // The dark bed goes UNDER everything else in the road's SVG.
  roadSvg.insertAdjacentHTML('afterbegin', roadBedHtml(atlas.roadPath));

  // Dragging may only grab the road's own band. Everywhere else — the sky, the
  // hills, the title — stays still under the cursor.
  roadWrap.style.top = `${atlas.bandTop}px`;
  roadWrap.style.bottom = 'auto';
  roadWrap.style.height = `${atlas.bandBottom - atlas.bandTop}px`;
  road.style.top = `${-atlas.bandTop}px`; // world coordinates survive the crop

  const parallax = [...stage.querySelectorAll('[data-par]')]
    .map((el) => ({ el, factor: Number(el.dataset.par) || 0, svg: el.querySelector('svg') }));

  // ---- overlay UI ----------------------------------------------------------
  const eraReachable = (era) => {
    const first = atlas.nodes.find((n) => n.era === era.id && n.reachable);
    return first || null;
  };

  const ui = document.createElement('div');
  ui.className = 'mr-ui';
  ui.innerHTML = `
    <div class="mr-titleblock">
      <div class="mr-title">MARANATHA</div>
      <div class="mr-tagline"><i></i><span>A Bible game — walk through the Bible</span><i></i></div>
    </div>

    <div class="mr-panel">
      <div class="mr-panel-top">
        <span class="mr-era" data-field="era">Genesis</span>
        <span class="mr-ord" data-field="ord">Chapter IX</span>
      </div>
      <h1 class="mr-story-title" data-field="title">Joseph</h1>
      <div class="mr-passage" data-field="passage">Genesis 37–50</div>
      <div class="mr-progress" data-field="progress"></div>
      <div class="mr-rule"></div>
      <p class="mr-blurb" data-field="blurb"></p>
      <button type="button" class="mr-start" data-field="start">▶&nbsp; Start Story</button>
    </div>

    <div class="mr-ribbon-row">
      <button type="button" class="mr-nav" data-nav="prev" aria-label="Previous chapter">‹</button>
      <div class="mr-ribbon">
        ${ERAS.map((era) => {
    const open = !!eraReachable(era);
    const list = STORIES.filter((s) => s.era === era.id);
    const dots = list.map((s) => {
      const w = s.tier === 'major' ? 7 : s.tier === 'standard' ? 5 : 3.5;
      const bg = isBuilt(s) ? '#ffd28a' : 'rgba(253,246,227,.32)';
      return `<i style="width:${w}px; height:${w}px; background:${bg}"></i>`;
    }).join('');
    return `<button type="button" class="mr-era-chip${open ? '' : ' is-shut'}" data-era="${era.id}"${open ? '' : ' disabled'}
              style="flex:${list.length} 1 0" aria-label="${era.name} — ${era.sub}${open ? '' : ' (locked)'}">
            <span class="mr-era-name">${open ? '' : '🔒 '}${era.name}</span>
            <span class="mr-era-dots">${dots}</span>
          </button>`;
  }).join('')}
      </div>
      <button type="button" class="mr-nav" data-nav="next" aria-label="Next chapter">›</button>
    </div>

    <div class="mr-links">
      <button type="button" data-page="about">About</button>
      <button type="button" data-page="support">Support</button>
    </div>
    <button type="button" class="mr-gear" aria-label="Settings">⚙</button>
    <div class="mr-clock">${palette.label}${query.get('time') ? '' : ' · local'}</div>
  `;
  root.append(ui);

  // Lazy-screen and readiness failures land back here behind the black veil.
  // Recovery has to be explicit, and it must not hide the map.
  const failedRoute = params.loadError?.key;
  if (failedRoute) {
    const notice = document.createElement('div');
    notice.className = 'mr-notice';
    notice.setAttribute('role', 'alert');
    notice.innerHTML = `<span>${params.loadError.phase === 'assets'
      ? 'The story assets did not finish loading.'
      : 'The story could not be loaded.'}</span>`;
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'mr-notice-go';
    retry.textContent = 'Try again';
    retry.onclick = () => app.navigate(
      failedRoute,
      failedRoute === 'joseph' ? { storyId: 'joseph' } : undefined,
    );
    const reload = document.createElement('button');
    reload.type = 'button';
    reload.className = 'mr-notice-alt';
    reload.textContent = 'Reload';
    reload.onclick = () => window.location.reload();
    notice.append(retry, reload);
    ui.append(notice);
  }

  document.body.append(root);

  const field = (k) => ui.querySelector(`[data-field="${k}"]`);
  const startBtn = field('start');

  // ---- palette -------------------------------------------------------------
  // One palette, applied to every layer at once.
  (function applyPalette() {
    const q = (s) => stage.querySelector(s);
    const all = (s) => [...stage.querySelectorAll(s)];
    q('[data-sky]').style.background = palette.sky;
    palette.ridges.forEach((c, i) => all(`[data-ridge="${i}"]`).forEach((r) => r.setAttribute('fill', c)));
    all('[data-cross]').forEach((c) => c.setAttribute('fill', palette.ridges[4]));
    all('[data-crossshadow]').forEach((c) => c.setAttribute('fill', palette.ridges[2]));
    [['0.05', 0], ['0.10', 1], ['0.17', 2], ['0.26', 3]].forEach(([f, i]) => {
      const b = q(`[data-par="${f}"]`);
      if (b) b.style.color = palette.veg[i] || palette.ridges[i + 1];
    });
    const { lum } = palette;
    const place = (sel, w, h) => {
      const el = q(sel);
      if (!el) return null;
      el.style.left = `${lum.x}px`;
      el.style.top = `${lum.y}px`;
      if (w) { el.style.width = `${w}px`; el.style.height = `${h ?? w}px`; }
      return el;
    };
    const moonlight = place('[data-moonlight]');
    if (moonlight) moonlight.style.background = palette.moonlight;
    place('[data-lumring]', lum.ring);
    const disc = place('[data-lum]', lum.size);
    if (disc) disc.style.background = palette.lumFill;
    const glow = place('[data-lumglow]', lum.glowSize);
    if (glow) glow.style.background = palette.glowFill;
    q('[data-stars]').style.opacity = palette.stars;
    q('[data-night]').style.opacity = palette.night;
    q('[data-haze]').style.background = palette.haze;
    all('[data-fire]').forEach((f) => { f.style.opacity = palette.fire; });
  }());

  // ---- camera --------------------------------------------------------------
  let scale = 1;
  let stacked = false;
  let cropX = 0;          // css px of stage cropped off the left (cover-centring)
  let visibleW = DESIGN_W; // design px visible across the viewport
  let viewRight = DESIGN_W; // rightmost visible point, in stage coordinates
  let minOffset = 0;
  let offset = 0;
  let selectedId = null;

  const clampOffset = (v) => Math.max(minOffset, Math.min(80, v));

  // The stage is centred when it is wider than the viewport, so a point on
  // screen is NOT simply cssX / scale — the crop has to come back out first.
  // Every focus and clamp below works in stage coordinates.
  const toStageX = (cssX) => (cssX + cropX) / scale;

  // Where a selected chapter should come to rest: middle of the open space
  // beside the story panel on wide screens, dead centre when it is stacked.
  function focusX() {
    if (stacked) return toStageX(window.innerWidth * 0.5);
    const panel = ui.querySelector('.mr-panel');
    const panelRight = toStageX(panel?.getBoundingClientRect().right ?? 0);
    return (panelRight + viewRight) / 2;
  }

  function applyCamera(animate) {
    const transition = animate ? 'transform 680ms cubic-bezier(.22,.72,.2,1)' : 'none';
    const x = Math.round(offset);
    road.style.transition = transition;
    road.style.transform = `translate3d(${x}px,0,0)`;
    for (const layer of parallax) {
      layer.el.style.transition = transition;
      layer.el.style.transform = `translate3d(${Math.round(x * layer.factor)}px,0,0)`;
    }
    // The sun/moon travels with the farthest band so the hilltop crosses stay
    // silhouetted against it, and never slides under the story panel.
    const dx = Math.max(Math.round(x * 0.05), Math.min(0, 540 - palette.lum.x));
    for (const sel of ['[data-lum]', '[data-lumglow]', '[data-lumring]', '[data-moonlight]']) {
      const el = stage.querySelector(sel);
      if (!el) continue;
      el.style.transition = transition;
      el.style.transform = `translate(-50%,-50%) translate3d(${dx}px,0,0)`;
    }
    root.classList.toggle('at-gate', x <= minOffset + 2);
  }

  // ---- selection -----------------------------------------------------------
  function selectStory(id, animate = true) {
    const node = atlas.byId.get(id);
    if (!node || !node.reachable) return;
    selectedId = id;

    const era = ERAS.find((e) => e.id === node.era);
    field('era').textContent = era ? era.name : '';
    field('ord').textContent = `Chapter ${node.ord}`;
    field('title').textContent = node.title;
    field('passage').textContent = node.passage;
    field('blurb').textContent = node.blurb;
    // "Walked" means walked: chapters the player has actually finished.
    const walked = atlas.nodes.filter((n) => n.status === 'done').length;
    field('progress').textContent =
      `${walked} of ${atlas.total} stories walked · story ${node.num}`;

    startBtn.textContent = node.built ? '▶  Start Story' : '🔒  Coming soon';
    startBtn.disabled = !node.built;
    startBtn.classList.toggle('is-locked', !node.built);

    for (const el of stage.querySelectorAll('[data-node]')) {
      const on = el.dataset.node === id;
      el.classList.toggle('is-selected', on);
      el.style.zIndex = on ? '5' : '1';
    }
    for (const chip of ui.querySelectorAll('[data-era]')) {
      chip.classList.toggle('is-on', chip.dataset.era === node.era);
    }

    offset = clampOffset(focusX() - node.x);
    applyCamera(animate);
  }

  function step(dir) {
    const i = atlas.nodes.findIndex((n) => n.id === selectedId);
    const next = atlas.nodes[Math.max(0, Math.min(atlas.reachIndex, i + dir))];
    if (next && next.id !== selectedId) { Audio.uiClick(); selectStory(next.id); }
  }

  // ---- responsive ----------------------------------------------------------
  // Each parallax band is clipped to the widest slice it can ever show
  // (viewport + how far it travels at its own parallax factor). Without this
  // the browser holds five 6400px-wide surfaces; with it the far bands are
  // barely wider than the screen.
  function clipWorld() {
    const travel = Math.abs(minOffset) + 60;
    for (const layer of parallax) {
      const w = Math.min(atlas.worldW, Math.ceil(viewRight + travel * layer.factor));
      layer.el.style.width = `${w}px`;
      if (layer.svg) {
        layer.svg.setAttribute('viewBox', `0 0 ${w} ${DESIGN_H}`);
        layer.svg.style.width = `${w}px`;
      }
    }
    const roadW = Math.min(atlas.worldW, Math.ceil(viewRight + travel));
    road.style.width = `${roadW}px`;
    roadSvg.setAttribute('viewBox', `0 0 ${roadW} ${DESIGN_H}`);
    roadSvg.style.width = `${roadW}px`;
    roadSvg.style.height = `${DESIGN_H}px`;
  }

  function relayout() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (!vw || !vh) return;
    // Below this the design's side-by-side composition stops working: the map
    // moves to a band on top and the story panel becomes a sheet beneath it.
    stacked = vw < 900 || vh < 520;
    root.classList.toggle('is-stacked', stacked);

    // One factor scales the whole interface with the viewport, so the design's
    // proportions hold everywhere instead of shrinking only the scenery.
    const clamp = (lo, v, hi) => Math.max(lo, Math.min(hi, v));
    const u = stacked
      ? clamp(0.62, Math.min(vw / 430, vh / 760), 1.05)
      : clamp(0.82, Math.min(vw / DESIGN_W, vh / DESIGN_H), 1.4);
    root.style.setProperty('--u', u.toFixed(3));

    const panel = ui.querySelector('.mr-panel');
    let bandH = vh;
    if (stacked) {
      // Give the map whatever the chapter sheet and the ribbon don't need, so
      // nothing is ever pushed off a short landscape phone.
      panel.style.top = '0px';
      const panelH = panel.offsetHeight;
      const ribbonH = ui.querySelector('.mr-ribbon-row').offsetHeight + 22;
      bandH = Math.round(clamp(vh * 0.3, vh - panelH - ribbonH - 12, vh * 0.62));
      panel.style.top = `${bandH}px`;
    } else {
      panel.style.top = '';
    }
    band.style.height = `${bandH}px`;
    scale = Math.max(bandH / DESIGN_H, vw / DESIGN_W);
    visibleW = vw / scale;
    // Cover: centre what overflows horizontally, but bias the vertical crop
    // upward so the road keeps its distance from the era ribbon.
    cropX = (DESIGN_W * scale - vw) / 2;
    viewRight = toStageX(vw);
    const dy = (DESIGN_H * scale - bandH) * 0.66;
    stage.style.transform = `translate3d(${-cropX}px,${-dy}px,0) scale(${scale})`;

    // The road fades out behind the story panel instead of running under it.
    if (stacked) {
      roadWrap.style.maskImage = 'none';
      roadWrap.style.webkitMaskImage = 'none';
    } else {
      const edge = toStageX(panel?.getBoundingClientRect().right ?? 468 * scale);
      const mask = `linear-gradient(90deg,rgba(0,0,0,0) 0px,rgba(0,0,0,0) ${Math.round(edge - 168)}px,rgba(0,0,0,.5) ${Math.round(edge - 48)}px,#000 ${Math.round(edge + 92)}px)`;
      roadWrap.style.maskImage = mask;
      roadWrap.style.webkitMaskImage = mask;
    }

    // Only one story exists, so the journey is barred one chapter past it.
    minOffset = Math.min(80, focusX() - gateNode.x);
    clipWorld();
    offset = clampOffset(offset);
    if (selectedId) selectStory(selectedId, false);
    else applyCamera(false);
  }

  // ---- input ---------------------------------------------------------------
  let dragging = false;
  let dragFrom = 0;
  let dragBase = 0;
  let dragDist = 0;

  const onPointerDown = (e) => {
    if (e.button != null && e.button !== 0) return;
    dragging = true;
    dragFrom = e.clientX;
    dragBase = offset;
    dragDist = 0;
    roadWrap.classList.add('is-grabbing');
    roadWrap.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!dragging) return;
    const dx = (e.clientX - dragFrom) / scale;
    dragDist = Math.max(dragDist, Math.abs(dx));
    offset = clampOffset(dragBase + dx);
    applyCamera(false);
  };
  const onPointerUp = (e) => {
    if (!dragging) return;
    dragging = false;
    roadWrap.classList.remove('is-grabbing');
    roadWrap.releasePointerCapture?.(e.pointerId);
  };
  const onWheel = (e) => {
    e.preventDefault();
    offset = clampOffset(offset - (e.deltaY + e.deltaX) * 1.4);
    applyCamera(false);
  };

  roadWrap.addEventListener('pointerdown', onPointerDown);
  roadWrap.addEventListener('pointermove', onPointerMove);
  roadWrap.addEventListener('pointerup', onPointerUp);
  roadWrap.addEventListener('pointercancel', onPointerUp);
  roadWrap.addEventListener('wheel', onWheel, { passive: false });

  // A drag that ends on a chapter must not also select it.
  stage.addEventListener('click', (e) => {
    if (dragDist > 8) { dragDist = 0; return; }
    const node = e.target.closest?.('[data-node]');
    if (!node) return;
    Audio.uiClick();
    selectStory(node.dataset.node);
  });

  ui.addEventListener('click', (e) => {
    const nav = e.target.closest?.('[data-nav]');
    if (nav) { step(nav.dataset.nav === 'next' ? 1 : -1); return; }
    const chip = e.target.closest?.('[data-era]');
    if (chip) {
      const era = ERAS.find((x) => x.id === chip.dataset.era);
      const first = era && eraReachable(era);
      if (first) { Audio.uiClick(); selectStory(first.id); }
      return;
    }
    const page = e.target.closest?.('[data-page]');
    if (page) { Audio.uiClick(); app.navigate(page.dataset.page); }
  });

  startBtn.onclick = () => {
    const story = STORIES.find((s) => s.id === selectedId);
    if (!story || !isBuilt(story)) return;
    Audio.uiClick();
    app.navigate(story.sceneKey, { storyId: story.id });
  };

  ui.querySelector('.mr-gear').onclick = () => { Audio.uiClick(); openSettings(); };

  const onKeyDown = (e) => {
    if (e.defaultPrevented || e.target?.closest?.('input, select, textarea')) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
  };
  window.addEventListener('keydown', onKeyDown);

  const onResize = () => relayout();
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);
  window.visualViewport?.addEventListener('resize', onResize);
  // A tab opened in the background reports 0x0 until it is first shown, and
  // `resize` alone is unreliable on mobile. Observing the (fixed, inset-0) root
  // is the catch-all: the first real size lays the map out, however it arrives.
  const observer = 'ResizeObserver' in window ? new ResizeObserver(() => relayout()) : null;
  observer?.observe(root);
  const graphicsOff = Graphics.subscribe?.(() => relayout());

  // ---- audio ---------------------------------------------------------------
  // Build and prepaint stay silent behind the veil; the soundscape starts only
  // once the app has revealed this screen (or on the first unlocking tap).
  let music = null;
  let bedsStarted = false;
  let activated = false;
  const daylight = paletteKey === 'day' || paletteKey === 'dawn';
  const startBeds = () => {
    if (bedsStarted || disposed) return;
    bedsStarted = true;
    Audio.ambience({ wind: 0.22, birds: daylight ? 0.16 : 0.04 });
    music = Audio.playLoop('music.camp_warm', { gain: 0.45 });
  };
  const activate = () => {
    if (disposed || activated) return;
    activated = true;
    if (Audio.on) startBeds();
    else window.addEventListener('pointerdown', startBeds, { once: true });
  };

  // ---- open ----------------------------------------------------------------
  relayout();
  // Open on the chapter the player is up to; failing that, the first one they
  // can actually walk, so the button is never dead on arrival.
  const current = atlas.nodes.find((n) => n.built && n.status === 'current')
    || atlas.nodes.find((n) => n.built)
    || atlas.nodes[0];
  selectStory(current.id, false);
  // Fade in on the next frame so the transition has a starting value. A tab
  // that is still hidden gets no frames, so a timer backs it up — the map must
  // never be left sitting at opacity 0.
  const reveal = () => { if (!disposed) root.classList.add('is-in'); };
  requestAnimationFrame(reveal);
  const revealTimer = setTimeout(reveal, 80);

  function dispose() {
    disposed = true;
    clearTimeout(revealTimer);
    window.removeEventListener('pointerdown', startBeds);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('orientationchange', onResize);
    window.visualViewport?.removeEventListener('resize', onResize);
    observer?.disconnect();
    graphicsOff?.();
    music?.stop(0.8);
    Audio.ambience({ wind: 0, birds: 0 });
    root.remove();
    style.remove();
  }

  // `flat` tells the app there is no 3D here: it hides the canvas and stops
  // submitting GPU frames while this screen is up.
  return { flat: true, update() {}, dispose, activate, whenReady: Promise.resolve(true) };
}
