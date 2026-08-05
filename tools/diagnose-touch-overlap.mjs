// CAN THE PLAYER ACTUALLY PRESS THE THING?
//
// A review found that a new bottom-centre panel sat entirely on top of the
// touch joystick and swallowed its presses — a player on a phone could not
// move. It was found by MEASURING rects in a real browser; reading the code had
// missed it twice. So the fix gets measured the same way, and so does every
// other overlay the game can put on screen.
//
// For each interactive control this asks the only question that matters:
// at its centre, what does document.elementFromPoint() actually return?
//
// Usage:  npm run dev   (in another terminal)
//         node tools/diagnose-touch-overlap.mjs
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.argv[2] || process.env.DIAG_URL || 'http://localhost:1225';
const PORT = Number(process.env.DIAG_CDP_PORT || 9460);
// Force the software path so the GPU notice is on screen: it is the newest
// overlay and the one that caused the bug.
const FLAGS = ['--use-angle=d3d11-warp-webgl', '--disable-gpu-compositing'];

const CHROME = [
  `${process.env.ProgramFiles}\\Google\\Chrome\\Application\\chrome.exe`,
  `${process.env['ProgramFiles(x86)']}\\Google\\Chrome\\Application\\chrome.exe`,
].find((p) => p && existsSync(p));
if (!CHROME) throw new Error('no Chrome');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class CDP {
  constructor(ws) {
    this.ws = ws; this.seq = 0; this.pending = new Map();
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      const w = m.id && this.pending.get(m.id);
      if (!w) return;
      this.pending.delete(m.id);
      m.error ? w.reject(new Error(`${m.error.message} (${w.method})`)) : w.resolve(m.result);
    };
  }
  static async attach(url) {
    const ws = new WebSocket(url);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('no socket')); });
    return new CDP(ws);
  }
  send(method, params = {}) {
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, method });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
}
async function evaluate(cdp, expression) {
  const r = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result?.value;
}
async function waitFor(cdp, expr, label, timeout = 60000) {
  const t0 = Date.now();
  for (;;) {
    let ok = false;
    try { ok = await evaluate(cdp, expr); } catch { /* nav */ }
    if (ok) return;
    if (Date.now() - t0 > timeout) throw new Error(`timed out: ${label}`);
    await sleep(200);
  }
}

// Describe every fixed/absolute overlay, and for each interactive control ask
// what is actually on top of it.
const AUDIT = `(() => {
  const describe = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      cls: (el.className && String(el.className).slice(0, 28)) || el.id || el.tagName,
      rect: [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)],
      z: cs.zIndex, pe: cs.pointerEvents, vis: cs.visibility, op: cs.opacity,
      visible: r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.01,
    };
  };
  const owner = (x, y) => {
    const el = document.elementFromPoint(x, y);
    if (!el) return 'nothing';
    // Walk up to the nearest identifiable surface.
    let n = el;
    for (let i = 0; i < 6 && n; i += 1) {
      const c = n.className && String(n.className);
      if (c && /mr-/.test(c)) return c.split(/\\s+/).find((s) => s.startsWith('mr-')) || c;
      if (n.id) return '#' + n.id;
      if (n.tagName === 'CANVAS') return 'canvas';
      n = n.parentElement;
    }
    return el.tagName.toLowerCase();
  };

  // The controls a player must be able to press.
  const controls = {};
  // The joystick is an UNCLASSED div with inline styles (src/ui/joystick.js),
  // so it can only be found by what it looks like: a fixed, round, z-35 box
  // parented straight to <body>.
  const findStick = () => [...document.body.children].find((el) => {
    const cs = getComputedStyle(el);
    return cs.position === 'fixed' && cs.zIndex === '35' && cs.borderRadius.includes('50%');
  });
  const stickBase = findStick();
  if (stickBase) controls.joystick = stickBase;
  const prompt = document.querySelector('.mr-prompt, [class*="prompt"]');
  if (prompt) controls.talkPrompt = prompt;
  const home = document.querySelector('.mr-home-btn, #homeBtn, [aria-label*="Home" i]');
  if (home) controls.homeButton = home;
  const gear = document.querySelector('[aria-label*="Settings" i]');
  if (gear) controls.gear = gear;
  const skip = document.querySelector('.mr-skipbtn');
  if (skip) controls.skip = skip;

  const out = { viewport: [innerWidth, innerHeight], controls: {}, overlays: [] };
  for (const [name, el] of Object.entries(controls)) {
    const d = describe(el);
    if (!d || !d.visible) { out.controls[name] = { present: false }; continue; }
    const cx = Math.round((d.rect[0] + d.rect[2]) / 2);
    const cy = Math.round((d.rect[1] + d.rect[3]) / 2);
    out.controls[name] = { present: true, rect: d.rect, centre: [cx, cy], ownerAtCentre: owner(cx, cy) };
  }
  // Every fixed/absolute thing currently on screen, for context.
  for (const el of document.body.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    if (cs.position !== 'fixed' && cs.position !== 'absolute') continue;
    if (el.parentElement !== document.body) continue; // top-level surfaces only
    const d = describe(el);
    if (d && d.visible) out.overlays.push(d);
  }
  return out;
})()`;

