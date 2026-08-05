// Guards the licensing story, because every part of it fails SILENTLY.
//
// A wrong `license` field in package.json is what GitHub's sidebar, npm, and
// every automated scanner actually read — the repo can advertise one license
// while shipping another and nothing anywhere complains. A copyright line in
// the README can name different holders than the LICENSE does and drift
// forever. A build can quietly stop carrying the license at all, which is us
// breaking our own clause 2(e). None of that shows up in a playthrough, so it
// gets asserted here.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...p) => readFileSync(join(ROOT, ...p), 'utf8');

// --- 1. the license itself -------------------------------------------------

const licensePath = join(ROOT, 'LICENSE');
assert.ok(
  existsSync(licensePath),
  'LICENSE must exist at the repo root under exactly that name — that is the '
  + "file name GitHub's license detector looks for",
);
const license = readFileSync(licensePath, 'utf8');
assert.ok(license.trim().length > 500, 'LICENSE looks truncated or stubbed out');
assert.match(
  license, /^TDG SOURCE-AVAILABLE LICENSE/,
  'LICENSE must still be the TDG source-available license',
);

// The authoritative copyright line. Everything else must agree with THIS.
const copyright = license.match(/^Copyright \(c\) (\d{4}) (.+?)\.$/m);
assert.ok(copyright, 'LICENSE must carry a parseable "Copyright (c) <year> <holders>." line');
const [, YEAR, HOLDERS] = copyright;
const holderNames = HOLDERS
  .split(/\s+and\s+|,\s*/)
  .map((n) => n.replace(/\s*\([^)]*\)\s*/g, '').trim())
  .filter(Boolean);
assert.ok(holderNames.length >= 1, 'could not read any copyright holder out of the LICENSE');

// --- 2. package.json must not advertise a different license ----------------

const pkg = JSON.parse(read('package.json'));
assert.equal(
  pkg.license, 'SEE LICENSE IN LICENSE',
  'package.json "license" is the field tooling actually reads. For a custom license it '
  + 'must be "SEE LICENSE IN LICENSE" — an SPDX id like MIT (or "UNLICENSED", which means '
  + 'no grant at all) would contradict the LICENSE file we ship',
);

// --- 3. the README must agree with the license -----------------------------

const readme = read('README.md');
assert.match(readme, /^##\s+.*License\s*$/m, 'README needs a "## License" section');
assert.ok(
  /\[LICENSE\]\(LICENSE\)/.test(readme),
  'the README License section must link to [LICENSE](LICENSE)',
);
assert.ok(
  readme.includes(YEAR),
  `README copyright year must match the LICENSE (${YEAR})`,
);
for (const name of holderNames) {
  assert.ok(
    readme.includes(name),
    `README must name every copyright holder the LICENSE does — missing "${name}". `
    + 'A README copyright line that names different people than the LICENSE is a '
    + 'contradiction no test but this one would ever catch.',
  );
}

// The license carves third-party material out (clause 4a), so the README has to
// point at where those separate terms actually live.
const creditsLinks = [...readme.matchAll(/\(([^)]*CREDITS\.md)\)/g)].map((m) => m[1]);
assert.ok(
  creditsLinks.length >= 1,
  'the README License section must link the third-party credits (the license carves them out)',
);

// --- 4. no surviving contradictory license claim ---------------------------

const SPDX_CLAIM = /\b(MIT|Apache-2\.0|BSD-3-Clause|GPL-[0-9])\b/;
const OPEN_SOURCE_CLAIM = /\bopen[- ]source\b/i;
// Saying we are NOT open source is the correct thing for this project to say,
// so a denial must not trip the guard — only an affirmative claim may.
const DENIAL = /\bnot\s+(?:an?\s+)?open[- ]source\b/gi;
for (const file of ['README.md', 'src/screens/pages.js']) {
  const text = read(file);
  assert.ok(
    !SPDX_CLAIM.test(text),
    `${file} names an open-source license id — that would contradict the TDG license`,
  );
  // The LICENSE says so itself ("Publishing a repository is not an open-source
  // grant"), so the product's own copy must never claim otherwise.
  assert.ok(
    !OPEN_SOURCE_CLAIM.test(text.replace(DENIAL, '')),
    `${file} calls the project open source, which the TDG license explicitly is not`,
  );
}

// --- 5. the vite plugin, exercised for real (both paths) -------------------

// Calling the plugin's own hooks catches the divergence a config read cannot:
// the build emit and the dev server must hand out the SAME bytes under the
// SAME names, or the in-game link means one thing in dev and another shipped.
const licenseBytes = readFileSync(licensePath);
const viteConfig = (await import('../vite.config.js')).default;
const plugin = (viteConfig.plugins ?? []).flat().find((p) => p?.name === 'maranatha-ship-license');
assert.ok(plugin, 'vite.config.js must register the maranatha-ship-license plugin');

