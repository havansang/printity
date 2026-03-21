const ApiError = require('../utils/ApiError');

function validate(schema, source = 'body') {
  return function validationMiddleware(req, res, next) {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        field: issue.path.join('.') || source,
        message: issue.message,
      }));

      next(new ApiError(422, 'Validation failed', errors));
      return;
    }

    req[source] = result.data;
    next();
  };
}

module.exports = { validate };
