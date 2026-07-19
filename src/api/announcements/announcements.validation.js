const Joi = require("joi");

// POST /api/v1/announcements
const createAnnouncementSchema = Joi.object({
  title: Joi.string().trim().min(3).max(150).required(),
  body: Joi.string().trim().min(1).max(5000).required(),
  courseId: Joi.string().uuid().allow(null).optional(), // omit/null = all of this instructor's courses
});

// PATCH /api/v1/announcements/:id
const updateAnnouncementSchema = Joi.object({
  title: Joi.string().trim().min(3).max(150).optional(),
  body: Joi.string().trim().min(1).max(5000).optional(),
}).min(1);

const announcementIdParamSchema = Joi.object({
  id: Joi.string().uuid().required(),
});

module.exports = { createAnnouncementSchema, updateAnnouncementSchema, announcementIdParamSchema };
