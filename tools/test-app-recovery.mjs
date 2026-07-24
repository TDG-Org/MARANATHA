import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { waitWithDeadline } from '../src/core/deadline.js';
import { resolveLazyScreen } from '../src/core/lazyScreen.js';
import { loadOwnedTexture } from '../src/engine/textureLoader.js';

// A scene-aborted texture request must retire the real browser transport, not
// merely ignore TextureLoader's eventual callback. A successful request must
// include image decode before marking its Texture upload-ready.
{
  const previousImage = globalThis.Image;
  const images = [];
  class ImageFake {
    constructor() {
      this._src = '';
      this.decodeCalls = 0;
      images.push(this);
    }
    set src(value) { this._src = String(value); }
    get src() { return this._src; }
    async decode() { this.decodeCalls += 1; }
  }
  globalThis.Image = ImageFake;
  try {
    const lifetime = new AbortController();
    const aborted = loadOwnedTexture('textures/owned-abort.jpg', { signal: lifetime.signal });
    let disposeEvents = 0;
    aborted.texture.addEventListener('dispose', () => { disposeEvents += 1; });
    assert.equal(images.at(-1).src, 'textures/owned-abort.jpg');
    lifetime.abort();
    await assert.rejects(aborted.whenReady, { name: 'AbortError' });
    assert.equal(images.at(-1).src, '', 'texture abort did not cancel its owned image request');
    assert.equal(disposeEvents, 1, 'aborted texture was not disposed exactly once');

    const loaded = loadOwnedTexture('textures/owned-ready.jpg');
    const readyImage = images.at(-1);
    const loadCallback = readyImage.onload();
    await loadCallback;
    assert.equal(await loaded.whenReady, loaded.texture);
    assert.equal(readyImage.decodeCalls, 1, 'texture readiness skipped image decode');
    assert.ok(loaded.texture.version > 0, 'decoded texture was not marked upload-ready');
    loaded.texture.dispose();
  } finally {
    if (previousImage === undefined) delete globalThis.Image;
    else globalThis.Image = previousImage;
  }
}

assert.equal(await waitWithDeadline(Promise.resolve('ready'), 20, 'late'), 'ready');
await assert.rejects(
  waitWithDeadline(Promise.reject(new Error('decode failed')), 20, 'late'),
  /decode failed/,
);
assert.equal(
  await waitWithDeadline(new Promise(() => {}), 5, 'late', { rejectOnTimeout: false }),
  false,
);
await assert.rejects(
  waitWithDeadline(new Promise(() => {}), 5, 'screen timed out'),
  /screen timed out/,
);

// A timed-out module request must not poison the route forever, and its late
// failure must not clear the newer retry.
{
  const requests = [];
  const entry = {
    builder: null,
    promise: null,
    load: () => new Promise((resolve, reject) => requests.push({ resolve, reject })),
  };
  await assert.rejects(resolveLazyScreen(entry, 'joseph', { timeoutMs: 5 }), /timed out/);
  assert.equal(entry.promise, null, 'timed-out lazy request remained cached');

  const retry = resolveLazyScreen(entry, 'joseph', { timeoutMs: 50 });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(requests.length, 2, 'retry reused the abandoned request');
  requests[0].reject(new Error('late first failure'));
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.notEqual(entry.promise, null, 'late first failure cleared the live retry');
  const builder = () => ({});
  requests[1].resolve(builder);
  assert.equal(await retry, builder);
  assert.equal(entry.builder, builder);
}

// Late success is just as stale as late failure: it may satisfy its abandoned
// caller, but it cannot overwrite the builder owned by the active retry.
{
  const requests = [];
  const entry = {
    builder: null,
    promise: null,
    load: () => new Promise((resolve, reject) => requests.push({ resolve, reject })),
  };
  await assert.rejects(resolveLazyScreen(entry, 'joseph', { timeoutMs: 5 }), /timed out/);
  const retry = resolveLazyScreen(entry, 'joseph', { timeoutMs: 50 });
  await new Promise((resolve) => setTimeout(resolve, 0));
  const staleBuilder = () => ({ stale: true });
  requests[0].resolve(staleBuilder);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(entry.builder, null, 'late first success overwrote the live retry');
  const liveBuilder = () => ({ live: true });
  requests[1].resolve(liveBuilder);
  assert.equal(await retry, liveBuilder);
  assert.equal(entry.builder, liveBuilder);
}

const appSource = await readFile(new URL('../src/core/app.js', import.meta.url), 'utf8');
const homeSource = await readFile(new URL('../src/screens/home.js', import.meta.url), 'utf8');

assert.match(
  appSource,
  /if \(readyResult === false\)[\s\S]*throw new Error\(`Screen "\$\{readyKey\}" readiness timed out`\)/,
  'a readiness timeout can still reveal an incomplete scene',
);
assert.match(
  appSource,
  /failed while loading; returning home[\s\S]*disposeCurrent\(`Screen "\$\{readyKey\}" failed readiness`\)[\s\S]*build\('home', \{ loadError: \{ key: readyKey, phase: 'assets' \} \}\)/,
  'a rejected readiness contract is not disposed behind the veil before fallback',
);
assert.match(
  appSource,
  /failed to build; returning home[\s\S]*build\('home', \{ loadError: \{ key, phase: 'screen' \} \}\)/,
  'a failed lazy chunk does not return to the eager home recovery screen',
);
assert.match(
  appSource,
  /function disposeCurrent[\s\S]*lifetime\.abort[\s\S]*instance\.dispose[\s\S]*disposeDeep\(current\.scene\)[\s\S]*postFX\.reset\(\)[\s\S]*current = null/,
  'failed scenes do not release every shell-owned resource',
);
assert.match(
  appSource,
  /busy = true;[\s\S]*loopController\?\.stop\(\)[\s\S]*await veil\.reveal[\s\S]*current\.instance\.activate\?\.\(\)[\s\S]*busy = false[\s\S]*loopController\?\.start\(\)/,
  'navigation does not keep game work stopped through readiness/reveal/activation',
);
assert.match(
  appSource,
  /if \(current && !busy\)/,
  'the app loop can update/render an incomplete screen behind the loader',
);
for (const recoveryText of ['role', 'Try again', 'Reload', 'app.navigate']) {
  assert.ok(homeSource.includes(recoveryText), `home recovery UI is missing ${recoveryText}`);
}
{
  const activationIndex = homeSource.indexOf('const activate = () =>');
  const audioStartIndex = homeSource.indexOf('if (Audio.on) startBeds();');
  const returnedIndex = homeSource.indexOf('return { update, dispose, activate }');
  assert.ok(
    activationIndex >= 0 && audioStartIndex > activationIndex && returnedIndex > audioStartIndex,
    'Home starts audio during build instead of post-reveal activation',
  );
}

console.log('App deadline, failed-screen disposal, and visible recovery checks passed.');
