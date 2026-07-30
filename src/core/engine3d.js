// THE 3D ENGINE EDGE — the only module on the app shell's path that imports
// three. The home story map is pure DOM: before this module loads, a player
// has downloaded ZERO bytes of Three.js (the boot chunk is the shell alone).
// createApp pulls this in behind the loader on the first non-flat navigation,
// and idle-prefetches it once the menu paints so the Start click stays a cut,
// not a download (startup-efficiency skill). Story chunks (joseph3d, legacy,
// playground) import three statically, so the bundler hoists it into one
// shared chunk both edges depend on — the scene chunk and the engine fetch
// in parallel, never as a waterfall.
import * as THREE from 'three';

export { createRenderer, startLoop } from './renderer.js';
export { THREE };
