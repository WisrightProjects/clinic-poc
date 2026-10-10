const fs = require('fs');

class AppError extends Error {
  constructor(code, message, httpStatus = 500) {
    super(message);
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

// Postgres rejects a malformed value for a typed column (e.g. /visits/abc against an
// integer id, or an unknown status in ?status=) with 22P02 — a bad request, not a crash.
const PG_INVALID_TEXT = '22P02';

// A failed request doesn't keep its uploads: multer saves files before any check runs
// (missing questionId, wrong image type, a DB error), so delete them here —
// unless a DB row already points at one (file.stored, set by the service), which must stay.
function errorHandler(err, req, res, _next) {
  const files = Array.isArray(req.files) ? req.files : Object.values(req.files || {}).flat();
  for (const file of [req.file, ...files]) {
    if (file && !file.stored) fs.promises.unlink(file.path).catch(() => {});
  }
  if (err.code === PG_INVALID_TEXT) err = new AppError('BAD_REQUEST', 'Invalid value in request', 400);
  const status = err.httpStatus || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const message = err.message || 'An unexpected error occurred';
  res.status(status).json({ error: { code, message } });
}

module.exports = { AppError, errorHandler };
