const Joi = require("joi");

const searchUsersSchema = Joi.object({
  q: Joi.string().trim().allow("").optional(),
  role: Joi.string().valid("STUDENT", "INSTRUCTOR", "ADMIN", "SUPER_ADMIN").optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

const updateMeSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).optional(),
  avatar: Joi.string().uri().optional(),
}).min(1);

module.exports = { searchUsersSchema, updateMeSchema };
