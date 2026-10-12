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

// A failed request doesn't keep its upload: multer saves the file before any check runs
// (missing questionId, another clinic's visit), so delete it here — unless a DB row
// already points at it (file.stored, set by answerService), which must keep its audio.
function errorHandler(err, req, res, _next) {
  if (req.file && !req.file.stored) fs.promises.unlink(req.file.path).catch(() => {});
  if (err.code === PG_INVALID_TEXT) err = new AppError('BAD_REQUEST', 'Invalid value in request', 400);
  const status = err.httpStatus || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const message = err.message || 'An unexpected error occurred';
  res.status(status).json({ error: { code, message } });
}

module.exports = { AppError, errorHandler };
