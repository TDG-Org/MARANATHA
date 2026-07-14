import { createApp } from './core/app.js';
import { buildHome } from './screens/home.js';
import { buildJoseph } from './scenes/joseph/index.js';
import { Audio } from './systems/AudioSystem.js';
import { Settings } from './systems/Settings.js';
import { Narrator } from './systems/Narrator.js';
import { mountVolumeControl } from './ui/volume.js';

// MARANATHA — HD-2D engine (Three.js). Flat Alto-style sprites living in a 3D
// world with a real moving camera. Phase C boots into the home/story map;
// stories are screens the app navigates between with eased fades.

const container = document.getElementById('app');
const app = createApp(container);

app.register('home', buildHome);
app.register('joseph', buildJoseph);

mountVolumeControl();
app.navigate('home');

// Debug/testing handle (harmless in production; used by automated playtests).
window.__MARANATHA = { app, Audio, Settings, Narrator };
