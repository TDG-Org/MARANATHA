// Home's stylesheet. Injected on entry, removed on dispose.
//
// The keyframes are the design project's, verbatim — they are what makes the
// vista breathe. THE LAW HERE: every one of them animates `transform` or
// `opacity` and nothing else. Those two are the only properties the compositor
// can animate without asking the main thread to paint, so a hundred of them
// running at once still costs no repaint. The design's marching road dashes
// (`stroke-dashoffset`) broke that law — one animation, but it re-rasterised
// the whole 2370x810 road path every frame, forever. It shimmers now instead.
//
// Two stops: `.mr-quiet` (reduced-motion) removes the motion; `.mr-still`
// pauses it while the window is hidden or unfocused, so a parked menu on a
// second monitor stops asking the compositor for frames it has no viewer for.

export const KEYFRAMES_CSS = `
@keyframes mrDrift { from { transform: translateX(-6%); } to { transform: translateX(6%); } }
@keyframes mrMote { 0% { transform: translate(0,0); opacity: 0; } 20% { opacity: .85; } 100% { transform: translate(46px,-120px); opacity: 0; } }
@keyframes mrSmoke { 0% { transform: translate(0,0) scale(.7); opacity: 0; } 25% { opacity: .5; } 100% { transform: translate(-26px,-96px) scale(1.9); opacity: 0; } }
@keyframes mrTwinkle { 0%,100% { opacity: .25; } 50% { opacity: .95; } }
@keyframes mrFlicker { 0%,100% { opacity: .58; } 28% { opacity: .95; } 52% { opacity: .72; } 74% { opacity: 1; } }
@keyframes mrWing { 0%,100% { transform: scaleY(.55); } 50% { transform: scaleY(1); } }
@keyframes mrGlow { 0%,100% { opacity: .45; } 50% { opacity: .8; } }
@keyframes mrEmber { 0% { transform: translate(0,0) scale(1); opacity: 0; } 12% { opacity: .95; } 70% { opacity: .5; } 100% { transform: translate(var(--dx,18px),-160px) scale(.4); opacity: 0; } }
@keyframes mrFly { 0%,100% { transform: translate(0,0); opacity: 0; } 15% { opacity: .9; } 40% { transform: translate(26px,-22px); opacity: .5; } 65% { transform: translate(-14px,-44px); opacity: .95; } 85% { opacity: .2; } }
@keyframes mrSway { 0%,100% { transform: rotate(-1.4deg); } 50% { transform: rotate(1.4deg); } }
@keyframes mrPulse { 0%,100% { opacity: .35; transform: scale(1); } 50% { opacity: .75; transform: scale(1.14); } }
@keyframes mrShoot { 0% { opacity: 0; transform: translate(0,0); } 1.5% { opacity: 1; } 6% { opacity: .85; } 9% { opacity: 0; transform: translate(440px,190px); } 100% { opacity: 0; transform: translate(440px,190px); } }
@keyframes mrShimmer { 0%,100% { opacity: .5; } 50% { opacity: .95; } }
`;

