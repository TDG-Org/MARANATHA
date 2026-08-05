// Settle a promise within a bounded wall-clock window. Callers can opt into a
// false sentinel when timeout is a recoverable branch; actual promise
// rejections always remain errors.
export const waitWithDeadline = (
  promise,
  ms,
  message,
  { rejectOnTimeout = true } = {},
) => new Promise((resolve, reject) => {
  let settled = false;
  const timer = setTimeout(() => {
    if (settled) return;
    settled = true;
    if (rejectOnTimeout) reject(new Error(message));
    else resolve(false);
  }, ms);
  Promise.resolve(promise).then(
    (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    },
    (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    },
  );
});

// ── A DEADLINE THAT CAN TELL "SLOW" FROM "STUCK" ────────────────────────────
//
// A flat wall-clock deadline over a download cannot. The story pulls ~3.7 MB of
// rigs, textures and narration; a 12s limit meant a 3G-class link was thrown
// back to the menu with "The story assets did not finish loading" while the
// download was progressing perfectly well, and even an ordinary 400 KB/s link
// finished with about 300ms to spare. Raising the number just moves the line:
// some connection is always slower, and a genuinely wedged fetch then hangs for
// however long the new number is.
//
// So watch PROGRESS instead. `progress()` returns any monotonic measure of
// "something is still arriving"; while it keeps changing the wait continues,
// and the deadline only fires after `stallMs` of nothing happening at all. A
// hard cap remains as a backstop against a progress signal that lies.
export const waitWhileProgressing = (
  promise,
  {
    progress,
    stallMs = 20000,
    hardCapMs = 180000,
    pollMs = 1000,
    message = 'Timed out',
    rejectOnTimeout = true,
  } = {},
) => new Promise((resolve, reject) => {
  let settled = false;
  let lastChange = Date.now();
  let lastValue = null;
  const started = Date.now();

  const finish = (fn, arg) => {
    if (settled) return;
    settled = true;
    clearInterval(poll);
    fn(arg);
  };

  const poll = setInterval(() => {
    if (settled) return;
    let value = null;
    // A progress source that throws must never be the reason a player is
    // stranded — treat it as "no information" and let the hard cap decide.
    try { value = progress?.(); } catch { value = lastValue; }
    const now = Date.now();
    if (value !== lastValue) { lastValue = value; lastChange = now; }
    const stalled = now - lastChange >= stallMs;
    const capped = now - started >= hardCapMs;
    if (!stalled && !capped) return;
    const why = capped ? `${message} (hard cap)` : `${message} (no progress for ${stallMs}ms)`;
    if (rejectOnTimeout) finish(reject, new Error(why));
    else finish(resolve, false);
  }, pollMs);

  Promise.resolve(promise).then(
    (value) => finish(resolve, value),
    (error) => finish(reject, error),
  );
});
