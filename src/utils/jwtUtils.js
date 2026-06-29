const jwt = require("jsonwebtoken");
const config = require("../config");
const ApiError = require("./ApiError");

/**
 * Signs a short-lived Access Token (default 15m).
 * Payload includes: id, role, jti (unique token ID for blacklisting).
 */
const signAccessToken = (payload) => {
  const { id, role } = payload;
  const jti = `${id}-${Date.now()}`; // unique per-issuance ID
  return jwt.sign(
    { id, role, jti },
    config.jwt.accessSecret,
    { expiresIn: config.jwt.accessExpiresIn || "15m" }
  );
};

/**
 * Signs a long-lived Refresh Token (default 7d).
 * Contains only id + jti — role is re-fetched on every refresh.
 */
const signRefreshToken = (payload) => {
  const { id } = payload;
  const jti = `${id}-refresh-${Date.now()}`;
  return jwt.sign(
    { id, jti },
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshExpiresIn || "7d" }
  );
};

/**
 * Verifies an access token. Throws ApiError on failure.
 * @param {string} token
 * @returns {object} decoded payload
 */
const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, config.jwt.accessSecret);
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      throw new ApiError(401, "Access token expired. Please refresh your session.");
    }
    throw new ApiError(401, "Invalid access token.");
  }
};

/**
 * Verifies a refresh token. Throws ApiError on failure.
 * @param {string} token
 * @returns {object} decoded payload
 */
const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, config.jwt.refreshSecret);
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      throw new ApiError(401, "Refresh token expired. Please log in again.");
    }
    throw new ApiError(401, "Invalid refresh token.");
  }
};

/**
 * Extracts raw JWT string from Authorization header.
 * Supports: "Bearer <token>"
 * @param {import("express").Request} req
 * @returns {string|null}
 */
const extractBearerToken = (req) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  return null;
};

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  extractBearerToken,
};
