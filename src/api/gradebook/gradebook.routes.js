const express = require("express");
const router = express.Router();
const { protect, requireRole } = require("../../middleware/auth.middleware");
const validate = require("../../middleware/validate.middleware");
const ROLES = require("../../constants/roles");
const { courseIdParamSchema } = require("./gradebook.validation");
const { getGradebook } = require("./gradebook.controller");

// GET /api/v1/gradebook/:courseId — instructor (owner)/admin.
// Pure aggregation of existing quiz + assignment grades, no separate storage.
router.get(
  "/:courseId",
  protect,
  requireRole(ROLES.INSTRUCTOR, ROLES.ADMIN),
  validate(courseIdParamSchema, "params"),
  getGradebook
);

module.exports = router;
