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
  const current = STORIES.find((s) => !completed.includes(s.id));
  return current?.id === storyId ? 'current' : 'locked';
}

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
