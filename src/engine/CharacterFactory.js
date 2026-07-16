import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { Character3D } from './Character3D.js';

// Builds the whole cast from shared base rigs: load the robed base (and the
// hooded variant when present) ONCE, then clone per character (SkeletonUtils)
// with per-part Alto color swaps — the clip library is shared, and each
// character renders as ~1 draw call (merged skinned body). If no GLB exists,
// every character is the labeled TEMP capsule with the same API.
//
// Files (see /models/MODELS.md + CREDITS.md):
//   models/character-base.glb    — robed base (required for GLB mode)
//   models/character-hooded.glb  — hooded variant (optional)
export class CharacterFactory {
  constructor() {
    this.bases = { robed: null, hooded: null };
    this.hasGLB = false;
    this._tried = false;
    this._loader = new GLTFLoader();
  }

  async loadBase() {
    if (this._tried) return this.hasGLB;
    this._tried = true;
    this.bases.robed = await this._load('models/character-base.glb');
    this.bases.hooded = await this._load('models/character-hooded.glb');
    this.hasGLB = !!this.bases.robed;
    return this.hasGLB;
  }

  async _load(url) {
    try { return await this._loader.loadAsync(url); } catch { return null; }
  }

  // opts: { name, colors:{robe,robeShade,skin,hair,coat[]}, scale, base:'robed'|'hooded',
  //         staff:boolean (Jacob), hoodIsCloth:boolean }
  create({ name = '', colors = {}, scale = 1, base = 'robed', staff = false, hoodIsCloth = false } = {}) {
    const src = this.bases[base] || this.bases.robed;
    if (this.hasGLB && src) {
      const scene = skeletonClone(src.scene);
      return new Character3D({
        mode: 'glb', gltf: { scene, animations: src.animations },
        colors, scale, name, staff, hoodIsCloth,
      });
    }
    return new Character3D({ mode: 'capsule', colors, scale, name, temp: true });
  }

  // Free the shared base GLBs ONCE (clones share base geometry by reference;
  // per-character dispose only frees per-instance merged geometry/materials).
  dispose() {
    for (const key of Object.keys(this.bases)) {
      const base = this.bases[key];
      if (!base) continue;
      base.scene.traverse((o) => {
        if (!o.isMesh && !o.isSkinnedMesh) return;
        o.geometry?.dispose?.();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => {
          if (!m) return;
          for (const k in m) { const v = m[k]; if (v && v.isTexture) v.dispose(); }
          m.dispose?.();
        });
      });
      this.bases[key] = null;
    }
    this.hasGLB = false;
    this._tried = false;
  }
}
