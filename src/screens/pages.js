import * as THREE from 'three';
import { makeSky, makeRidges, makeGround, makeSun, makeMotes } from '../engine/world.js';
import { Audio } from '../systems/AudioSystem.js';

// About / Support — simple content pages over the same golden-hour backdrop as
// home, matching its calm style. Static-site friendly: the Support page uses a
// Stripe PAYMENT LINK (no backend). Nate replaces STRIPE_PAYMENT_LINK below.
export const STRIPE_PAYMENT_LINK = 'https://buy.stripe.com/REPLACE_WITH_YOUR_LINK';

function backdrop(scene) {
  scene.fog = new THREE.Fog(0xffdfba, 46, 250);
  const sky = makeSky({ top: 0xf2b880, bottom: 0xffe9c9 });
  scene.add(sky.mesh);
  scene.add(makeGround());
  scene.add(makeRidges());
  scene.add(makeSun());
  const motes = makeMotes({ count: 60 });
  scene.add(motes.points);
  return { sky, motes };
}

function pageShell({ app, camera, heading, passage }) {
  camera.position.set(0, 4.6, 18);
  camera.lookAt(0, 3.4, -24);

  const root = document.createElement('div');
  root.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:20', 'pointer-events:none',
    'color:#fdf6e3', 'font-family:"Segoe UI",system-ui,sans-serif',
    'display:flex', 'flex-direction:column', 'align-items:center',
    'opacity:0', 'transition:opacity 500ms ease',
  ].join(';');

  const h = document.createElement('div');
  h.textContent = heading;
  h.style.cssText = [
    'margin-top:8vh', 'font-family:Georgia,"Times New Roman",serif',
    'font-size:clamp(26px,5vw,44px)', 'letter-spacing:0.22em',
    'text-shadow:0 2px 12px rgba(15,12,26,0.5)',
  ].join(';');
  if (passage) {
    const p = document.createElement('div');
    p.textContent = passage;
    p.style.cssText = 'margin-top:9px; font-size:clamp(11px,1.6vw,14px); letter-spacing:0.16em; opacity:0.7;';
    root.append(h, p);
  } else {
    root.append(h);
  }

  const card = document.createElement('div');
  card.style.cssText = [
    'pointer-events:auto', 'width:min(92vw,600px)', 'max-height:64vh', 'overflow-y:auto',
    'margin:26px 20px', 'padding:24px 26px', 'text-align:left', 'line-height:1.62',
    'font-size:clamp(14px,1.9vw,16px)',
    'background:rgba(16,14,26,0.5)', 'border:1px solid rgba(242,184,128,0.18)',
    'border-radius:16px', 'backdrop-filter:blur(4px)', 'box-shadow:0 10px 34px rgba(0,0,0,0.32)',
  ].join(';');

  const back = document.createElement('button');
  back.type = 'button';
  back.textContent = '⌂  Home';
  back.style.cssText = [
    'position:fixed', 'top:calc(14px + env(safe-area-inset-top))', 'left:calc(14px + env(safe-area-inset-left))',
    'z-index:22', 'pointer-events:auto', 'padding:10px 16px', 'border-radius:11px', 'cursor:pointer',
    'font:600 14px "Segoe UI",system-ui,sans-serif', 'color:#fdf6e3',
    'background:rgba(16,14,26,0.55)', 'border:1px solid rgba(255,255,255,0.14)', 'backdrop-filter:blur(3px)',
    'transition:background 150ms ease',
  ].join(';');
  back.onmouseenter = () => { back.style.background = 'rgba(30,26,44,0.7)'; };
  back.onmouseleave = () => { back.style.background = 'rgba(16,14,26,0.55)'; };
  back.onclick = () => { Audio.uiClick?.(); app.navigate('home'); };

  root.append(card);
  document.body.append(root, back);
  requestAnimationFrame(() => { root.style.opacity = '1'; });
  return { root, back, card, cleanup: () => { root.remove(); back.remove(); } };
}

export function buildAbout({ scene, camera, app }) {
  const bg = backdrop(scene);
  const { card, cleanup } = pageShell({ app, camera, heading: 'About MARANATHA', passage: '“Maranatha — Come, Lord.”' });
  card.innerHTML = `
    <p style="margin:0 0 14px;"><strong>MARANATHA</strong> is a biblically accurate browser game that
    lets you <em>walk through the real events of the Bible</em> — so you come to know God, the people
    of that time, and how His promise always comes true.</p>
    <p style="margin:0 0 14px;">It's built to be <strong>free and open to everyone</strong>: no login,
    no cost, no barrier. You just start playing. Every scene shows the real Scripture on screen and
    stays faithful to the text — the goal is to help people meet God in His own story, not to preach.</p>
    <p style="margin:0 0 14px;">The first playable story is <strong>Joseph</strong> (Genesis 37–50) —
    a favored son, betrayed and cast down, who is raised up to save the very brothers who wronged him.
    “You meant evil against me, but God meant it for good.” (Genesis 50:20)</p>
    <p style="margin:0; opacity:0.82;">Made with care, for the God who keeps His promises. <em>Come, Lord.</em></p>
  `;
  const motes = bg.motes;
  return {
    update(dt, tMs) { bg.sky.update(dt); motes.update(dt, tMs / 1000); },
    dispose() { cleanup(); },
  };
}

export function buildSupport({ scene, camera, app }) {
  const bg = backdrop(scene);
  const { card, cleanup } = pageShell({ app, camera, heading: 'Support MARANATHA', passage: 'Keep it free for everyone' });
  card.innerHTML = `
    <p style="margin:0 0 14px;">MARANATHA is <strong>free, with no ads and no accounts</strong> — and
    we want to keep it that way. If it has blessed you, a gift helps cover the time and hosting to
    build the rest of the Bible's stories and keep the doors open to everyone.</p>
    <p style="margin:0 0 18px; opacity:0.82;">Every bit goes straight into making more of the story.
    Thank you for walking with us.</p>
  `;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = '❤  Support the project';
  btn.style.cssText = [
    'display:block', 'width:100%', 'padding:14px', 'border-radius:12px', 'cursor:pointer', 'border:none',
    'font:700 16px "Segoe UI",system-ui,sans-serif', 'color:#241f38', 'background:#f2b880',
    'transition:filter 150ms ease, transform 150ms ease',
  ].join(';');
  btn.onmouseenter = () => { btn.style.filter = 'brightness(1.07)'; btn.style.transform = 'translateY(-1px)'; };
  btn.onmouseleave = () => { btn.style.filter = 'none'; btn.style.transform = 'none'; };
  const note = document.createElement('div');
  note.style.cssText = 'margin-top:12px; font-size:12.5px; opacity:0.6; text-align:center;';
  btn.onclick = () => {
    Audio.uiClick?.();
    if (STRIPE_PAYMENT_LINK.includes('REPLACE')) {
      note.textContent = 'The support link isn’t set up yet — check back soon. 🙏';
    } else {
      window.open(STRIPE_PAYMENT_LINK, '_blank', 'noopener');
    }
  };
  card.append(btn, note);
  const motes = bg.motes;
  return {
    update(dt, tMs) { bg.sky.update(dt); motes.update(dt, tMs / 1000); },
    dispose() { cleanup(); },
  };
}
