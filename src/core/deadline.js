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
