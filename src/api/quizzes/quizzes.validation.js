const Joi = require("joi");

const createQuizSchema = Joi.object({
  title: Joi.string().trim().min(3).max(150).required(),
  courseId: Joi.string().uuid().required(),
  timeLimit: Joi.number().integer().positive().allow(null).optional(),
  passMark: Joi.number().integer().min(0).max(100).optional(),
});

const updateQuizSchema = Joi.object({
  title: Joi.string().trim().min(3).max(150).optional(),
  timeLimit: Joi.number().integer().positive().allow(null).optional(),
  passMark: Joi.number().integer().min(0).max(100).optional(),
}).min(1); // must contain at least one field — an empty PATCH makes no sense

const quizIdParamSchema = Joi.object({
  id: Joi.string().uuid().required(),
});

module.exports = { createQuizSchema, updateQuizSchema, quizIdParamSchema };