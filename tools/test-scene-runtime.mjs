// THE SCENE, RUN FOR REAL — in Node, in about a second.
//
// Everything in this file was previously done by hand through the Browser pane:
// start a dev server, navigate, patch `img.decode` because a hidden tab never
// settles it, lose the patch to an HMR reload, hit a 30-second timeout, then
// discover the console's `import()` handed back a duplicate module instance.
// None of that proved anything durable, because none of it stayed.
//
// This boots the same modules in-process. It is roughly a hundred times faster,
// it is deterministic, and what it proves stays proven because it runs on every
// `npm test`.
//
// It deliberately does NOT claim fps or a composited frame. The pane could not
// do those either; they remain `#debug` on a real device.
//
// Run: node tools/test-scene-runtime.mjs
import assert from 'node:assert/strict';
import { bootScene, drawStats, undisposedFrom } from './harness/scene.mjs';

let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks += 1; };
const near = (a, b, tol, m) => { assert.ok(Math.abs(a - b) <= tol, `${m} (${a} vs ${b})`); checks += 1; };

// EVERY SOUND THE SCENE ASKS FOR MUST EXIST. A key that is not in the manifest
// warns to the console and is otherwise silent, so a wrong or missing cue never
// fails anything — which is exactly how the ark ended up playing a GRASS
// footstep on 137 m of timber decking. Capture the warnings and assert none.
const soundWarnings = [];
{
  const realWarn = console.warn;
  console.warn = (...args) => {
    const msg = args.join(' ');
    if (/unknown sound key/i.test(msg)) soundWarnings.push(msg);
    else realWarn(...args);
  };
}

const { buildNoahArk } = await import('../src/scenes/noah/index.js');
const { DECK_Y, DOOR } = await import('../src/scenes/noah/arkSpec.js');

// ── IT BUILDS, AND IT BUILDS FAST ───────────────────────────────────────────
const t0 = Date.now();
const h = await bootScene(buildNoahArk);
const bootMs = Date.now() - t0;
ok(h.debug.ready, 'the ark scene reached readiness');
ok(bootMs < 8000, `built in ${bootMs}ms — well inside the app's 12s readiness deadline`);

// ── THE BUDGET, COUNTED FROM THE SCENE GRAPH ────────────────────────────────
// Not renderer.info (that needs a GPU) but the same arithmetic: a draw is a
// visible mesh, an InstancedMesh is one draw however many instances it holds.
// This counts EVERYTHING visible with no frustum culling — the worst possible
// frame, which is the number a budget deserves to be judged against.
{
  // Measure a SETTLED frame. Visibility culling (the site, the lantern glows,
  // the particle fields) is applied in update(), so a stats read taken straight
  // after build reports a state the player never actually sees.
  h.step(30);
  const s = h.stats();
  ok(s.calls <= 100, `worst-case draw calls ${s.calls} — Low/Med ceiling is 100, and that is the guarantee`);
  ok(s.triangles <= 120000, `worst-case triangles ${s.triangles} (ceiling 120k)`);
  ok(s.instanced >= 8, `${s.instanced} instanced meshes — repeats are batched, not per-object`);
  console.log(`  worst-case frame: ${s.calls} draws / ${s.triangles} tris / ${s.instanced} instanced`);
}

// ── A PLAYER CAN WALK IN, WITH REAL KEY EVENTS ──────────────────────────────
// Holding W from the spawn must carry the player up the boarding ramp, through
// the door and onto the lower deck. This is the whole promise of the scene.
{
  const d = h.debug;
  d.controller.teleport(DOOR.x, 0, 34);
  const startY = d.player.position.y;
  near(startY, 0, 0.01, 'the walk starts on the ground outside');

  h.hold('w', 560);
  const p = d.player.position;
  near(p.y, DECK_Y[0], 0.05, 'holding W alone arrives on the LOWER DECK');
  ok(d.controller.deck === 'deck1', `standing on deck1 (reported ${d.controller.deck})`);
  ok(d.insideK > 0.9, `the interior/exterior swap engaged (insideK ${d.insideK.toFixed(2)})`);
  ok(!d.hull.exterior.visible, 'the outer hull is hidden while aboard, so the camera can see in');
}

// ── AND CLIMB ALL THREE DECKS ───────────────────────────────────────────────
{
  const d = h.debug;
  const reach = (x, y, z, label) => {
    d.controller.teleport(x, y, z);
    h.step(30);
    near(d.player.position.y, y, 0.06, `${label} is a real standing surface`);
    return d.controller.deck;
  };
  ok(reach(0, DECK_Y[0], 0, 'lower deck') === 'deck1', 'deck 1 identifies itself');
  ok(reach(0, DECK_Y[1], 0, 'second deck') === 'deck2', 'deck 2 identifies itself');
  ok(reach(0, DECK_Y[2], 0, 'third deck') === 'deck3', 'deck 3 identifies itself');
}

// ── THE LEVEL-LAYOUT AUDIT MUST BE CLEAN ────────────────────────────────────
{
  const findings = h.debug.audit();
  ok(findings.length === 0, `layout audit returned ${findings.length} findings: ${JSON.stringify(findings.slice(0, 2))}`);
}

