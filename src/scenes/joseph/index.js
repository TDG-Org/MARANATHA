import * as THREE from 'three';
import { makeSky, makeRidges, makeGround, makeSun, makeMotes, easeInOut } from '../../engine/world.js';
import { Audio } from '../../systems/AudioSystem.js';
import { createStoryHud } from '../../ui/storyHud.js';
import { confirmModal } from '../../ui/modal.js';

// JOSEPH — Genesis 37–50. The first playable story.
//
// Slice 1 (this file for now): a warm golden camp backdrop + the story HUD
// (HOME button with an "Are you sure?" confirm, and the top-left objective
// line), proving the shell end-to-end. Slice 2 adds the player, movement, and
// the follow camera; Slice 4 scripts Scene 1 (the coat & the dreams).
export function buildJoseph({ scene, camera, app }) {
  // environment-vibes: safety / belonging → warm golden-hour camp.
  scene.fog = new THREE.Fog(0xffdfba, 44, 250);
  const sky = makeSky({ top: 0xf2b880, bottom: 0xffe9c9 });
  scene.add(sky.mesh);
  scene.add(makeGround());
  scene.add(makeRidges());
  scene.add(makeSun());
  const motes = makeMotes({ count: 80 });
  scene.add(motes.points);

  Audio.ambience({ wind: 0.24, birds: 0.22 });
  Audio.musicPad(0.03, [130.81, 196.0, 261.63]); // warm-camp bed (placeholder)

  const hud = createStoryHud({
    onHome: async () => {
      const leave = await confirmModal({
        title: 'Return home?',
        body: 'Your progress in this story is saved when you finish a scene.',
        confirmText: 'Return home',
        cancelText: 'Keep playing',
      });
      if (leave) app.navigate('home');
    },
  });
  hud.setObjective('Joseph — the story comes together here. Press ⌂ to return home.');

  // Gentle idle drift (a placeholder for the follow camera coming in Slice 2).
  const poseA = { pos: new THREE.Vector3(3, 4.6, 17), look: new THREE.Vector3(-1, 3.2, -22) };
  const poseB = { pos: new THREE.Vector3(-3.5, 4.0, 15.5), look: new THREE.Vector3(1.5, 2.8, -20) };
  const camPos = new THREE.Vector3();
  const camLook = new THREE.Vector3();

  function update(dt, tMs) {
    const t = tMs / 1000;
    sky.update(dt);
    motes.update(dt, t);
    const k = easeInOut((Math.sin(t * (Math.PI * 2 / 30)) + 1) / 2);
    camPos.lerpVectors(poseA.pos, poseB.pos, k);
    camPos.y += Math.sin(t * 0.85) * 0.05;
    camLook.lerpVectors(poseA.look, poseB.look, k);
    camera.position.copy(camPos);
    camera.lookAt(camLook);
  }

  function dispose() {
    hud.destroy();
  }

  return { update, dispose };
}
