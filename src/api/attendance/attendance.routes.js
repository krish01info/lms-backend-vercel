const express = require("express");
const router = express.Router();
const { protect, requireRole } = require("../../middleware/auth.middleware");
const validate = require("../../middleware/validate.middleware");
const ROLES = require("../../constants/roles");
const { rosterQuerySchema, markAttendanceSchema, summaryQuerySchema } = require("./attendance.validation");
const { getMyAttendance, getRoster, markAttendance, getSummary, getAutoRoster } = require("./attendance.controller");

// GET /api/v1/attendance/my — student, auto-derived from lesson activity.
// UNCHANGED behavior from the original stub — just moved into
// attendance.service.js so this file can stay thin.
router.get("/my", protect, getMyAttendance);

// GET /api/v1/attendance/roster?courseId=&date= — instructor (owner)/admin.
// Full enrolled roster for a course on a given date, with each student's
// current status (null if that date hasn't been marked yet).
router.get(
  "/roster",
  protect,
  requireRole(ROLES.INSTRUCTOR, ROLES.ADMIN),
  validate(rosterQuerySchema, "query"),
  getRoster
);

// POST /api/v1/attendance/mark — instructor (owner)/admin.
// Batch-save the whole roster for one course + date in a single call.
router.post(
  "/mark",
  protect,
  requireRole(ROLES.INSTRUCTOR, ROLES.ADMIN),
  validate(markAttendanceSchema),
  markAttendance
);

// GET /api/v1/attendance/summary?courseId= — instructor (owner)/admin.
// Per-student attendance % across every date ever marked for this course.
router.get(
  "/summary",
  protect,
  requireRole(ROLES.INSTRUCTOR, ROLES.ADMIN),
  validate(summaryQuerySchema, "query"),
  getSummary
);

// GET /api/v1/attendance/auto-roster?courseId=&date= — instructor (owner)/admin.
// Auto-computed attendance from lesson completion.  Shows every enrolled
// student with PRESENT if they completed a lesson created on that date, or
// ABSENT if they haven't yet.
router.get(
  "/auto-roster",
  protect,
  requireRole(ROLES.INSTRUCTOR, ROLES.ADMIN),
  validate(rosterQuerySchema, "query"),
  getAutoRoster
);

module.exports = router;
