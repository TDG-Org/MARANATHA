export function makeAbortError(message = 'Operation aborted') {
  const error = new Error(message);
  error.name = 'AbortError';
  return error;
}

export function abortReason(signal) {
  return signal?.reason instanceof Error ? signal.reason : makeAbortError();
}

export function isAbortError(error) {
  return error?.name === 'AbortError';
}

export function throwIfAborted(signal) {
  if (signal?.aborted) throw abortReason(signal);
}

// Reject the consumer immediately on lifetime abort while still observing the
// underlying work, so a late rejection can never become unhandled.
export function withAbort(work, signal) {
  if (!signal) return Promise.resolve().then(() => (typeof work === 'function' ? work() : work));
  if (signal.aborted) return Promise.reject(abortReason(signal));

  let promise;
  try { promise = Promise.resolve(typeof work === 'function' ? work() : work); }
  catch (error) { return Promise.reject(error); }

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener('abort', onAbort);
      fn(value);
    };
    const onAbort = () => finish(reject, abortReason(signal));
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => finish(resolve, value),
      (error) => finish(reject, error),
    );
  });
}
