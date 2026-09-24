const { ApiError } = require('../utils/httpResponse');
const env = require('../../config/env');

function notFoundHandler(req, res, next) {
  res.status(404).json({ success: false, code: 'NOT_FOUND', message: `Route not found: ${req.method} ${req.originalUrl}` });
}

// MongoDB duplicate-key error (E11000), raised on any unique-index violation
const MONGO_DUPLICATE_KEY = 11000;

function errorHandler(err, req, res, next) {
  let error = err;

  if (err && err.code === MONGO_DUPLICATE_KEY) {
    // Returns which field and value caused a duplicate key conflict
    error = ApiError.conflict('A record with these details already exists', {
      details: env.nodeEnv === 'development' ? err.keyValue : undefined,
    });
  }

  if (!(error instanceof ApiError)) {
    console.error('Unhandled error:', err);
    error = ApiError.internal(env.nodeEnv === 'production' ? 'Something went wrong' : err.message);
  }

  res.status(error.statusCode).json({
    success: false,
    code: error.code,
    message: error.message,
    ...(error.details ? { details: error.details } : {}),
  });
}

module.exports = { notFoundHandler, errorHandler };