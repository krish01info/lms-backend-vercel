const express = require("express");
const router = express.Router();
const { protect } = require("../../middleware/auth.middleware");
const { register, login, refresh, logout, getMe, googleAuth, googleCallback } = require("./auth.controller");

// Public routes
router.post("/register", register);
router.post("/login",    login);
router.post("/refresh",  refresh);
router.post("/logout",   logout);

// Google OAuth routes
router.get("/google",          googleAuth);
router.get("/google/callback", googleCallback);

// Protected routes
router.get("/me", protect, getMe);

module.exports = router;

