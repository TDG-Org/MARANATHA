// DEFECTS THAT BREAK A PLAYER.
//
// Every case here was found by a hunt prompted by one real bug: an opaque
// overlay sat on top of the touch joystick and swallowed its presses, so a
// player on a phone could not move. None of these are visible in a code review
// and none of them throw — the game keeps running and simply stops obeying.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import './harness/dom.mjs';
import { bootScene, undisposedFrom } from './harness/scene.mjs';
import { getCheckpoint, resetProgress, saveGeneration, setCheckpoint } from '../src/systems/SaveSystem.js';
import { createCheckpointPersistence } from '../src/scenes/joseph3d/checkpointEntry.js';

// ── 1. PAUSING MUST NOT DISABLE MOVEMENT FOREVER ────────────────────────────
//
// The pause menu restores input on resume by asking the SCENE what it wants:
// `setInput(isInputOn())`. If a scene answers that question by reading the
// controller's own live flag, it is reading the value pause set to false on the
// way in — so resume restores OFF, permanently, on keyboard and touch alike.
// The ark did exactly this. Measured before the fix: after one Esc-open-close,
// 45 frames of held W moved the player 0.0000u, and a 10-second soak never
// healed it.
{
  const { buildNoahArk } = await import('../src/scenes/noah/index.js');
  const booted = await bootScene(buildNoahArk);
  const instance = booted.instance ?? booted;
  const controller = instance.debug?.controller;
  assert.ok(controller, 'the ark must expose its controller for this check');
  assert.equal(controller.enabled, true, 'input starts enabled');

  // Walk, to prove movement works before the pause.
  const start = instance.debug.player.position.clone();
  booted.hold?.('w', 30);
  const movedBefore = instance.debug.player.position.distanceTo(start);
  assert.ok(movedBefore > 0.5, `precondition: the player can walk (moved ${movedBefore.toFixed(3)}u)`);

  // A disable/enable round trip must leave the player able to walk. NOTE this
  // deliberately does NOT claim to exercise the pause menu: the scene does not
  // expose its isInputOn/setInput handles, so a check written that way would
  // fall back to `true` and pass with the bug fully present — vacuous. The
  // pause CONTRACT is guarded at source level below; this proves the controller
  // itself round-trips.
  controller.setEnabled(false);
  const whileOff = instance.debug.player.position.clone();
  booted.hold?.('w', 30);
  assert.ok(instance.debug.player.position.distanceTo(whileOff) < 0.1,
    'disabled input must actually stop the player');
  controller.setEnabled(true);
  const afterPause = instance.debug.player.position.clone();
  booted.hold?.('w', 45);
  const movedAfter = instance.debug.player.position.distanceTo(afterPause);
  assert.ok(movedAfter > 0.5,
    `re-enabling input must let the player walk again — moved only ${movedAfter.toFixed(4)}u`);
  instance.dispose?.();
}

// Source-level guard for the same trap in EVERY scene, since the runtime check
// above can only reach what a scene chooses to expose.
{
  for (const file of ['src/scenes/noah/index.js', 'src/scenes/joseph3d/index.js']) {
    const src = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    const m = src.match(/isInputOn:\s*\(\)\s*=>\s*([^,\n]+)/);
    assert.ok(m, `${file} must tell the pause menu how to read its input state`);
    assert.ok(
      !/controller\??\.enabled/.test(m[1]),
      `${file}: isInputOn reads the controller's own flag (${m[1].trim()}). The pause menu `
      + 'sets that flag to false before it asks, so resume restores OFF and the player is '
      + 'frozen for the rest of the visit. Keep a scene-owned variable instead.',
    );
  }
}

