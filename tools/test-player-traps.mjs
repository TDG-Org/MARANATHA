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

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

  // A GARMENT HAS NO INSIDE, AND BACKFACE CULLING DOES NOT KNOW THAT.
  //
  // Nate: "the tunic on the other side, is fully translucent, bug, fix!"
  //
  // The coat is a single-layer cape mesh. With the default FrontSide every
  // back face is culled, so the camera looks straight through the cloth
  // whenever it swings, lifts, or is seen from the far side — which covers
  // most of the gift beat and all of the walk-away. It never throws and never
  // shows up in a draw count; it just quietly renders a hole where the most
  // important object in the chapter should be.
  {
    const THREE = await import('three');
    const joseph = booted.instance.debug.joseph;

    // RUNTIME half — the capsule fallback, which is what this harness builds.
    // Node has no GLB rigs (every mesh in the booted scene is unnamed), so the
    // real cape cannot be reached from here and saying otherwise would be a
    // guard that proves nothing. The capsule coat is open-ended cylinders,
    // which have exactly the same no-inside problem.
    const bands = joseph?._capsuleCoat || [];
    assert.ok(bands.length > 0, 'the capsule fallback built no coat to check');
    for (const band of bands) {
      assert.equal(band.material?.side, THREE.DoubleSide,
        'a capsule coat band is single-sided — an open-ended sleeve rendered '
        + 'FrontSide disappears when seen from its far side');
    }

    // SOURCE half — the GLB cape, which only exists in a browser. Named as a
    // source check so nobody later mistakes it for an executed one.
    const charSource = readFileSync(new URL('../src/engine/Character3D.js', import.meta.url), 'utf8');
    const capeBlock = charSource.match(/if \(this\.capeMesh\) \{[\s\S]*?\n {4}\}/);
    assert.ok(capeBlock, 'the cape material block moved — this guard cannot see it any more');
    assert.match(capeBlock[0], /side\s*=\s*THREE\.DoubleSide/,
      'the GLB cape is drawn single-sided again — a one-layer garment rendered '
      + 'FrontSide is invisible from its far side, which reads to a player as the '
      + 'coat being transparent');
    assert.match(charSource, /return this\._toon\(0xffffff, \{ map: tex, side: THREE\.DoubleSide \}\)/,
      'the painted coat material dropped its double-sided flag');

    console.log(`  garments: ${bands.length} capsule coat bands double-sided (runtime), `
      + 'GLB cape double-sided (source — Node has no rigs)');
  }

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


// -- 7. PAUSING MUST NOT STARVE THE SOUND, THEN BURST ON RESUME -------------
//
// The pause menu suspends the AudioContext on purpose. A one-shot scheduled on
// a suspended context never plays and never ends, so its onended never fires
// and it holds one of the 14 one-shot slots forever. Measured: about a dozen UI
// clicks during a pause (one settings-slider drag is enough -- it fires a click
// per input event) silenced every UI sound for the rest of that pause, and the
// whole backlog then fired AT ONCE on resume.
{
  const { Audio } = await import('../src/systems/AudioSystem.js');
  // A minimal context stand-in: the real class only needs state + node factories.
  const made = { osc: 0, buf: 0 };
  const node = () => ({
    connect: (n) => n, disconnect() {}, start() {}, stop() {},
    frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {}, value: 0 },
    gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, value: 0 },
    type: '', buffer: null, loop: false, onended: null, Q: { value: 1 },
  });
  Audio.ctx = {
    state: 'running', currentTime: 0,
    createOscillator: () => { made.osc += 1; return node(); },
    createBufferSource: () => { made.buf += 1; return node(); },
    createGain: () => node(), createBiquadFilter: () => node(),
    resume: () => Promise.resolve(), suspend: () => Promise.resolve(),
  };
  Audio.master = node(); Audio.sfx = node(); Audio.music = node(); Audio.space = node();
  Audio.volume = 0.8;
  Audio.channels = { music: 1, sfx: 1, voice: 1 };
  Audio._liveOneShots = 0;
  Audio.holdSuspend = false;

  const clicks = (n) => { for (let i = 0; i < n; i += 1) Audio.tone({ freq: 440, dur: 0.05 }); };

  clicks(3);
  assert.ok(made.osc >= 3, `precondition: a running context plays UI sound (made ${made.osc})`);

  // Now pause exactly as ui/pause.js does.
  Audio.holdSuspend = true;
  Audio.ctx.state = 'suspended';
  const beforePause = made.osc;
  const slotsBefore = Audio._liveOneShots;
  clicks(30); // a slider drag
  assert.equal(made.osc, beforePause,
    `${made.osc - beforePause} sources were scheduled on a SUSPENDED context — each one holds a `
    + 'one-shot slot forever and fires as part of a burst on resume');
  assert.equal(Audio._liveOneShots, slotsBefore,
    `the one-shot cap gained ${Audio._liveOneShots - slotsBefore} permanently-stuck slots during a pause`);

  // Resume: sound must work again immediately, not be exhausted.
  Audio.holdSuspend = false;
  Audio.ctx.state = 'running';
  const afterResume = made.osc;
  clicks(3);
  assert.ok(made.osc - afterResume >= 3,
    `after resuming, UI sound must work again (only ${made.osc - afterResume} of 3 played) — `
    + 'the cap was still full of sources scheduled while paused');
  Audio.ctx = null; // leave no stub behind for later tests
}

