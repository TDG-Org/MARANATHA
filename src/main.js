import { createApp } from './core/app.js';
import { buildHome } from './screens/home.js';
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

app.register('home', buildHome);
// Load only the route a player opens. Scene 1 no longer makes the home screen
// parse the legacy game/playground, and those developer routes never occupy a
// normal player's memory.
app.registerLazy('joseph', () => import('./scenes/joseph3d/index.js').then((m) => m.buildJoseph3D));
app.registerLazy('legacy-joseph', () => import('./scenes/joseph/index.js').then((m) => m.buildJoseph));
app.registerLazy('playground', () => import('./screens/playground.js').then((m) => m.buildPlayground));
app.registerLazy('about', () => import('./screens/pages.js').then((m) => m.buildAbout));
app.registerLazy('support', () => import('./screens/pages.js').then((m) => m.buildSupport));

Audio.registerManifest(AUDIO_MANIFEST);
mountVolumeControl();
mountSkipButton();
app.navigate(
  /playground/.test(location.hash) ? 'playground'
    : /legacy-joseph/.test(location.hash) ? 'legacy-joseph'
      : /about/.test(location.hash) ? 'about'
        : /support/.test(location.hash) ? 'support'
          : 'home',
);

// Debug/testing handle (harmless in production; used by automated playtests).
window.__MARANATHA = { app, Audio, Settings, Narrator };
