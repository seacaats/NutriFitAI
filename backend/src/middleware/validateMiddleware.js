const { ApiError } = require('../utils/httpResponse');

/**
 * Validates req.body against a zod schema, replacing 
 * req.body with the coerced result on success
 * @param {import('zod').ZodSchema} schema
 */
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

/**
 * Same contract as validateBody, for req.query. But since req.query
 * can't be overwritten, coerced results are stored in req.validatedQuery
 * @param {import('zod').ZodSchema} schema
 */
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

/**
 * Same contract as validateBody, for req.params. Worth for validating UUIDs,
 * which would otherwise return a "not found", instead of returning an actual error
 * @param {import('zod').ZodSchema} schema
 */
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
