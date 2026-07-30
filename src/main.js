import { createApp } from './core/app.js';
import { buildHome } from './screens/home/index.js';
import { Audio } from './systems/AudioSystem.js';
import { Settings } from './systems/Settings.js';
import { Narrator } from './systems/Narrator.js';
import { AUDIO_MANIFEST } from './data/audioManifest.js';
import { mountVolumeControl } from './ui/volume.js';
import { mountSkipButton } from './ui/skipButton.js';

// MARANATHA — HD-2D engine (Three.js). Flat Alto-style sprites living in a 3D
// world with a real moving camera. Phase C boots into the home/story map;
// stories are screens the app navigates between with eased fades.

const container = document.getElementById('app');
const app = createApp(container);

// `flat` at REGISTRATION: the home is pure DOM, so booting into it downloads
// zero bytes of Three.js — the engine chunk loads behind the loader on the
// first story navigation (and idle-prefetches while the menu is up).
app.register('home', buildHome, { flat: true });
// Load only the route a player opens. Scene 1 no longer makes the home screen
// parse the legacy game/playground, and those developer routes never occupy a
// normal player's memory.
app.registerLazy('joseph', () => import('./scenes/joseph3d/index.js').then((m) => m.buildJoseph3D));
app.registerLazy('noah', () => import('./scenes/noah/index.js').then((m) => m.buildNoahArk));
app.registerLazy('legacy-joseph', () => import('./scenes/joseph/index.js').then((m) => m.buildJoseph));
app.registerLazy('playground', () => import('./screens/playground.js').then((m) => m.buildPlayground));
// About and Support are NOT routes. They are panels the home opens over itself,
// so its music keeps playing and the real map stays behind them (see pages.js).

Audio.registerManifest(AUDIO_MANIFEST);
mountVolumeControl();
mountSkipButton();
const openPanel = /about/.test(location.hash) ? 'about'
  : /support/.test(location.hash) ? 'support'
    : null;
// legacy-joseph must be tested BEFORE joseph, or the shared substring routes it
// to the 3D scene and the 2D original becomes unreachable.
const routeFromHash = () => {
  const h = location.hash;
  if (/playground/.test(h)) return 'playground';
  if (/legacy-joseph/.test(h)) return 'legacy-joseph';
  if (/noah/.test(h)) return 'noah';
  if (/joseph/.test(h)) return 'joseph';
  return 'home';
};
app.navigate(routeFromHash(), openPanel ? { openPanel } : undefined);

// Debug/testing handle (harmless in production; used by automated playtests).
window.__MARANATHA = { app, Audio, Settings, Narrator };
