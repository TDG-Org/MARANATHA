import { Audio } from '../systems/AudioSystem.js';

// DOM volume control (mute button + slider), top-right. DOM = native-crisp
// rendering, real accessibility semantics, and finger-sized targets for
// free. Volume persists via AudioSystem (localStorage). M toggles mute.
export function mountVolumeControl() {
  const host = document.getElementById('volume');
  if (!host) return;

  const button = document.createElement('button');
  button.type = 'button';
  button.setAttribute('aria-label', 'Mute');

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '0';
  slider.max = '100';
  slider.step = '1';
  slider.setAttribute('aria-label', 'Volume');

  const sync = () => {
    button.textContent = Audio.enabled ? '🔊' : '🔇';
    slider.value = String(Math.round(Audio.volume * 100));
  };

  button.addEventListener('click', () => {
    Audio.unlock();
    Audio.toggleMute();
    if (Audio.enabled) Audio.uiClick();
  });
  slider.addEventListener('input', () => {
    Audio.unlock();
    Audio.setVolume(Number(slider.value) / 100);
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'm' || e.key === 'M') {
      Audio.unlock();
      Audio.toggleMute();
    }
  });
  Audio.onVolume = sync;

  host.append(button, slider);
  sync();
}
