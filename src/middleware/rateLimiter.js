const rateLimit = require("express-rate-limit");
const ApiError = require("../utils/ApiError");

const handler = (req, res, next, options) => {
  next(new ApiError(429, "Too many requests. Please try again later."));
};

/** General API limiter — applied globally. Generous, just guards against abuse. */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler,
});

/** Stricter limiter for auth endpoints (login/register/refresh) — blocks brute force. */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler,
  skipSuccessfulRequests: true,
});

/** Very strict limiter for the AI tutor (protects against runaway LLM cost). */
const aiTutorLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  handler,
});

module.exports = { apiLimiter, authLimiter, aiTutorLimiter };
