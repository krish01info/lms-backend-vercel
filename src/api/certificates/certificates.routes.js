const express = require("express");
const router = express.Router();
const { protect, requireRole } = require("../../middleware/auth.middleware");
const ROLES = require("../../constants/roles");
const certificatesController = require("./certificates.controller");

// GET /api/v1/certificates/my — certificates earned by the logged-in student
router.get("/my", protect, certificatesController.getMyCertificates);

// GET /api/v1/certificates/:id
router.get("/:id", protect, certificatesController.getCertificateById);

// POST /api/v1/certificates — instructor/admin issues a certificate for a completed course
router.post(
  "/",
  protect,
  requireRole(ROLES.INSTRUCTOR, ROLES.ADMIN),
  certificatesController.issueCertificate
);

module.exports = router;