export const UI_CSS = `
/* --u scales the whole interface with the viewport, so the design's
   proportions survive a phone and an ultrawide alike (set by relayout). */
.mr-home {
  position: fixed; inset: 0; z-index: 20; --u: 1;
  color: #fdf6e3; font-family: 'Segoe UI', system-ui, sans-serif;
  background: #02040c; overflow: hidden;
  opacity: 0; transition: opacity 620ms ease;
}
.mr-home.is-in { opacity: 1; }
.mr-quiet .mr-band *, .mr-quiet .mr-band { animation: none !important; }
.mr-still .mr-band *, .mr-still .mr-band { animation-play-state: paused !important; }
/* The map behind an open About/Support panel. It is ALREADY parked by
   .mr-still before this applies, so the blur is rasterised once instead of
   re-running the convolution on every animated frame.
   And it is rasterised ONCE, not eighteen times: this used to carry a
   300ms filter transition, which re-ran a 7px convolution over the entire
   viewport on every frame of the fade. On a large screen that is the single
   most expensive thing the menu could possibly do, and it happened every time
   the player opened About. The panel's own fade covers the change. */
.mr-home.mr-behind-panel .mr-band { filter: blur(7px) saturate(.9) brightness(.66); }
.mr-home.mr-behind-panel .mr-ui { opacity: .25; transition: opacity 260ms ease; pointer-events: none; }

.mr-band { position: absolute; left: 0; top: 0; right: 0; overflow: hidden; }
.mr-stage {
  position: absolute; left: 0; top: 0; width: 1440px; height: 810px;
  transform-origin: 0 0; overflow: hidden;
  font-family: 'Segoe UI', system-ui, sans-serif; color: #fdf6e3;
}

/* The parallax bands and the road are the only things that move while panning.
   Promoting them means each is rasterised ONCE and then merely translated, so a
   drag costs a few layer moves instead of repainting the hillside every frame.
   They are clipped to the widest slice they can ever show (see clipWorld), so
   the promotion buys smoothness without holding six 6400px surfaces. */
.mr-stage [data-par], .mr-stage [data-road] {
  will-change: transform;
  backface-visibility: hidden;
}
.mr-stage [data-par] { overflow: hidden; }
/* the cloud band's soft edges spill outside its box on purpose */
.mr-stage [data-band="0"] { overflow: visible; }

/* ---- the road, and the only place a drag may grab ---- */
[data-roadwrap] { cursor: grab; touch-action: pan-y; }
[data-roadwrap].is-grabbing { cursor: grabbing; }

/* ---- chapter stops ---- */
.mr-node { transition: transform 260ms cubic-bezier(.2,.8,.3,1); }
.mr-node:hover { transform: translateY(-7px); }
.mr-node:hover [data-hoverglow], .mr-node:focus-visible [data-hoverglow] { opacity: 1; }
.mr-node.is-selected [data-circle] { outline: 2px solid rgba(255,240,214,.9); outline-offset: 7px; }
.mr-node:focus { outline: none; }
.mr-node:focus-visible [data-circle] { outline: 3px solid #fff6e6; outline-offset: 7px; }
/* stops past the gate are scenery, not choices — the road simply goes on */
.mr-node-beyond { opacity: .5; pointer-events: none; }

/* ---- the gate: where the road is barred until this story is walked ---- */
.mr-gate-sign {
  display: flex; align-items: center; gap: 12px; white-space: nowrap;
  transform: translateY(-50%);
}
.mr-gate-lock {
  font-size: 26px; line-height: 1;
  filter: drop-shadow(0 2px 8px rgba(4,14,22,.9));
}
.mr-gate-text {
  font: 600 15px 'Segoe UI', system-ui, sans-serif; color: #ffe9c9;
  letter-spacing: .04em; text-shadow: 0 2px 10px rgba(4,14,22,.95);
}
.mr-gate-text i {
  font: italic 400 12.5px Georgia, serif; color: rgba(253,246,227,.62);
  letter-spacing: .02em;
}
/* a small nudge when the player pushes against the gate */
.mr-gate-sign { transition: transform 320ms cubic-bezier(.2,.8,.3,1), opacity 320ms ease; opacity: .82; }
.at-gate .mr-gate-sign { transform: translateY(-50%) translateX(-8px); opacity: 1; }

/* ---- overlay ---- */
.mr-ui { position: absolute; inset: 0; pointer-events: none; }
.mr-ui button { pointer-events: auto; font-family: inherit; }
/* The chapter panel and the era ribbon sit OVER the map, so they have to catch
   the pointer themselves — otherwise a drag started on the blurb would grab the
   road underneath them. Everything else in the overlay stays transparent. */
.mr-panel, .mr-ribbon-row { pointer-events: auto; }

.mr-titleblock {
  position: absolute; left: 0; right: 0; top: calc(42px * var(--u));
  display: flex; flex-direction: column; align-items: center; gap: calc(13px * var(--u));
  padding: 0 16px;
}
.mr-title {
  font: 400 calc(56px * var(--u)) Georgia, 'Times New Roman', serif;
  letter-spacing: .44em; text-indent: .44em; color: #fff6e6;
  text-shadow: 0 4px 30px rgba(4,14,22,.6);
  transition: text-shadow 620ms ease, color 620ms ease;
}
.mr-tagline { display: flex; align-items: center; gap: calc(16px * var(--u)); max-width: 100%; }
.mr-tagline span {
  font: 400 calc(13px * var(--u)) 'Segoe UI', system-ui, sans-serif;
  letter-spacing: .24em; text-transform: uppercase; color: rgba(253,246,227,.66);
  text-align: center;
}
.mr-tagline i { flex: 0 0 auto; width: calc(56px * var(--u)); height: 1px; }
.mr-tagline i:first-child { background: linear-gradient(90deg, rgba(255,246,230,0), rgba(255,246,230,.6)); }
.mr-tagline i:last-child { background: linear-gradient(90deg, rgba(255,246,230,.6), rgba(255,246,230,0)); }

/* ---- the selected chapter ---- */
.mr-panel {
  position: absolute; left: calc(64px * var(--u)); top: calc(226px * var(--u));
  width: calc(404px * var(--u)); display: flex; flex-direction: column;
}
.mr-panel-top { display: flex; align-items: center; gap: calc(11px * var(--u)); flex-wrap: wrap; }
.mr-era {
  font: 600 calc(10.5px * var(--u)) 'Segoe UI', system-ui, sans-serif;
  letter-spacing: .26em; text-transform: uppercase; color: #241f38;
  background: rgba(255,233,201,.9); padding: calc(4px * var(--u)) calc(10px * var(--u));
  border-radius: 20px;
}
.mr-story-title {
  font: 400 calc(47px * var(--u)) Georgia, 'Times New Roman', serif;
  color: #fff6e6; line-height: 1.04; margin: calc(16px * var(--u)) 0 0;
}
.mr-passage {
  font: 400 calc(12.5px * var(--u)) 'Segoe UI', system-ui, sans-serif;
  letter-spacing: .16em; text-transform: uppercase; color: rgba(253,246,227,.56);
  margin-top: calc(13px * var(--u));
}
.mr-rule {
  width: calc(56px * var(--u)); height: 2px; background: #f2b880;
  margin: calc(20px * var(--u)) 0 calc(18px * var(--u));
}
.mr-blurb {
  font: italic 400 calc(16px * var(--u))/1.62 Georgia, serif;
  color: rgba(253,246,227,.9); text-wrap: pretty;
  min-height: calc(66px * var(--u)); margin: 0;
}

.mr-start {
  align-self: flex-start; margin-top: calc(26px * var(--u));
  position: relative; overflow: hidden;
  font: 700 calc(16px * var(--u)) 'Segoe UI', system-ui, sans-serif;
  letter-spacing: .14em; text-transform: uppercase;
  padding: calc(19px * var(--u)) calc(44px * var(--u));
  border-radius: calc(15px * var(--u)); border: 1px solid rgba(255,246,226,.5);
  cursor: pointer; color: #231a10;
  background: linear-gradient(150deg,#fff2d8 0%,#ffdca6 34%,#f2b880 62%,#e0a05f 100%);
  box-shadow: 0 14px 34px rgba(255,178,96,.3), 0 0 0 1px rgba(120,70,26,.18),
              inset 0 1px 0 rgba(255,255,255,.85), inset 0 -2px 6px rgba(150,88,32,.24);
  /* NO LAYOUT PROPERTY MAY BE TRANSITIONED HERE. This used to animate
     letter-spacing, which changes the button's intrinsic width — so hovering
     the one button the whole menu is built around ran a layout pass over the
     panel subtree on every frame of a 300ms transition, and the label visibly
     reflowed while it did. The glow stays: a box-shadow repaints one small
     element, which is a different order of cost from re-laying-out its parent. */
  transition: transform 220ms cubic-bezier(.2,.8,.3,1), box-shadow 300ms ease;
}
.mr-start::before {
  content: ''; position: absolute; left: -40%; top: -120%; width: 44%; height: 340%;
  background: linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,.5), rgba(255,255,255,0));
  transform: rotate(18deg); pointer-events: none;
}
.mr-start:hover:not(:disabled) { transform: translateY(-3px); }
.mr-start:active:not(:disabled) { transform: translateY(-1px); }
.mr-start.is-locked {
  background: rgba(255,255,255,.1); color: #fdf6e3; opacity: .6;
  cursor: default; box-shadow: none; border-color: rgba(255,255,255,.2);
}
.mr-start.is-locked::before { display: none; }

/* ---- the era ribbon ---- */
.mr-ribbon-row {
  position: absolute; right: calc(26px * var(--u)); bottom: calc(26px * var(--u));
  left: calc(472px * var(--u));
  height: calc(56px * var(--u)); display: flex; align-items: center; gap: calc(10px * var(--u));
}
.mr-nav {
  /* touch floor: --u bottoms out at 0.62 on phones, which scaled these to
     ~25px — interactive chrome floors at 44px, only the DECOR scales */
  flex: 0 0 auto; width: max(44px, calc(40px * var(--u))); height: max(44px, calc(40px * var(--u)));
  border-radius: 50%; display: flex; align-items: center; justify-content: center;
  font-size: calc(19px * var(--u)); line-height: 1; cursor: pointer; color: #fff6e6;
  background: #0a1a22; border: 1px solid rgba(255,232,190,.24); padding: 0;
  transition: background 200ms ease, border-color 200ms ease, transform 200ms ease;
}
.mr-nav:hover { background: #122a33; border-color: rgba(255,232,190,.7); }
.mr-nav[data-nav="prev"]:hover { transform: translateX(-2px); }
.mr-nav[data-nav="next"]:hover { transform: translateX(2px); }
.mr-ribbon { flex: 1 1 auto; display: flex; gap: calc(7px * var(--u)); height: 100%; min-width: 0; }
.mr-era-chip {
  display: flex; flex-direction: column; justify-content: center; gap: calc(7px * var(--u));
  padding: calc(8px * var(--u)) calc(12px * var(--u)); box-sizing: border-box;
  border-radius: calc(11px * var(--u)); cursor: pointer; min-width: 0; text-align: left;
  background: #0a1a22; border: 1px solid rgba(255,232,190,.16);
  transition: background 220ms ease, border-color 220ms ease;
}
.mr-era-chip:hover:not(:disabled) { background: #122a33; border-color: rgba(255,232,190,.6); }
.mr-era-chip.is-on { background: #2b2317; border-color: rgba(255,232,190,.65); }
/* eras beyond the gate: visibly shut, and not a target */
.mr-era-chip.is-shut { opacity: .42; cursor: default; border-style: dashed; }
.mr-era-chip.is-shut .mr-era-dots { opacity: .55; }
.mr-era-name {
  font: 600 calc(10.5px * var(--u)) 'Segoe UI', system-ui, sans-serif;
  letter-spacing: .2em; text-transform: uppercase; color: rgba(253,246,227,.6);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.mr-era-chip.is-on .mr-era-name { color: #ffeccd; }
.mr-era-dots { display: flex; align-items: center; gap: calc(4px * var(--u)); }
.mr-era-dots i { flex: 0 0 auto; border-radius: 50%; }

/* ---- chrome ---- */
.mr-links {
  position: absolute; top: calc(24px * var(--u) + env(safe-area-inset-top));
  left: calc(28px * var(--u) + env(safe-area-inset-left));
  display: flex; gap: calc(18px * var(--u));
}
.mr-links button {
  background: none; border: none; cursor: pointer; color: #fdf6e3; opacity: .72;
  font: 500 calc(13px * var(--u)) 'Segoe UI', system-ui, sans-serif;
  /* the type stays small; the HIT AREA meets the 44px touch floor */
  padding: 12px 8px; margin: -6px -6px; text-shadow: 0 1px 5px rgba(4,14,22,.8);
  transition: opacity 150ms ease;
}
.mr-links button:hover { opacity: 1; }
/* clears the persistent #volume control, which owns the top-right corner */
.mr-gear {
  position: absolute; top: calc(60px * var(--u) + env(safe-area-inset-top));
  right: calc(26px * var(--u) + env(safe-area-inset-right));
  width: max(44px, calc(38px * var(--u))); height: max(44px, calc(38px * var(--u)));
  border-radius: calc(11px * var(--u)); display: flex; align-items: center;
  justify-content: center; font-size: calc(18px * var(--u)); cursor: pointer;
  color: #fdf6e3; background: rgba(6,18,26,.6); border: 1px solid rgba(255,255,255,.14);
  padding: 0; transition: background 150ms ease;
}
.mr-gear:hover { background: rgba(18,42,51,.8); }
.mr-clock {
  position: absolute; top: calc(108px * var(--u) + env(safe-area-inset-top));
  right: calc(26px * var(--u) + env(safe-area-inset-right));
  font: 600 calc(9.5px * var(--u)) 'Segoe UI', system-ui, sans-serif;
  letter-spacing: .2em; text-transform: uppercase; color: rgba(253,246,227,.42);
  text-align: right;
}

.mr-notice {
  position: absolute; left: 50%; top: calc(150px * var(--u)); transform: translateX(-50%);
  pointer-events: auto; width: min(88vw, 440px); box-sizing: border-box;
  padding: 10px 12px; border-radius: 11px; display: flex; align-items: center;
  justify-content: center; gap: 10px; flex-wrap: wrap;
  background: rgba(55,25,24,.9); border: 1px solid rgba(255,184,150,.45);
  font-size: 13px; line-height: 1.35; text-align: center;
  box-shadow: 0 6px 20px rgba(0,0,0,.3);
}
.mr-notice-go { padding: 7px 10px; border-radius: 8px; border: 0; background: #f2b880; color: #241f38; font-weight: 650; cursor: pointer; }
.mr-notice-alt { padding: 7px 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,.32); background: transparent; color: #fdf6e3; font-weight: 600; cursor: pointer; }

/* ---- stacked: the map takes the top band, the chapter reads beneath it ---- */
.mr-home.is-stacked .mr-title {
  font-size: clamp(17px, 5vw, 30px); letter-spacing: .34em; text-indent: .34em;
}
.mr-home.is-stacked .mr-titleblock { top: calc(14px + env(safe-area-inset-top)); gap: 8px; }
.mr-home.is-stacked .mr-tagline span { font-size: clamp(8.5px, 2.3vw, 12px); letter-spacing: .18em; }
.mr-home.is-stacked .mr-tagline i { width: clamp(18px, 6vw, 44px); }
/* the sheet's top edge is measured by relayout so it always fits the screen.
   Horizontal padding honours the notch (viewport-fit=cover) — the sibling
   ribbon row below already did; the panel had been left out. */
.mr-home.is-stacked .mr-panel {
  left: 0; right: 0; width: auto;
  padding: calc(14px * var(--u))
    max(calc(20px * var(--u)), env(safe-area-inset-right))
    0
    max(calc(20px * var(--u)), env(safe-area-inset-left));
  box-sizing: border-box;
}
.mr-home.is-stacked .mr-story-title { font-size: calc(34px * var(--u)); margin-top: calc(8px * var(--u)); }
.mr-home.is-stacked .mr-rule { margin: calc(12px * var(--u)) 0 calc(10px * var(--u)); }
.mr-home.is-stacked .mr-blurb { font-size: calc(14px * var(--u)); min-height: calc(56px * var(--u)); }
.mr-home.is-stacked .mr-start {
  align-self: stretch; text-align: center; margin-top: calc(14px * var(--u));
  padding: calc(15px * var(--u)) calc(20px * var(--u));
}
.mr-home.is-stacked .mr-ribbon-row {
  left: calc(12px + env(safe-area-inset-left)); right: calc(12px + env(safe-area-inset-right));
  bottom: calc(10px + env(safe-area-inset-bottom)); height: calc(46px * var(--u));
}
.mr-home.is-stacked .mr-clock { display: none; }
.mr-home.is-stacked .mr-gear {
  /* floored below the persistent #volume box: its 44px coarse-pointer button
     reaches ~y52, and 52px*u at u=0.62 put the gear underneath it */
  top: max(calc(52px * var(--u) + env(safe-area-inset-top)), calc(58px + env(safe-area-inset-top)));
}
`;
