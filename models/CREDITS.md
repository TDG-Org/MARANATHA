# /models — asset credits & licenses

Every model file in this folder, with source and license, per the asset-pipeline rule:
no log line → the asset doesn't ship.

| File | Source asset | Author | License | Source URL | Downloaded | Modifications |
|---|---|---|---|---|---|---|
| `character-base.glb` | KayKit Adventurers Character Pack 1.0 — **Mage.glb** | Kay Lousberg (kaylousberg.com) | **CC0** (verified in repo `LICENSE.txt` at download time) | https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0 | 2026-07-16 | Loaded as-is; at runtime we hide fantasy accessories (hat, spellbook, wand), re-color parts to the Alto palette (flat toon, original texture unused), repurpose `Mage_Cape` as Joseph's coat and `2H_Staff` as Jacob's staff. |
| `character-hooded.glb` | KayKit Adventurers Character Pack 1.0 — **Rogue_Hooded.glb** | Kay Lousberg (kaylousberg.com) | **CC0** (same `LICENSE.txt`) | https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0 | 2026-07-16 | Same treatment; weapons (knife, crossbows, throwable) hidden; hooded head kept for shepherd/brother variety. |

## Validation summary (glbcheck, 2026-07-16)

| File | Size | Tris | Rig | Clips |
|---|---|---|---|---|
| character-base.glb | 3.4 MB | 5,683 (≤10k ✓) | 1 skin, 41 joints | 77 shared clips |
| character-hooded.glb | 3.4 MB | 6,035 (≤10k ✓) | same rig | same library |

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
