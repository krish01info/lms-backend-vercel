const Joi = require("joi");

const createCourseSchema = Joi.object({
  title: Joi.string().trim().min(3).max(200).required(),
  description: Joi.string().trim().min(10).max(5000).required(),
  price: Joi.number().min(0).optional(),
  category: Joi.string().trim().optional(),
  categoryId: Joi.string().uuid().optional(),
  status: Joi.string().valid("DRAFT", "PUBLISHED").optional(),
  videoUrl: Joi.string().uri().optional().allow(null, ""),
  thumbnail: Joi.string().uri().optional().allow(null, ""),
});

const updateCourseSchema = Joi.object({
  title: Joi.string().trim().min(3).max(200).optional(),
  description: Joi.string().trim().min(10).max(5000).optional(),
  price: Joi.number().min(0).optional(),
  category: Joi.string().trim().optional(),
  categoryId: Joi.string().uuid().optional().allow(null),
  status: Joi.string().valid("DRAFT", "PUBLISHED", "ARCHIVED").optional(),
  videoUrl: Joi.string().uri().optional().allow(null, ""),
  thumbnail: Joi.string().uri().optional().allow(null, ""),
});

const courseIdParamSchema = Joi.object({
  id: Joi.string().uuid().required(),
});

module.exports = { createCourseSchema, updateCourseSchema, courseIdParamSchema };
