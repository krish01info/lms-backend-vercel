const Joi = require("joi");

// GET /api/v1/notifications/me?page=&limit=&unreadOnly=
const listQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  unreadOnly: Joi.boolean().default(false),
});

// PATCH /api/v1/notifications/:id/read
const notificationIdParamSchema = Joi.object({
  id: Joi.string().uuid().required(),
});

module.exports = { listQuerySchema, notificationIdParamSchema };