const emitted = [];
plugin.generateBundle.call({ emitFile: (file) => emitted.push(file) });
assert.deepEqual(
  emitted.map((f) => f.fileName).sort(), ['LICENSE', 'license.txt'],
  'the build must emit both the detector name (LICENSE) and the servable one (license.txt)',
);
for (const file of emitted) {
  assert.deepEqual(file.source, licenseBytes, `emitted ${file.fileName} is not the source bytes`);
}

let middleware = null;
plugin.configureServer({ middlewares: { use: (fn) => { middleware = fn; } } });
assert.ok(middleware, 'the plugin must serve the license in dev too');
for (const name of ['license.txt', 'LICENSE']) {
  let body = null;
  let type = null;
  let fellThrough = false;
  middleware(
    { url: `/${name}` },
    { setHeader: (k, v) => { if (/content-type/i.test(k)) type = v; }, end: (b) => { body = b; } },
    () => { fellThrough = true; },
  );
  assert.ok(
    !fellThrough,
    `dev did not serve /${name}; it would fall through to Vite's SPA fallback and return `
    + 'index.html with a 200 — the link would open the game, not the license',
  );
  assert.deepEqual(body, licenseBytes, `dev served the wrong bytes for /${name}`);
  assert.match(type ?? '', /text\/plain/, `/${name} must be served as text/plain to be readable`);
}
// ...and it must not swallow anything else.
let passedOn = false;
middleware({ url: '/index.html' }, { setHeader() {}, end() {} }, () => { passedOn = true; });
assert.ok(passedOn, 'the license middleware must only intercept the license paths');

// --- 6. every local link AND image in the README resolves ------------------

let localLinks = 0;
for (const [, , target] of readme.matchAll(/\[([^\]]*)\]\(([^)]+)\)/g)) {
  if (/^(https?:|mailto:|#)/.test(target)) continue; // external/anchor: checked out of band
  const path = resolve(ROOT, target.split('#')[0]);
  assert.ok(existsSync(path), `README links to ${target}, which does not exist on disk`);
  localLinks += 1;
}

// The README leads with ten screenshots, written as HTML so they can be laid
// out in a grid — which the markdown link pattern above cannot see at all. A
// missing one is a broken image on the front page of the project.
let images = 0;
for (const [, src] of readme.matchAll(/<img[^>]*\ssrc="([^"]+)"/g)) {
  if (/^https?:/.test(src)) continue;
  assert.ok(existsSync(resolve(ROOT, src)), `README shows <img src="${src}">, which is not on disk`);
  images += 1;
}
assert.ok(images >= 5, `expected the README to still show its screenshots, found ${images}`);
// Every screenshot must also carry alt text — the images ARE the pitch, so a
// reader who cannot see them should still get it.
for (const [tag] of readme.matchAll(/<img[^>]*>/g)) {
  assert.match(tag, /\salt="[^"]{10,}"/, `an <img> in the README has no real alt text: ${tag.slice(0, 70)}`);
}

// --- 7. the built artifact actually carries the license --------------------

// Opportunistic: `npm test` does not build. When a build IS present it must be
// byte-identical to the source of truth — the point of emitting it at build
// time rather than checking a second copy into public/.
// `license.txt` is the copy the game links to: a static host serves an
// extensionless file as application/octet-stream, which downloads instead of
// displaying. Both are emitted from the one root LICENSE, so both are checked.
const DIST_NAMES = ['LICENSE', 'license.txt'];
let distNote = 'no dist/ present (run `npm run build` to check the artifact)';
if (existsSync(join(ROOT, 'dist'))) {
  for (const name of DIST_NAMES) {
    const emitted = join(ROOT, 'dist', name);
    assert.ok(
      existsSync(emitted),
      `the build produced no dist/${name} — every deployed copy would ship with our `
      + 'notices stripped, which clause 2(e) forbids',
    );
    assert.deepEqual(
      readFileSync(emitted),
      readFileSync(licensePath),
      `dist/${name} is not byte-identical to the root LICENSE`,
    );
  }
  distNote = `${DIST_NAMES.length} dist copies byte-identical to source`;
}

// The product must actually link the license it ships, and must link the
// SERVABLE name — ./LICENSE would download rather than open.
const about = read('src/screens/pages.js');
assert.ok(
  about.includes('license.txt'),
  'the About panel must link the license that ships with the build (./license.txt)',
);
assert.ok(
  !/href="\.\/LICENSE"/.test(about),
  'link ./license.txt, not ./LICENSE — a static host serves the extensionless file as '
  + 'application/octet-stream, so the link downloads the file instead of showing it',
);

console.log(
  `license passed: ${holderNames.length} holder(s) [${holderNames.join(', ')}] ${YEAR} consistent `
  + `across LICENSE/README/package.json · ${localLinks} local links + ${images} screenshots resolve (alt text checked) · `
  + `${creditsLinks.length} third-party credits linked · ${distNote}`,
);
