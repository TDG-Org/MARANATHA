import { Audio } from '../systems/AudioSystem.js';

// ABOUT + SUPPORT — panels the LIVE home owns.
//
// They were screens once: each built a sky, ridges, ground, sun and sixty
// drifting motes, and kept the renderer submitting frames while somebody read
// three paragraphs. Then they were flat screens with a still copy of the vista
// painted behind them — which still NAVIGATED, and Nate caught what that costs:
// *"it does pop out but on their own pages because the music also stops and i
// dont see the home page in the background even though it's blurred"*.
//
// Navigating disposes the home. The home owns the menu music, so the music
// stopped; and "the background" was a photograph of the home rather than the
// home. So these do not navigate at all now. `openPanel()` mounts an overlay
// over the running home: its music keeps playing, its vista is the real one
// behind the glass, and closing is just un-mounting a div.
//
// The blur is affordable because of the order it is done in: the vista is
// PARKED first (the existing `.mr-still` class stops every animation), and only
// then blurred. A still layer is rasterised once and composited; blurring a
// layer that is still animating would re-run the convolution every frame, which
// is the one thing this project forbids over live content.
//
// Static-site friendly: Support uses a Stripe PAYMENT LINK (no backend). Nate
// replaces STRIPE_PAYMENT_LINK below.
export const STRIPE_PAYMENT_LINK = 'https://buy.stripe.com/REPLACE_WITH_YOUR_LINK';

function popout({ onClose, heading, passage }) {
  const root = document.createElement('div');
  root.className = 'mr-page';
  root.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:40', 'display:flex',
    'align-items:center', 'justify-content:center', 'padding:20px',
    'box-sizing:border-box', 'color:#fdf6e3',
    'font-family:"Segoe UI",system-ui,sans-serif',
    'opacity:0', 'transition:opacity 320ms ease',
  ].join(';');

  // Only a dim wash here. The blur belongs to the REAL home underneath, which
  // stays mounted and keeps playing its music; the home applies it to its own
  // vista after parking the animations (see openPanel's caller).
  const behind = document.createElement('div');
  behind.style.cssText = 'position:absolute; inset:0; background:rgba(3,6,16,.42);';
  root.append(behind);

  // the card
  const card = document.createElement('div');
  card.style.cssText = [
    'position:relative', 'width:min(92vw,620px)', 'max-height:86vh', 'overflow:auto',
    'padding:34px 34px 30px', 'box-sizing:border-box',
    'background:rgba(10,26,34,0.94)', 'border:1px solid rgba(255,232,190,0.18)',
    'border-radius:18px', 'box-shadow:0 24px 70px rgba(0,0,0,0.55)',
    'transform:translateY(12px)', 'transition:transform 320ms cubic-bezier(.2,.8,.3,1)',
  ].join(';');

  const title = document.createElement('div');
  title.textContent = heading;
  title.style.cssText = [
    'font:400 clamp(26px,4.4vw,40px) Georgia,"Times New Roman",serif',
    'color:#fff6e6', 'letter-spacing:.04em', 'margin:0 44px 6px 0',
  ].join(';');
  card.append(title);

  if (passage) {
    const sub = document.createElement('div');
    sub.textContent = passage;
    sub.style.cssText = [
      'font:400 12.5px "Segoe UI",system-ui,sans-serif', 'letter-spacing:.16em',
      'text-transform:uppercase', 'color:rgba(253,246,227,.56)', 'margin-bottom:18px',
    ].join(';');
    card.append(sub);
  }

  const rule = document.createElement('div');
  rule.style.cssText = 'width:56px; height:2px; background:#f2b880; margin:0 0 20px;';
  card.append(rule);

  const body = document.createElement('div');
  body.style.cssText = 'font:400 15.5px/1.66 Georgia,serif; color:rgba(253,246,227,.92);';
  card.append(body);

  // the small X, top right of the card
  const close = document.createElement('button');
  close.type = 'button';
  close.setAttribute('aria-label', `Close ${heading}`);
  close.textContent = '✕';
  close.style.cssText = [
    'position:absolute', 'top:14px', 'right:14px',
    'width:34px', 'height:34px', 'border-radius:10px', 'padding:0',
    'display:flex', 'align-items:center', 'justify-content:center',
    'font:400 16px/1 "Segoe UI",system-ui,sans-serif', 'color:#fdf6e3',
    'background:transparent', 'border:1px solid rgba(255,255,255,0.14)',
    'cursor:pointer', 'transition:background 150ms ease,border-color 150ms ease',
  ].join(';');
  close.onpointerenter = () => {
    close.style.background = 'rgba(255,255,255,0.09)';
    close.style.borderColor = 'rgba(255,232,190,0.55)';
  };
  close.onpointerleave = () => {
    close.style.background = 'transparent';
    close.style.borderColor = 'rgba(255,255,255,0.14)';
  };
  card.append(close);

  root.append(card);
  document.body.append(root);
  requestAnimationFrame(() => {
    root.style.opacity = '1';
    card.style.transform = 'translateY(0)';
  });

  // Closing is a local un-mount, not a navigation, so it is instant and can
  // never be refused by a router that happens to be busy.
  const leave = () => {
    Audio.uiClick?.();
    onClose();
  };

  close.onclick = leave;
  // anywhere outside the card returns to the map
  root.onclick = (e) => { if (e.target === root || behind.contains(e.target)) leave(); };
  const onKey = (e) => { if (e.key === 'Escape') leave(); };
  window.addEventListener('keydown', onKey);

  const cleanup = () => {
    window.removeEventListener('keydown', onKey);
    root.remove();
  };
  return { body, cleanup };
}

export function openAboutPanel({ onClose }) {
  const { body, cleanup } = popout({
    onClose, heading: 'About MARANATHA', passage: '“Maranatha — Come, Lord.”',
  });
  body.innerHTML = `
    <p style="margin:0 0 14px;"><strong>MARANATHA</strong> is a Bible game — a biblically accurate
    browser world that lets you <em>walk through the Bible</em> — so you come to know God, the people
    of that time, and how His promise always comes true.</p>
    <p style="margin:0 0 14px;">It's built to be <strong>free and open to everyone</strong>: no login,
    no cost, no barrier. You just start playing. Every scene shows the real Scripture on screen and
    stays faithful to the text — the goal is to help people meet God in His own story, not to preach.</p>
    <p style="margin:0 0 14px;">The first playable story is <strong>Joseph</strong> (Genesis 37–50) —
    a favored son, betrayed and cast down, who is raised up to save the very brothers who wronged him.
    “You meant evil against me, but God meant it for good.” (Genesis 50:20)</p>
    <p style="margin:0 0 14px; opacity:0.82;">Your progress is kept in <strong>your own browser
    only</strong> — there is no account, and nothing is ever sent to a server.</p>
    <p style="margin:0; opacity:0.82;">Made with care, for the God who keeps His promises. <em>Come, Lord.</em></p>
  `;
  return cleanup;
}

export function openSupportPanel({ onClose }) {
  const { body, cleanup } = popout({
    onClose, heading: 'Support MARANATHA', passage: 'Keep it free for everyone',
  });
  body.innerHTML = `
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
  btn.onclick = (e) => {
    e.stopPropagation(); // the button is not "outside the card"
    Audio.uiClick?.();
    if (STRIPE_PAYMENT_LINK.includes('REPLACE')) {
      note.textContent = 'The support link isn’t set up yet — check back soon. 🙏';
    } else {
      window.open(STRIPE_PAYMENT_LINK, '_blank', 'noopener');
    }
  };
  body.append(btn, note);
  return cleanup;
}
