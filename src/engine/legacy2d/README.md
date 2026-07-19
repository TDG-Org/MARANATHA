# engine/legacy2d — the 2D-era engine (frozen)

These four modules power ONLY the original 2D Joseph scene at `#legacy-joseph`
(`src/scenes/joseph/`), kept until the 3D scene is signed off. Nothing on the
live 3D path imports from here. Retire this folder together with that route.

- `Character.js` — billboarded sprite character (canvas atlas walk cycle)
- `PlayerController.js` — 2D-era movement (keys/tap/joystick)
- `FollowCamera.js` — the pre-CameraDirector trailing camera
- `Interaction.js` — the pre-Interactables proximity prompt system

Also legacy-2D-only (kept in their own layers): `src/ui/verse.js` and
`src/data/verses.js` (BSB text — the legacy scene keeps its original
translation; the live game reads WEB from `src/data/versesWEB.js`).
