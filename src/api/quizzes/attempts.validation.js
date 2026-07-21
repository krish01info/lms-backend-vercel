const Joi = require("joi");

// POST /api/v1/quizzes/:quizId/attempts
const submitAttemptSchema = Joi.object({
  answers: Joi.array()
    .items(
      Joi.object({
        questionId: Joi.string().uuid().required(),
        selectedAnswer: Joi.string().trim().required(),
      })
    )
    .min(1)
    .required(),
});

// Shared param schema for routes that receive :quizId
const quizIdParamSchema = Joi.object({
  quizId: Joi.string().uuid().required(),
});

module.exports = { submitAttemptSchema, quizIdParamSchema };
