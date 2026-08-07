import { STORIES, ERAS } from '../../data/stories.js';
import { statusOf } from '../../systems/SaveSystem.js';
import { Audio } from '../../systems/AudioSystem.js';
import { Graphics } from '../../systems/Graphics.js';
import { Settings } from '../../systems/Settings.js';
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
//
// Nate, on the first build: "there just feels like there's TOO much going on,
// too much flare around the storyline... i can bare[ly] see the camp and the
// tents and people in the background". The sky and the road verge were doing
// so much twinkling that the painted world underneath them stopped reading.
// These are roughly half what the design shipped, and the field that was
// costing the most attention around the road — the glowing fireflies along the
// verge — is the one cut hardest.
//
// `embers` is 0 deliberately, and it is not a taste call: the ember field
// targets camps at x 2303 and 4606, while band 3 is clipped to about 1630px on
// every screen size. Those particles have never once been visible. They were
// paying for four running animations to render nothing.
const PARTICLE_BASE = { stars: 34, sparkles: 3, motes: 12, embers: 0, fireflies: 7 };

// How many of the design's three shooting stars survive. They are the single
// most attention-grabbing thing on a screen that is meant to feel still.
const SHOOTING_STARS = 1;

const animRe = (name) => new RegExp(`animation:\\s*mr${name}[^;"]*;?`, 'g');
const strip = (html, name) => html.replace(animRe(name), '');

// The design marches the road's dashes with `stroke-dashoffset`. That is the
// one property on this screen the compositor cannot animate by itself, so every
// frame it asks the main thread to re-rasterise the whole road path — forever,
// while the player reads the chapter blurb. The dashes stay exactly where they
// are and shimmer instead: the same "the road goes on" read, on the compositor.
const composited = (html) => html.replace(animRe('Dash'), 'animation:mrShimmer 3.6s ease-in-out infinite');

// Keep one running instance in every `keep` (0 = none, 1 = all).
function thinAnimations(html, name, keep) {
  if (keep === 1) return html;
  if (keep <= 0) return strip(html, name);
  let i = 0;
  return html.replace(animRe(name), (m) => (i++ % keep === 0 ? m : ''));
}

// Remove whole ELEMENTS, not just their animation.
//
// Stripping an animation off a particle leaves the element behind at its
// authored style — and these particles are drawn by their keyframes, whose 0%
// is `opacity: 0`. Take the animation away and a drifting smoke puff becomes a
// solid pale disc sitting on the fire forever. Anything that is only visible
// while it animates has to be deleted outright.
function dropElements(html, name, keep = 0) {
  const re = new RegExp(`<div[^>]*animation:\\s*mr${name}[^>]*>(?:</div>|[\\s\\S]*?</div>\\s*</div>)`, 'g');
  let i = 0;
  return html.replace(re, (m) => (i++ < keep ? m : ''));
}

