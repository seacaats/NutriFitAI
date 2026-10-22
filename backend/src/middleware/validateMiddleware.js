const { ApiError } = require('../utils/httpResponse');

/** Validates req.body against `schema` and replaces it with the parsed result. */
function validateBody(schema) {
  return function validate(req, res, next) {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }));
      return next(ApiError.badRequest('Validation failed', { details }));
    }
    req.body = result.data;
    return next();
  };
}

/** Validates req.query against `schema` and stores the parsed result on `req.validatedQuery`. */
function validateQuery(schema) {
  return function validate(req, res, next) {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }));
      return next(ApiError.badRequest('Validation failed', { details }));
    }
    req.validatedQuery = result.data;
    return next();
  };
}

/** Validates req.params against `schema` and replaces it with the parsed result. */
function validateParams(schema) {
  return function validate(req, res, next) {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }));
      return next(ApiError.badRequest('Validation failed', { details }));
    }
    req.params = result.data;
    return next();
  };
}

module.exports = { validateBody, validateQuery, validateParams };
