const Joi = require("joi");

// GET /api/v1/gradebook/:courseId
const courseIdParamSchema = Joi.object({
  courseId: Joi.string().uuid().required(),
});

module.exports = { courseIdParamSchema };