export function buildHome({ app, params = {} }) {
  let disposed = false;

  const query = new URLSearchParams(window.location.hash.split('?')[1] || '');
  // The player's chosen backdrop wins over the clock; 'auto' (the default)
  // keeps matching the time of day. A ?time= override still beats both, for QA.
  const chosenSky = Settings.data?.sky && Settings.data.sky !== 'auto' ? Settings.data.sky : null;
  const paletteKey = paletteKeyForNow(query.get('time') || chosenSky);
  const palette = PALETTES[paletteKey];
  const quiet = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;

  const isBuilt = (story) => !!(story.sceneKey && app.hasScreen(story.sceneKey));
  // Said on the Bible card, so the promise on it is the live one rather than a
  // number that quietly goes stale the next time a scene lands.
  const builtCount = STORIES.filter(isBuilt).length;
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
  const swayKeep = { low: 0, medium: 3, high: 2 }[Graphics.name] ?? 3;
  const backdrop = thinAnimations(
    // Low DELETES the smoke rather than freezing it: a puff with no animation
    // is a solid pale disc parked on the fire, because its keyframe owns the
    // opacity. Shooting stars are cut on every preset — one streak reads as
    // wonder, three read as a screensaver.
    dropElements(
      Graphics.name === 'low' ? dropElements(BACKDROP_HTML, 'Smoke') : BACKDROP_HTML,
      'Shoot',
      SHOOTING_STARS,
    ),
    'Sway',
    swayKeep,
  );

  const counts = {};
  for (const [key, base] of Object.entries(PARTICLE_BASE)) {
    // A zero base means the field is switched off outright — don't let the
    // preset's minimum quietly resurrect three of them.
    counts[key] = base > 0 ? Graphics.particles(base) : 0;
  }
  const fields = particleHtml(counts);

  stage.innerHTML =
    backdrop.replace(/<!--slot:(\w+)-->/g, (_, k) => fields[k] || '')
    + composited(ROAD_HTML).replace('<!--slot:nodes-->', atlas.nodes.map(nodeHtml).join('') + gateHtml(atlas))
    + VIGNETTE_HTML;

  band.append(stage);
  root.append(band);

  // The ash veil END TIMES is read through. A flat composited layer rather than
  // a blur: the vista behind it keeps its shape, and a colour wash costs one
  // layer where a full-screen convolution costs the whole viewport every frame.
  const scrim = document.createElement('div');
  scrim.className = 'mr-scrim';
  root.append(scrim);

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

    <button type="button" class="mr-back" data-back>‹&nbsp; All modes</button>

    <div class="mr-modes">
      <div class="mr-modes-prompt">Choose where to begin</div>
      <div class="mr-modes-row">
        <button type="button" class="mr-mode mr-mode-bible" data-mode="bible">
          <span class="mr-mode-kicker">The true story</span>
          <span class="mr-mode-name">Bible Stories</span>
          <span class="mr-mode-rule"></span>
          <span class="mr-mode-line">Walk through the Bible as it happens, chapter by chapter.</span>
          <span class="mr-mode-meta">Genesis onward · ${builtCount} ready to play</span>
          <span class="mr-mode-go">Enter&nbsp; ▸</span>
        </button>
        <button type="button" class="mr-mode mr-mode-end" data-mode="endtimes">
          <span class="mr-mode-kicker">Original story</span>
          <span class="mr-mode-name">END TIMES</span>
          <span class="mr-mode-rule"></span>
          <span class="mr-mode-line">The same world, in a darker light. Being written now.</span>
          <span class="mr-mode-meta">In development</span>
          <span class="mr-mode-go">Take a look&nbsp; ▸</span>
        </button>
      </div>
    </div>

    <div class="mr-et-panel">
      <div class="mr-panel-top">
        <span class="mr-era">Original story</span>
      </div>
      <h1 class="mr-story-title">END TIMES</h1>
      <div class="mr-passage">Matthew 24 · 1 Thessalonians 4</div>
      <div class="mr-rule"></div>
      <p class="mr-blurb">An original story, told in the same world and the same
        engine — in a darker light. It is being written now.</p>
      <div class="mr-state">In development — not yet playable.</div>
      <button type="button" class="mr-start is-locked" disabled>🔒&nbsp; Coming soon</button>
    </div>

    <div class="mr-panel">
      <div class="mr-panel-top">
        <span class="mr-era" data-field="era">Genesis</span>
      </div>
      <h1 class="mr-story-title" data-field="title">Joseph</h1>
      <div class="mr-passage" data-field="passage">Genesis 37–50</div>
      <div class="mr-rule"></div>
      <p class="mr-blurb" data-field="blurb"></p>
      <div class="mr-state" data-field="state" aria-live="polite"></div>
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
    // Nate: "i can barely see the camp and the tents and people". The camp is
    // drawn in its band's own silhouette colour, which at night is #080f24
    // against a #16224a hillside — a difference of about fifteen levels, i.e.
    // none. The tents are 42px and the people are ten. They are the only sign
    // of life in the vista, so they get their own lift out of the hillside
    // rather than sharing the shrubbery's colour.
    all('[data-campgroup]').forEach((g) => { g.style.color = palette.camp || palette.ridges[3]; });
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

  // Dragging the road calls applyCamera on every pointer frame. It used to
  // re-query the stage for the four sun/moon elements each time and rewrite an
  // identical `transition` string on a dozen elements — style work the browser
  // then has to recompute, for a value that had not changed. Resolve the
  // elements once and write only what actually differs.
  const lumEls = ['[data-lum]', '[data-lumglow]', '[data-lumring]', '[data-moonlight]']
    .map((sel) => stage.querySelector(sel))
    .filter(Boolean);

  // ONE STYLE WRITE PER FRAME, NOT ONE PER EVENT.
  //
  // Nate: "when i drag and move to see more nodes and stories, it's still a bit
  // gittery".
  //
  // A gaming mouse reports at 500-1000Hz and a trackpad fires a pointermove per
  // touch sample, so on a 60Hz screen this rewrote the transform of the road,
  // every parallax band and the four sun/moon elements up to sixteen times for
  // a single frame the player could see. Fifteen of those were thrown away, and
  // the one that survived was whichever event happened to land last — so the
  // step between frames was uneven even though the hand was moving smoothly.
  // That unevenness IS the jitter; it is not a cost problem, it is a sampling
  // problem, and coalescing to the frame fixes both.
  //
  // Deliberately a one-shot per burst, never self-rescheduling: nothing here
  // may become a private animation loop behind the frame governor.
  let cameraFrame = 0;
  const scheduleCamera = () => {
    if (cameraFrame) return;
    cameraFrame = requestAnimationFrame(() => {
      cameraFrame = 0;
      applyCamera(false);
    });
  };
  let lastTransition = null;
  let lastAtGate = null;
  // WHOLE PIXELS, BUT WHOSE?
  //
  // Every moving layer used to be rounded to a whole STAGE pixel. The stage is
  // then scaled to cover the viewport, so a stage pixel is not a screen pixel —
  // and a parallax band moving at factor 0.2 only changed position once every
  // five stage pixels of drag, which on screen is a background that lurches
  // instead of gliding. Rounding to whole DEVICE pixels keeps the crispness the
  // rule was written for and removes the stepping entirely.
  let devicePx = 1;
  const snap = (v) => Math.round(v * devicePx) / devicePx;

  function applyCamera(animate) {
    // An eased focus move must not be stomped by a queued drag write a frame
    // later — that write sets transition:none and the glide never plays.
    if (cameraFrame) { cancelAnimationFrame(cameraFrame); cameraFrame = 0; }
    const transition = animate ? 'transform 680ms cubic-bezier(.22,.72,.2,1)' : 'none';
    const x = offset;
    if (transition !== lastTransition) {
      lastTransition = transition;
      road.style.transition = transition;
      for (const layer of parallax) layer.el.style.transition = transition;
      for (const el of lumEls) el.style.transition = transition;
    }
    road.style.transform = `translate3d(${snap(x)}px,0,0)`;
    for (const layer of parallax) {
      layer.el.style.transform = `translate3d(${snap(x * layer.factor)}px,0,0)`;
    }
    // The sun/moon travels with the farthest band so the hilltop crosses stay
    // silhouetted against it, and never slides under the story panel.
    const dx = Math.max(snap(x * 0.05), Math.min(0, 540 - palette.lum.x));
    for (const el of lumEls) {
      el.style.transform = `translate(-50%,-50%) translate3d(${dx}px,0,0)`;
    }
    const atGate = x <= minOffset + 2;
    if (atGate !== lastAtGate) {
      lastAtGate = atGate;
      root.classList.toggle('at-gate', atGate);
    }
  }

  // ---- selection -----------------------------------------------------------
  function selectStory(id, animate = true) {
    const node = atlas.byId.get(id);
    if (!node) return;
    selectedId = id;

    const era = ERAS.find((e) => e.id === node.era);
    field('era').textContent = era ? era.name : '';
    field('title').textContent = node.title;
    field('passage').textContent = node.passage;
    field('blurb').textContent = node.blurb;

    // SAY WHICH OF THE THREE THINGS THIS IS. "Start Story" on a chapter with no
    // story, and an identical-looking lock on one that is simply not written
    // yet, left the player to guess which stops were real. Each state now names
    // itself in the panel as well as on the button.
    const state = field('state');
    if (!node.built) {
      state.textContent = 'Not built yet — this chapter is still to come.';
      startBtn.textContent = '🔒  Coming soon';
    } else if (node.explore) {
      state.textContent = 'Walk around it — the story is still to be written.';
      startBtn.textContent = '▶  Explore';
    } else {
      state.textContent = 'Ready to play.';
      startBtn.textContent = '▶  Start Story';
    }
    state.classList.toggle('is-ready', node.built);
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
  // The design paints a world 6400px wide, but a band only ever shows the slice
  // clipWorld() gives it — so a second camp at x=2140 inside a band clipped to
  // 1630 is not "far away", it is UNREACHABLE. Most of the backdrop is in that
  // state: whole camps, herds, a shepherd, most of the birds, and every one of
  // their running animations, parsed and laid out and composited to render
  // nothing at all, on every device, forever. Anything whose own left edge
  // starts past its band's clip is removed once, on the first layout.
  // Removal is permanent, so it must NOT be judged against the window the player
  // happens to have open. A band's clip is `viewRight + travel x factor`, and
  // viewRight is bounded by the design width however wide the monitor gets
  // (the stage is cover-scaled). So the threshold is computed from the WIDEST
  // slice a band could ever show, plus a margin — anything past that is
  // unreachable on any screen, at any size, forever.
  let pruned = false;
  function pruneUnreachable() {
    if (pruned) return 0;
    const travel = Math.abs(minOffset) + 60;
    if (!Number.isFinite(travel)) return 0;
    pruned = true;
    let removed = 0;
    for (const layer of parallax) {
      const widestEver = Math.min(atlas.worldW, DESIGN_W + 240 + travel * layer.factor);
      for (const child of [...layer.el.children]) {
        if (child.tagName === 'svg') continue; // the band's own hillside
        const left = parseFloat(child.style.left);
        if (Number.isFinite(left) && left > widestEver) { child.remove(); removed += 1; }
      }
    }
    return removed;
  }

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
    // How many stage units make one physical pixel — recomputed here rather
    // than read per frame, since neither the scale nor the display can change
    // without a layout pass reaching this line.
    devicePx = Math.max(1, scale * (window.devicePixelRatio || 1));
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
    pruneUnreachable();
    offset = clampOffset(offset);
    if (selectedId) selectStory(selectedId, false);
    else applyCamera(false);
  }

  // ---- input ---------------------------------------------------------------
  let dragging = false;
  let dragFrom = 0;
  let dragBase = 0;
  let dragDist = 0;

  // WHICH CHAPTER THE PRESS STARTED ON.
  //
  // The road takes pointer capture so a drag keeps working when the cursor
  // leaves it — and a captured pointer RETARGETS its click to the capturing
  // element. So every real press on a chapter arrived at the click handler with
  // `e.target` set to the road, `closest('[data-node]')` came back null, and the
  // selection was dropped on the floor. The map looked completely dead: nothing
  // you clicked ever became the selected story.
  //
  // It survived testing because a scripted `el.click()` dispatches straight at
  // the element and never goes through capture at all. Only a real finger or
  // mouse hits it, which is why Nate found it and the tests did not.
  let pressNode = null;
  const onPointerDown = (e) => {
    if (e.button != null && e.button !== 0) return;
    dragging = true;
    dragFrom = e.clientX;
    dragBase = offset;
    dragDist = 0;
    pressNode = e.target.closest?.('[data-node]') || null;
    roadWrap.classList.add('is-grabbing');
    roadWrap.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!dragging) return;
    const dx = (e.clientX - dragFrom) / scale;
    dragDist = Math.max(dragDist, Math.abs(dx));
    offset = clampOffset(dragBase + dx);
    scheduleCamera();
  };
  const onPointerUp = (e) => {
    if (!dragging) return;
    dragging = false;
    roadWrap.classList.remove('is-grabbing');
    roadWrap.releasePointerCapture?.(e.pointerId);
    applyCamera(false); // land exactly where the hand let go, not a frame behind
  };
  const onWheel = (e) => {
    e.preventDefault();
    offset = clampOffset(offset - (e.deltaY + e.deltaX) * 1.4);
    scheduleCamera();
  };

  roadWrap.addEventListener('pointerdown', onPointerDown);
  roadWrap.addEventListener('pointermove', onPointerMove);
  roadWrap.addEventListener('pointerup', onPointerUp);
  roadWrap.addEventListener('pointercancel', onPointerUp);
  roadWrap.addEventListener('wheel', onWheel, { passive: false });

  // A drag that ends on a chapter must not also select it.
  stage.addEventListener('click', (e) => {
    const started = pressNode;
    pressNode = null;
    if (dragDist > 8) { dragDist = 0; return; }
    // `e.target` first for keyboard/synthetic activation, then the chapter the
    // press actually began on — which is the only one available once pointer
    // capture has retargeted the click to the road itself.
    const node = e.target.closest?.('[data-node]') || started;
    if (!node) return;
    Audio.uiClick();
    selectStory(node.dataset.node);
  });

  ui.addEventListener('click', (e) => {
    const modeBtn = e.target.closest?.('[data-mode]');
    if (modeBtn) { Audio.uiClick(); setMode(modeBtn.dataset.mode, true); return; }
    if (e.target.closest?.('[data-back]')) { Audio.uiClick(); setMode('choose', true); return; }
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
    if (page) { Audio.uiClick(); openPanel(page.dataset.page); }
  });

  startBtn.onclick = () => {
    const story = STORIES.find((s) => s.id === selectedId);
    if (!story || !isBuilt(story)) return;
    Audio.uiClick();
    app.navigate(story.sceneKey, { storyId: story.id });
  };

  ui.querySelector('.mr-gear').onclick = () => {
    Audio.uiClick();
    // Resetting progress changes the status of every stop, the walked stretch of
    // road, and the progress line -- none of which this screen recomputes on its
    // own. Without this the map kept showing the world as it was before the
    // reset until the player happened to rebuild it by visiting another page.
    openSettings({ onReset: () => { if (!disposed) app.navigate('home'); } });
  };

  const onKeyDown = (e) => {
    if (e.defaultPrevented || e.target?.closest?.('input, select, textarea')) return;
    // An overlay (About/Support/Settings) inerts the home root — this
    // window-level handler must stand down with it, or arrows kept stepping
    // chapters (with an audible click) behind the open panel.
    if (root.inert || root.classList.contains('mr-behind-panel')) return;
    // Escape backs out of a mode the same way the button does.
    if (e.key === 'Escape' && mode !== 'choose') { e.preventDefault(); setMode('choose', true); return; }
    // The arrows steer the story map, so they only exist while it is the live
    // mode — otherwise they stepped chapters, audibly, behind the chooser.
    if (mode !== 'bible') return;
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

  // ---- About / Support panels ----------------------------------------------
  // These are NOT screens. Navigating away would dispose this home — taking its
  // music with it — and the "blurred background" would be a photograph of the
  // map rather than the map. They mount over the living home instead.
  //
  // Order matters for the blur: park the vista FIRST (`.mr-still` stops every
  // animation), then blur. Blurring a surface that is still animating re-runs
  // the convolution every frame; blurring a parked one rasterises once.
  let closePanel = null;
  const setPanelBlur = (on) => {
    root.classList.toggle('mr-behind-panel', on);
    syncMotion(on);
  };
  function openPanel(name) {
    if (closePanel) closePanel();
    setPanelBlur(true);
    const onClose = () => {
      closePanel = null;
      setPanelBlur(false);
      cleanup?.();
    };
    let cleanup = null;
    const load = name === 'support'
      ? import('../pages.js').then((m) => m.openSupportPanel({ onClose }))
      : import('../pages.js').then((m) => m.openAboutPanel({ onClose }));
    load.then((dispose) => {
      cleanup = dispose;
      // Closed again before the chunk arrived — do not leave an orphan panel.
      if (!closePanel) dispose();
    }).catch((e) => { console.error('[home] panel failed', e); setPanelBlur(false); });
    closePanel = () => { closePanel = null; setPanelBlur(false); cleanup?.(); };
  }

  // ---- motion gate ---------------------------------------------------------
  // A menu is where a player parks. The vista is CSS, so it lives on the
  // compositor and never touches the frame governor — but "not on the main
  // thread" is not "free": ~110 running animations ask the compositor for a new
  // frame at the display's refresh rate for as long as this screen is up, which
  // on a 144 Hz panel is 144 composites a second of a picture nobody is
  // watching. Hidden tabs are already stopped by the browser; an UNFOCUSED but
  // visible window is not, and that is exactly the second-monitor case. Both
  // stop here, and the motion picks up where it left off on the way back.
  //
  // Two independent reasons to park, kept as separate flags on purpose: an
  // About panel opened from END TIMES must not un-park the vista when it
  // closes. A single boolean did exactly that.
  let panelParked = false;
  let modeParked = false;
  const syncMotion = (forcePark) => {
    if (disposed) return;
    if (typeof forcePark === 'boolean') panelParked = forcePark;
    root.classList.toggle('mr-still', panelParked || modeParked || document.hidden || !document.hasFocus());
  };
  document.addEventListener('visibilitychange', syncMotion);
  window.addEventListener('blur', syncMotion);
  window.addEventListener('focus', syncMotion);
  syncMotion();

  // ---- the two modes -------------------------------------------------------
  // The home opens on the chooser; the story map and the END TIMES card are
  // both revealed FROM it, and a back control returns to it. One screen, three
  // states — not three screens: navigating away would dispose this home and
  // take its music and its painted vista with it.
  //
  // Regions outside the live mode are faded AND `inert`. Fading alone leaves
  // their buttons in the tab order and in the accessibility tree, so a hidden
  // story map would still answer a keyboard press — the same contract the
  // pause overlay and the About/Support panels already keep.
  const modesEl = ui.querySelector('.mr-modes');
  const etPanel = ui.querySelector('.mr-et-panel');
  const backBtn = ui.querySelector('[data-back]');
  const bibleParts = [ui.querySelector('.mr-panel'), ui.querySelector('.mr-ribbon-row'), roadWrap];
  let mode = null;

  function setMode(next, userInitiated = false) {
    if (mode === next) return;
    mode = next;
    const choosing = next === 'choose';
    root.classList.toggle('is-choosing', choosing);
    root.classList.toggle('is-bible', next === 'bible');
    root.classList.toggle('is-endtimes', next === 'endtimes');

    // ORDER MATTERS, IN BOTH DIRECTIONS. Clear inert first, THEN move focus:
    // `focus()` on an element still inside an inert subtree is a silent no-op,
    // so focusing before this ran left the keyboard on the screen wrapper with
    // nothing selected. And focus has to move at all, because inerting the
    // region the player just came from drops focus to <body> and strands the
    // tab order — the same contract the pause overlay and About/Support keep.
    modesEl.inert = !choosing;
    etPanel.inert = next !== 'endtimes';
    backBtn.inert = choosing;
    for (const el of bibleParts) if (el) el.inert = next !== 'bible';
    if (userInitiated) {
      const target = choosing
        ? modesEl.querySelector('[data-mode]')
        : next === 'bible' ? (startBtn.disabled ? backBtn : startBtn) : backBtn;
      target?.focus?.();
    }

    // END TIMES is a still, dark panel. Park the vista under it rather than
    // asking the compositor for a hundred layers a frame behind a veil.
    modeParked = next === 'endtimes';
    syncMotion();
  }

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
  // The chooser is the front door. The one exception is a story that failed to
  // load: the player was already on their way somewhere, and the retry notice
  // belongs beside the map it came from, not behind a mode card.
  setMode(params.loadError ? 'bible' : 'choose');
  // Fade in on the next frame so the transition has a starting value. A tab
  // that is still hidden gets no frames, so a timer backs it up — the map must
  // never be left sitting at opacity 0.
  const reveal = () => { if (!disposed) root.classList.add('is-in'); };
  // #about / #support still work as links: they land on the map and open
  // their panel over it, which is what they always should have done.
  if (params.openPanel) setTimeout(() => { if (!disposed) openPanel(params.openPanel); }, 260);
  requestAnimationFrame(reveal);
  const revealTimer = setTimeout(reveal, 80);

  function dispose() {
    disposed = true;
    closePanel?.();
    clearTimeout(revealTimer);
    // A drag frame queued on the way out would run against a torn-down screen.
    if (cameraFrame) { cancelAnimationFrame(cameraFrame); cameraFrame = 0; }
    window.removeEventListener('pointerdown', startBeds);
    window.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('visibilitychange', syncMotion);
    window.removeEventListener('blur', syncMotion);
    window.removeEventListener('focus', syncMotion);
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
