const fs = require('fs');

class AppError extends Error {
  constructor(code, message, httpStatus = 500) {
    super(message);
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

// A failed request never keeps its upload: multer saves the file before any check
// runs (missing questionId, another clinic's visit, DB error), so delete it here.
function errorHandler(err, req, res, _next) {
  if (req.file) fs.promises.unlink(req.file.path).catch(() => {});
  const status = err.httpStatus || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const message = err.message || 'An unexpected error occurred';
  res.status(status).json({ error: { code, message } });
}

module.exports = { AppError, errorHandler };
