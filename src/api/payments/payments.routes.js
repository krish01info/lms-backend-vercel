const express = require("express");
const router = express.Router();
const { protect } = require("../../middleware/auth.middleware");
const validate = require("../../middleware/validate.middleware");
const { createPaymentSchema } = require("./payments.validation");
const paymentsController = require("./payments.controller");

// GET /api/v1/payments/my — payments made by the logged-in student
router.get("/my", protect, paymentsController.getMyPayments);

// GET /api/v1/payments/:id
router.get("/:id", protect, paymentsController.getPaymentById);

// POST /api/v1/payments — create/record a payment (manual logging, or gateway webhook later)
router.post("/", protect, validate(createPaymentSchema), paymentsController.createPayment);

module.exports = router;
