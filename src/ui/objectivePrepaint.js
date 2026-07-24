let depth = 0;

// A checkpoint may execute only the synchronous objective prefix while the
// cinema veil is opaque. StoryHud observes this tiny generic UI scope and
// paints that one handoff immediately; later async objective changes keep the
// normal authored crossfade.
export function withObjectivePrepaint(run) {
  if (typeof run !== 'function') throw new TypeError('Objective prepaint requires a callback');
  depth += 1;
  try {
    return run();
  } finally {
    depth = Math.max(0, depth - 1);
  }
}

export function isObjectivePrepaintActive() {
  return depth > 0;
}
