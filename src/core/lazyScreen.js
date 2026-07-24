import { waitWithDeadline } from './deadline.js';

// Resolve and cache one lazy screen builder. The in-flight identity matters:
// a timed-out request must become retryable, and a late rejection from that
// abandoned request must never clear a newer retry.
export async function resolveLazyScreen(entry, key, { timeoutMs = 12000 } = {}) {
  if (entry.builder) return entry.builder;

  let request = entry.promise;
  if (!request) {
    request = Promise.resolve().then(entry.load).then((loaded) => {
      if (typeof loaded !== 'function') {
        throw new TypeError(`Lazy screen "${key}" did not return a builder`);
      }
      // A request that outlived its deadline no longer owns this cache slot.
      // Do not let its late success replace a newer retry's builder.
      if (entry.promise === request) entry.builder = loaded;
      return loaded;
    });
    entry.promise = request;
    request.catch(() => {
      if (entry.promise === request) entry.promise = null;
    });
  }

  try {
    return await waitWithDeadline(request, timeoutMs, `Lazy screen "${key}" timed out`);
  } catch (error) {
    if (entry.promise === request) entry.promise = null;
    throw error;
  }
}