// ── PARTICLES SLEEP WHEN THEY CANNOT BE SEEN ────────────────────────────────
// Simulating and uploading particles the player cannot see is pure waste, and
// this scene shipped doing exactly that below decks until it was measured.
{
  const d = h.debug;
  d.controller.teleport(0, DECK_Y[1], 0);
  h.step(240);
  ok(!d.site.group.visible, 'the building site is hidden while below decks');
  const motes = h.scene.children.find((o) => o.isPoints);
  ok(motes && !motes.visible, 'the outdoor dust field is hidden while below decks');
}

// ── DISPOSE MUST GIVE EVERYTHING BACK ───────────────────────────────────────
//
// HONEST SCOPE, because the first version of this test overstated itself: this
// walks the SCENE GRAPH, so it can only see resources attached to it. It cannot
// detect the D10 skeleton-leak class (bone-matrix DataTextures are reachable
// from no material) — that still needs a real renderer.info census on a device.
//
// It proves two different things in two steps, and the FIRST is the one with
// teeth: core/app.js runs the scene's own dispose() and then disposeDeep(scene),
// and disposeDeep frees everything graph-reachable — so a census taken only
// after it can never fail however sloppy the scene was. Measured: deleting the
// ark's wood.dispose() call changed the after-everything numbers not at all.
{
  const before = h.census();
  ok(before.geometries > 5, `the live scene owns ${before.geometries} geometries`);
  ok(before.textures > 0, `the live scene owns ${before.textures} textures`);

  // STEP 1 — the scene must release the textures IT creates, not lean on the
  // sweeper. It creates its own canvas wood/plank textures and owns them
  // explicitly. Measured: 7 of 13 released here normally, 3 of 13 with
  // wood.dispose() deleted, so half is a real line rather than a magic number.
  h.disposeScene();
  const own = h.census();
  const released = before.textures - own.undisposedTextures;
  ok(
    released >= before.textures * 0.5,
    `the scene's own dispose released only ${released}/${before.textures} textures `
    + '— it is leaning on disposeDeep for resources it created itself',
  );

  // STEP 2 — after the full app teardown, nothing the scene OWNED is left
  // undisposed. Judged against the snapshot taken while it was alive, because
  // disposeDeep ends with root.clear(): a census taken afterwards walks an
  // EMPTY graph, so every "=== 0" passes over an empty set and can never fail.
  await h.disposeDeep();
  const after = undisposedFrom(before);
  // The contract is that dispose() was CALLED on everything, not that the graph
  // shrank. Comparing reachable-before to reachable-after was the first version
  // of this and it could never fail — dispose frees the GPU handle, it does not
  // unlink the object.
  ok(
    after.geometries === 0,
    `${after.geometries} geometries were never disposed (of ${before.geometries})`,
  );
  ok(
    after.textures === 0,
    `${after.textures} textures were never disposed (of ${before.textures})`,
  );
  ok(
    after.materials === 0,
    `${after.materials} materials were never disposed (of ${before.materials})`,
  );
  console.log(`  gpu census: ${before.geometries} geometries / ${before.textures} textures / `
    + `${before.materials} materials — all disposed on teardown`);
}

// ── AND IT SURVIVES BEING ENTERED AGAIN ─────────────────────────────────────
// Re-entry is where lifecycle bugs live: a scene that leaves a listener, a
// timer or a zombie loop behind fails on the second visit, not the first.
{
  const again = await bootScene(buildNoahArk);
  ok(again.debug.ready, 'the scene builds a second time after a full dispose');
  const s = drawStats(again.scene);
  ok(s.calls <= 120, `second entry still inside the draw budget (${s.calls})`);
  await again.dispose();
}

// ── NO SOUND THE SCENE PLAYS MAY BE MISSING FROM THE MANIFEST ───────────────
{
  const unique = [...new Set(soundWarnings)];
  ok(
    unique.length === 0,
    `the scene asked for sound keys that do not exist: ${unique.join(' | ')}`,
  );
}


// ── THE SCENE MUST NOT CARRY LIGHTS IT IS NOT USING ────────────────────────
// Every lit fragment in the game pays for every point light in the scene,
// whether it contributes or not — and the count cannot be changed at runtime,
// because it is baked into each material's shader cache key (D24: toggling one
// recompiles the world mid-stride). So the count must be as low as the scene
// can manage and CONSTANT. The pitch fires and the below-decks lanterns are
// never both relevant, so they share one pool of three.
{
  const h2 = await bootScene(buildNoahArk);
  const pointLights = [];
  h2.scene.traverse((o) => { if (o.isPointLight) pointLights.push(o); });
  ok(pointLights.length <= 3, `${pointLights.length} point lights — every lit pixel pays for each one`);

  const lit = () => pointLights.filter((l) => l.intensity > 0.01).length;
  h2.debug.controller.teleport(DOOR.x, 0, 40);
  h2.step(120);
  const outside = lit();
  ok(outside > 0, 'the pitch fires light the building site');

  h2.debug.controller.teleport(0, DECK_Y[0], 0);
  h2.step(240);
  ok(lit() > 0, 'the lanterns light the hold');

  // ...and the COUNT never moved, only the intensities.
  let after = 0;
  h2.scene.traverse((o) => { if (o.isPointLight) after += 1; });
  ok(after === pointLights.length,
    `the point-light count changed from ${pointLights.length} to ${after} — that recompiles every lit material`);
  console.log(`  lighting: ${pointLights.length} point lights, shared between the fires and the lanterns`);
  await h2.dispose();
}

console.log(`scene runtime: ${checks} checks passed — real scene, no browser, ${bootMs}ms to boot`);
