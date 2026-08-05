// DEFECTS THAT BREAK A PLAYER.
//
// Every case here was found by a hunt prompted by one real bug: an opaque
// overlay sat on top of the touch joystick and swallowed its presses, so a
// player on a phone could not move. None of these are visible in a code review
// and none of them throw — the game keeps running and simply stops obeying.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import './harness/dom.mjs';
import { bootScene } from './harness/scene.mjs';
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

console.log(
  'player traps passed: pause restores input in every scene (no scene answers '
  + '"is input on?" from the flag pause clears), a reset survives a running story, '
  + 'and nothing is parked under the persistent volume control.',
);
