// Purpose: Slow down password guessing on POST /auth/login.
// Counts sign-in attempts per key in a sliding window. A key may make `limit` attempts;
// the next one (while those still count) blocks it for `blockMs`. A blocked key is refused
// even with the right password (otherwise guessing could simply continue).
// An attempt is counted BEFORE the password is checked (`begin`) and given back when it
// succeeds (`succeed`), so many requests sent at the same moment can't all get through
// while the first ones are still being checked.
// A null key (no usable mobile / no real client IP) is never counted or blocked.
// In memory, so it resets on restart — fine for the single backend container. Memory is
// bounded by `maxKeys`: expired entries are swept (at most once a minute), then the oldest
// unblocked ones dropped. A blocked entry is never dropped, so filling the map can't lift
// a block.
// Pure (no config/DB): `now` is injectable for tests.

const { AppError } = require('./errors');

const SWEEP_EVERY_MS = 60 * 1000;

function createLoginLimiter({ limit, windowMs, blockMs, maxKeys = 10000, now = Date.now }) {
  const entries = new Map(); // key -> { attempts: number[] (times), blockedUntil: number }
  let lastSweep = 0;

  function prune(key, t) {
    const e = entries.get(key);
    if (!e) return null;
    e.attempts = e.attempts.filter(time => t - time < windowMs);
    if (e.attempts.length === 0 && e.blockedUntil <= t) {
      entries.delete(key);
      return null;
    }
    return e;
  }

  function makeRoom(t) {
    if (entries.size < maxKeys) return;
    if (t - lastSweep >= SWEEP_EVERY_MS) {
      lastSweep = t;
      for (const key of [...entries.keys()]) prune(key, t);
    }
    // Still full: drop the oldest-inserted entries that are not blocked.
    for (const [key, e] of entries) {
      if (entries.size < maxKeys) break;
      if (e.blockedUntil <= t) entries.delete(key);
    }
  }

  return {
    // Milliseconds until the key may try again, or 0 when it isn't blocked.
    retryAfterMs(key) {
      if (!key) return 0;
      const t = now();
      const e = prune(key, t);
      return e && e.blockedUntil > t ? e.blockedUntil - t : 0;
    },
    // Count one attempt, before the password is checked. Returns false when the key is
    // blocked, or blocks it when it already has `limit` attempts in the window — the
    // caller then refuses.
    begin(key) {
      if (!key) return true;
      const t = now();
      let e = prune(key, t);
      if (!e) {
        makeRoom(t);
        e = { attempts: [], blockedUntil: 0 };
      }
      if (e.blockedUntil > t) return false;
      if (e.attempts.length >= limit) {
        e.blockedUntil = t + blockMs;
        e.attempts = [];
        entries.set(key, e);
        return false;
      }
      e.attempts.push(t);
      entries.set(key, e);
      return true;
    },
    // The attempt succeeded: give it back. `clear` also forgets earlier failures (used for
    // the account's own keys after a correct password).
    succeed(key, { clear = false } = {}) {
      if (!key) return;
      const e = entries.get(key);
      if (!e || e.blockedUntil > now()) return;
      if (clear) entries.delete(key);
      else e.attempts.pop();
    },
    size: () => entries.size,
  };
}

// 429 with the wait in minutes (rounded up) and a Retry-After header in seconds.
function tooManyAttempts(retryMs) {
  const minutes = Math.ceil(retryMs / 60000);
  return new AppError(
    'TOO_MANY_ATTEMPTS',
    `Too many failed sign-in attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
    429,
    { 'Retry-After': String(Math.ceil(retryMs / 1000)) }
  );
}

module.exports = { createLoginLimiter, tooManyAttempts };
