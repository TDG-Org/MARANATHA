// What the PLAYER actually sees, sampled from the game's own #debug readout.
//
// The first diagnosis measured the ark while standing still and found 28.8fps
// with eco:true — which is the governor working as designed, not the bug. It
// also ran its own requestAnimationFrame chain to count frames, and THAT IS AN
// ARTEFACT: a continuous rAF chain forces callbacks at the panel's rate, which
// is exactly the signal the pacer's refresh estimator feeds on. The probe was
// propping up the thing it was measuring.
//
// So this one samples on a TIMER, never rAF, and reads the game's own #debug
// line - the same string on the user's screen: fps + eco label, measured
// display Hz -> paced fps, script vs submit split, draws/tris, pixelRatio, GPU.
// It samples idle AND while walking (full rate), in the heaviest scene.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.argv[2] || process.env.DIAG_URL || 'http://localhost:1225';
const PORT = Number(process.env.DIAG_CDP_PORT || 9445);
const WIDTH = Number(process.env.DIAG_W || 3840);
const HEIGHT = Number(process.env.DIAG_H || 1080);

// Which browser matters: the user's default is Edge, and a Chromium fork can
// differ in compositor and power policy even on identical page code.
const BROWSERS = {
  chrome: [
    `${process.env.ProgramFiles}\\Google\\Chrome\\Application\\chrome.exe`,
    `${process.env['ProgramFiles(x86)']}\\Google\\Chrome\\Application\\chrome.exe`,
    `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
  ],
  edge: [
    `${process.env.ProgramFiles}\\Microsoft\\Edge\\Application\\msedge.exe`,
    `${process.env['ProgramFiles(x86)']}\\Microsoft\\Edge\\Application\\msedge.exe`,
  ],
};
const WHICH = (process.env.DIAG_BROWSER || 'chrome').toLowerCase();
const CHROME = (BROWSERS[WHICH] || BROWSERS.chrome).find((p) => p && existsSync(p));
if (!CHROME) throw new Error(`no ${WHICH} found`);

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
    if (ok) return Date.now() - t0;
    if (Date.now() - t0 > timeout) throw new Error(`timed out: ${label}`);
    await sleep(200);
  }
}

// Sampled on a TIMER so nothing here drives rAF.
const READ_DEBUG = `(() => {
  const el = document.getElementById('debug');
  const M = window.__MARANATHA;
  return {
    debug: el ? el.textContent.replace(/\\s+/g, ' ').trim() : null,
    fps: M && M.app && M.app.power ? M.app.power.fps : null,
    eco: M && M.app && M.app.power ? M.app.power.eco : null,
    notice: (() => { const n = document.querySelector('.mr-gpu-notice');
      return n ? (n.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 90) : null; })(),
  };
})()`;

async function sample(cdp, seconds, label) {
  const rows = [];
  const end = Date.now() + seconds * 1000;
  while (Date.now() < end) {
    rows.push(await evaluate(cdp, READ_DEBUG));
    await sleep(500);
  }
  const fps = rows.map((r) => r.fps).filter((v) => typeof v === 'number');
  fps.sort((a, b) => a - b);
  return {
    label,
    samples: rows.length,
    fpsMin: fps[0] ?? null,
    fpsMedian: fps[fps.length >> 1] ?? null,
    fpsMax: fps[fps.length - 1] ?? null,
    ecoSeen: [...new Set(rows.map((r) => r.eco))],
    lastDebug: rows[rows.length - 1]?.debug ?? null,
    notice: rows.map((r) => r.notice).find(Boolean) ?? null,
  };
}

const key = (cdp, type, code, keyCode) => cdp.send('Input.dispatchKeyEvent', {
  type, code, key: code === 'KeyW' ? 'w' : code, windowsVirtualKeyCode: keyCode,
  nativeVirtualKeyCode: keyCode,
});

const profile = join(tmpdir(), `maranatha-live-${process.pid}`);
mkdirSync(profile, { recursive: true });
const chrome = spawn(CHROME, [
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--mute-audio',
  '--autoplay-policy=no-user-gesture-required',
  `--window-size=${WIDTH},${HEIGHT}`, '--window-position=0,0',
  // DIAG_FLAGS reproduces a player's real browser state. The one that matters:
  //   --use-angle=d3d11-warp-webgl --disable-gpu-compositing
  // which is exactly what Edge runs with "use graphics acceleration" turned
  // OFF — a CPU rasterizer. Every probe this repo ever ran used a fresh
  // profile, which defaults acceleration ON, so no automated measurement in
  // the project's history could reproduce the condition being reported.
  ...(process.env.DIAG_FLAGS ? process.env.DIAG_FLAGS.split(' ').filter(Boolean) : []),
  '--new-window', 'about:blank',
], { stdio: 'ignore' });

const out = {};
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

  for (const scene of [
    { hash: '#joseph', beat: 1, name: 'joseph-camp (heaviest, 95 draws)' },
    { hash: '#noah', beat: null, name: 'noah-ark' },
  ]) {
    await cdp.send('Page.navigate', { url: 'about:blank' });
    await sleep(300);
    await cdp.send('Page.navigate', { url: BASE });
    await waitFor(cdp, 'document.readyState === "complete"', 'shell');
    await evaluate(cdp, `(() => {
      const s = JSON.parse(localStorage.getItem('maranatha-settings-v1') || '{}');
      s.hud = true; localStorage.setItem('maranatha-settings-v1', JSON.stringify(s));
      ${scene.beat !== null
        ? `localStorage.setItem('maranatha-save-v1', JSON.stringify({ checkpoints: { joseph3d: ${scene.beat} } }));`
        : ''}
      return true; })()`);
    await cdp.send('Page.navigate', { url: 'about:blank' });
    await sleep(250);
    await cdp.send('Page.navigate', { url: BASE + '/' + scene.hash });
    await waitFor(cdp, `(() => { const c = document.querySelector('#app canvas');
      return !!c && c.width > 200 && getComputedStyle(c).visibility !== 'hidden'; })()`, scene.hash);
    await sleep(9000); // settle: scene entry grace is 3s, adaptive quality needs frames

    const idle = await sample(cdp, 6, `${scene.name} — IDLE`);
    // Hold W: real key events, no keyUp, so the controller keeps moving.
    await key(cdp, 'keyDown', 'KeyW', 87);
    await sleep(1500);
    const walking = await sample(cdp, 8, `${scene.name} — WALKING (full rate)`);
    await key(cdp, 'keyUp', 'KeyW', 87);
    out[scene.hash] = { idle, walking };
  }
  console.log(JSON.stringify(out, null, 2));
} finally {
  try { cdp?.ws.close(); } catch { /* gone */ }
  chrome.kill();
  await sleep(500);
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* locked */ }
}
