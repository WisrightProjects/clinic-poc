const bcrypt = require('bcryptjs');
const config = require('../config');
const userRepository = require('../repositories/userRepository');
const { signToken, verifyToken, unauthenticated } = require('../utils/authToken');
const { normalizeMobile } = require('../utils/mobile');
const { AppError } = require('../utils/errors');

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

async function login(mobile, password) {
  if (typeof password !== 'string' || !password) throw invalidLogin();
  const normalized = normalizeMobile(mobile);
  const row = normalized ? await userRepository.findByMobile(normalized) : null;
  const ok = await bcrypt.compare(password, row ? row.password_hash : DUMMY_HASH);
  if (!row || !ok) throw invalidLogin();

  const user = toSessionUser(row);
  return { token: signToken(user.id, config.jwtSecret, config.jwtExpiresIn), user: toPublicUser(user) };
}

// Used by the authenticate middleware on every request: verifies the token and loads
// the user fresh, so deactivation takes effect immediately. Throws 401.
async function authenticateToken(token) {
  const userId = Number(verifyToken(token, config.jwtSecret).sub);
  const row = Number.isInteger(userId) ? await userRepository.findById(userId) : null;
  if (!row) throw unauthenticated();
  return toSessionUser(row);
}

module.exports = { login, authenticateToken, toPublicUser };
