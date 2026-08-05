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

// --- 5. every local link in the README resolves ----------------------------

let localLinks = 0;
for (const [, , target] of readme.matchAll(/\[([^\]]*)\]\(([^)]+)\)/g)) {
  if (/^(https?:|mailto:|#)/.test(target)) continue; // external/anchor: checked out of band
  const path = resolve(ROOT, target.split('#')[0]);
  assert.ok(existsSync(path), `README links to ${target}, which does not exist on disk`);
  localLinks += 1;
}

// --- 6. the built artifact actually carries the license --------------------

// Opportunistic: `npm test` does not build. When a build IS present it must be
// byte-identical to the source of truth — the point of emitting it at build
// time rather than checking a second copy into public/.
const distLicense = join(ROOT, 'dist', 'LICENSE');
let distNote = 'no dist/ present (run `npm run build` to check the artifact)';
if (existsSync(join(ROOT, 'dist'))) {
  assert.ok(
    existsSync(distLicense),
    'the build produced no dist/LICENSE — every deployed copy would ship with our '
    + 'notices stripped, which clause 2(e) forbids',
  );
  assert.deepEqual(
    readFileSync(distLicense),
    readFileSync(licensePath),
    'dist/LICENSE is not byte-identical to the root LICENSE',
  );
  distNote = 'dist/LICENSE byte-identical to source';
}

console.log(
  `license passed: ${holderNames.length} holder(s) [${holderNames.join(', ')}] ${YEAR} consistent `
  + `across LICENSE/README/package.json · ${localLinks} local README links resolve · `
  + `${creditsLinks.length} third-party credits linked · ${distNote}`,
);
