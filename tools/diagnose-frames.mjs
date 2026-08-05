// Frame-rate diagnosis on the REAL machine, in a REAL visible browser window.
//
// `#debug` says what the fps IS. It cannot say WHY. This drives a headed Chrome
// over the DevTools protocol and separates the causes that look identical from
// the inside:
//
//   1. Is the browser even using the GPU?  (chrome://gpu + the unmasked string)
//   2. Can the panel/browser deliver frames at all, with no game running?
//      (a bare rAF chain on about:blank — if THAT is 15, nothing in this repo
//      is the cause)
//   3. Does the frame rate fall as the WINDOW gets bigger? That is the single
//      cleanest discriminator: cost that scales with screen pixels is fill rate
//      or the compositor (the CSS colour grade), and cost that does not is CPU,
//      pacing or draw-call bound.
//   4. Does turning the full-screen colour grade off buy frames back? It is a
//      CSS filter over the live canvas at SCREEN resolution, so the DPR cap
//      cannot touch it and `#debug` cannot see it.
//
// Usage:  node tools/diagnose-frames.mjs [url]
//         node tools/diagnose-frames.mjs https://tdg-org.github.io/MARANATHA/
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.argv[2] || process.env.DIAG_URL || 'http://localhost:1225';
const PORT = Number(process.env.DIAG_CDP_PORT || 9444);
const SCENE = process.env.DIAG_SCENE || '#noah'; // no cutscene, walkable immediately
const SAMPLE_MS = Number(process.env.DIAG_SAMPLE_MS || 5000);

