const Joi = require("joi");

// POST /api/v1/assignments
const createAssignmentSchema = Joi.object({
  title: Joi.string().trim().min(3).max(150).required(),
  description: Joi.string().trim().max(2000).allow("", null).optional(),
  courseId: Joi.string().uuid().required(),
  dueDate: Joi.date().iso().allow(null).optional(),
});

// PATCH /api/v1/assignments/:id
const updateAssignmentSchema = Joi.object({
  title: Joi.string().trim().min(3).max(150).optional(),
  description: Joi.string().trim().max(2000).allow("", null).optional(),
  dueDate: Joi.date().iso().allow(null).optional(),
}).min(1); // must contain at least one field — an empty PATCH makes no sense

// PATCH /api/v1/assignments/submissions/:submissionId/grade
// Always 0-100 — no per-assignment maxPoints field, per product decision.
const gradeSubmissionSchema = Joi.object({
  grade: Joi.number().integer().min(0).max(100).required(),
  feedback: Joi.string().trim().max(2000).allow("", null).optional(),
});

module.exports = {
  createAssignmentSchema,
  updateAssignmentSchema,
  gradeSubmissionSchema,
};

