#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { findClip } from '../src/engine/Character3D.js';
import {
  DEFAULT_CLIPS,
  RUNTIME_CLIPS,
  optimizeCharacterGlb,
  parseGlb,
} from './optimize-character-glb.mjs';

globalThis.self = globalThis;
// GLTFLoader only needs image dimensions for this structure/animation test;
// browsers perform the real PNG decode. The embedded image bytes are checked
// separately by the optimizer's exact retained-bufferView hash validation.
globalThis.createImageBitmap = async () => ({ width: 1024, height: 1024, close() {} });

const MODELS = [
  'public/models/character-base.glb',
  'public/models/character-hooded.glb',
];

const EXPECTED_STATE_CLIPS = Object.freeze({
  idle: 'Idle',
  walk: 'Walking_A',
  run: 'Running_A',
  talk: 'Interact',
  kneel: 'Sit_Floor_Idle',
});

function toArrayBuffer(bytes) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

function sceneSignature(scene) {
  const nodes = [];
  scene.traverse((node) => {
    nodes.push({
      name: node.name,
      type: node.type,
      childCount: node.children.length,
      position: node.position.toArray(),
      quaternion: node.quaternion.toArray(),
      scale: node.scale.toArray(),
      vertices: node.geometry?.attributes?.position?.count ?? null,
      indices: node.geometry?.index?.count ?? null,
      bones: node.skeleton?.bones?.length ?? null,
    });
  });
  return nodes;
}

async function loadWithProductionLoader(bytes) {
  return new GLTFLoader().parseAsync(toArrayBuffer(bytes), '');
}

async function run() {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'maranatha-glb-opt-'));
  const reports = [];
  try {
    for (const model of MODELS) {
      const sourceBytes = await readFile(model);
      const { output, report } = optimizeCharacterGlb(sourceBytes, { label: model });
      const candidatePath = path.join(tempDir, `${path.basename(model, '.glb')}.candidate.glb`);
      await writeFile(candidatePath, output);

      if (report.clipsBefore > DEFAULT_CLIPS.length) {
        assert.ok(report.outputBytes < report.inputBytes, `${model}: candidate did not shrink`);
      } else {
        // Once the validated candidate becomes the tracked production model,
        // rerunning the optimizer is an idempotence check rather than another
        // compression pass.
        assert.equal(report.clipsBefore, DEFAULT_CLIPS.length, `${model}: unexpected clip inventory`);
        assert.equal(report.outputBytes, report.inputBytes, `${model}: optimized production file changed size`);
      }
      assert.equal(report.clipsAfter, DEFAULT_CLIPS.length, `${model}: wrong retained clip count`);
      for (const required of RUNTIME_CLIPS) {
        assert.ok(report.retainedClips.includes(required), `${model}: missing ${required}`);
      }

      const parsed = parseGlb(output, candidatePath);
      assert.equal(parsed.bytes.byteLength, report.outputBytes, `${model}: report size mismatch`);
      assert.deepEqual(parsed.json.animations.map((animation) => animation.name), report.retainedClips,
        `${model}: written clip names changed`);

      // Actual Three GLTFLoader parse for both source and candidate. Scene graph,
      // mesh counts, transforms, geometry counts, and skeleton counts must match.
      const [sourceGltf, candidateGltf] = await Promise.all([
        loadWithProductionLoader(sourceBytes),
        loadWithProductionLoader(output),
      ]);
      assert.deepEqual(sceneSignature(candidateGltf.scene), sceneSignature(sourceGltf.scene),
        `${model}: production-loader scene signature changed`);

      // Exercise all five states through the exact function Character3D uses.
      const mixer = new THREE.AnimationMixer(candidateGltf.scene);
      for (const [state, expectedName] of Object.entries(EXPECTED_STATE_CLIPS)) {
        const clip = findClip(candidateGltf.animations, state);
        assert.ok(clip, `${model}: Character3D could not resolve '${state}'`);
        assert.equal(clip.name, expectedName, `${model}: '${state}' resolved differently`);
        const action = mixer.clipAction(clip);
        action.reset().play();
        mixer.update(1 / 60);
        action.stop();
      }
      mixer.stopAllAction();

      // Determinism: a second pass over identical bytes must be byte-identical.
      const repeated = optimizeCharacterGlb(sourceBytes, { label: `${model} repeat` });
      assert.deepEqual(repeated.output, output, `${model}: output is not deterministic`);
      reports.push({ model, ...report });
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }

  const before = reports.reduce((sum, report) => sum + report.inputBytes, 0);
  const after = reports.reduce((sum, report) => sum + report.outputBytes, 0);
  console.log('character GLB optimizer: PASS');
  for (const report of reports) {
    console.log(`  ${report.model}: ${report.inputBytes} -> ${report.outputBytes} bytes (${report.savedPercent.toFixed(2)}% saved), ${report.clipsBefore} -> ${report.clipsAfter} clips`);
  }
  console.log(`  combined: ${before} -> ${after} bytes (${((1 - after / before) * 100).toFixed(2)}% saved)`);
  console.log(`  retained runtime states: ${Object.entries(EXPECTED_STATE_CLIPS).map(([state, clip]) => `${state}=${clip}`).join(', ')}`);
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
