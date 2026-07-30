import assert from 'node:assert/strict';
import { STORIES } from '../src/data/stories.js';
import { statusOf } from '../src/systems/SaveSystem.js';
import { readFile } from 'node:fs/promises';
import { AUDIO_MANIFEST } from '../src/data/audioManifest.js';
import { SCENE1_CANONICAL_ORDER, SCENE1_ROUTING, WEB } from '../src/data/versesWEB.js';
import { nearestUnbowedBundle } from '../src/scenes/joseph3d/beats/helpers.js';
import { finishNarratedHold } from '../src/scenes/joseph3d/beats/telling.js';
import {
  createCheckpointPersistence,
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
  homeSource,
  dreamFieldSource,
] = await Promise.all([
  read('../src/scenes/joseph3d/beats/dream.js'),
  read('../src/scenes/joseph3d/beats/telling.js'),
  read('../src/scenes/joseph3d/beats/index.js'),
  read('../src/scenes/joseph3d/beats/coldOpen.js'),
  read('../src/scenes/joseph3d/beats/camp.js'),
  read('../src/scenes/joseph3d/index.js'),
  read('../src/scenes/joseph3d/pit.js'),
  read('../src/engine/textureLoader.js'),
  read('../src/screens/home/index.js'),
  read('../src/scenes/joseph3d/dreamField.js'),
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

const audioKeys = AUDIO_MANIFEST.map(({ key }) => key);
assert.ok(audioKeys.includes('music.dark_amb'), 'reusable dark ambience is missing from the manifest');
assert.ok(audioKeys.includes('sfx.boy_crying'), 'Nate-supplied pit sniffles are missing from the manifest');
const sniffles = AUDIO_MANIFEST.find(({ key }) => key === 'sfx.boy_crying')?.seconds;
assert.ok(
  sniffles >= 4 && sniffles <= 5,
  `pit sniffles must stay in the requested 4-5 second window (got ${sniffles})`,
);
assert.equal(audioKeys.includes('music.betrayal_dark'), false, 'scene-specific dark music key returned');
assert.equal(audioKeys.includes('music.pit_sad'), false, 'redundant pit music key returned');
assert.match(sceneSource, /0:\s*'music\.dark_amb'/,
  'the cold open does not enter on the reusable dark ambience');
const cryingCueAt = coldOpenSource.indexOf("ctx.sound('sfx.boy_crying')");
const cryingCueEnd = coldOpenSource.indexOf("ctx.hud.emote('Joseph is sad')", cryingCueAt);
assert.ok(cryingCueAt >= 0 && cryingCueEnd > cryingCueAt, 'pit crying cue is missing');
assert.doesNotMatch(
  coldOpenSource.slice(cryingCueAt, cryingCueEnd),
  /setMusic\(/,
  'pit crying starts a second music bed instead of keeping dark ambience',
);
assert.match(sceneSource, /grassTex = loadTiled\([^;]+THREE\.MirroredRepeatWrapping\)/,
  'Scene 1 grass no longer uses seam-safe mirrored wrapping');
assert.match(sceneSource, /grassTex = loadTiled\('textures\/grass\.jpg', 76, 34,/,
  'Scene 1 grass facets are no longer using the finer approved tiling');
// The home is DOM/CSS/SVG only. `flat` is what lets the app hide the canvas and
// submit ZERO GPU frames while the menu is up — the single largest idle-power
// win in the app. It must never regress into a 3D screen by accident.
assert.match(homeSource, /return \{ flat: true,/,
  'the home screen no longer declares `flat` — the app would keep rendering GPU frames behind the menu');
assert.doesNotMatch(homeSource, /from 'three'/,
  'the home screen imported Three.js again — the flat menu must cost no WebGL work');
assert.match(
  beatIndexSource,
  /if \(n >= 6\) stageTellingAmbient\(\)/,
  'telling checkpoint resume does not stage ambient actors behind its entry veil',
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
  { beat: 'cold-open', voice: 'MIXED', line: 'Simeon/Joseph/brothers exchange (text) · gen_37_24 (verse card + VO)' },
  { beat: 'intro', voice: 'NARRATOR', line: 'gen_37_1 (verse card + VO)' },
  { beat: 'herd', voice: 'CHARACTER', line: 'Two unnamed brothers give practical flock directions (text; no verse)' },
  { beat: 'report', voice: 'MIXED', line: 'Jacob/Joseph enact the report (text) · then full gen_37_2 (verse card + VO)' },
  { beat: 'coat', voice: 'MIXED', line: 'Jacob + brothers speak (text) · verses 37:3, 37:4 narrated — no line quotes its verse' },
  { beat: 'dusk', voice: 'CHARACTER', line: 'Judah mocks Joseph’s tunic by the fire (text) · Rest objective + Sit prompt' },
  { beat: 'dream-and-first-telling', voice: 'MIXED', line: 'dream 1: narr-dream-begins + 37:7 · Joseph tells only the brothers (text) · 37:5, 37:8 narrated · then dream 2' },
  { beat: 'second-telling', voice: 'MIXED', line: 'Joseph tells dream 2 to his brothers · 37:9 narrated · then tells his father and brothers · Jacob reacts · 37:10 narrated' },
  { beat: 'close', voice: 'NARRATOR', line: 'gen_37_11 (verse card + VO) + tease title' },
], 'Scene 1 routing table drifted from the current canonical verse placements');

let skippedHoldElapsed = 0;
await finishNarratedHold({
  verseResult: { status: 'skipped' },
  duration: 12500,
  getElapsed: () => skippedHoldElapsed,
  setElapsed: (value) => { skippedHoldElapsed = value; },
  settled: new Promise(() => {}), // skip must never wait on the driver (a hang here IS the failure)
});
assert.equal(skippedHoldElapsed, 12500, 'Skip narration did not release the full orbit hold');

// The un-skipped hold is ONE driver-settled promise — zero polling wake-ups.
{
  let elapsed = 400;
  let release;
  const settled = new Promise((resolve) => { release = resolve; });
  let landed = false;
  const pending = finishNarratedHold({
    verseResult: { status: 'done' },
    duration: 1000,
    getElapsed: () => elapsed,
    setElapsed: (value) => { elapsed = value; },
    settled,
  }).then(() => { landed = true; });
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(landed, false, 'the narrated hold released before its driver finished');
  elapsed = 1000;
  release();
  await pending;
  assert.equal(landed, true);
}
assert.doesNotMatch(
  tellingSource,
  /while \(getElapsed\(\) < duration\)/,
  'the narrated hold regressed to a polling loop',
);
const narratedHoldCall = tellingSource.indexOf('await finishNarratedHold({');
const narratedHoldRelease = tellingSource.indexOf('ctx.camera.setPoseDriver(null)', narratedHoldCall);
assert.ok(
  narratedHoldCall >= 0 && narratedHoldRelease > narratedHoldCall,
  'first-dream camera driver is not released after the narrated hold',
);

const summitGate = dreamSource.indexOf("id: 'summit-reach'");
const summitClear = dreamSource.indexOf('ctx.hud.clearObjective?.()', summitGate);
const summitLock = dreamSource.indexOf('ctx.setInput(false)', summitGate);
assert.ok(
  summitGate >= 0 && summitClear > summitGate && summitClear < summitLock,
  'summit objective is not cleared synchronously at its gate',
);
assert.doesNotMatch(tellingSource, /objectiveEl\.textContent/, 'telling still infers story state from DOM');
{
  const gather = tellingSource.indexOf('async function gatherCircle');
  const prompt = tellingSource.indexOf('ctx.interactables.addPrompt({', gather);
  const commit = tellingSource.indexOf('committed = true', prompt);
  const black = tellingSource.indexOf("{ t: 'fade', on: true, ms: 260 }", commit);
  const reserve = tellingSource.indexOf('await reserveTellingAmbient()', black);
  const seat = tellingSource.indexOf('for (const [key, angle] of TELL_RING)', reserve);
  const camera = tellingSource.indexOf('ctx.camera.cutTo', seat);
  const reveal = tellingSource.indexOf("{ t: 'fade', on: false, ms: 620 }", camera);
  assert.ok(
    gather >= 0 && prompt > gather && commit > prompt && black > commit
      && reserve > black && seat > reserve && camera > seat && reveal > camera,
    'telling no longer requires an explicit sit prompt before covered staging',
  );
  assert.match(
    tellingSource.slice(prompt, commit),
    /label: 'Sit and tell your dream'/,
    'telling prompt does not clearly name the player action',
  );
}
{
  const wakeStart = dreamSource.indexOf('async function wakeToCamp');
  const wakeBlack = dreamSource.indexOf("{ t: 'fade', on: true, ms: 650 }", wakeStart);
  const stageAmbient = dreamSource.indexOf('stageTellingAmbient()', wakeBlack);
  const wakeReveal = dreamSource.indexOf("{ t: 'fade', on: false, ms: 700 }", stageAmbient);
  assert.ok(
    wakeStart >= 0 && wakeBlack > wakeStart && stageAmbient > wakeBlack && wakeReveal > stageAmbient,
    'ambient telling arc is not staged completely under black',
  );
}
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
const herdSource = campSource.slice(0, reportStart);
assert.match(herdSource, /ctx\.cast\.brother5[\s\S]*ctx\.cast\.brother1/);
assert.doesNotMatch(
  herdSource,
  /ctx\.cast\.(?:simeon|levi)|dialogue\.say\('(?:Simeon|Levi)'/,
  'the flock beat assigns Bilhah/Zilpah-son staging to Leah’s named sons',
);
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
assert.doesNotMatch(
  coldOpenSource,
  /pitTalk|futureSoft|grading\.set\('ominous'\)/,
  'cold-open cuts still swap to a different global exposure',
);
assert.match(
  coldOpenSource,
  /BACKGROUND_CAST\.forEach\(\(n\) => \{ n\.char\.root\.visible = false; \}\)/,
  'unrelated camp characters can still leak into the pit background',
);
assert.match(
  coldOpenSource,
  /BACKGROUND_CAST\.forEach\(\(n, i\) => \{[\s\S]*backgroundVisibility\[i\]/,
  'pit-only cast visibility is not restored under the morning black',
);
assert.match(pitSource, /const MEAL = \{ x: PIT\.x \+ 31, z: PIT\.z - 9\.5 \}/,
  'the meal camp drifted back beside the cistern');
assert.match(pitSource, /const campTents = new THREE\.InstancedMesh\(/,
  'the distant tree/fire destination has no readable camp silhouette');
assert.match(
  sceneSource,
  /ground\.material\.color\.set\(name === 'pit' \? 0x46505c : 0xffffff\)/,
  'the shared grass landscape no longer recedes into night at the pit stage',
);
assert.match(
  await read('../src/engine/MoodGrading.js'),
  /pit:\s*\{\s*skyTop:\s*0x1c2238,[\s\S]*ridge:\s*\[0x4e5265,\s*0x414556,\s*0x303442\]/,
  'the cold-open sky or ridges drifted back to the bright overcast-day palette',
);
{
  const heaveStart = coldOpenSource.indexOf('await ctx.motion.tween(1250');
  const heaveEnd = coldOpenSource.indexOf('P.setSkyLight(1)', heaveStart);
  const fallStart = coldOpenSource.indexOf('const D = 4600', heaveEnd);
  assert.ok(
    heaveStart >= 0 && heaveEnd > heaveStart && fallStart > heaveEnd,
    'shaft glow returned to an exterior cold-open shot',
  );
  const walkOff = coldOpenSource.indexOf('// SHOT 5', fallStart);
  const shaftOff = coldOpenSource.indexOf('P.setSkyLight(0)', walkOff);
  const mealOn = coldOpenSource.indexOf('P.setMealGlow(1)', walkOff);
  assert.ok(
    walkOff > fallStart && shaftOff > walkOff && mealOn > shaftOff,
    'walk-off can still paint the fall-only shaft disc',
  );
}
assert.doesNotMatch(coldOpenSource, /throne, dreamer|who: 'Judah'.*becomes of your dreams/s);
assert.match(coldOpenSource, /who: 'Brothers'[\s\S]*becomes of his dreams/);
assert.doesNotMatch(pitSource, /camp they return to|CAMPFIRES|setCampGlow|campGlow/);
const preCoat = campSource.slice(0, coatStart);
assert.doesNotMatch(preCoat, /father.s favorite|all you.re good for/i,
  'favoritism/hatred arrives before Genesis 37:3–4');
assert.doesNotMatch(campSource, /prince|gift I did not look for|Let all of Hebron/i);
assert.match(
  dreamSource,
  /setObjective\(`Walk to the wheat bundles — \$\{bowed\} of \$\{D\.outer\.length\}\.`\)/,
  'the wheat objective loses its action verb after the first bundle',
);
assert.match(
  dreamSource,
  /ctx\.camera\.snap\(\);\s*[\s\S]*await wait\(900\);\s*await seq\(\[/,
  'first-dream exact stage state is not settled behind black before reveal',
);
assert.match(
  dreamSource,
  /heading: 'That night, Joseph dreamed again'/,
  'second-dream bottom-right context title is missing',
);
assert.match(
  sceneSource,
  /fullRate: \(\) =>[\s\S]*activeStage === 'dream'/,
  'animated dream exploration can still fall into the eco frame-rate target',
);
assert.doesNotMatch(
  dreamSource,
  /setObjective\(`The wheat bundles bow/,
  'a status sentence replaced the actionable wheat objective',
);
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
  /const textureReadiness = \[\][\s\S]*loadOwnedTexture\(url,[\s\S]*textureReadiness\.push\(whenReady\)[\s\S]*await Promise\.all\(textureReadiness\)[\s\S]*new THREE\.WebGLRenderTarget\(32, 32,[\s\S]*renderer\.compile\(scene, warmCamera\)[\s\S]*renderer\.render\(scene, warmCamera\)[\s\S]*finally \{[\s\S]*renderer\.setRenderTarget\(priorTarget\)[\s\S]*warmTarget\.dispose\(\)[\s\S]*dream\.group\.visible = wasDream/,
  'texture readiness or prewarm visibility restoration is not owned by the loading gate',
);
assert.match(textureLoaderSource, /const image = new Image\(\)/,
  'texture readiness no longer owns the underlying image request');
assert.match(textureLoaderSource, /signal\?\.addEventListener\('abort', onAbort/,
  'texture image request no longer follows scene abort');
assert.match(textureLoaderSource, /const fail = \(error\) => \{[\s\S]*texture\.dispose\(\)/,
  'failed or aborted textures are not disposed');
assert.match(textureLoaderSource, /cancelOwned = \(reason = makeAbortError[\s\S]*?image\.onload = null[\s\S]*?image\.src = ''[\s\S]*?fail\(reason\)/,
  'owned texture cancellation leaves download/decode work alive');
assert.match(textureLoaderSource, /onAbort = \(\) => cancelOwned\(signal\?\.reason/,
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
assert.match(
  gatherSource,
  /\{ t: 'fade', on: true, ms: 260 \}[\s\S]*for \(const \[key, angle\] of TELL_RING\)[\s\S]*ctx\.joseph\.setPosition\(TELLING_JOSEPH_MARK\.x, TELLING_JOSEPH_MARK\.z\)[\s\S]*ctx\.camera\.cutTo\([\s\S]*\{ t: 'fade', on: false, ms: 620 \}/,
  'telling circle is not staged and framed entirely under one covered cut',
);
assert.match(
  gatherSource,
  /n\.target = null;[\s\S]*n\.onArrive\?\.resolve\?\.\(false\);[\s\S]*n\.onArrive = null;/,
  'covered telling staging leaves an older NPC walk owner active',
);
assert.match(
  gatherSource,
  /finally \{[\s\S]*cancelScriptMove\(\);[\s\S]*vel\.set\(0, 0\);[\s\S]*\}/,
  'gatherCircle does not clean up its scripted walk on abort/stall',
);
assert.match(
  sceneSource,
  /debugBeatValue !== null && debugBeatValue !== ''[\s\S]*Number\.isInteger\(debugBeat\)[\s\S]*debugBeat >= 0 && debugBeat <= 7/,
  'debug checkpoint replay is unbounded or treats a missing query as beat zero',
);
{
  const writes = [];
  const isolated = createCheckpointPersistence({
    isolated: true,
    saveBeat: (beat) => writes.push(['beat', beat]),
    saveCompletion: () => writes.push(['complete']),
  });
  isolated.checkpoint(6);
  isolated.complete();
  assert.deepEqual(writes, [],
    'debug beat replay mutated persistent checkpoint/progress');

  const normal = createCheckpointPersistence({
    isolated: false,
    saveBeat: (beat) => writes.push(['beat', beat]),
    saveCompletion: () => writes.push(['complete']),
  });
  normal.checkpoint(3);
  normal.complete();
  assert.deepEqual(writes, [['beat', 3], ['complete']],
    'normal story persistence was disabled by debug isolation');
}
assert.match(
  sceneSource,
  /const persistence = createCheckpointPersistence\(\{[\s\S]*isolated: debugBeatReplay,[\s\S]*saveBeat: \(beat\) => setCheckpoint\('joseph3d', beat\),[\s\S]*setSceneProgress\('joseph', 1\);[\s\S]*clearCheckpoint\('joseph3d'\);/,
  'Scene 1 persistence does not route through the debug-isolation boundary',
);
assert.equal(
  (sceneSource.match(/\bsetCheckpoint\('joseph3d'/g) || []).length,
  1,
  'Scene 1 bypasses the persistence boundary for checkpoint writes',
);
assert.match(
  sceneSource,
  /finish: \(\) => \{[\s\S]*persistence\.complete\(\);[\s\S]*app\.navigate\('home'\)/,
  'story completion bypasses debug save isolation',
);

assert.match(
  campSource,
  /'The night has turned cold with your brothers\.'[\s\S]*'Go back to your tent and rest\.'/,
  'dusk objective lost its emotional context or clear action hint',
);
{
  const coatVerse = campSource.indexOf('WEB.gen_37_3');
  // The ORDER is the contract, not the fade's duration.
  const outsideBlack = campSource.indexOf("{ t: 'fade', on: true,", coatVerse);
  const hideTent = campSource.indexOf('T.group.visible = false', outsideBlack);
  const showCamp = campSource.indexOf("ctx.setStage?.('camp')", hideTent);
  const settle = campSource.indexOf("{ t: 'wait', ms:", showCamp);
  const judah = campSource.indexOf("who: 'Judah', text: 'A special tunic", showCamp);
  assert.ok(
    outsideBlack >= 0 && hideTent > outsideBlack && showCamp > hideTent && judah > showCamp,
    'Judah envy shot reveals before the exterior camp owns stage visibility',
  );
  // Waking the camp stage is the heaviest frame in the beat. It must land
  // behind the black, not on the reveal, or the cut reads as a hitch.
  assert.ok(
    settle > showCamp && settle < judah,
    'the camp stage is revealed without settling behind the black first',
  );
}
assert.match(tellingSource, /Enough, Joseph\. What is this dream you have dreamed\?/);
// Nate asked for the NEAR rocks to bounce three separate times before the right
// ones were found: the magical stones at r 17.5+ always bobbed, but the border
// boulders at r ~14.3-15.4 — the ones actually in his eyeline — were written
// once at build and never touched again. Both must animate, and the boulders
// must never dip through the ground.
assert.match(dreamFieldSource, /writeBorderRocks\(t\)/,
  'the dream border boulders stopped animating — the near rocks are stationary again');
assert.match(dreamFieldSource, /const rise = 0\.45 \+ rnd\(\) \* 0\.4;[\s\S]*rise \+ 0\.45 \+ rnd\(\) \* 0\.45/,
  'the border boulder arc no longer guarantees its hover exceeds its rise (they would sink through the ground)');
// The bushes share that ring at the same distance and read as stones in dream
// light. If only the boulders move, two thirds of the near ring is still frozen.
assert.match(dreamFieldSource, /if \(borderBush && borderBushSpots\)/,
  'the dream border bushes went static again — most of the near ring would be frozen');
// An InstancedMesh caches the bounding sphere from its build-time matrices, so
// a ring that now rises must opt out of frustum culling or it can pop away.
assert.match(dreamFieldSource, /borderRock\.frustumCulled = false;[\s\S]*borderBush\.frustumCulled = false;/,
  'the animated border ring can be frustum-culled against its stale bounding sphere');
assert.match(dreamSource, /setNameTagSuppressed\?\.\(ctx\.joseph, true\)/);
assert.match(dreamSource, /ctx\.sunSprite\.visible = false/);
assert.match(
  sceneSource,
  /activeStage === 'camp' \|\| activeStage === 'dream'[\s\S]*!ctx\.sequencer\.running/,
  'Joseph name tag is not available during interactive dream play',
);

const bakedSourceManifest = JSON.parse(await read('../public/audio/vo/source-manifest.json'));
assert.deepEqual(
  bakedSourceManifest,
  createSourceManifest(),
  'narrator source changed without regenerating the matching VO (`npm run vo -- --id <line-id>`)',
);

console.log('Scene 1 canonical order, verse source, checkpoint, and objective handoff checks passed.');

// ── PROGRESSION MUST SURVIVE A SECOND PLAYABLE CHAPTER ───────────────────────
// The map asks statusOf() which chapter the player is up to, and it answers
// "the first playable one you have not completed". The ark broke that: it is
// walkable (so playable) but has NO story and therefore no completion path, and
// it sits EARLIER in the book than Joseph — so it took 'current' and could never
// hand it on, leaving the one finished story marked locked forever.
//
// Chapters that are places rather than stories carry `explore: true` and stay
// out of the reckoning. Remove that flag when a chapter gets its beats.
{
  const explorable = STORIES.filter((s) => s.sceneKey && s.explore);
  const realStories = STORIES.filter((s) => s.sceneKey && !s.explore);
  assert.ok(realStories.length > 0, 'at least one playable chapter is a real story');

  // Whatever else is playable, the first REAL story is the one you are up to.
  const first = realStories[0];
  assert.equal(
    statusOf(first.id), 'current',
    `the first unfinished real story (${first.id}) must be the current chapter`,
  );
  for (const s of explorable) {
    assert.notEqual(
      statusOf(s.id), 'current',
      `${s.id} is explorable, not a chapter to be up to — it can never be completed`,
    );
    // ...but it must still be reachable: sceneKey is what lights it on the map.
    assert.ok(s.sceneKey, `${s.id} still needs a sceneKey to be playable at all`);
  }
  console.log(`progression: ${realStories.length} real ${realStories.length === 1 ? 'story' : 'stories'}, `
    + `${explorable.length} explorable; current = ${first.id}`);
}
