// Purpose: Request authentication (CLINIC-008) — replaces the x-role header guard.
// createAuthenticate takes the token -> user resolver (authService.authenticateToken)
// so this module stays free of config/DB and can be unit-tested. Mount the result
// with wrap() like every other async handler.

const { AppError } = require('./errors');
const { bearerToken } = require('./authToken');

// Reads 'Authorization: Bearer <token>' and sets
// req.user = { id, name, role, clinicId, clinicName }. The resolver throws 401.
function createAuthenticate(authenticateToken) {
  return async function authenticate(req, _res, next) {
    req.user = await authenticateToken(bearerToken(req.header('authorization')));
    next();
  };
}

// Use after authenticate: requireRole('doctor') rejects other roles with 403.
function requireRole(...roles) {
  return function roleCheck(req, _res, next) {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError('FORBIDDEN', 'You do not have access to this action', 403));
    }
    next();
  };
}

module.exports = { createAuthenticate, requireRole };
