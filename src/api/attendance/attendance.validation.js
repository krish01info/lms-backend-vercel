const Joi = require("joi");

// GET /api/v1/attendance/roster?courseId=&date=
const rosterQuerySchema = Joi.object({
  courseId: Joi.string().uuid().required(),
  date: Joi.date().iso().required(),
});

// POST /api/v1/attendance/mark
const markAttendanceSchema = Joi.object({
  courseId: Joi.string().uuid().required(),
  date: Joi.date().iso().required(),
  records: Joi.array()
    .items(
      Joi.object({
        userId: Joi.string().uuid().required(),
        status: Joi.string().valid("PRESENT", "ABSENT").required(),
      })
    )
    .min(1)
    .required(),
});

// GET /api/v1/attendance/summary?courseId=
const summaryQuerySchema = Joi.object({
  courseId: Joi.string().uuid().required(),
});

module.exports = { rosterQuerySchema, markAttendanceSchema, summaryQuerySchema };
