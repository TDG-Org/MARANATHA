#!/usr/bin/env node
//
// THE CAMERA LAW: no camp shot may point at the empty back of the camp.
//
// Nate has reported this three separate times, about three different shots:
//   "the camera angle is showing the other side of the camp, and it's all empty"
//   "when the scene that shows the brothers envied him, it STILL SHOWS THE BACK
//    OF THE CAMP, FIX THIS! bad camera angle!!!"
//   "fix the camera angles for some scenes, to NEVER show the back of the camp,
//    since it's empty, only infront of the camp where the sun is at! you really
//    need to remember this!"
//
// Taste cannot be asserted, but THIS can: a camera either has the lived-in camp
// behind its subject or it does not, and that is a measurable fact. This test
// builds the real camp, reads every authored camera out of the beat files, and
// counts how much camp actually falls inside each frame behind the subject.
//
// It is deliberately a FLOOR, not a target. It catches "pointed at nothing",
// not "framed imperfectly" — the second is Nate's call, the first is a bug.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { ColliderWorld } from '../src/engine/collision.js';
import { buildCamp } from '../src/scenes/joseph3d/props.js';
import { TELLING_AMBIENT_SLOTS, COAT_ENVY_SPECTATOR_SLOTS, TELLING_FIRE } from '../src/scenes/joseph3d/beats/helpers.js';
import {
  DUSK_CIRCLE_ANGLE,
  HERD_DIRECTION_MARKS,
  HERD_DIRECTION_JOSEPH_MARK,
} from '../src/scenes/joseph3d/beats/camp.js';
import { MOODS } from '../src/engine/MoodGrading.js';
import {
  TELLING_JOSEPH_MARK,
  TELLING_LONE_MARK,
  TELLING_WALKOFF_CAMERA,
  TELLING_FINAL_CAMERA,
  TELLING_CIRCLE_ANGLE,
} from '../src/scenes/joseph3d/beats/telling.js';

// The camp builders need this much of a canvas for their procedural glows.
globalThis.document = {
  createElement() {
    return {
      width: 0,
      height: 0,
      getContext() {
        return {
          createRadialGradient() { return { addColorStop() {} }; },
          createLinearGradient() { return { addColorStop() {} }; },
          fillRect() {}, set fillStyle(_v) {},
        };
      },
    };
  },
};

// ---- what "the camp" is, as points a camera can actually see ---------------
const colliders = new ColliderWorld();
const camp = buildCamp(colliders);
camp.group.updateMatrixWorld(true);

const content = [];
const scratchM = new THREE.Matrix4();
const scratchV = new THREE.Vector3();
camp.group.traverse((o) => {
  if (o.isInstancedMesh) {
    for (let i = 0; i < o.count; i++) {
      o.getMatrixAt(i, scratchM);
      scratchV.setFromMatrixPosition(scratchM).applyMatrix4(o.matrixWorld);
      content.push({ x: scratchV.x, y: scratchV.y, z: scratchV.z, w: 1 });
    }
  } else if (o.isMesh) {
    scratchV.setFromMatrixPosition(o.matrixWorld);
    content.push({ x: scratchV.x, y: scratchV.y, z: scratchV.z, w: 1 });
  }
});
// People read as far more "camp" than a crate does.
for (const s of [...TELLING_AMBIENT_SLOTS, ...COAT_ENVY_SPECTATOR_SLOTS]) {
  content.push({ x: s.x, y: 1, z: s.z, w: 4 });
}
assert.ok(content.length > 200, `camp census looks wrong (${content.length} points)`);

