import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SCENE1_CANONICAL_ORDER, SCENE1_ROUTING, WEB } from '../src/data/versesWEB.js';
import { nearestUnbowedBundle } from '../src/scenes/joseph3d/beats/helpers.js';
import {
  createInputGate,
  isObjectivePrepaintActive,
  isInteractiveCheckpoint,
  runInteractiveCheckpointEntry,
} from '../src/scenes/joseph3d/checkpointEntry.js';
import { createSourceManifest } from './vo-inventory.mjs';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');
const [
  dreamSource,
  tellingSource,
  beatIndexSource,
  coldOpenSource,
  campSource,
  sceneSource,
  pitSource,
  textureLoaderSource,
] = await Promise.all([
  read('../src/scenes/joseph3d/beats/dream.js'),
  read('../src/scenes/joseph3d/beats/telling.js'),
  read('../src/scenes/joseph3d/beats/index.js'),
  read('../src/scenes/joseph3d/beats/coldOpen.js'),
  read('../src/scenes/joseph3d/beats/camp.js'),
  read('../src/scenes/joseph3d/index.js'),
  read('../src/scenes/joseph3d/pit.js'),
  read('../src/engine/textureLoader.js'),
]);

assert.deepEqual(SCENE1_CANONICAL_ORDER, [
  'dream1', 'tell1', 'response1', 'dream2',
  'tell2_brothers', 'tell2_family', 'rebuke', 'envy',
]);

