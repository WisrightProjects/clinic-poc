// Tests for CLINIC-008.2 login tokens and request authentication.
// Pure logic only — no config/DB/network — mirrors visitValidation.test.js style.
// The user loader is passed in as a plain function instead of hitting the DB.

const jwt = require('jsonwebtoken');
const { signToken, verifyToken, bearerToken, unauthenticated, issuedBeforePasswordChange } = require('../utils/authToken');
const { createAuthenticate, requireRole } = require('../utils/auth');
const { normalizeMobile } = require('../utils/mobile');

const SECRET = 'test-secret-that-is-at-least-32-characters-long';
const doctor = { id: 7, name: 'Dr. Ramesh', role: 'doctor', clinicId: 2, clinicName: 'Sri Clinic' };

// Runs a middleware and resolves with the error passed to next() (undefined = allowed).
function runNext(middleware, req) {
  return new Promise(resolve => middleware(req, {}, err => resolve(err)));
}
const reqWith = authorization => ({ header: name => (name.toLowerCase() === 'authorization' ? authorization : undefined) });

describe('signToken / verifyToken', () => {
  test('round trip keeps the user id (and nothing else that could go stale)', () => {
    const payload = verifyToken(signToken(7, SECRET, '30d'), SECRET);
    expect(payload.sub).toBe('7');
    expect(payload).not.toHaveProperty('role');
    expect(payload).not.toHaveProperty('clinicId');
  });

  test('AC2: token expires after 30 days', () => {
    const { iat, exp } = verifyToken(signToken(1, SECRET, '30d'), SECRET);
    expect(exp - iat).toBe(30 * 24 * 60 * 60);
  });

  test('AC3: expired token is rejected with UNAUTHENTICATED', () => {
    const token = jwt.sign({ sub: '1', exp: Math.floor(Date.now() / 1000) - 10 }, SECRET);
    expect(() => verifyToken(token, SECRET)).toThrow(expect.objectContaining({ code: 'UNAUTHENTICATED', httpStatus: 401 }));
  });

  test('AC3: tampered token is rejected', () => {
    const token = signToken(1, SECRET, '30d');
    const [h, , s] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ sub: '1', clinicId: 1, role: 'doctor' })).toString('base64url');
    expect(() => verifyToken(`${h}.${forged}.${s}`, SECRET)).toThrow(expect.objectContaining({ code: 'UNAUTHENTICATED' }));
  });

  test('AC3: token signed with another secret is rejected', () => {
    const token = signToken(1, 'another-secret-that-is-also-32-characters', '30d');
    expect(() => verifyToken(token, SECRET)).toThrow(expect.objectContaining({ code: 'UNAUTHENTICATED' }));
  });

  test("AC3: unsigned 'alg: none' token is rejected", () => {
    const token = jwt.sign({ sub: '1', clinicId: 1, role: 'doctor' }, null, { algorithm: 'none' });
    expect(() => verifyToken(token, SECRET)).toThrow(expect.objectContaining({ code: 'UNAUTHENTICATED' }));
  });

  test('AC3: missing token is rejected', () => {
    expect(() => verifyToken(null, SECRET)).toThrow(expect.objectContaining({ code: 'UNAUTHENTICATED' }));
  });
});

describe('issuedBeforePasswordChange (password reset signs out old devices)', () => {
  const changedAt = new Date('2026-10-10T10:00:00.500Z');
  const changedSec = Math.floor(changedAt.getTime() / 1000);
  test('a token issued before the change is rejected', () => {
    expect(issuedBeforePasswordChange(changedSec - 1, changedAt)).toBe(true);
  });
  test('a token issued in the same second or later is accepted', () => {
    expect(issuedBeforePasswordChange(changedSec, changedAt)).toBe(false);
    expect(issuedBeforePasswordChange(changedSec + 60, changedAt)).toBe(false);
  });
  test('accepts the ISO string form pg may return', () => {
    expect(issuedBeforePasswordChange(changedSec - 1, changedAt.toISOString())).toBe(true);
  });
});

describe('bearerToken', () => {
  test('extracts the token from a Bearer header', () => {
    expect(bearerToken('Bearer abc.def.ghi')).toBe('abc.def.ghi');
    expect(bearerToken('bearer abc')).toBe('abc');
  });
  test('returns null for missing or malformed headers', () => {
    expect(bearerToken(undefined)).toBeNull();
    expect(bearerToken('abc')).toBeNull();
    expect(bearerToken('Basic abc')).toBeNull();
  });
});

describe('createAuthenticate', () => {
  // Stand-in for authService.authenticateToken: verify the token, then "load" user 7.
  const authenticateToken = async token => {
    const { sub } = verifyToken(token, SECRET);
    if (sub !== '7') throw unauthenticated();
    return doctor;
  };
  const authenticate = createAuthenticate(authenticateToken);
  const run = async (req) => { let passed = false; await authenticate(req, {}, () => { passed = true; }); return passed; };

  test('valid token sets req.user and continues', async () => {
    const req = reqWith(`Bearer ${signToken(7, SECRET, '30d')}`);
    expect(await run(req)).toBe(true);
    expect(req.user).toEqual(doctor);
  });

  test('AC3: no Authorization header -> 401 (x-role is ignored)', async () => {
    const req = { header: name => (name === 'x-role' ? 'doctor' : undefined) };
    await expect(run(req)).rejects.toMatchObject({ code: 'UNAUTHENTICATED', httpStatus: 401 });
    expect(req.user).toBeUndefined();
  });

  test('deactivated or deleted user -> 401', async () => {
    await expect(run(reqWith(`Bearer ${signToken(99, SECRET, '30d')}`))).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });
});

describe('requireRole', () => {
  test('AC8: allows the listed role', async () => {
    expect(await runNext(requireRole('doctor'), { user: doctor })).toBeUndefined();
  });
  test('AC8: blocks other roles with 403 FORBIDDEN', async () => {
    expect(await runNext(requireRole('doctor'), { user: { ...doctor, role: 'attender' } }))
      .toMatchObject({ code: 'FORBIDDEN', httpStatus: 403 });
  });
  test('blocks when there is no signed-in user', async () => {
    expect(await runNext(requireRole('doctor'), {})).toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('normalizeMobile', () => {
  test.each([
    ['9876543210', '9876543210'],
    ['98765 43210', '9876543210'],
    ['+91 98765-43210', '9876543210'],
    ['919876543210', '9876543210'],
    ['09876543210', '9876543210'],
    [9876543210, '9876543210'],
  ])('%p -> %p', (input, expected) => {
    expect(normalizeMobile(input)).toBe(expected);
  });

  test.each([[''], ['12345'], ['1234567890'], ['98765432101'], ['abcdefghij'], [null], [undefined], [{}]])(
    'rejects %p',
    input => { expect(normalizeMobile(input)).toBeNull(); }
  );
});
