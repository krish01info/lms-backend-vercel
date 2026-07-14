const Joi = require("joi");

// POST /api/v1/quizzes/:quizId/questions
const createQuestionSchema = Joi.object({
  text: Joi.string().trim().min(1).required(),
  options: Joi.array()
    .items(Joi.string().trim().min(1))
    .min(2)
    .required(),
  answer: Joi.string().trim().required(),
  order: Joi.number().integer().positive().required(),
}).custom((obj, helpers) => {
  if (!obj.options.includes(obj.answer)) {
    return helpers.message('"answer" must be one of the provided options');
  }
  return obj;
});

// PATCH /api/v1/questions/:id
const updateQuestionSchema = Joi.object({
  text: Joi.string().trim().min(1).optional(),
  options: Joi.array()
    .items(Joi.string().trim().min(1))
    .min(2)
    .optional(),
  answer: Joi.string().trim().optional(),
  order: Joi.number().integer().positive().optional(),
})
  .min(1) // at least one field required — empty PATCH makes no sense
  .custom((obj, helpers) => {
    // Only cross-validate when both options AND answer appear in the same
    // PATCH body.  When only one is sent the service layer checks against
    // the existing DB value (which we don't have here in validation).
    if (obj.options && obj.answer && !obj.options.includes(obj.answer)) {
      return helpers.message('"answer" must be one of the provided options');
    }
    return obj;
  });

// :quizId param used on POST / GET question routes
const quizIdParamSchema = Joi.object({
  quizId: Joi.string().uuid().required(),
});

// :id param used on PATCH / DELETE question routes
const questionIdParamSchema = Joi.object({
  id: Joi.string().uuid().required(),
});

module.exports = {
  createQuestionSchema,
  updateQuestionSchema,
  quizIdParamSchema,
  questionIdParamSchema,
};
