# /models — rigged 3D character files (GLB)

**STATUS (2026-07-16): real CC0 rigs are INSTALLED** — `character-base.glb` (robed) and
`character-hooded.glb` (hooded), from the KayKit Adventurers pack. See `CREDITS.md` for
licenses, validation numbers, and the clip-mapping gaps (talk→Interact, kneel→Sit_Floor_Idle).
The TEMP capsule remains only as the graceful fallback if these files are removed.

Note vs the original spec below: these rigs use KayKit bone names (`hips/spine/chest/head/
handslot.l/r`), not `mixamorig:*` — that's fine; the loader matches animation clips by NAME
and only searches bones for accessory attachment (`/chest|spine/i`, present here).

## What to provide

Preferred: **one base rigged character** that the `CharacterFactory` reuses for the whole
cast via material color-swaps + small accessory meshes (cheaper, consistent).

| File | Purpose |
|---|---|
| `character-base.glb` | the base robed human, rigged + animated (required) |
| `accessory-coat.glb` *(future — not yet loaded)* | Joseph's layered ornate coat as a separate mesh. The engine does NOT load accessory GLBs yet; today Joseph's coat is a single colour in GLB mode (procedural bands in capsule mode). |
| `<name>.glb` *(future — not yet loaded)* | a fully distinct character, if color-swap isn't enough. Also not auto-loaded yet. |

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

Embed these as named `AnimationClip`s **inside `character-base.glb`** — the engine reads that one
file's `animations` only (separate `clips/<name>.glb` files are NOT auto-loaded yet). Each clip's
name is matched case-insensitively **by substring**, so the name must CONTAIN its state word:

- `idle` — relaxed standing loop
- `walk` — forward walk loop (~1.3 m/s feel)
- `run` — forward run loop
- `talk` — gesturing-in-place loop (for dialogue)
- `kneel` — kneel down / reverent pose (can be a one-shot; hold last frame)

Mixamo clips work, with one caveat: a raw Mixamo clip is named `mixamo.com`, which won't match the
state words — **rename each clip to its state** (`idle` / `walk` / `run` / `talk` / `kneel`) and
bake them all into `character-base.glb` (export as **glTF Binary .glb**). Then the loader's clip
matching picks them up.

## How the engine uses these

- `CharacterFactory` looks for `character-base.glb`; if absent it builds a **TEMP capsule**
  with the same animation-state API (procedural bob/lean stand-ins), tinted per variant.
- Clips are driven by an `AnimationMixer` with crossfades between `idle/walk/run/talk/kneel`.
- Name tags render above the head (DOM-projected, clamped scale).

> Sourcing: Mixamo (free, Adobe account) for rig+clips; or Quaternius / Kenney (CC0)
> low-poly rigged humans. Hand me a file or a link and I'll wire it in.
