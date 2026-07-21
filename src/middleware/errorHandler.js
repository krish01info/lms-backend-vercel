const config = require("../config");

/**
 * Centralized error handler — replaces the inline handler that used to live
 * at the bottom of app.js. Understands ApiError (statusCode + errors[]) as
 * well as a few common third-party error shapes (Prisma, Joi, Multer, JWT)
 * so callers always get a consistent { success, statusCode, message, errors } body.
 */
const errorHandler = (err, req, res, next) => { // eslint-disable-line no-unused-vars
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal Server Error";
  let errors = err.errors || [];

  // Prisma known request errors (unique constraint, not found, fk violation…)
  if (err.code === "P2002") {
    statusCode = 409;
    const fields = err.meta?.target?.join(", ") || "field";
    message = `A record with this ${fields} already exists.`;
  } else if (err.code === "P2025") {
    statusCode = 404;
    message = "Record not found.";
  } else if (err.code === "P2003") {
    statusCode = 400;
    message = "Invalid reference — related record does not exist.";
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Invalid token.";
  } else if (err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Token expired.";
  }

  if (config.env !== "test") {
    console.error(`❌ [${req.method} ${req.originalUrl}]`, err.message);
    if (config.env === "development" && statusCode === 500) console.error(err.stack);
  }

  res.status(statusCode).json({
    success: false,
    statusCode,
    message,
    errors,
    ...(config.env === "development" && { stack: err.stack }),
  });
};

module.exports = errorHandler;
