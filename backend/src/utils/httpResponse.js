// Consolidated HTTP helpers

class ApiError extends Error {
  /**
   * @param {number} statusCode
   * @param {string} message
   * @param {{ code?: string, details?: any }} [opts]
   */
  constructor(statusCode, message, opts = {}) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = opts.code || 'ERROR';
    this.details = opts.details;
  }

  static badRequest(message, opts) {
    return new ApiError(400, message, { code: 'BAD_REQUEST', ...opts });
  }

  static unauthorized(message = 'Unauthorized', opts) {
    return new ApiError(401, message, { code: 'UNAUTHORIZED', ...opts });
  }

  static forbidden(message = 'Forbidden', opts) {
    return new ApiError(403, message, { code: 'FORBIDDEN', ...opts });
  }

  static notFound(message = 'Not found', opts) {
    return new ApiError(404, message, { code: 'NOT_FOUND', ...opts });
  }

  static conflict(message = 'Conflict', opts) {
    return new ApiError(409, message, { code: 'CONFLICT', ...opts });
  }

  static tooManyRequests(message = 'Too many requests', opts) {
    return new ApiError(429, message, { code: 'RATE_LIMITED', ...opts });
  }

  static internal(message = 'Internal server error', opts) {
    return new ApiError(500, message, { code: 'INTERNAL', ...opts });
  }
}

// Success envelope
function sendSuccess(res, { statusCode = 200, data = null, message } = {}) {
  return res.status(statusCode).json({
    success: true,
    ...(message ? { message } : {}),
    data,
  });
}

/**
 * @param {(req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => Promise<any>} fn
 */
function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = { ApiError, sendSuccess, asyncHandler };