// ── 2. "RESET PROGRESS" MUST STICK ──────────────────────────────────────────
//
// The pause ⚙ is reachable at every moment of the story, so a player can reset
// mid-scene. Only the home screen ever passed an onReset hook, so a reset from
// inside a story cleared localStorage and the very next beat wrote its
// checkpoint straight back — after a modal that said "This cannot be undone".
{
  setCheckpoint('joseph3d', 4);
  assert.equal(getCheckpoint('joseph3d'), 4, 'precondition: a checkpoint exists');

  const persistence = createCheckpointPersistence({
    saveBeat: (beat) => setCheckpoint('joseph3d', beat),
    saveCompletion: () => {},
  });
  persistence.checkpoint(5);
  assert.equal(getCheckpoint('joseph3d'), 5, 'a live story writes its checkpoints');

  const before = saveGeneration();
  resetProgress();
  assert.notEqual(saveGeneration(), before, 'a reset must bump the generation');
  assert.equal(getCheckpoint('joseph3d'), 0, 'the save is cleared');

  persistence.checkpoint(6);
  persistence.complete();
  assert.equal(getCheckpoint('joseph3d'), 0,
    'a story still running after a reset must NOT write its progress back — the '
    + 'confirm modal promised this could not be undone');

  // ...and a story started AFTER the reset must save normally again.
  const fresh = createCheckpointPersistence({
    saveBeat: (beat) => setCheckpoint('joseph3d', beat),
    saveCompletion: () => {},
  });
  fresh.checkpoint(2);
  assert.equal(getCheckpoint('joseph3d'), 2, 'a new story saves normally after a reset');
  resetProgress();
}

