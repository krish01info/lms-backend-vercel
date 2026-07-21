const express = require("express");
const router = express.Router();
const { protect } = require("../../middleware/auth.middleware");
const resultsController = require("./results.controller");

// GET /api/v1/results/my — the logged-in student's real grades, aggregated
// from quiz attempts + graded assignment submissions, per enrolled course.
router.get("/my", protect, resultsController.getMyResults);

module.exports = router;