// -- 8. THE PAUSE OVERLAY MUST TAKE THE KEYBOARD WITH IT --------------------
//
// pointer-events on the dimmed world stops the MOUSE. It does not stop the
// keyboard: every button in the frozen game -- home, gear, skip, the dialogue
// footer -- stayed Tab-reachable and Enter-activatable behind the overlay, so a
// keyboard player could act on a paused scene without seeing what they hit.
{
  const { createPauseMenu } = await import('../src/ui/pause.js');
  const before = [...document.body.children];
  const stray = document.createElement('button'); // stands in for a game control
  document.body.append(stray);

  let paused = null;
  const pause = createPauseMenu({
    app: { setPaused: (on) => { paused = on; } },
    isInputOn: () => true,
    setInput: () => {},
  });

  assert.notEqual(stray.inert, true, 'precondition: the game is reachable before pausing');
  pause.open();
  assert.equal(paused, true, 'the app must actually pause');
  assert.equal(stray.inert, true,
    'a game control behind the pause overlay is still keyboard-reachable — `inert` must close '
    + 'the door pointer-events cannot');
  for (const el of before) {
    if (el === stray) continue;
    assert.notEqual(el.inert, false, 'nothing behind the overlay may stay interactive');
  }

  pause.close();
  assert.equal(stray.inert, false, 'closing must give the game its keyboard back');
  pause.destroy?.();
  stray.remove();
}

