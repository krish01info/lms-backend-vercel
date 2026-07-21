const ApiError = require("../utils/ApiError");
const HTTP_STATUS = require("../constants/httpStatus");

// Generic Joi-based validation middleware factory.
// source defaults to "body" but can be "params" or "query" too.
// Usage: router.post("/", validate(createQuizSchema), controller.create)
const validate = (schema, source = "body") => (req, res, next) => {
  const { error, value } = schema.validate(req[source], {
    abortEarly: false,   // collect ALL errors, not just the first
    stripUnknown: true,  // silently drop fields not defined in the schema
  });

  if (error) {
    const errors = error.details.map((d) => d.message);
    return next(new ApiError(HTTP_STATUS.BAD_REQUEST, "Validation failed.", errors));
  }

  req[source] = value; // replace with the sanitized/coerced value
  next();
};

module.exports = validate;
