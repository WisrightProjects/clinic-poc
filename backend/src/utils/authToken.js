// Purpose: Sign and verify login tokens (CLINIC-008). Pure — the secret is passed in,
// so this module never reads config and can be unit-tested directly.
// The token carries only the user id (sub). Clinic and role are always reloaded from
// the DB per request, so a role or clinic change can never be read stale from a token.

const jwt = require('jsonwebtoken');
const { AppError } = require('./errors');

const ALGORITHM = 'HS256';

function signToken(userId, secret, expiresIn) {
  return jwt.sign({ sub: String(userId) }, secret, { algorithm: ALGORITHM, expiresIn });
}

// Returns the payload, or throws UNAUTHENTICATED for a missing, expired, tampered or
// wrongly-signed token. The algorithm is pinned so an 'alg: none' token is rejected.
function verifyToken(token, secret) {
  if (!token) throw unauthenticated('Sign in required');
  try {
    return jwt.verify(token, secret, { algorithms: [ALGORITHM] });
  } catch (err) {
    throw unauthenticated(err.name === 'TokenExpiredError' ? 'Session expired, please sign in again' : undefined);
  }
}

// 'Bearer abc' -> 'abc'; anything else -> null.
function bearerToken(header) {
  const match = /^Bearer\s+(\S+)$/i.exec(header || '');
  return match ? match[1] : null;
}

function unauthenticated(message = 'Invalid session, please sign in again') {
  return new AppError('UNAUTHENTICATED', message, 401);
}

module.exports = { signToken, verifyToken, bearerToken, unauthenticated };
