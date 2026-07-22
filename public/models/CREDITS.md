# /models — asset credits & licenses

Every model file in this folder, with source and license, per the asset-pipeline rule:
no log line → the asset doesn't ship.

| File | Source asset | Author | License | Source URL | Downloaded | Modifications |
|---|---|---|---|---|---|---|
| `character-base.glb` | KayKit Adventurers Character Pack 1.0 — **Mage.glb** | Kay Lousberg (kaylousberg.com) | **CC0** (verified in repo `LICENSE.txt` at download time) | https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0 | 2026-07-16 | Runtime hides fantasy accessories, recolors parts to the Alto palette, repurposes `Mage_Cape` as Joseph's coat and `2H_Staff` as Jacob's staff. On 2026-07-22 the GLB was losslessly repacked: all scene/mesh/material/image/skin bytes were retained exactly and the 76-clip source library was reduced to 17 runtime/staging clips. |
| `character-hooded.glb` | KayKit Adventurers Character Pack 1.0 — **Rogue_Hooded.glb** | Kay Lousberg (kaylousberg.com) | **CC0** (same `LICENSE.txt`) | https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0 | 2026-07-16 | Same runtime treatment; weapons hidden and the hooded head retained for variety. On 2026-07-22 it received the same exact-byte animation-library repack (76 → 17 clips). |

## Validation summary (glbcheck + production GLTFLoader, 2026-07-22)

| File | Size | Tris | Rig | Clips |
|---|---|---|---|---|
| character-base.glb | 1.08 MiB | 5,683 (≤10k ✓) | 1 skin, 41 joints | 17 retained clips |
| character-hooded.glb | 1.09 MiB | 6,035 (≤10k ✓) | same rig | same 17 clips |

`tools/test-character-glb-optimizer.mjs` parses both files with Three.js's real
`GLTFLoader`, compares scene signatures, exercises all five mapped game states,
hash-checks retained buffer views, and proves deterministic/idempotent output.

### Clip mapping vs MODELS.md spec (gaps documented)

| Our state | Clip used | Note |
|---|---|---|
| idle | `Idle` | exact |
| walk | `Walking_A` | exact family |
| run | `Running_A` | exact family |
| talk | `Interact` | **gap:** no dedicated talk clip — Interact reads as gesturing |
| kneel | `Sit_Floor_Idle` | **gap:** no true kneel — floor-sit is the closest reverent pose |

Rig bone names are KayKit's own (`hips/spine/chest/head/handslot.l/r`), NOT `mixamorig:*` —
MODELS.md's Mixamo note updated; the loader matches clips by name and never needs bone names,
except accessory attach which searches `/chest|spine/i` (present here).

> Support the author (optional, license does not require it): kaylousberg.com / KayKit on itch.io.
