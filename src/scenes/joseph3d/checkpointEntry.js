import { withObjectivePrepaint } from '../../ui/objectivePrepaint.js';
import { saveGeneration } from '../../systems/SaveSystem.js';
export { withObjectivePrepaint, isObjectivePrepaintActive } from '../../ui/objectivePrepaint.js';

const INTERACTIVE_CHECKPOINTS = new Set([1, 2, 4, 6]);

export function isInteractiveCheckpoint(index) {
  return INTERACTIVE_CHECKPOINTS.has(index);
}

// A debug beat replay must exercise the exact story code without borrowing
// ownership of the player's persistent checkpoint/progress. Keep that policy
// at one boundary so normal play and isolated QA cannot accidentally diverge.
export function createCheckpointPersistence({
  isolated = false,
  saveBeat = () => {},
  saveCompletion = () => {},
} = {}) {
  // If the player wipes their progress from the pause menu mid-story, this
  // handle is stale: every later beat would write its checkpoint back into the
  // save that was just cleared. Born in one generation, silent after a reset.
  const bornIn = saveGeneration();
  const live = () => !isolated && saveGeneration() === bornIn;
  return Object.freeze({
    checkpoint(beat) {
      if (live()) saveBeat(beat);
    },
    complete() {
      if (live()) saveCompletion();
    },
  });
}

// Checkpoint entry temporarily owns input while an interactive beat executes
// its synchronous objective/guide prefix behind black. The beat may request
// control immediately, but the real controller stays disabled until reveal.
export function createInputGate(applyInput) {
  let held = false;
  let requested = false;

  return {
    set(on) {
      const next = !!on;
      if (!held) {
        applyInput(next);
        return;
      }
      requested = next;
      if (!next) applyInput(false);
    },

    hold() {
      if (held) throw new Error('Checkpoint input is already held');
      held = true;
      requested = false;
      applyInput(false);
      let released = false;

      return (allowRequested = true) => {
        if (released) {
          // A beat failure after reveal still leaves the scene safely inert.
          if (!allowRequested) applyInput(false);
          return;
        }
        released = true;
        held = false;
        const next = !!allowRequested && requested;
        requested = false;
        applyInput(next);
      };
    },
  };
}

export async function runInteractiveCheckpointEntry({
  index,
  holdInput,
  prepare,
  invokeBeat,
  reveal,
  withObjectivePrepaint: prepaint = withObjectivePrepaint,
}) {
  const releaseInput = holdInput();
  let beatPromise = null;
  try {
    prepare();
    // Calling the async beat executes its objective/guide prefix now. Observe
    // rejection immediately while reveal is pending, then await the same
    // promise after control is released—never invoke the beat a second time.
    beatPromise = Promise.resolve(prepaint(invokeBeat));
    beatPromise.catch(() => {});
    await reveal();
    releaseInput(true);
    await beatPromise;
    return index + 1;
  } catch (error) {
    releaseInput(false);
    throw error;
  }
}
