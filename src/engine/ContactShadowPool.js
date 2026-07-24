import * as THREE from 'three';
import { blobShadow } from './world.js';

// High-quality character contact shadows, pooled into one InstancedMesh.
// Pixel shape/material matches blobShadow(); only ownership changes:
// 15 identical planes/textures/materials/draws become one shared resource and
// one draw. Entries follow character roots and may be hidden independently.
export class ContactShadowPool {
  constructor(scene, capacity = 20) {
    const seed = blobShadow(1);
    this.geometry = seed.geometry;
    this.material = seed.material;
    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false; // actors teleport between distant stages
    this.mesh.count = 0;
    this.entries = [];
    this._dummy = new THREE.Object3D();
    this._index = new Map();
    scene.add(this.mesh);
  }

  add(character, width = 1.15) {
    if (!character || this.entries.length >= this.mesh.instanceMatrix.count || this._index.has(character)) return;
    const entry = {
      character, width, visible: true,
      lastX: NaN, lastY: NaN, lastZ: NaN, lastVisible: null,
    };
    this._index.set(character, this.entries.length);
    this.entries.push(entry);
    this.mesh.count = this.entries.length;
    this.update();
  }

  setVisible(character, on) {
    const i = this._index.get(character);
    if (i === undefined) return;
    this.entries[i].visible = !!on;
  }

  update() {
    const d = this._dummy;
    let changed = false;
    for (let i = 0; i < this.entries.length; i++) {
      const e = this.entries[i];
      const p = e.character.root.position;
      if (
        p.x === e.lastX
        && p.y === e.lastY
        && p.z === e.lastZ
        && e.visible === e.lastVisible
      ) continue;
      e.lastX = p.x;
      e.lastY = p.y;
      e.lastZ = p.z;
      e.lastVisible = e.visible;
      d.position.set(p.x, p.y + 0.03, p.z);
      d.rotation.set(-Math.PI / 2, 0, 0);
      d.scale.set(e.visible ? e.width : 0, e.visible ? e.width : 0, 1);
      d.updateMatrix();
      this.mesh.setMatrixAt(i, d.matrix);
      changed = true;
    }
    // Idle characters should not upload an unchanged instance buffer.
    if (changed) this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.mesh.parent?.remove(this.mesh);
    this.mesh.dispose();
    this.geometry.dispose();
    this.material.map?.dispose();
    this.material.dispose();
    this.entries.length = 0;
    this._index.clear();
  }
}
