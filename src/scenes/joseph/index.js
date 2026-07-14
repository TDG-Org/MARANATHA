import * as THREE from 'three';
import { makeSky, makeRidges, makeGround, makeSun, makeMotes, easeInOut } from '../../engine/world.js';
import { Audio } from '../../systems/AudioSystem.js';
import { createStoryHud } from '../../ui/storyHud.js';
import { confirmModal } from '../../ui/modal.js';
import { makeJoseph } from './cast.js';
import { PlayerController } from '../../engine/PlayerController.js';
import { FollowCamera } from '../../engine/FollowCamera.js';
import { Guidance } from '../../engine/Guidance.js';

// JOSEPH — Genesis 37–50. The first playable story.
//
// Slice 2 (this build): free movement (WASD / arrows / tap-to-move / mobile
// joystick), a gentle follow camera, a guiding waypoint, and the player
// character (Joseph in his ornate robe) with a real walk. Slice 4 scripts
// Scene 1 (the coat & the dreams) on top of these systems.
export function buildJoseph({ scene, camera, renderer, app }) {
  // environment-vibes: safety / belonging → warm golden-hour camp.
  scene.fog = new THREE.Fog(0xffdfba, 44, 250);
  const sky = makeSky({ top: 0xf2b880, bottom: 0xffe9c9 });
  scene.add(sky.mesh);
  scene.add(makeGround()); // flat camp underfoot; swells only toward the horizon
  scene.add(makeRidges());
  scene.add(makeSun());
  const motes = makeMotes({ count: 80 });
  scene.add(motes.points);
  const tents = makeTents();
  scene.add(tents);

  Audio.ambience({ wind: 0.24, birds: 0.22 });
  Audio.musicPad(0.03, [130.81, 196.0, 261.63]); // warm-camp bed (placeholder)

  // Player.
  const joseph = makeJoseph().placeAt(0, 2).addTo(scene);

  const controller = new PlayerController({
    camera, character: joseph, domElement: renderer.domElement,
    bounds: { minX: -13, maxX: 13, minZ: -14, maxZ: 9 },
  });

  const follow = new FollowCamera(camera);
  follow.setTarget(joseph.position);
  follow.snapToTarget();
  follow.frame(0); // place the camera for the very first rendered frame

  const guide = new Guidance(scene);
  const goal = new THREE.Vector3(7, 0, -4);
  guide.setTarget(goal);
  let arrived = false;

  const hud = createStoryHud({
    onHome: async () => {
      controller.setEnabled(false);
      const leave = await confirmModal({
        title: 'Return home?',
        body: 'Your progress in this story is saved when you finish a scene.',
        confirmText: 'Return home',
        cancelText: 'Keep playing',
      });
      if (leave) app.navigate('home'); else controller.setEnabled(true);
    },
  });
  hud.setObjective('Walk to the light — use WASD / arrows, tap, or the joystick.');

  let idle = 0;

  function update(dt, tMs) {
    const t = tMs / 1000;
    sky.update(dt);
    motes.update(dt, t);

    controller.update(dt);
    follow.setTarget(joseph.position);
    follow.setLead(controller.vel.x, controller.vel.y);
    follow.frame(dt);
    guide.update(dt, camera);

    // Arrival at the waypoint (Slice 2 demo of guidance → objective flow).
    if (!arrived) {
      const d = Math.hypot(joseph.position.x - goal.x, joseph.position.z - goal.z);
      if (d < 1.2) {
        arrived = true;
        guide.setTarget(null);
        Audio.bell();
        hud.setObjective('You made it. The camp comes alive in Scene 1 — press ⌂ to return home.');
      } else {
        // Idle nudge (game-feel law 7).
        if (controller.vel.length() < 0.2) { idle += dt; if (idle > 12000) { hud.pulse(); idle = 0; } }
        else idle = 0;
      }
    }
  }

  function dispose() {
    hud.destroy();
    controller.dispose();
    guide.dispose();
    joseph.dispose();
  }

  // Test handle (harmless): the preview tab runs hidden, so automated checks
  // pump update() manually and read state through here.
  return { update, dispose, debug: { joseph, controller, follow, guide, goal } };
}

// A few simple tents so the camp reads as a place to walk through. One
// instanced draw call (performance skill).
function makeTents() {
  const geo = new THREE.ConeGeometry(1.6, 2.0, 4);
  geo.rotateY(Math.PI / 4); // square base
  const mat = new THREE.MeshBasicMaterial({ color: 0xb89a6a, fog: true });
  const spots = [
    [-9, -8], [10, -9], [-11, 2], [12, 3], [-3, -12],
  ];
  const mesh = new THREE.InstancedMesh(geo, mat, spots.length);
  const dummy = new THREE.Object3D();
  spots.forEach(([x, z], i) => {
    dummy.position.set(x, 1.0, z);
    const s = 0.9 + (i % 3) * 0.25;
    dummy.scale.set(s, s, s);
    dummy.rotation.y = i * 0.7;
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}