const markers = (source) => [...source.matchAll(/storyEvent\?\.\('([^']+)'\)/g)].map((m) => m[1]);
assert.deepEqual(
  markers(dreamSource),
  ['dream1', 'response1', 'dream2'],
  'runtime story markers drifted from Genesis 37:5–11 order',
);
assert.deepEqual(
  markers(tellingSource),
  ['tell1', 'tell2_brothers', 'tell2_family', 'rebuke', 'envy'],
  'telling markers drifted from Genesis 37:5–11 order',
);
assert.match(
  beatIndexSource,
  /list:\s*\[intro,\s*herd,\s*report,\s*coat,\s*dusk,\s*dream,\s*tell,\s*close\]/,
  'external beat/checkpoint indices changed',
);

assert.equal(
  WEB.gen_37_2.text,
  'This is the history of the generations of Jacob. Joseph, being seventeen years old, was feeding the flock with his brothers. He was a boy with the sons of Bilhah and Zilpah, his father’s wives. Joseph brought an evil report of them to their father.',
);
assert.ok(WEB.gen_37_7.text.startsWith('for behold,'), 'Genesis 37:7 casing is not canonical WEB');
assert.equal(
  WEB.gen_37_9.text,
  'He dreamed yet another dream, and told it to his brothers, and said, “Behold, I have dreamed yet another dream: and behold, the sun and the moon and eleven stars bowed down to me.”',
);
assert.equal(
  WEB.gen_37_10.text,
  'He told it to his father and to his brothers. His father rebuked him, and said to him, “What is this dream that you have dreamed? Will I and your mother and your brothers indeed come to bow ourselves down to the earth before you?”',
);
assert.ok(WEB.gen_37_24.text.startsWith('and they took him,'), 'Genesis 37:24 casing is not canonical WEB');
assert.deepEqual(SCENE1_ROUTING, [
  { beat: 'cold-open', voice: 'NARRATOR', line: 'gen_37_24 (verse card + VO)' },
  { beat: 'intro', voice: 'NARRATOR', line: 'gen_37_1 (verse card + VO)' },
  { beat: 'herd', voice: 'CHARACTER', line: 'Simeon/Levi give practical flock directions (text; no verse)' },
  { beat: 'report', voice: 'MIXED', line: 'Jacob/Joseph enact the report (text) · then full gen_37_2 (verse card + VO)' },
  { beat: 'coat', voice: 'MIXED', line: 'Jacob + brothers speak (text) · verses 37:3, 37:4 narrated — no line quotes its verse' },
  { beat: 'dusk', voice: 'GAMEPLAY', line: 'objective + Sit prompt only (no spoken lines)' },
  { beat: 'dream-and-first-telling', voice: 'MIXED', line: 'dream 1: narr-dream-begins + 37:7 · Joseph tells only the brothers (text) · 37:5, 37:8 narrated · then dream 2' },
  { beat: 'second-telling', voice: 'MIXED', line: 'Joseph tells dream 2 to his brothers · 37:9 narrated · then tells his father and brothers · Jacob reacts · 37:10 narrated' },
  { beat: 'close', voice: 'NARRATOR', line: 'gen_37_11 (verse card + VO) + tease title' },
], 'Scene 1 routing table drifted from the current canonical verse placements');

const summitGate = dreamSource.indexOf("id: 'summit-reach'");
const summitClear = dreamSource.indexOf('ctx.hud.clearObjective?.()', summitGate);
const summitLock = dreamSource.indexOf('ctx.setInput(false)', summitGate);
assert.ok(
  summitGate >= 0 && summitClear > summitGate && summitClear < summitLock,
  'summit objective is not cleared synchronously at its gate',
);
assert.doesNotMatch(tellingSource, /objectiveEl\.textContent/, 'telling still infers story state from DOM');
assert.match(tellingSource, /Genesis 37:12–17 — the road to Dothan/);
assert.doesNotMatch(coldOpenSource, /1898 BC/);
assert.doesNotMatch(coldOpenSource, /WEB\.gen_37_2\b/,
  'Genesis 37:2 is announced before the player enacts its report');
assert.equal(
  (coldOpenSource.match(/WEB\.gen_37_1\b/g) || []).length,
  1,
  'intro must carry Genesis 37:1 exactly once',
);
const reportStart = campSource.indexOf('async function report()');
const reportLine = campSource.indexOf('I bring a bad report', reportStart);
const reportVerse = campSource.indexOf('WEB.gen_37_2', reportStart);
const coatStart = campSource.indexOf('async function coat()');
assert.ok(reportStart >= 0 && reportLine > reportStart && reportVerse > reportLine && reportVerse < coatStart,
  'Genesis 37:2 does not land immediately after its enacted report');
assert.equal(
  (campSource.slice(reportStart, coatStart).match(/WEB\.gen_37_2\b/g) || []).length,
  1,
  'the enacted report must carry the full Genesis 37:2 exactly once',
);
assert.doesNotMatch(coldOpenSource, /walk home|toward their camp/i);
assert.doesNotMatch(coldOpenSource, /throne, dreamer|who: 'Judah'.*becomes of your dreams/s);
assert.match(coldOpenSource, /who: 'Brothers'[\s\S]*becomes of his dreams/);
assert.doesNotMatch(pitSource, /camp they return to|CAMPFIRES|setCampGlow|campGlow/);
const preCoat = campSource.slice(0, coatStart);
assert.doesNotMatch(preCoat, /father.s favorite|all you.re good for/i,
  'favoritism/hatred arrives before Genesis 37:3–4');
assert.doesNotMatch(campSource, /prince|gift I did not look for|Let all of Hebron/i);
const tell1Marker = tellingSource.indexOf("storyEvent?.('tell1')");
const tell1Line = tellingSource.indexOf('Brothers — hear this dream', tell1Marker);
const tell2Brothers = tellingSource.indexOf("storyEvent?.('tell2_brothers')");
const verse9 = tellingSource.indexOf('WEB.gen_37_9', tell2Brothers);
const tell2Family = tellingSource.indexOf("storyEvent?.('tell2_family')");
const verse10 = tellingSource.indexOf('WEB.gen_37_10', tell2Family);
assert.ok(tell1Marker >= 0 && tell1Line > tell1Marker,
  'first-telling marker fires before the telling actually starts');
assert.ok(
  tell2Brothers >= 0 && verse9 > tell2Brothers && tell2Family > verse9 && verse10 > tell2Family,
  'Genesis 37:9–10 tellings were collapsed or reordered',
);
assert.doesNotMatch(tellingSource, /gen_37_10_short/, 'shortened verse 37:10 is still displayed');
assert.match(sceneSource, /Math\.max\(0, Math\.min\(7, Math\.floor\(savedBeat\)\)\)/,
  'checkpoint is not safely clamped across beats 0–7');
assert.deepEqual(
  Array.from({ length: 8 }, (_, index) => index).filter(isInteractiveCheckpoint),
  [1, 2, 4, 6],
  'checkpoint reveal ownership drifted from the four interactive entries',
);
assert.match(
  sceneSource,
  /const inputGate = createInputGate\([\s\S]*const setInput = \(on\) => inputGate\.set\(on\);/,
  'story beats no longer route their input requests through the checkpoint hold',
);
const runStoryStart = sceneSource.indexOf('async function runStory(from)');
const runStoryEnd = sceneSource.indexOf('// --- per-frame ---', runStoryStart);
assert.ok(runStoryStart >= 0 && runStoryEnd > runStoryStart, 'runStory source window was not found');
const runStorySource = sceneSource.slice(runStoryStart, runStoryEnd);
assert.match(
  runStorySource,
  /if \(from > 0 && isInteractiveCheckpoint\(from\)\)[\s\S]*loopFrom = await runInteractiveCheckpointEntry\([\s\S]*invokeBeat: \(\) => beats\.list\[from\]\(ctx\)[\s\S]*for \(let i = loopFrom;/,
  'interactive checkpoint beat is not prepared once and skipped by the later story loop',
);
const ownedRevealStart = runStorySource.indexOf('} else if (from > 0)');
const ownedRevealEnd = runStorySource.indexOf('for (let i = loopFrom', ownedRevealStart);
const ownedRevealSource = runStorySource.slice(ownedRevealStart, ownedRevealEnd);
assert.match(
  ownedRevealSource,
  /ctx\.setInput\(false\);[\s\S]*beats\.applyState\(from, ctx\);[\s\S]*if \(from === 7\)[\s\S]*setLetterbox\?\.\(true\)[\s\S]*cinema\.fade\(false, 800\);/,
  'cinematic checkpoint entry no longer holds input or precomposes beat 7',
);
assert.equal(
  (ownedRevealSource.match(/cinema\.fade\(false, 800\)/g) || []).length,
  1,
  'beat 3 or 5 regained a generic reveal instead of owning its black-to-stage transition',
);
const coatEnd = campSource.indexOf('async function dusk()', coatStart);
assert.match(
  campSource.slice(coatStart, coatEnd),
  /setStage\?\.\('tent'\)[\s\S]*\{ t: 'fade', on: false,/,
  'checkpoint 3 no longer reveals its tent from inside the coat beat',
);
const checkpointDreamStart = dreamSource.indexOf('async function dream()');
assert.match(
  dreamSource.slice(checkpointDreamStart),
  /setStage\?\.\('dream'\)[\s\S]*\{ t: 'fade', on: false,/,
  'checkpoint 5 no longer reveals its field from inside the dream beat',
);
assert.match(beatIndexSource, /setTarget\(c\.joseph\.position\)[\s\S]*setLead\(0, 0\)[\s\S]*camera\.snap\(\)/,
  'checkpoint camera snaps before receiving the resumed actor target');
const castReadyStart = sceneSource.indexOf('const castReady =');
const castReadyEnd = sceneSource.indexOf('})();', castReadyStart);
assert.ok(castReadyStart >= 0 && castReadyEnd > castReadyStart);
assert.doesNotMatch(
  sceneSource.slice(castReadyStart, castReadyEnd),
  /runStory\(/,
  'story starts when rigs finish while narration/readiness loader still owns the screen',
);
assert.match(
  sceneSource,
  /const sceneReady = Promise\.all[\s\S]*ready = true[\s\S]*const activate = \(\) =>[\s\S]*runStory\(startBeat\)[\s\S]*whenReady: sceneReady[\s\S]*activate/,
  'Scene 1 does not separate full readiness from post-reveal story activation',
);
assert.match(
  sceneSource,
  /const textureReadiness = \[\][\s\S]*loadOwnedTexture\(url,[\s\S]*textureReadiness\.push\(whenReady\)[\s\S]*await Promise\.all\(textureReadiness\)[\s\S]*renderer\.compile\(scene, camera\)[\s\S]*finally \{[\s\S]*dream\.group\.visible = wasDream/,
  'texture readiness or prewarm visibility restoration is not owned by the loading gate',
);
assert.match(textureLoaderSource, /const image = new Image\(\)/,
  'texture readiness no longer owns the underlying image request');
assert.match(textureLoaderSource, /signal\?\.addEventListener\('abort', onAbort/,
  'texture image request no longer follows scene abort');
assert.match(textureLoaderSource, /const fail = \(error\) => \{[\s\S]*texture\.dispose\(\)/,
  'failed or aborted textures are not disposed');
assert.match(textureLoaderSource, /onAbort = \(\) => \{[\s\S]*image\.onload = null[\s\S]*image\.src = ''[\s\S]*fail\(/,
  'texture abort ignores the callback but leaves download/decode work alive');
assert.match(textureLoaderSource, /await image\.decode\(\)[\s\S]*texture\.needsUpdate = true/,
  'texture readiness resolves before image decode/upload preparation');
assert.match(
  sceneSource,
  /let beds = null[\s\S]*let music = null[\s\S]*const activate = \(\) =>[\s\S]*audioActivated = true[\s\S]*startBeds\(\)[\s\S]*startMusic\(\)[\s\S]*runStory\(startBeat\)/,
  'Scene 1 starts audible transports before post-reveal activation',
);

// Runtime checkpoint-entry contract: each interactive beat executes its
// objective/guide prefix behind black, cannot enable real input before reveal,
// and is awaited exactly once before the outer loop advances.
for (const index of [1, 2, 4, 6]) {
  let input = true;
  let objectiveOwned = false;
  let guideOwned = false;
  let prepared = 0;
  let invoked = 0;
  let revealed = 0;
  let finishBeat;
  const beatGate = new Promise((resolve) => { finishBeat = resolve; });
  const inputTransitions = [];
  const inputGate = createInputGate((on) => {
    input = on;
    inputTransitions.push(on);
  });

  const nextIndex = await runInteractiveCheckpointEntry({
    index,
    holdInput: () => inputGate.hold(),
    prepare: () => { prepared += 1; },
    invokeBeat: () => {
      invoked += 1;
      assert.equal(isObjectivePrepaintActive(), true,
        `checkpoint ${index} objective prefix ran outside prepaint ownership`);
      inputGate.set(true);
      objectiveOwned = true;
      guideOwned = true;
      return beatGate;
    },
    reveal: async () => {
      revealed += 1;
      assert.equal(isObjectivePrepaintActive(), false,
        `checkpoint ${index} leaked prepaint ownership into reveal`);
      assert.equal(input, false, `checkpoint ${index} enabled input under black`);
      assert.equal(objectiveOwned, true, `checkpoint ${index} revealed before objective ownership`);
      assert.equal(guideOwned, true, `checkpoint ${index} revealed before guide ownership`);
      finishBeat();
    },
  });

  assert.equal(prepared, 1, `checkpoint ${index} applied state more than once`);
  assert.equal(invoked, 1, `checkpoint ${index} invoked its beat more than once`);
  assert.equal(revealed, 1, `checkpoint ${index} revealed more than once`);
  assert.deepEqual(inputTransitions, [false, true], `checkpoint ${index} input hold ordering drifted`);
  assert.equal(nextIndex, index + 1, `checkpoint ${index} did not advance past its consumed beat`);
}

// Every interaction gate ends objective ownership immediately. Cinematic
// hiding alone is insufficient: bars can move before the next goal is set.
for (const marker of ["spoken = true;", "sat = true;", "rested = true;"]) {
  const at = campSource.indexOf(marker);
  const clear = campSource.indexOf('ctx.hud.clearObjective?.()', at);
  assert.ok(at >= 0 && clear > at && clear < at + 180,
    `${marker} does not synchronously clear its completed objective`);
}
const dreamEntry = dreamSource.indexOf('async function dream()');
assert.ok(
  dreamSource.indexOf('ctx.hud.clearObjective?.()', dreamEntry) < dreamSource.indexOf('await seq([', dreamEntry),
  'dream entry can reveal a stale gameplay objective during its first bar transition',
);

const bundles = [
  { position: { x: 6, z: 0 }, userData: {} },
  { position: { x: 1, z: 0 }, userData: {} },
  { position: { x: -2, z: 0 }, userData: {} },
];
assert.equal(
  nearestUnbowedBundle(bundles, { x: 0, z: 0 }),
  bundles[1],
  'dream guide does not choose the nearest unbowed bundle',
);
bundles[1].userData.bowed = true;
assert.equal(
  nearestUnbowedBundle(bundles, { x: 0, z: 0 }),
  bundles[2],
  'dream guide does not retarget after the nearest bundle bows',
);
bundles[0].userData.bowed = true;
bundles[2].userData.bowed = true;
assert.equal(nearestUnbowedBundle(bundles, { x: 0, z: 0 }), null, 'dream guide does not clear at completion');
const bundleTrigger = dreamSource.slice(
  dreamSource.indexOf("id: `sheaf${i}`"),
  dreamSource.indexOf('ctx.guide.setTarget(null);', dreamSource.indexOf("id: `sheaf${i}`")),
);
assert.match(
  bundleTrigger,
  /s\.userData\.bowed = true;[\s\S]*retargetBundleGuide\(\);[\s\S]*if \(bowed >= D\.outer\.length\) resolve\(\);/,
  'dream guide is not retargeted after each bundle trigger',
);

const gatherStart = tellingSource.indexOf('async function gatherCircle(');
const gatherEnd = tellingSource.indexOf('// Genesis 37:5', gatherStart);
const gatherSource = tellingSource.slice(gatherStart, gatherEnd);
const gatherAll = gatherSource.indexOf('await Promise.all([');
const josephWalk = gatherSource.indexOf('ctx.controller.scriptMoveTo(0.9, -4.1, 1.45)', gatherAll);
const brotherWalks = gatherSource.indexOf('...TELL_RING.map', gatherAll);
assert.ok(
  gatherAll >= 0 && josephWalk > gatherAll && brotherWalks > gatherAll,
  'Joseph and the brothers no longer gather concurrently',
);
assert.doesNotMatch(gatherSource, /ctx\.joseph\.setPosition\(/, 'gatherCircle restored Joseph’s visible teleport');
assert.match(
  gatherSource,
  /finally \{[\s\S]*cancelScriptMove\(\);[\s\S]*vel\.set\(0, 0\);[\s\S]*\}/,
  'gatherCircle does not clean up its scripted walk on abort/stall',
);

assert.match(campSource, /ctx\.hud\.setObjective\('Rest in your tent\.'\);/);
assert.doesNotMatch(
  campSource,
  /The night has turned cold with them\. Go to your tent and rest\./,
  'dusk objective regressed to the long instruction',
);

const bakedSourceManifest = JSON.parse(await read('../public/audio/vo/source-manifest.json'));
assert.deepEqual(
  bakedSourceManifest,
  createSourceManifest(),
  'narrator source changed without regenerating the matching VO (`npm run vo -- --id <line-id>`)',
);

console.log('Scene 1 canonical order, verse source, checkpoint, and objective handoff checks passed.');
