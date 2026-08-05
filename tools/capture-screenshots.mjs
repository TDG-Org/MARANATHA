// Captures the README screenshots by driving the REAL game in headless Chrome.
//
// Screenshots go stale the moment the art changes, and a stale screenshot is a
// lie told on the front page. So they are generated, not hand-taken: run
// `npm run shots` and every image is re-made from the current code.
//
// No new dependency — Chrome is driven over the DevTools protocol through
// Node's built-in WebSocket. The game exposes everything needed already:
// `window.__MARANATHA` (app/Settings), the `sky` setting for the map's time of
// day, and SaveSystem beat checkpoints, so a scene can be entered at any beat
// without playing through the ones before it.
//
// Usage:  npm start      (dev server on 1225, in another terminal)
//         npm run shots
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'docs', 'screenshots');
const BASE = process.env.SHOT_URL || 'http://localhost:1225';
const PORT = Number(process.env.SHOT_CDP_PORT || 9333);
const WIDTH = 1440;
const HEIGHT = 810;
const QUALITY = 88;

const CHROME_CANDIDATES = [
  `${process.env.ProgramFiles}\\Google\\Chrome\\Application\\chrome.exe`,
  `${process.env['ProgramFiles(x86)']}\\Google\\Chrome\\Application\\chrome.exe`,
  `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
  `${process.env.ProgramFiles}\\Microsoft\\Edge\\Application\\msedge.exe`,
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- the smallest CDP client that can do this job ---------------------------

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.seq = 0;
    this.pending = new Map();
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      const waiter = msg.id && this.pending.get(msg.id);
      if (!waiter) return;
      this.pending.delete(msg.id);
      if (msg.error) waiter.reject(new Error(`${msg.error.message} (${waiter.method})`));
      else waiter.resolve(msg.result);
    };
  }

  static async attach(wsUrl) {
    const ws = new WebSocket(wsUrl);
    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = () => reject(new Error('could not open a DevTools socket'));
    });
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
  const res = await cdp.send('Runtime.evaluate', {
    expression, awaitPromise: true, returnByValue: true,
  });
  if (res.exceptionDetails) {
    throw new Error(`page threw: ${res.exceptionDetails.exception?.description || res.exceptionDetails.text}`);
  }
  return res.result?.value;
}

async function waitFor(cdp, expression, label, timeout = 40000) {
  const started = Date.now();
  for (;;) {
    let ok = false;
    try { ok = await evaluate(cdp, expression); } catch { /* page mid-navigation */ }
    if (ok) return Date.now() - started;
    if (Date.now() - started > timeout) throw new Error(`timed out waiting for ${label}`);
    await sleep(200);
  }
}

async function capture(cdp, file) {
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: QUALITY });
  const path = join(OUT, file);
  writeFileSync(path, Buffer.from(data, 'base64'));
  return statSync(path).size;
}

// --- what to shoot ----------------------------------------------------------

// A scene is entered at a chosen BEAT via the save file's checkpoint, so the
// camp/dusk/dream shots do not require playing the cold open first.
// The perf meter is ON by default (deliberate — honest fps on real devices),
// but it is a developer readout, not the game. Turned off through the game's
// own setting, exactly as a player would, rather than hidden from the DOM.
const settings = (patch) => `
  (() => { const raw = localStorage.getItem('maranatha-settings-v1');
    const s = raw ? JSON.parse(raw) : {};
    Object.assign(s, ${JSON.stringify(patch)}, { hud: false });
    localStorage.setItem('maranatha-settings-v1', JSON.stringify(s)); return true; })()`;
// NOTE the checkpoint id is `joseph3d` (the SCENE), not `joseph` (the story).
// Using the story id silently resumes at beat 0 and every shot comes back as
// the cold open — which is exactly what happened the first time.
const enterJoseph = (beat) => `
  localStorage.setItem('maranatha-save-v1', JSON.stringify({ checkpoints: { joseph3d: ${beat} } }));
  ${settings({})}`;
const pinSky = (sky) => settings({ sky });

const HOME_READY = `[...document.querySelectorAll('button')].some(b => /Start Story/i.test(b.textContent||''))`;
// The HOME keeps a canvas around with visibility:hidden, so "a canvas exists"
// is true there too — the first run of this tool shot the menu nine times and
// reported success. A scene is only really up when that canvas is VISIBLE and
// the story HUD (not the Start button) owns the screen.
const SCENE_READY = `(() => { const c = document.querySelector('#app canvas');
  if (!c || c.width < 200) return false;
  if (getComputedStyle(c).visibility === 'hidden') return false;
  return !document.body.textContent.includes('Start Story'); })()`;

const SHOTS = [
  { file: 'home-dawn.jpg',  url: '/',      prepare: pinSky('dawn'),  ready: HOME_READY,  settle: 2600 },
  { file: 'home-day.jpg',   url: '/',      prepare: pinSky('day'),   ready: HOME_READY,  settle: 2600 },
  { file: 'home-dusk.jpg',  url: '/',      prepare: pinSky('dusk'),  ready: HOME_READY,  settle: 2600 },
  { file: 'home-night.jpg', url: '/',      prepare: pinSky('night'), ready: HOME_READY,  settle: 2600 },
  { file: 'joseph-camp.jpg',  url: '/#joseph', prepare: enterJoseph(1), ready: SCENE_READY, settle: 9000 },
  { file: 'joseph-coat.jpg',  url: '/#joseph', prepare: enterJoseph(3), ready: SCENE_READY, settle: 9000 },
  { file: 'joseph-dusk.jpg',  url: '/#joseph', prepare: enterJoseph(4), ready: SCENE_READY, settle: 9000 },
  { file: 'joseph-dream.jpg', url: '/#joseph', prepare: enterJoseph(5), ready: SCENE_READY, settle: 11000 },
  // The ark is 137 m long and the player spawns at the foot of its boarding
  // ramp, so the default view is all hull and scaffolding. These two use the
  // scene's own debug handle to stand somewhere the ship actually reads.
  {
    file: 'noah-ark.jpg', url: '/#noah', prepare: settings({}), ready: SCENE_READY, settle: 7000,
    // A FOLLOW camera physically cannot frame a 137 m ship — it is built to keep
    // one 1.8 m character large. So this borrows the director's pose driver and
    // pins a real three-quarter hero lens instead. The hull spans x +-68.6 and
    // stands ~15 m tall, so this sits ~136 m out and 34 m up, which puts the
    // whole length inside the lens and still short of the fog (near = 170).
    act: `(() => { const d = window.__MARANATHA.app.instance.debug;
      d.controller.teleport(-6, 3, 20);    // a figure at the foot of the ramp, for scale
      d.player.turnToward(0, -1);
      d.director.setPoseDriver((pose) => {
        pose.pos.set(100, 34, 88);
        pose.look.set(0, 7, 0);
      });
      return true; })()`,
  },
  {
    file: 'noah-inside.jpg', url: '/#noah', prepare: settings({}), ready: SCENE_READY, settle: 7000,
    act: `(() => { const d = window.__MARANATHA.app.instance.debug;
      d.controller.teleport(-40, 6.43, 0); // second deck, on the centre corridor
      d.player.turnToward(1, 0);           // look down the length of the ship
      d.director.snap(); return true; })()`,
  },
];

// --- run --------------------------------------------------------------------

const chromePath = CHROME_CANDIDATES.find((p) => p && existsSync(p));
if (!chromePath) throw new Error('no Chrome/Edge found to drive');

const profile = join(tmpdir(), `maranatha-shots-${process.pid}`);
mkdirSync(OUT, { recursive: true });

const chrome = spawn(chromePath, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  `--window-size=${WIDTH},${HEIGHT}`,
  // WebGL in headless runs on SwiftShader; recent Chrome requires opting in.
  '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--no-first-run', '--no-default-browser-check', '--hide-scrollbars',
  '--mute-audio', '--autoplay-policy=no-user-gesture-required',
  '--disable-features=Translate,MediaRouter',
  'about:blank',
], { stdio: 'ignore' });

let cdp = null;
try {
  // wait for the debugging endpoint, then attach to the one open page
  let target = null;
  for (let i = 0; i < 80 && !target; i += 1) {
    await sleep(250);
    try {
      const list = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json());
      target = list.find((t) => t.type === 'page');
    } catch { /* not up yet */ }
  }
  if (!target) throw new Error('Chrome never exposed a page target');

  cdp = await CDP.attach(target.webSocketDebuggerUrl);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: false,
  });

  // Reachability is checked once, with a clear message: every later failure
  // would otherwise look like a game bug rather than "the server isn't up".
  try {
    await fetch(BASE, { signal: AbortSignal.timeout(4000) });
  } catch {
    throw new Error(`no dev server at ${BASE} — run \`npm start\` in another terminal first`);
  }

  for (const shot of SHOTS) {
    // about:blank between shots forces a real load even when only the hash moves
    await cdp.send('Page.navigate', { url: 'about:blank' });
    await sleep(250);
    await cdp.send('Page.navigate', { url: BASE });
    await waitFor(cdp, 'document.readyState === "complete"', 'first load');
    await evaluate(cdp, shot.prepare);
    // about:blank again before the real target: going from "/" to "/#joseph" is
    // a HASH change, not a load, so the app never boots the scene — the first
    // run of this tool captured the menu for every gameplay shot that way.
    await cdp.send('Page.navigate', { url: 'about:blank' });
    await sleep(250);
    await cdp.send('Page.navigate', { url: BASE + shot.url });
    await waitFor(cdp, 'document.readyState === "complete"', `${shot.file} load`);

    const waited = await waitFor(cdp, shot.ready, `${shot.file} ready`);
    await sleep(shot.settle);
    if (shot.act) {
      await evaluate(cdp, shot.act);
      await sleep(shot.actSettle ?? 2200); // let the follow camera settle again
    }
    const bytes = await capture(cdp, shot.file);
    const errors = await evaluate(cdp, 'window.__shotErrors ? window.__shotErrors.length : 0') ?? 0;
    console.log(`  ${shot.file.padEnd(20)} ready in ${String(waited).padStart(5)}ms  ${(bytes / 1024).toFixed(0)} kB${errors ? `  (${errors} page errors)` : ''}`);
  }
  console.log(`\n${SHOTS.length} screenshots written to docs/screenshots/`);
} finally {
  try { cdp?.ws.close(); } catch { /* already gone */ }
  chrome.kill();
  await sleep(400);
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* windows lock */ }
}
