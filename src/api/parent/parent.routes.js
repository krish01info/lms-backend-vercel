const express = require("express");
const router = express.Router();
const { protect, requireRole } = require("../../middleware/auth.middleware");
const ROLES = require("../../constants/roles");
const parentController = require("./parent.controller");

router.use(protect, requireRole(ROLES.PARENT));

// GET /api/v1/parent/children
router.get("/children", parentController.getMyChildren);

// GET /api/v1/parent/children/:studentId/summary
router.get("/children/:studentId/summary", parentController.getChildSummary);

module.exports = router;
