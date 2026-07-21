const express = require("express");
const router = express.Router();
const { protect, requireRole } = require("../../middleware/auth.middleware");
const validate = require("../../middleware/validate.middleware");
const ROLES = require("../../constants/roles");
const {
  createAnnouncementSchema,
  updateAnnouncementSchema,
  announcementIdParamSchema,
} = require("./announcements.validation");
const {
  createAnnouncement,
  getAnnouncements,
  getAnnouncementById,
  updateAnnouncement,
  deleteAnnouncement,
} = require("./announcements.controller");

// POST /api/v1/announcements — instructor/admin. courseId omitted/null = all
// of this instructor's courses. Fans out a Notification to every affected
// student.
router.post(
  "/",
  protect,
  requireRole(ROLES.INSTRUCTOR, ROLES.ADMIN),
  validate(createAnnouncementSchema),
  createAnnouncement
);

// GET /api/v1/announcements?courseId=&page=&limit=
router.get("/", protect, getAnnouncements);

// GET /api/v1/announcements/:id
router.get("/:id", protect, validate(announcementIdParamSchema, "params"), getAnnouncementById);

// PATCH /api/v1/announcements/:id — instructor (owner)/admin
router.patch(
  "/:id",
  protect,
  requireRole(ROLES.INSTRUCTOR, ROLES.ADMIN),
  validate(announcementIdParamSchema, "params"),
  validate(updateAnnouncementSchema),
  updateAnnouncement
);

// DELETE /api/v1/announcements/:id — instructor (owner)/admin
router.delete(
  "/:id",
  protect,
  requireRole(ROLES.INSTRUCTOR, ROLES.ADMIN),
  validate(announcementIdParamSchema, "params"),
  deleteAnnouncement
);

module.exports = router;
