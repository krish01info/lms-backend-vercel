const express = require("express");
const router = express.Router();
const { protect, requireRole } = require("../../middleware/auth.middleware");
const controller = require("./admin.controller");

// Every admin route requires a logged-in ADMIN or SUPER_ADMIN.
router.use(protect, requireRole("ADMIN", "SUPER_ADMIN"));

// ── Dashboard ───────────────────────────────────────────────────────────────
router.get("/dashboard/stats", controller.getDashboardStats);

// ── Users ───────────────────────────────────────────────────────────────────
router.get("/users", controller.getUsers);
router.get("/users/:userId", controller.getUserById);
router.patch("/users/:userId", controller.updateUser);
router.patch("/users/:userId/status", controller.setUserStatus);
router.delete("/users/:userId", controller.deleteUser);

// ── Courses ─────────────────────────────────────────────────────────────────
router.get("/courses", controller.getCourses);
router.patch("/courses/:courseId/status", controller.setCourseStatus);

// ── Payments ────────────────────────────────────────────────────────────────
router.get("/payments", controller.getPayments);
router.get("/payments/stats", controller.getPaymentStats);

// ── Reports ─────────────────────────────────────────────────────────────────
// :type = user-activity | financial | course-performance | attendance-summary
router.get("/reports/:type", controller.getReport);

// ── Analytics ───────────────────────────────────────────────────────────────
router.get("/analytics", controller.getAnalytics);

// ── Settings ────────────────────────────────────────────────────────────────
router.get("/settings", controller.getSettings);
router.patch("/settings", controller.updateSetting);

// ── Audit Logs ──────────────────────────────────────────────────────────────
router.get("/audit-logs", controller.getAuditLogs);

module.exports = router;