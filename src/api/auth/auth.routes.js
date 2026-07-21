const express = require("express");
const router = express.Router();
const { protect } = require("../../middleware/auth.middleware");
const validate = require("../../middleware/validate.middleware");
const { authLimiter } = require("../../middleware/rateLimiter");
const { registerSchema, loginSchema, refreshSchema } = require("./auth.validation");
const { register, login, refresh, logout, getMe, googleAuth, googleCallback } = require("./auth.controller");

// Public routes (rate-limited — these are the classic brute-force targets)
router.post("/register", authLimiter, validate(registerSchema), register);
router.post("/login",    authLimiter, validate(loginSchema), login);
router.post("/refresh",  authLimiter, validate(refreshSchema), refresh);
router.post("/logout",   logout);

// Google OAuth routes
router.get("/google",          googleAuth);
router.get("/google/callback", googleCallback);

// Protected routes
router.get("/me", protect, getMe);

module.exports = router;

