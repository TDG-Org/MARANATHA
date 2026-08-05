// Does the game get SLOWER the longer you play it?
//
// Every measurement so far ran for about twenty seconds and found 72fps. A
// player runs for minutes and changes scene repeatedly. Two classic causes look
// exactly like "my gaming PC only gets 15fps" and neither shows up in a short
// run:
//
//   1. A per-frame leak - geometries, textures, shader programs or DOM nodes
//      accumulating until the driver thrashes.
//   2. LEAKED WEBGL CONTEXTS. A browser allows only a handful (~16) per page.
//      Create one per scene entry without losing the old one and the browser
//      silently EVICTS the oldest - or falls back to software - and everything
//      collapses with no error in the console.
//
// So: play for minutes, bounce between scenes, and watch the resource counts
// alongside the frame rate. Samples on a timer, never rAF.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.argv[2] || process.env.DIAG_URL || 'http://localhost:1225';
const PORT = Number(process.env.DIAG_CDP_PORT || 9447);
const MINUTES = Number(process.env.DIAG_MINUTES || 4);
const CYCLES = Number(process.env.DIAG_CYCLES || 6);

const BROWSERS = {
  chrome: [`${process.env.ProgramFiles}\\Google\\Chrome\\Application\\chrome.exe`,
    `${process.env['ProgramFiles(x86)']}\\Google\\Chrome\\Application\\chrome.exe`],
  edge: [`${process.env.ProgramFiles}\\Microsoft\\Edge\\Application\\msedge.exe`,
    `${process.env['ProgramFiles(x86)']}\\Microsoft\\Edge\\Application\\msedge.exe`],
};
const WHICH = (process.env.DIAG_BROWSER || 'chrome').toLowerCase();
const EXE = (BROWSERS[WHICH] || BROWSERS.chrome).find((p) => p && existsSync(p));
if (!EXE) throw new Error(`no ${WHICH}`);

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

// Count live WebGL contexts by asking every canvas on the page, plus the
// resource counters three.js keeps. `canvasCount` catches an orphaned canvas
// that was never removed from the document.
const STATS = `(() => {
  const M = window.__MARANATHA;
  const info = M && M.app && M.app.scene ? null : null;
  const canvases = [...document.querySelectorAll('canvas')];
  const r = window.__DIAG_RENDERER;
  const mem = r ? r.info.memory : null;
  return {
    fps: M && M.app && M.app.power ? M.app.power.fps : null,
    eco: M && M.app && M.app.power ? M.app.power.eco : null,
    canvases: canvases.length,
    geometries: mem ? mem.geometries : null,
    textures: mem ? mem.textures : null,
    programs: r && r.info.programs ? r.info.programs.length : null,
    calls: r ? r.info.render.calls : null,
    heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null,
    domNodes: document.getElementsByTagName('*').length,
    contextLost: !!window.__DIAG_CONTEXT_LOST,
  };
})()`;

const key = (cdp, type, code, keyCode) => cdp.send('Input.dispatchKeyEvent', {
  type, code, key: 'w', windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode,
});

const profile = join(tmpdir(), `maranatha-endure-${process.pid}`);
mkdirSync(profile, { recursive: true });
const proc = spawn(EXE, [
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--mute-audio',
  '--autoplay-policy=no-user-gesture-required',
  '--window-size=3840,1080', '--window-position=0,0', '--new-window', 'about:blank',
], { stdio: 'ignore' });

const out = { browser: WHICH, timeline: [], cycles: [] };
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
  await cdp.send('Log.enable').catch(() => {});

  const enter = async (hash, beat) => {
    await cdp.send('Page.navigate', { url: 'about:blank' });
    await sleep(250);
    await cdp.send('Page.navigate', { url: BASE });
    await waitFor(cdp, 'document.readyState === "complete"', 'shell');
    await evaluate(cdp, `(() => {
      const s = JSON.parse(localStorage.getItem('maranatha-settings-v1') || '{}');
      s.hud = true; localStorage.setItem('maranatha-settings-v1', JSON.stringify(s));
      ${beat !== null ? `localStorage.setItem('maranatha-save-v1', JSON.stringify({ checkpoints: { joseph3d: ${beat} } }));` : ''}
      return true; })()`);
    await cdp.send('Page.navigate', { url: 'about:blank' });
    await sleep(200);
    await cdp.send('Page.navigate', { url: BASE + '/' + hash });
    await waitFor(cdp, `(() => { const c = document.querySelector('#app canvas');
      return !!c && c.width > 200 && getComputedStyle(c).visibility !== 'hidden'; })()`, hash);
    await sleep(6000);
    // Reach the live renderer + watch for context loss.
    await evaluate(cdp, `(() => {
      const c = document.querySelector('#app canvas');
      c.addEventListener('webglcontextlost', () => { window.__DIAG_CONTEXT_LOST = true; });
      const M = window.__MARANATHA;
      window.__DIAG_RENDERER = M && M.app ? (M.app.renderer || null) : null;
      return !!window.__DIAG_RENDERER; })()`).catch(() => false);
  };

  // ---- 1. one long unbroken session, walking ----
  await enter('#joseph', 1);
  await key(cdp, 'keyDown', 'KeyW', 87);
  const end = Date.now() + MINUTES * 60_000;
  let i = 0;
  while (Date.now() < end) {
    const s = await evaluate(cdp, STATS);
    out.timeline.push({ t: ++i * 5, ...s });
    await sleep(5000);
  }
  await key(cdp, 'keyUp', 'KeyW', 87);

  // ---- 2. bounce between scenes, watching resources ----
  for (let c = 0; c < CYCLES; c += 1) {
    await enter(c % 2 === 0 ? '#noah' : '#joseph', c % 2 === 0 ? null : 1);
    await key(cdp, 'keyDown', 'KeyW', 87);
    await sleep(4000);
    const s = await evaluate(cdp, STATS);
    await key(cdp, 'keyUp', 'KeyW', 87);
    out.cycles.push({ cycle: c + 1, scene: c % 2 === 0 ? 'noah' : 'joseph', ...s });
  }

  console.log(JSON.stringify(out, null, 2));
} finally {
  try { cdp?.ws.close(); } catch { /* gone */ }
  proc.kill();
  await sleep(500);
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* locked */ }
}
