const Joi = require("joi");

const registerSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  email: Joi.string().trim().email().required(),
  password: Joi.string().min(6).max(72).required(),
  role: Joi.string().valid("student", "teacher", "instructor", "admin").default("student"),
});

const loginSchema = Joi.object({
  email: Joi.string().trim().email().required(),
  password: Joi.string().required(),
});

const refreshSchema = Joi.object({
  refreshToken: Joi.string().optional(), // may also arrive via httpOnly cookie
});

module.exports = { registerSchema, loginSchema, refreshSchema };
