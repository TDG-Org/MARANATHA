// prefers-reduced-motion, one shared gate (accessibility skill). Every DOM
// surface (loader marks, HUD pulses, dialogue dips) asks THIS instead of
// sprawling per-surface matchMedia reads, so the whole UI answers the OS
// setting consistently. The 3D world's calm authored motion is the game
// itself and is not gated here; decorative churn is.
const query = typeof window !== 'undefined' && window.matchMedia
  ? window.matchMedia('(prefers-reduced-motion: reduce)')
  : null;

export const prefersReducedMotion = () => !!query?.matches;
