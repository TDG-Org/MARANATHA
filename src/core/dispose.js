// Leaving a scene must free its GPU memory (performance mandate — no
// leaks between story chapters). Walks a subtree and disposes geometry,
// materials, and every texture a material references.
export function disposeDeep(root) {
  root.traverse((obj) => {
    // InstancedMesh holds its instanceMatrix / instanceColor in separate GPU
    // buffers that geometry.dispose() does NOT free — only InstancedMesh
    // .dispose() releases them (via three's onDispose handler). Call it.
    if (obj.isInstancedMesh) obj.dispose();
    obj.geometry?.dispose?.();
    const mats = Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : [];
    for (const m of mats) {
      for (const key of Object.keys(m)) {
        const v = m[key];
        if (v && v.isTexture) v.dispose();
      }
      m.dispose?.();
    }
  });
  root.clear?.();
}
