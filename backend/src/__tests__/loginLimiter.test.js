// Tests for backend/src/utils/loginLimiter.js and utils/clientIp.js — password-guessing
// limits on login. Pure logic only: the clock is a plain variable, no timers or DB.

const { createLoginLimiter, tooManyAttempts } = require('../utils/loginLimiter');
const { isPrivateAddress, clientKey, TRUSTED_PROXIES } = require('../utils/clientIp');

const MIN = 60 * 1000;

function setup(opts = {}) {
  let t = 0;
  const limiter = createLoginLimiter({ limit: 5, windowMs: 15 * MIN, blockMs: 15 * MIN, now: () => t, ...opts });
  return { limiter, advance: ms => { t += ms; } };
}
// n attempts that all fail (begin, never succeed); returns what begin answered each time.
const fail = (limiter, key, n) => Array.from({ length: n }, () => limiter.begin(key));

describe('createLoginLimiter', () => {
  test('allows `limit` attempts, refuses and blocks the next one', () => {
    const { limiter } = setup();
    expect(fail(limiter, 'k', 5)).toEqual([true, true, true, true, true]);
    expect(limiter.retryAfterMs('k')).toBe(0);
    expect(limiter.begin('k')).toBe(false); // 6th
    expect(limiter.retryAfterMs('k')).toBe(15 * MIN);
  });

  test('counts before the check: attempts started at the same moment are capped too', () => {
    const { limiter } = setup();
    // 20 logins in flight at once (none finished yet): only 5 are let through.
    expect(fail(limiter, 'k', 20).filter(Boolean)).toHaveLength(5);
  });

  test('a block lasts blockMs, then the key may try again', () => {
    const { limiter, advance } = setup();
    fail(limiter, 'k', 6);
    advance(14 * MIN);
    expect(limiter.retryAfterMs('k')).toBe(1 * MIN);
    advance(1 * MIN);
    expect(limiter.retryAfterMs('k')).toBe(0);
    expect(limiter.begin('k')).toBe(true);
  });

  test('attempts older than the window do not count', () => {
    const { limiter, advance } = setup();
    fail(limiter, 'k', 5);
    advance(16 * MIN);
    expect(limiter.begin('k')).toBe(true);
  });

  test('a correct password on the last allowed attempt signs in and clears the count', () => {
    const { limiter } = setup();
    fail(limiter, 'k', 4);
    expect(limiter.begin('k')).toBe(true); // 5th: this one is right
    limiter.succeed('k', { clear: true });
    expect(fail(limiter, 'k', 5)).toEqual([true, true, true, true, true]);
  });

  test('succeed without clear gives back only that one attempt', () => {
    const { limiter } = setup();
    fail(limiter, 'k', 4);
    limiter.begin('k');
    limiter.succeed('k');
    expect(limiter.begin('k')).toBe(true); // still 4 + this = 5
    expect(limiter.begin('k')).toBe(false);
  });

  test('a null key is never counted or blocked', () => {
    const { limiter } = setup();
    expect(fail(limiter, null, 10).every(Boolean)).toBe(true);
    expect(limiter.retryAfterMs(null)).toBe(0);
    expect(limiter.size()).toBe(0);
  });

  test('memory is capped, but a blocked key is never dropped (filling the map cannot lift a block)', () => {
    const { limiter } = setup({ maxKeys: 3 });
    fail(limiter, 'target', 6); // blocked
    for (const k of ['a', 'b', 'c', 'd', 'e']) limiter.begin(k);
    expect(limiter.size()).toBeLessThanOrEqual(3);
    expect(limiter.retryAfterMs('target')).toBeGreaterThan(0);
  });

  test('keys are counted separately', () => {
    const { limiter } = setup();
    fail(limiter, 'a', 6);
    expect(limiter.retryAfterMs('a')).toBeGreaterThan(0);
    expect(limiter.retryAfterMs('b')).toBe(0);
  });
});

describe('tooManyAttempts', () => {
  test('429 TOO_MANY_ATTEMPTS with minutes rounded up and a Retry-After header', () => {
    const err = tooManyAttempts(14 * MIN + 1000);
    expect(err).toMatchObject({ code: 'TOO_MANY_ATTEMPTS', httpStatus: 429, headers: { 'Retry-After': '841' } });
    expect(err.message).toBe('Too many failed sign-in attempts. Try again in 15 minutes.');
  });

  test('says "1 minute" for under a minute', () => {
    expect(tooManyAttempts(20 * 1000).message).toBe('Too many failed sign-in attempts. Try again in 1 minute.');
  });
});

describe('clientIp', () => {
  test('the same ranges are trusted as proxies', () => {
    expect(TRUSTED_PROXIES).toEqual(expect.arrayContaining(['172.16.0.0/12', '10.0.0.0/8', 'fc00::/7']));
  });

  test.each(['127.0.0.1', '::1', '10.0.1.5', '172.18.0.3', '192.168.1.20', '::ffff:172.18.0.3', 'fd12::1', 'fe80::1', undefined, '', 'not-an-ip'])(
    '%p is private (never limited)',
    ip => {
      expect(isPrivateAddress(ip)).toBe(true);
      expect(clientKey(ip)).toBeNull();
    }
  );

  test.each(['49.205.12.7', '8.8.8.8', '172.32.0.1', '::ffff:49.205.12.7', '2401:4900::1'])('%p is public', ip =>
    expect(isPrivateAddress(ip)).toBe(false)
  );

  test('IPv4 is keyed by the address (also when written as ::ffff:)', () => {
    expect(clientKey('49.205.12.7')).toBe('ip:49.205.12.7');
    expect(clientKey('::ffff:49.205.12.7')).toBe('ip:49.205.12.7');
  });

  test('IPv6 is keyed by its /64, so one subscriber cannot rotate through addresses', () => {
    const key = clientKey('2401:4900:1c5a:08f2::1');
    expect(key).toBe('ip6:2401:4900:1c5a:8f2::/64');
    expect(clientKey('2401:4900:1c5a:8f2:abcd:ef01:2345:6789')).toBe(key);
    expect(clientKey('2401:4900:1c5a:8f3::1')).not.toBe(key);
  });
});