// ── 3. NOTHING MAY BE PARKED UNDER THE PERSISTENT VOLUME CONTROL ────────────
//
// #volume is fixed at top-right with z-index 30 and is always present. The
// ark's HUD put its settings gear at the same anchor inside a z-index-24 root,
// so the button was 100% dead on every phone (0 of 49 elementFromPoint probes
// reached it) AND destructive: a real press fell through to the master-volume
// slider and slammed it from 0.30 to 0.83. ui/pause.js offsets its own gear to
// 56px for exactly this reason.
{
  const TOP_RIGHT = /top:\s*calc\(12px[^;]*;\s*right:\s*calc\(14px/;
  for (const file of ['src/scenes/noah/hud.js', 'src/screens/playground.js', 'src/ui/storyHud.js']) {
    let src;
    try { src = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'); } catch { continue; }
    for (const line of src.split('\n')) {
      if (!TOP_RIGHT.test(line)) continue;
      assert.fail(
        `${file} pins a surface to the top-right corner at 12px, which the persistent `
        + `#volume control (z-index 30) already owns:\n    ${line.trim().slice(0, 120)}\n`
        + 'Offset it like ui/pause.js does (56px), or the control is dead and its press '
        + 'moves the player\'s volume instead.',
      );
    }
  }
}


// ── 4. THE MAIN STORY MUST GIVE ITS TEXTURES BACK ───────────────────────────
//
// A real, measured leak: entering and leaving the Joseph story left ONE extra
// 512x512 on the GPU every time. Measured live in Chrome across five cycles —
// home-screen textures 5, 6, 7, 8, 9, monotonic, while geometries and shader
// programs both returned cleanly to zero.
//
// The cause is worth remembering because it is invisible to a graph walk taken
// at the wrong moment: the scene loads four file textures and OWNS them, but
// only disposed the ones `disposeDeep` happened to reach. `brick` is used by
// the pit stage alone, and `pit.dispose()` runs FIRST and takes its group with
// it — correctly leaving a shared texture alone, since a stage must not free
// what it borrowed. So nothing freed it.
//
// Until now nothing executed this scene at all: every other test reads its
// SOURCE. tools/test-scene-runtime.mjs censuses the ark, and the ark alone.
{
  const { buildJoseph3D } = await import('../src/scenes/joseph3d/index.js');
  const booted = await bootScene(buildJoseph3D);
  const before = booted.census();
  assert.ok(before.textures > 0, `the live story must own textures (got ${before.textures})`);

  // Snapshot while ALIVE, then judge that snapshot. A census taken after
  // teardown walks an empty graph, so "undisposed === 0" passes vacuously —
  // and a detached-but-never-disposed object is exactly the leak shape.
  booted.disposeScene();
  await booted.disposeDeep();
  const after = undisposedFrom(before);
  assert.equal(after.textures, 0,
    `${after.textures} of ${before.textures} textures the story owned were never disposed — `
    + 'each one is a GPU allocation the player keeps for the rest of the session, every '
    + 'time they enter the story');
  assert.equal(after.geometries, 0,
    `${after.geometries} of ${before.geometries} geometries were never disposed`);
}

// ── 5. A SETTING THE PLAYER CHOSE MUST SURVIVE A RELOAD ─────────────────────
//
// Graphics reads four localStorage keys through one helper that validated
// EVERY value against the preset table — so `'on'`/`'off'` (the colour grade)
// and `'saver'`/`'balanced'`/`'max'` (the frame-rate dial) could never pass.
// Both were written on every click and thrown away on every load: a player who
// chose Saver for heat, or turned the grade off to buy frames, silently got
// Balanced and Rich back every single time they opened the game.
{
  const { GraphicsSystem } = await import('../src/systems/Graphics.js');
  const store = () => {
    const map = new Map();
    return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), map };
  };

  for (const [rate, grade] of [['saver', false], ['max', false], ['balanced', true], ['max', true]]) {
    const storage = store();
    const first = new GraphicsSystem({ storage, detectedPreset: 'medium' });
    first.setFrameRate(rate);
    first.setColourGrade(grade);
    assert.equal(first.frameRate, rate, 'precondition: the choice applies in the session');
    assert.equal(first.colourGrade, grade, 'precondition: the grade applies in the session');

    // A NEW instance over the SAME storage is exactly what a reload is.
    const reloaded = new GraphicsSystem({ storage, detectedPreset: 'medium' });
    assert.equal(reloaded.frameRate, rate,
      `frame rate "${rate}" did not survive a reload (got "${reloaded.frameRate}") — `
      + 'the dial writes to storage and the loader throws the value away');
    assert.equal(reloaded.colourGrade, grade,
      `colour grade ${grade} did not survive a reload (got ${reloaded.colourGrade})`);
  }

  // A junk or hand-edited value must fall back, not crash or stick.
  {
    const storage = store();
    storage.setItem('maranatha-frame-rate', 'ludicrous');
    storage.setItem('maranatha-colour-grade', 'maybe');
    storage.setItem('maranatha-graphics-v1', 'ultra');
    const g = new GraphicsSystem({ storage, detectedPreset: 'medium' });
    assert.equal(g.frameRate, 'balanced', 'an unknown frame rate falls back to the default');
    assert.equal(g.colourGrade, true, 'an unknown grade value falls back to on');
    assert.ok(['low', 'medium', 'high'].includes(g.name), 'an unknown preset falls back to a real one');
  }
}

// -- 6. A SCENE MUST FREE THE FILE TEXTURES IT LOADED, ITSELF ---------------
//
// The ownership rule, enforced directly. Leaning on disposeDeep() is what let
// the brick leak ship: it sweeps whatever is still hanging on the graph when it
// runs, so a texture used only by a stage that already disposed its own group
// is freed by nobody, while its neighbours on long-lived objects are freed by
// luck.
//
// Measured honestly: the ark does NOT leak today either way (five cycles in a
// real browser, textures flat at 0 with and without its own disposal, because
// disposeDeep happens to reach its two). That is exactly why the RULE is
// asserted here rather than the symptom -- the ark is one refactor away from
// the story's bug, and an assertion that only fires on today's symptom would
// have passed on the ark while it was one line from breaking.
{
  const scenes = [
    ['the story', '../src/scenes/joseph3d/index.js', 'buildJoseph3D'],
    ['the ark', '../src/scenes/noah/index.js', 'buildNoahArk'],
  ];
  for (const [label, path, exportName] of scenes) {
    const mod = await import(path);
    const booted = await bootScene(mod[exportName]);
    const owned = [...booted.census().sets.textures]
      .filter((t) => String(t.image && t.image.src || '').includes('textures/'));
    assert.ok(owned.length > 0, `${label} must load at least one file texture (found ${owned.length})`);

    const freed = new Set();
    for (const t of owned) {
      const original = t.dispose.bind(t);
      t.dispose = () => { freed.add(t); original(); };
    }
    booted.disposeScene(); // the scene's OWN dispose, before any sweeper runs
    const missed = owned.filter((t) => !freed.has(t))
      .map((t) => String(t.image && t.image.src || '').split('/').pop());
    assert.equal(missed.length, 0,
      `${label} loaded ${owned.length} file textures and its own dispose() freed `
      + `${freed.size}. Never freed: ${missed.join(', ')}. A scene owns what it loads - `
      + 'disposeDeep only reaches what is still on the graph when it runs.');
    await booted.disposeDeep();
  }
}


console.log(
  'player traps passed: pause restores input in every scene (no scene answers '
  + '"is input on?" from the flag pause clears), a reset survives a running story, '
  + 'nothing is parked under the persistent volume control, and the main story '
  + 'gives every texture and geometry it owns back on dispose.',
);
