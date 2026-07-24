const Joi = require("joi");

// GET /api/v1/notifications/me?page=&limit=&unreadOnly=
// GET /api/v1/notifications?page=&limit=&unread=
const listQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  unread: Joi.boolean().default(false),
});

// PATCH /api/v1/notifications/:notificationId/read
// DELETE /api/v1/notifications/:notificationId
const notificationIdParamSchema = Joi.object({
  notificationId: Joi.string().uuid().required(),
});

module.exports = { listQuerySchema, notificationIdParamSchema };
