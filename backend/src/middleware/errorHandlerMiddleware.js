const { ApiError } = require('../utils/httpResponse');
const env = require('../../config/env');

function notFoundHandler(req, res, next) {
  res.status(404).json({
    success: false,
    code: 'NOT_FOUND',
    message: env.nodeEnv === 'production' ? "We couldn't find that." : `Route not found: ${req.method} ${req.originalUrl}`,
  });
}

// MongoDB duplicate-key error code
const MONGO_DUPLICATE_KEY = 11000;

function errorHandler(err, req, res, next) {
  let error = err;

  if (err && err.code === MONGO_DUPLICATE_KEY) {
    error = ApiError.conflict('A record with these details already exists.', {
      details: env.nodeEnv === 'development' ? err.keyValue : undefined,
    });
  }

  // Map Multer upload errors to 413/400
  if (err && err.name === 'MulterError') {
    error = err.code === 'LIMIT_FILE_SIZE'
      ? new ApiError(413, err.field === 'audio' ? 'That recording is too long. Try a shorter one.' : 'That image is too large.', { code: 'FILE_TOO_LARGE' })
      : ApiError.badRequest('That upload could not be read.', { code: 'BAD_UPLOAD' });
  }

  if (!(error instanceof ApiError)) {
    console.error('Unhandled error:', err);
    error = ApiError.internal(env.nodeEnv === 'production' ? 'Something went wrong on our end. Please try again.' : err.message);
  }

  res.status(error.statusCode).json({
    success: false,
    code: error.code,
    message: error.message,
    ...(error.details ? { details: error.details } : {}),
  });
}

module.exports = { notFoundHandler, errorHandler };