// Purpose: Single-flight HOF — concurrent calls share the same in-flight promise.
// Prevents duplicate API invocations (e.g. double-tap on "Start Visit").
// Input:  asyncFn — any async function
// Output: wrapped function; concurrent callers share one promise until it settles

/**
 * Wraps an async function so that if it is called while already in flight,
 * all concurrent callers receive the same promise instead of launching new requests.
 * Once the promise settles (resolve or reject), the next call starts fresh.
 *
 * @param {(...args: any[]) => Promise<any>} asyncFn
 * @returns {(...args: any[]) => Promise<any>}
 */
export function withSingleFlight(asyncFn) {
  let inFlight = null;

  return function singleFlightWrapper(...args) {
    if (inFlight !== null) {
      return inFlight;
    }

    inFlight = asyncFn(...args).finally(() => {
      inFlight = null;
    });

    return inFlight;
  };
}
