const bcrypt = require('bcryptjs');
const config = require('../config');
const userRepository = require('../repositories/userRepository');
const { signToken, verifyToken, unauthenticated, issuedBeforePasswordChange } = require('../utils/authToken');
const { normalizeMobile } = require('../utils/mobile');
const { AppError } = require('../utils/errors');
const { createLoginLimiter, tooManyAttempts } = require('../utils/loginLimiter');
const { clientKey } = require('../utils/clientIp');

// Compared against when the mobile is unknown, so a wrong mobile takes as long as a
// wrong password and response timing doesn't reveal which accounts exist.
const DUMMY_HASH = '$2a$10$jjYDkdXnWIFxL0WPjDAO..DRSCa64ymoxAwW9KGEeTHynMTzVRxBa';

// One message for every failure, so it never reveals whether the mobile exists (AC2).
const invalidLogin = () => new AppError('INVALID_LOGIN', 'Mobile number or password is incorrect', 401);

function toSessionUser(row) {
  return { id: row.id, name: row.name, role: row.role, clinicId: row.clinic_id, clinicName: row.clinic_name };
}

function toPublicUser(user) {
  return { id: user.id, name: user.name, role: user.role, clinic: { id: user.clinicId, name: user.clinicName } };
}

// Password-guessing limits, all over 15 minutes (a block lasts 15 minutes):
//  - one mobile from one client: 5 attempts — someone guessing locks only themselves out;
//  - one mobile from anywhere: 20 — guessing spread over many IPs;
//  - one client (IPv4 address / IPv6 /64): 100 — trying many numbers. Generous, because a
//    clinic's Wi-Fi or a mobile carrier puts many people behind one address.
// Only a real client address counts as a client; a proxy's never does (utils/clientIp.js).
const FIFTEEN_MINUTES = 15 * 60 * 1000;
const limiter = (limit) => createLoginLimiter({ limit, windowMs: FIFTEEN_MINUTES, blockMs: FIFTEEN_MINUTES });
const byMobileAndClient = limiter(5);
const byMobile = limiter(20);
const byClient = limiter(100);

async function login(mobile, password, ip) {
  const normalized = normalizeMobile(mobile);
  const clientKeyValue = clientKey(ip);
  const keys = [
    [byMobileAndClient, normalized ? `${normalized}|${clientKeyValue ?? 'proxy'}` : null],
    [byMobile, normalized],
    [byClient, clientKeyValue],
  ];

  // Refused while blocked, even with the right password. The attempt is counted BEFORE the
  // password check, so requests sent at the same moment can't all slip through.
  // (A null key is never limited.)
  const waitMs = Math.max(...keys.map(([l, key]) => l.retryAfterMs(key)));
  if (waitMs > 0) throw tooManyAttempts(waitMs);
  // In order, stopping at the first refusal: an attempt refused for this client must not
  // also count against the mobile from everywhere (or one client could lock out the doctor).
  for (const [l, key] of keys) if (!l.begin(key)) throw tooManyAttempts(FIFTEEN_MINUTES);

  const hasPassword = typeof password === 'string' && password !== '';
  const row = normalized && hasPassword ? await userRepository.findByMobile(normalized) : null;
  const ok = hasPassword && (await bcrypt.compare(password, row ? row.password_hash : DUMMY_HASH));
  if (!row || !ok) throw invalidLogin(); // the attempt stays counted

  // Signed in: the account's own counts start fresh; the client just gets this one back.
  byMobileAndClient.succeed(keys[0][1], { clear: true });
  byMobile.succeed(keys[1][1], { clear: true });
  byClient.succeed(keys[2][1]);
  const user = toSessionUser(row);
  return { token: signToken(user.id, config.jwtSecret, config.jwtExpiresIn), user: toPublicUser(user) };
}

// Used by the authenticate middleware on every request: verifies the token and loads
// the user fresh, so deactivation takes effect immediately. A token issued before the
// password was last changed is rejected, so a password reset signs out old devices.
// Throws 401.
async function authenticateToken(token) {
  const { sub, iat } = verifyToken(token, config.jwtSecret);
  const userId = Number(sub);
  const row = Number.isInteger(userId) ? await userRepository.findById(userId) : null;
  if (!row || issuedBeforePasswordChange(iat, row.password_changed_at)) throw unauthenticated();
  return toSessionUser(row);
}

module.exports = { login, authenticateToken, toPublicUser };
