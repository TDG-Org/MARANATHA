import { createApp } from './core/app.js';
import { buildHome } from './screens/home.js';
import { buildJoseph } from './scenes/joseph/index.js';
import { buildJoseph3D } from './scenes/joseph3d/index.js';
import { buildPlayground } from './screens/playground.js';
import { buildAbout, buildSupport } from './screens/pages.js';
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
app.register('joseph', buildJoseph3D);        // the 3D Scene 1 is the default story route
app.register('legacy-joseph', buildJoseph);   // the 2D original, until Nate signs off on 3D
app.register('playground', buildPlayground);  // #playground — 3D foundation test bench
app.register('about', buildAbout);            // #about — the vision
app.register('support', buildSupport);        // #support — Stripe payment link

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
