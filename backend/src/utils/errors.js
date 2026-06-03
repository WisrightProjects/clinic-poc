class AppError extends Error {
  constructor(code, message, httpStatus = 500) {
    super(message);
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

function errorHandler(err, _req, res, _next) {
  const status = err.httpStatus || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const message = err.message || 'An unexpected error occurred';
  res.status(status).json({ error: { code, message } });
}

module.exports = { AppError, errorHandler };