const profile = join(tmpdir(), `maranatha-touch-${process.pid}`);
mkdirSync(profile, { recursive: true });
const chrome = spawn(CHROME, [
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--mute-audio',
  '--autoplay-policy=no-user-gesture-required', ...FLAGS,
  '--headless=new', '--window-size=420,900', 'about:blank',
], { stdio: 'ignore' });

const report = {};
let cdp = null;
try {
  let target = null;
  for (let i = 0; i < 100 && !target; i += 1) {
    await sleep(250);
    try {
      const list = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json());
      target = list.find((t) => t.type === 'page');
    } catch { /* not up */ }
  }
  cdp = await CDP.attach(target.webSocketDebuggerUrl);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  for (const [w, h, label] of [[390, 844, 'phone portrait'], [844, 390, 'phone landscape'], [360, 640, 'small phone']]) {
    // mobile:true + touch emulation is what makes `(pointer: coarse)` match,
    // which is the condition the joystick mounts under.
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: w, height: h, deviceScaleFactor: 2, mobile: true,
    });
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await cdp.send('Page.navigate', { url: 'about:blank' });
    await sleep(250);
    await cdp.send('Page.navigate', { url: BASE });
    await waitFor(cdp, 'document.readyState === "complete"', 'shell');
    await evaluate(cdp, `(() => {
      const s = JSON.parse(localStorage.getItem('maranatha-settings-v1') || '{}');
      s.hud = false; localStorage.setItem('maranatha-settings-v1', JSON.stringify(s));
      localStorage.setItem('maranatha-save-v1', JSON.stringify({ checkpoints: { joseph3d: 1 } }));
      localStorage.removeItem('maranatha-gpu-notice-dismissed');
      return true; })()`);
    await cdp.send('Page.navigate', { url: 'about:blank' });
    await sleep(200);
    await cdp.send('Page.navigate', { url: `${BASE}/#joseph` });
    await waitFor(cdp, `(() => { const c = document.querySelector('#app canvas');
      return !!c && c.width > 200 && getComputedStyle(c).visibility !== 'hidden'; })()`, 'scene');
    await sleep(9000);

    const audit = await evaluate(cdp, AUDIT);

    // The decisive test: does a real touch at the stick's centre reach it?
    const moved = await evaluate(cdp, `(() => {
      const el = [...document.body.children].find((n) => {
        const cs = getComputedStyle(n);
        return cs.position === 'fixed' && cs.zIndex === '35' && cs.borderRadius.includes('50%');
      });
      if (!el) return 'no joystick';
      const r = el.getBoundingClientRect();
      const x = Math.round((r.left + r.right) / 2), y = Math.round((r.top + r.bottom) / 2);
      const hit = document.elementFromPoint(x, y);
      let reached = false;
      const mark = () => { reached = true; };
      window.addEventListener('pointerdown', mark, true);
      hit?.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1, pointerType: 'touch', isPrimary: true,
      }));
      window.removeEventListener('pointerdown', mark, true);
      const inStick = !!(hit && el.contains(hit));
      return { x, y, hitClass: hit ? (String(hit.className) || hit.tagName) : null, hitIsStick: inStick, dispatched: reached };
    })()`);

    // ...and the notice must not survive leaving the scene.
    const gpuBefore = await evaluate(cdp, `!!document.querySelector('.mr-gpu-notice')`);
    await evaluate(cdp, `window.__MARANATHA.app.navigate('home')`).catch(() => null);
    await sleep(2500);
    const gpuAfter = await evaluate(cdp, `!!document.querySelector('.mr-gpu-notice')`);

    report[label] = { viewport: audit.viewport, controls: audit.controls, touch: moved,
      noticeInScene: gpuBefore, noticeStrandedOnHome: gpuAfter,
      overlays: audit.overlays.map((o) => `${o.cls} z=${o.z} pe=${o.pe} [${o.rect.join(',')}]`) };
  }
  console.log(JSON.stringify(report, null, 2));
} finally {
  try { cdp?.ws.close(); } catch { /* gone */ }
  chrome.kill();
  await sleep(400);
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* locked */ }
}
