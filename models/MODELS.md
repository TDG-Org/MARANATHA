# /models — rigged 3D character files (GLB)

The 3D character system (Phase D1) loads characters from this folder. Until a real
rigged GLB is here, the game uses a **clearly-labeled TEMP capsule** stand-in so the
camera, movement, animation-state API, name tags, and playground all work — but the
toon look, real animation, and cast variants only appear once you drop in a real file.

## What to provide

Preferred: **one base rigged character** that the `CharacterFactory` reuses for the whole
cast via material color-swaps + small accessory meshes (cheaper, consistent).

| File | Purpose |
|---|---|
| `character-base.glb` | the base robed human, rigged + animated (required) |
| `accessory-coat.glb` *(optional)* | Joseph's layered ornate coat as a separate mesh |
| `<name>.glb` *(optional)* | a fully distinct character, if color-swap isn't enough |

## Format & rig requirements

- **Format:** binary **.glb**, Y-up, **meters**, origin **at the feet**, facing **+Z**.
- **Scale:** ~**1.7 units** tall (world/human scale; Joseph reads ~1.7–1.9).
- **Rig:** **Mixamo-compatible** — standard `mixamorig:*` bone names (Hips, Spine, Head,
  LeftArm, RightUpLeg, …) so clips retarget/share across variants.
- **Budget:** **≤ 10k triangles** per character; one skinned mesh if possible; no PBR
  maps needed (the engine applies flat/toon materials in the Alto palette).
- **Materials:** untextured or flat vertex/material colors are fine — the engine overrides
  with `MeshToonMaterial` (zero shininess). Keep material slots named so color-swap can
  target them (e.g. `robe`, `skin`, `hair`, `sash`).

## Required animation clips

Embed these as named `AnimationClip`s in `character-base.glb` (or provide alongside as
`clips/<name>.glb`). Names are matched case-insensitively:

- `idle` — relaxed standing loop
- `walk` — forward walk loop (~1.3 m/s feel)
- `run` — forward run loop
- `talk` — gesturing-in-place loop (for dialogue)
- `kneel` — kneel down / reverent pose (can be a one-shot; hold last frame)

Mixamo clips work directly: download as **glTF Binary (.glb)**, "Without Skin" for the
extra clips if you keep them separate, or bake them all into the base file.

## How the engine uses these

- `CharacterFactory` looks for `character-base.glb`; if absent it builds a **TEMP capsule**
  with the same animation-state API (procedural bob/lean stand-ins), tinted per variant.
- Clips are driven by an `AnimationMixer` with crossfades between `idle/walk/run/talk/kneel`.
- Name tags render above the head (DOM-projected, clamped scale).

> Sourcing: Mixamo (free, Adobe account) for rig+clips; or Quaternius / Kenney (CC0)
> low-poly rigged humans. Hand me a file or a link and I'll wire it in.