const CHROME_CANDIDATES = [
  `${process.env.ProgramFiles}\\Google\\Chrome\\Application\\chrome.exe`,
  `${process.env['ProgramFiles(x86)']}\\Google\\Chrome\\Application\\chrome.exe`,
  `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];

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
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('no DevTools socket')); });
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

async function waitFor(cdp, expr, label, timeout = 45000) {
  const t0 = Date.now();
  for (;;) {
    let ok = false;
    try { ok = await evaluate(cdp, expr); } catch { /* navigating */ }
    if (ok) return Date.now() - t0;
    if (Date.now() - t0 > timeout) throw new Error(`timed out waiting for ${label}`);
    await sleep(200);
  }
}

// An INDEPENDENT rAF chain. It measures what the page can actually deliver,
// whoever is to blame — if the main thread is saturated this drops too, and if
// the compositor is the bottleneck the callbacks back up behind it.
const probe = (ms) => `new Promise((res) => {
  let n = 0; const gaps = []; let last = performance.now(); const t0 = last;
  (function tick(now) {
    n += 1; gaps.push(now - last); last = now;
    if (now - t0 < ${ms}) requestAnimationFrame(tick);
    else {
      const sorted = gaps.slice(1).sort((a, b) => a - b);
      const at = (p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] || 0;
      res({
        fps: +(n / ((now - t0) / 1000)).toFixed(1),
        medianGapMs: +at(0.5).toFixed(2),
        p95GapMs: +at(0.95).toFixed(2),
        worstGapMs: +at(1).toFixed(2),
        frames: n,
      });
    }
  })(performance.now());
})`;

const SNAPSHOT = `(() => {
  const c = document.querySelector('#app canvas');
  const gl = c && (c.getContext('webgl2', { failIfMajorPerformanceCaveat: false })
    || c.getContext('webgl'));
  let unmasked = null, attrs = null;
  if (gl) {
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (ext) unmasked = {
      vendor: gl.getParameter(ext.UNMASKED_VENDOR_WEBGL),
      renderer: gl.getParameter(ext.UNMASKED_RENDERER_WEBGL),
    };
    try { attrs = gl.getContextAttributes(); } catch {}
  }
  const M = window.__MARANATHA;
  return {
    dpr: window.devicePixelRatio,
    window: [window.innerWidth, window.innerHeight],
    screen: [screen.width, screen.height],
    canvasCss: c ? [c.clientWidth, c.clientHeight] : null,
    drawingBuffer: c ? [c.width, c.height] : null,
    megapixels: c ? +((c.width * c.height) / 1e6).toFixed(2) : null,
    canvasFilter: c ? getComputedStyle(c).filter : null,
    unmasked, attrs,
    graphics: M && M.Settings ? {
      preset: (window.__DIAG_G && window.__DIAG_G.name) || null,
      colourGrade: (window.__DIAG_G && window.__DIAG_G.colourGrade) ?? null,
    } : null,
    appFps: M && M.app && M.app.power ? M.app.power.fps : null,
    eco: M && M.app && M.app.power ? M.app.power.eco : null,
  };
})()`;

const chromePath = CHROME_CANDIDATES.find((p) => p && existsSync(p));
if (!chromePath) throw new Error('no Chrome found');
const profile = join(tmpdir(), `maranatha-diag-${process.pid}`);
mkdirSync(profile, { recursive: true });

// HEADED on purpose: a headless window composites differently, and the whole
// question is what the real compositor does on the real display.
const chrome = spawn(chromePath, [
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--mute-audio',
  '--autoplay-policy=no-user-gesture-required',
  '--disable-features=Translate,MediaRouter',
  '--new-window', 'about:blank',
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
  if (!target) throw new Error('Chrome never exposed a page target');
  cdp = await CDP.attach(target.webSocketDebuggerUrl);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  const { windowId } = await cdp.send('Browser.getWindowForTarget');
  const setSize = async (width, height) => {
    await cdp.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'normal' } });
    await cdp.send('Browser.setWindowBounds', { windowId, bounds: { left: 0, top: 0, width, height } });
    await sleep(900);
  };

  // --- 1. what does the BROWSER think of its own GPU? ----------------------
  await cdp.send('Page.navigate', { url: 'chrome://gpu' });
  await sleep(3500);
  report.gpuPage = await evaluate(cdp, `(() => {
    const t = document.body ? document.body.innerText : '';
    const want = /^(WebGL|WebGL2|Canvas|Rasterization|Video Decode|OpenGL|Vulkan|Compositing|Multiple Raster Threads|Graphics Feature Status|\\*)/;
    const lines = t.split('\\n').map(s => s.trim()).filter(Boolean);
    const status = lines.filter(l => want.test(l)).slice(0, 22);
    const driver = lines.filter(l => /GL_RENDERER|GL_VENDOR|Driver version|ANGLE|SwiftShader|Software only|Disabled/i.test(l)).slice(0, 14);
    return { status, driver };
  })()`).catch((e) => ({ error: String(e) }));

  // --- 2. can the panel deliver frames with NO game at all? ----------------
  await setSize(1600, 900);
  await cdp.send('Page.navigate', { url: 'about:blank' });
  await sleep(700);
  report.blankPage = await evaluate(cdp, probe(3000));

  // --- 3. the game, at three window sizes -------------------------------
  const sizes = [[1280, 720], [2560, 1080], [3840, 1080]];
  report.bySize = [];
  for (const [w, h] of sizes) {
    await setSize(w, h);
    await cdp.send('Page.navigate', { url: 'about:blank' });
    await sleep(300);
    await cdp.send('Page.navigate', { url: BASE + '/' + SCENE });
    await waitFor(cdp, `(() => { const c = document.querySelector('#app canvas');
      return !!c && c.width > 200 && getComputedStyle(c).visibility !== 'hidden'; })()`, `${w}x${h} scene`);
    await sleep(7000); // let the scene settle and any adaptive quality act
    // expose Graphics for the snapshot + the A/B below
    await evaluate(cdp, `import('${BASE}/src/systems/Graphics.js').then(m => { window.__DIAG_G = m.Graphics; return true; }).catch(() => false)`)
      .catch(() => null);
    const snap = await evaluate(cdp, SNAPSHOT);
    const live = await evaluate(cdp, probe(SAMPLE_MS));
    report.bySize.push({ size: `${w}x${h}`, ...snap, live });
  }

  // --- 4. A/B the full-screen colour grade at the largest size -------------
  const gradeOff = await evaluate(cdp, `(() => {
    if (!window.__DIAG_G) return null;
    window.__DIAG_G.setColourGrade(false);
    return getComputedStyle(document.querySelector('#app canvas')).filter;
  })()`).catch(() => null);
  if (gradeOff !== null) {
    await sleep(1200);
    report.gradeOff = { canvasFilter: gradeOff, live: await evaluate(cdp, probe(SAMPLE_MS)) };
    await evaluate(cdp, `window.__DIAG_G.setColourGrade(true); true`);
    await sleep(1200);
    report.gradeOn = { live: await evaluate(cdp, probe(SAMPLE_MS)) };
  }

  console.log(JSON.stringify(report, null, 2));
} finally {
  try { cdp?.ws.close(); } catch { /* gone */ }
  chrome.kill();
  await sleep(500);
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* locked */ }
}
