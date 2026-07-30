import { STORIES } from '../data/stories.js';

// Browser-only progress (no accounts yet). Stores just the completed story
// ids — "current" and "locked" are derived from registry order, so the save
// can never get into a broken state.
const KEY = 'maranatha-save-v1';

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    const data = raw ? JSON.parse(raw) : null;
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}

function write(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Private browsing / storage denied: play still works, progress just won't persist.
  }
}

export function getCompleted() {
  const { completed } = read();
  return Array.isArray(completed) ? completed : [];
}

// 'done' | 'current' | 'locked'
export function statusOf(storyId) {
  const completed = getCompleted();
  if (completed.includes(storyId)) return 'done';
  // "Current" means the next chapter the player can actually WALK. Measuring it
  // against every chapter in the book made it Creation forever -- a story with
  // no scene yet -- so no playable chapter was ever marked current and the map
  // had to fall back to guessing. Unbuilt chapters are scenery; they cannot be
  // the thing you are up to.
  // ...and an EXPLORABLE chapter is not somewhere you are "up to" either. The
  // ark is walkable with no story in it, so it can never be completed; left in
  // this list it takes 'current' (it sits earlier in the book than Joseph) and
  // never hands it on, which is the same shape as the D26 no-current bug from
  // the other direction.
  const playable = STORIES.filter((s) => s.sceneKey && !s.explore);
  const current = playable.find((s) => !completed.includes(s.id));
  return current?.id === storyId ? 'current' : 'locked';
}

// DELIBERATELY UNCALLED until scenes 2+ exist (audited, kept): with Joseph as
// the only playable chapter, marking it 'done' would leave NO 'current'
// chapter — the exact shape of the D26 reset bug. The first scene-2 finish
// flow wires this, when 'done' can hand 'current' to the next chapter.
// getSceneProgress below is the same parked contract's reader half.
export function completeStory(storyId) {
  const data = read();
  const completed = Array.isArray(data.completed) ? data.completed : [];
  if (!completed.includes(storyId)) completed.push(storyId);
  data.completed = completed;
  write(data);
}

// Furthest scene reached within a story (0 = none). Lets a partly-built story
// like Joseph record progress without marking the whole story complete.
export function getSceneProgress(storyId) {
  const { scenes } = read();
  return (scenes && typeof scenes === 'object' && scenes[storyId]) || 0;
}

export function setSceneProgress(storyId, n) {
  const data = read();
  const scenes = data.scenes && typeof data.scenes === 'object' ? data.scenes : {};
  scenes[storyId] = Math.max(n, scenes[storyId] || 0);
  data.scenes = scenes;
  write(data);
}

// Mid-scene beat checkpoints — a refresh resumes at the saved beat. Stored in
// the same save object, so "Reset progress" clears these too.
export function getCheckpoint(sceneId) {
  const { checkpoints } = read();
  return (checkpoints && typeof checkpoints === 'object' && checkpoints[sceneId]) || 0;
}

export function setCheckpoint(sceneId, beat) {
  const data = read();
  const cp = data.checkpoints && typeof data.checkpoints === 'object' ? data.checkpoints : {};
  cp[sceneId] = beat;
  data.checkpoints = cp;
  write(data);
}

export function clearCheckpoint(sceneId) {
  const data = read();
  if (data.checkpoints) { delete data.checkpoints[sceneId]; write(data); }
}

export function resetProgress() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