// -- 9. `#debug` IS A FORCE, NOT A DEFAULT --------------------------------
//
// The performance meter is off by default (it is a developer readout, and it
// used to sit over the corner of the game for every player who had never
// opened Settings). The moment that default flipped, `#debug` silently
// STOPPED WORKING: DebugHud honours the hash, and then Settings.bindHud()
// runs a beat later and applies the stored `false` over the top. Measured in
// a real browser: default hidden (right), Settings-on visible (right),
// `#debug` HIDDEN (wrong) -- taking the only honest way to read frame rate on
// a real device with it.
{
  const { DebugHud } = await import(`../src/core/quality.js?hud=${Date.now()}`);
  const el = document.getElementById("debug") || document.createElement("div");
  el.id = "debug";
  if (!el.parentNode) document.body.append(el);
  const renderer = { info: { render: { calls: 0, triangles: 0 } }, getContext: () => null };

  const priorHash = window.location.hash;
  try {
    // No hash: the saved preference is in charge, both ways.
    window.location.hash = "#joseph";
    const plain = new DebugHud(renderer, { enabled: false });
    assert.equal(plain.enabled, false, "with no #debug the meter follows the setting (off)");
    plain.setEnabled(true);
    assert.equal(plain.enabled, true, "...and the Settings toggle can turn it on");

    // With #debug: forced on, and NOTHING may turn it back off.
    window.location.hash = "#joseph-debug";
    const forced = new DebugHud(renderer, { enabled: false });
    assert.equal(forced.enabled, true, "#debug in the URL must force the meter on");
    forced.setEnabled(false); // this is exactly what Settings.bindHud does
    assert.equal(forced.enabled, true,
      "a stored hud:false switched the meter back off over an explicit #debug -- the URL "
      + "force must outrank the saved preference, or #debug stops working entirely");
  } finally {
    window.location.hash = priorHash;
  }
}
// ── 6. A CONTROL THAT LOOKS CLICKABLE MUST BE CLICKABLE ─────────────────────
//
// Nate: "clicking the bottom dialog, i cannot click on the arrow on the bottom
// right anymore for it to switch dialogs... if i click right on the text then
// it works, but that shouldnt be the case."
//
// The dialogue box advances on click. A missed tap on the small ◀ Back button
// used to fire the OPPOSITE action, so the whole FOOTER row was made a dead
// zone — and the ▸ advance hint lives in that row. The one control on screen
// whose entire job is "advance" became the only place in the box that could
// not advance, while the body text (which promises nothing) worked fine.
//
// This guard asserts BOTH halves, because fixing one by breaking the other is
// exactly how this bug was born.
{
  const { createDialogue } = await import('../src/ui/dialogue.js');
  const dialogue = createDialogue({});
  const box = document.body.children.find((el) => el.className === 'mr-dialogue');
  assert.ok(box, 'dialogue box was never mounted');
  const footer = box.children.find((el) => el.className === 'mr-dlg-footer');
  assert.ok(footer, 'dialogue footer was never mounted');
  const backZone = footer.children[0];
  const backBtn = backZone.children[0];
  const hint = footer.children[1];
  assert.equal(backBtn.textContent, '◀ Back', 'the Back button moved');
  assert.ok(/▸/.test(hint.textContent), 'the advance hint lost its arrow');

  // Model a real click faithfully: the control's own listener runs first, then
  // the event bubbles to the box unless that listener stopped it. Dispatching
  // only on the box would never exercise Back's handler, and dispatching only
  // on the control would never exercise the box's dead-zone test — the bug
  // lives in the interaction between the two.
  const clickOn = (target) => {
    let stopped = false;
    const event = { type: 'click', target, stopPropagation() { stopped = true; } };
    target.dispatchEvent(event);
    if (!stopped) box.dispatchEvent(event);
  };

  // LINE 1 — no history yet, so Back is hidden.
  const first = dialogue.say('Joseph', 'A line long enough to still be typing.');
  let firstDone = false;
  first.then(() => { firstDone = true; });
  await delay(30);
  clickOn(hint); // completes the type-on
  await delay(10);
  clickOn(hint); // ...and resolves the line
  await delay(30);
  assert.equal(firstDone, true,
    'the ▸ advance button did not advance the dialogue — it is inside the footer, '
    + 'and a footer-wide dead zone makes the game\'s most obvious control inert');

  // LINE 2 — history exists, so Back is showing and its zone must stay dead.
  const second = dialogue.say('Judah', 'A second line, so Back is live.');
  let secondDone = false;
  second.then(() => { secondDone = true; });
  await delay(30);
  clickOn(hint);
  await delay(10);
  assert.notEqual(backBtn.style.visibility, 'hidden', 'Back must be offered on line 2');
  clickOn(backBtn);
  await delay(20);
  assert.equal(secondDone, false,
    'a click on ◀ Back advanced the line — a missed tap on Back must never fire '
    + 'the opposite action');
  // ...and the re-read is showing, with the arrow relabelled to walk forward.
  assert.ok(/Forward/.test(hint.textContent), 'reading back did not relabel the arrow');
  clickOn(hint); // forward to live
  await delay(10);
  clickOn(hint); // resolve
  await delay(30);
  assert.equal(secondDone, true, 'stepping forward out of the re-read never resolved the line');
  dialogue.destroy();
}

