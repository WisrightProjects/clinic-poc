const { AppError } = require('./errors');

const ROLES = ['attender', 'doctor'];

function roleGuard(req, _res, next) {
  req.role = req.header('x-role');
  if (!ROLES.includes(req.role)) {
    return next(new AppError('FORBIDDEN', 'Unknown or missing x-role header', 403));
  }
  next();
}

module.exports = roleGuard;