// ---- every authored camera in the beats -------------------------------------
// The literal `{ t: 'cam', ... }` steps are the ones an author hand-places, and
// they are the ones that have been wrong. Shots produced by planGroupCamera are
// already covered by its own composition search + test-dialogue-camera-safety.
const BEATS = ['coldOpen', 'camp', 'dream', 'telling'];
// Numbers here are authored as literals OR as small Math.PI expressions, and the
// steps are written across several lines. Read a window after each `t: 'cam'`
// and pull the fields out of it.
const readNum = (body, key) => {
  const pi = body.match(new RegExp(String.raw`${key}:\s*(-?)Math\.PI\s*\*\s*(-?[\d.]+)`));
  if (pi) return (pi[1] === '-' ? -1 : 1) * Math.PI * Number(pi[2]);
  const bare = body.match(new RegExp(String.raw`${key}:\s*(-?[\d.]+)`));
  return bare ? Number(bare[1]) : null;
};
const shots = [];
for (const name of BEATS) {
  const src = await readFile(new URL(`../src/scenes/joseph3d/beats/${name}.js`, import.meta.url), 'utf8');
  let from = 0;
  for (;;) {
    const at = src.indexOf("t: 'cam'", from);
    if (at < 0) break;
    from = at + 8;
    const body = src.slice(at, at + 420);
    const target = body.match(/target:\s*\{\s*x:\s*(-?[\d.]+)\s*,\s*z:\s*(-?[\d.]+)/);
    const angle = readNum(body, 'angle');
    if (!target || angle === null) continue; // a moving/derived frame, not a fixed one
    shots.push({
      beat: name,
      line: src.slice(0, at).split(/\r?\n/).length,
      angle,
      target: { x: Number(target[1]), z: Number(target[2]) },
      distance: readNum(body, 'distance') ?? 6,
      height: readNum(body, 'height') ?? 2,
      lookHeight: readNum(body, 'lookHeight') ?? 1.3,
    });
  }
}
assert.ok(shots.length >= 2, `found only ${shots.length} authored cam steps with fixed targets — the parser has drifted`);

// ---- how much camp is behind the subject ------------------------------------
const camera = new THREE.PerspectiveCamera(46, 16 / 9, 0.1, 400);
const frustum = new THREE.Frustum();
const proj = new THREE.Matrix4();
function backdropScore({ angle, target, distance, height, lookHeight }) {
  camera.position.set(
    target.x - Math.sin(angle) * distance,
    height,
    target.z - Math.cos(angle) * distance,
  );
  camera.lookAt(target.x, lookHeight, target.z);
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();
  frustum.setFromProjectionMatrix(proj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  let score = 0;
  for (const p of content) {
    // only what lies BEYOND the subject counts as the backdrop
    if (Math.hypot(p.x - camera.position.x, p.z - camera.position.z) < distance + 1.5) continue;
    scratchV.set(p.x, p.y, p.z);
    if (frustum.containsPoint(scratchV)) score += p.w;
  }
  return score;
}

// Only shots staged INSIDE the camp are judged. The pit stage sits 60u west and
// the dream field 62u east; those are different places with their own worlds.
const IN_CAMP = (t) => Math.abs(t.x) < 26 && Math.abs(t.z) < 26;
// CALIBRATED AGAINST THE REAL BUG, not guessed. The envy shot Nate reported in
// capitals scored 139 at its old angle and 180+ once swung round to face the
// camp; the cold-open morning shot sits at 180. A floor of 120 would have let
// the reported bug through, which is worth stating plainly: a guard that does
// not fail on the case that prompted it is decoration.
//
// 165 fails the reported angle and passes every corrected one. The margin above
// it is thin (180 vs 165), so if a legitimately tighter shot ever lands here,
// widen the census or weight by screen area rather than quietly lowering this.
const FLOOR = 165;

const judged = shots.filter((s) => IN_CAMP(s.target));
assert.ok(judged.length >= 1, `no in-camp authored shots were found to judge (${shots.length} parsed)`);

// ---- the MOVING shots, which the parser above cannot see ---------------------
// A camera whose target is a function of a live position never appears in the
// scan, and that is exactly where the reported bug was hiding: the last two
// shots of the whole story track Joseph as he walks away, and both pointed at
// open ground. They are exported as data now precisely so they can be judged,
// and a tracked shot is judged on the WORST frame of the move — being correct
// only at the two ends is not being correct.
const walkPath = (k) => ({
  x: TELLING_JOSEPH_MARK.x + (TELLING_LONE_MARK.x - TELLING_JOSEPH_MARK.x) * k,
  z: TELLING_JOSEPH_MARK.z + (TELLING_LONE_MARK.z - TELLING_JOSEPH_MARK.z) * k,
});
const trackedWorst = (shot, path) => {
  let worst = Infinity;
  for (let k = 0; k <= 1.0001; k += 0.1) {
    worst = Math.min(worst, backdropScore({ ...shot, target: path(k) }));
  }
  return worst;
};
const moving = [
  {
    beat: 'telling', line: 'TELLING_WALKOFF_CAMERA', ...TELLING_WALKOFF_CAMERA,
    target: TELLING_LONE_MARK, score: trackedWorst(TELLING_WALKOFF_CAMERA, walkPath),
  },
  {
    beat: 'telling', line: 'TELLING_FINAL_CAMERA', ...TELLING_FINAL_CAMERA,
    target: TELLING_LONE_MARK,
    score: backdropScore({ ...TELLING_FINAL_CAMERA, target: TELLING_LONE_MARK }),
  },
];

// ---- the GROUP-PLANNED shots, which the parser cannot see either -------------
//
// This guard read only literal `{ t: 'cam' }` steps. Every shot built by
// planGroupCamera was invisible to it — and that is where the worst offender in
// the whole chapter was sitting: BOTH tellings and the dusk fire circle were
// authored at angle pi, which measures backdrop 83 and 79 against this floor of
// 165, for about twenty seconds each, at the emotional centre of the chapter.
// Nate reported it for the fourth time. A guard that cannot see the shot cannot
// be said to be guarding it.
const circleShot = (angle, distance, height, look) => ({
  angle,
  distance,
  height,
  lookHeight: look,
  target: { x: TELLING_FIRE.x, z: TELLING_FIRE.z },
});
const herdCentroid = {
  x: (HERD_DIRECTION_JOSEPH_MARK.x + HERD_DIRECTION_MARKS[0].x + HERD_DIRECTION_MARKS[1].x) / 3,
  z: (HERD_DIRECTION_JOSEPH_MARK.z + HERD_DIRECTION_MARKS[0].z + HERD_DIRECTION_MARKS[1].z) / 3,
};
const groupShots = [
  {
    beat: 'telling', line: 'gatherCircle planGroupCamera',
    ...circleShot(TELLING_CIRCLE_ANGLE, 5.7, 2.7, 1.2),
  },
  {
    beat: 'camp', line: 'dusk fire planGroupCamera',
    ...circleShot(DUSK_CIRCLE_ANGLE, 5.2, 2.25, 1.05),
  },
  {
    beat: 'camp', line: 'planHerdDirectionCamera',
    angle: 0, distance: 5.4, height: 2.25, lookHeight: 1.15, target: herdCentroid,
  },
];
// Judged elsewhere, on purpose, and named so the tripwire below stays exact:
//   coldOpen.js  the betrayal prowl — staged at the PIT, 60u west of the camp,
//                which is a different place with its own world (and its own
//                proof in test-dialogue-camera-safety).
const GROUP_SHOTS_ELSEWHERE = 1;

// COMPLETENESS TRIPWIRE. The two above are hand-listed because their actor sets
// live inside beat closures. If a third group shot is ever authored, this fails
// and forces whoever wrote it to bring it under the law rather than letting it
// slip through silently the way these two did.
{
  let planned = 0;
  for (const name of BEATS) {
    const src = await readFile(new URL(`../src/scenes/joseph3d/beats/${name}.js`, import.meta.url), 'utf8');
    planned += (src.match(/planGroupCamera\(/g) || []).length;
  }
  assert.equal(planned, groupShots.length + GROUP_SHOTS_ELSEWHERE,
    `${planned} planGroupCamera shots exist but ${groupShots.length + GROUP_SHOTS_ELSEWHERE} are accounted for here — `
    + 'add the new one to groupShots with its real target/distance/height, or this law '
    + 'is only enforced on the shots someone remembered to list');
}

// ---- and no camp shot may stare into the key light --------------------------
//
// The other half of the same sentence: "opposite side of the sun, and it looks
// horrible". A camera looking along the sun direction puts every face in
// silhouette. dot(look, sun) is exactly that, and at the reported angle it
// measured +0.62 — the camera was pointed at the light.
const sunOf = (mood) => {
  const s = MOODS[mood].sun;
  return new THREE.Vector3(s[0], s[1], s[2]).normalize();
};
const lookDot = ({ angle, target, distance, height, lookHeight }, sun) => {
  const eye = new THREE.Vector3(
    target.x - Math.sin(angle) * distance,
    height,
    target.z - Math.cos(angle) * distance,
  );
  return new THREE.Vector3(target.x, lookHeight, target.z).sub(eye).normalize().dot(sun);
};
const INTO_THE_SUN = 0.35;
const glare = groupShots
  .map((s, i) => ({ s, dot: lookDot(s, sunOf(i === 0 ? 'tenseDay' : 'dusk')) }))
  .filter(({ dot }) => dot > INTO_THE_SUN);
assert.deepEqual(
  glare.map(({ s, dot }) => `${s.beat}.js ${s.line} -> dot(look,sun) ${dot.toFixed(2)}`),
  [],
  'these shots look INTO the key light, so every face in them is a silhouette — '
  + 'swing them until dot(look, sun) is at or below zero',
);

const results = [
  ...judged.map((s) => ({ ...s, score: backdropScore(s) })),
  ...moving,
  ...groupShots.map((s) => ({ ...s, score: backdropScore(s) })),
];
const empty = results.filter((r) => r.score < FLOOR);
assert.deepEqual(
  empty.map((r) => `${r.beat}.js:${r.line} angle ${r.angle} -> backdrop ${r.score}`),
  [],
  'these camp shots point at the empty back of the camp — swing them round to face the lived-in camp\n'
  + '(the camera sits at target - (sin a, cos a) * distance and looks at the target, so a small |angle|\n'
  + ' looks back across the camp; angles near +/-pi look out at open ground)',
);

console.log(
  `camera backdrop: PASS — ${results.length} authored camp shots judged against a floor of ${FLOOR} `
  + `(census ${content.length} camp points): `
  + results.map((r) => `${r.beat}.js:${r.line}=${r.score}`).join(', '),
);