// ── 7. A THROWN BEAT MUST NOT TAKE THE GAME AWAY ────────────────────────────
//
// runStory's catch used to log and stop. Whatever the beat was doing when it
// threw simply stayed: letterbox down, screen mid-fade (usually fully black),
// camera locked in an authored pose, and input off — because every beat turns
// input off on the way IN and back on on the way OUT. Nothing watches for this
// and there is no timeout, so the player sat looking at a black rectangle with
// a working pause menu and nothing else. Only a reload escaped.
{
  const { buildJoseph3D } = await import('../src/scenes/joseph3d/index.js');
  const booted = await bootScene(buildJoseph3D);
  const instance = booted.instance ?? booted;
  const ctx = instance.debug.ctx;
  const controller = instance.debug.controller;
  const recover = instance.debug.recoverFromStoryFailure;
  assert.equal(typeof recover, 'function', 'the story failure recovery is not reachable');

  // WIRING, checked at source, because the runtime half below drives the
  // recovery directly through the debug seam and therefore cannot see whether
  // anything CALLS it. Proven necessary: deleting the call from the catch left
  // every runtime assertion below still green.
  {
    // Anchored on the story-failure LOG, not on `} catch (e) {` — the module has
    // more than one of those, and matching the first one audited the render
    // pre-warm's catch instead, which passed with the softlock fully restored.
    // Newlines normalised: a bounded source window is a different length under
    // CRLF, and this repo has been bitten by exactly that.
    const src = readFileSync(new URL('../src/scenes/joseph3d/index.js', import.meta.url), 'utf8')
      .replace(/\r\n/g, '\n');
    const at = src.indexOf("console.error('[joseph3d] story error'");
    assert.ok(at > 0, 'runStory no longer reports a story failure at all');
    const end = src.indexOf('\n  }', at);
    assert.ok(end > at, 'could not find the end of runStory');
    assert.match(src.slice(at, end), /recoverFromStoryFailure\(\)/,
      'a thrown beat is logged and abandoned — the scene keeps the letterbox down, '
      + 'the camera locked and input off, with no way back but a page reload');
  }

  // Put the scene into exactly the state a mid-cutscene throw leaves behind.
  const navigations = [];
  ctx.app.navigate = async (key, params) => { navigations.push({ key, params }); };
  ctx.setInput(false);
  ctx.hud.setCutscene?.(true);
  await ctx.cinema.letterbox(true);
  ctx.camera.setPoseDriver(() => ({ pos: [0, 3, 0], look: [0, 1, 0] }));
  assert.equal(controller.enabled, false, 'precondition: a cutscene has input off');

  await recover();

  assert.equal(controller.enabled, true,
    'a thrown beat left the player unable to move — recovery must hand input back');
  assert.equal(ctx.camera._poseDriver, null,
    'a thrown beat left the camera locked to a cutscene pose driver');
  assert.deepEqual(navigations.map((n) => n.key), ['home'],
    'a thrown beat must put the player somewhere they can act, not leave them in '
    + 'a camp with no story left to run');
  assert.equal(navigations[0].params?.loadError?.key, 'joseph',
    'the recovery navigation does not say what failed');

  // ...and it must survive its own steps failing, since it only ever runs
  // BECAUSE something already threw.
  ctx.setInput(false);
  const brokenCinema = ctx.cinema.letterbox;
  ctx.cinema.letterbox = () => { throw new Error('injected letterbox failure'); };
  await recover();
  assert.equal(controller.enabled, true,
    'one failing recovery step aborted the rest of the recovery');
  ctx.cinema.letterbox = brokenCinema;

  await booted.disposeDeep();
}

// ── 8. A TIME UNIT MISMATCH IS INVISIBLE UNTIL IT IS NOT ────────────────────
//
// Nate asked for tears by name. They were built, they looked right in the diff,
// and they drew NOTHING: the simulation is authored in seconds and every caller
// in this scene passes the frame pacer's dt, which is ~16.7 MILLISECONDS. Frame
// one drove each drop's remaining life to about -15.8 and parked it a kilometre
// below the world, forever.
//
// It survived my own check because I pumped it with 1/60 — handing the probe
// the unit the code wanted instead of the unit the game sends. So this guard
// pumps a REALISTIC millisecond dt, and a version written the other way passes
// today while proving nothing.
{
  const { buildPitStage } = await import('../src/scenes/joseph3d/pit.js');
  const pit = buildPitStage({});
  const head = { x: -62, y: 1.35, z: 6 };
  pit.setTears(true, head);
  const pos = pit.tears.geometry.getAttribute('position');
  let visibleFrames = 0;
  let nearHead = 0;
  for (let i = 0; i < 600; i += 1) {
    pit.update(16.7); // exactly what src/core/framePacer.js hands the scene
    for (let k = 0; k < pos.count; k += 1) {
      const y = pos.getY(k);
      if (y <= -100) continue;
      visibleFrames += 1;
      // ...and falling from the eyes, not floating somewhere else entirely.
      if (Math.hypot(pos.getX(k) - head.x, y - head.y, pos.getZ(k) - head.z) < 0.6) nearHead += 1;
      break;
    }
  }
  assert.ok(visibleFrames > 200,
    `the tears drew nothing at the frame rate the game actually runs at `
    + `(${visibleFrames}/600 frames had a drop above the world) — the simulation is `
    + 'in seconds and the caller passes milliseconds');
  assert.ok(nearHead > 150,
    `tears rendered but not at the eyes (${nearHead} of ${visibleFrames} within 0.6u of the head)`);
  console.log(`  tears: visible on ${visibleFrames}/600 real-dt frames, ${nearHead} of them at the eyes`);
  pit.dispose();
}

console.log(
  'player traps passed: pause restores input in every scene (no scene answers '
  + '"is input on?" from the flag pause clears), a reset survives a running story, '
  + 'nothing is parked under the persistent volume control, the main story '
  + 'gives every texture and geometry it owns back on dispose, and the dialogue '
  + 'advance arrow actually advances while ◀ Back stays a dead zone.',
);
