import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { Character3D } from './Character3D.js';

// Builds the whole cast from ONE base rig: load models/character-base.glb once,
// then clone it per variant (SkeletonUtils, shared geometry) with material
// color-swaps. If the GLB is absent, every character is a clearly-labeled TEMP
// capsule with the same API — so the camera, animation states, name tags, and
// playground all work before any real asset arrives.
export class CharacterFactory {
  constructor() {
    this.base = null;
    this.hasGLB = false;
    this._tried = false;
    this._loader = new GLTFLoader();
  }

  // Returns true if a real rigged GLB loaded. Safe to call repeatedly.
  async loadBase(url = 'models/character-base.glb') {
    if (this._tried) return this.hasGLB;
    this._tried = true;
    try {
      this.base = await this._loader.loadAsync(url);
      this.hasGLB = true;
    } catch {
      this.hasGLB = false; // no file yet → TEMP capsule mode (expected while /models is empty)
    }
    return this.hasGLB;
  }

  create({ name = '', colors = {}, scale = 1 } = {}) {
    if (this.hasGLB && this.base) {
      const scene = skeletonClone(this.base.scene);
      return new Character3D({ mode: 'glb', gltf: { scene, animations: this.base.animations }, colors, scale, name });
    }
    return new Character3D({ mode: 'capsule', colors, scale, name, temp: true });
  }

  // Free the base GLB's geometry/materials/textures ONCE (clones share the
  // base geometry by reference, so individual characters must not dispose it —
  // Character3D.dispose() skips geometry in GLB mode). Call at scene teardown.
  dispose() {
    if (!this.base) return;
    this.base.scene.traverse((o) => {
      if (!o.isMesh) return;
      o.geometry?.dispose?.();
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m) => {
        if (!m) return;
        for (const k in m) { const v = m[k]; if (v && v.isTexture) v.dispose(); }
        m.dispose?.();
      });
    });
    this.base = null;
    this.hasGLB = false;
  }
}
