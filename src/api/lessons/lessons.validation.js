const Joi = require("joi");

const createLessonSchema = Joi.object({
  title: Joi.string().trim().min(1).max(200).required(),
  description: Joi.string().trim().max(2000).optional().allow(null, ""),
  type: Joi.string().valid("VIDEO", "TEXT", "QUIZ", "ASSIGNMENT").optional(),
  videoUrl: Joi.string().uri().optional().allow(null, ""),
  content: Joi.string().optional().allow(null, ""),
  duration: Joi.number().integer().min(0).optional().allow(null),
  order: Joi.number().integer().min(0).optional(),
  isPreview: Joi.boolean().optional(),
});

const updateLessonSchema = Joi.object({
  title: Joi.string().trim().min(1).max(200).optional(),
  description: Joi.string().trim().max(2000).optional().allow(null, ""),
  type: Joi.string().valid("VIDEO", "TEXT", "QUIZ", "ASSIGNMENT").optional(),
  videoUrl: Joi.string().uri().optional().allow(null, ""),
  content: Joi.string().optional().allow(null, ""),
  duration: Joi.number().integer().min(0).optional().allow(null),
  order: Joi.number().integer().min(0).optional(),
  isPreview: Joi.boolean().optional(),
});

const lessonIdParamSchema = Joi.object({
  courseId: Joi.string().uuid().required(),
  lessonId: Joi.string().uuid().required(),
});

const courseIdParamSchema = Joi.object({
  courseId: Joi.string().uuid().required(),
});

module.exports = { createLessonSchema, updateLessonSchema, lessonIdParamSchema, courseIdParamSchema };
