const ApiError = require("../../utils/ApiError");
 
// Validates POST /api/v1/enrollments body
const validateEnrollBody = (req, res, next) => {
  const { courseId } = req.body;
 
  if (!courseId || typeof courseId !== "string") {
    throw new ApiError(400, "courseId is required.");
  }
 
  next();
};
 
// Validates GET /api/v1/enrollments (admin) and /my query filters
const VALID_STATUSES = ["ACTIVE", "COMPLETED", "EXPIRED", "CANCELLED"];
 
const validateEnrollmentQuery = (req, res, next) => {
  const { status, page, limit } = req.query;
 
  if (status && !VALID_STATUSES.includes(status)) {
    throw new ApiError(400, `status must be one of: ${VALID_STATUSES.join(", ")}`);
  }
  if (page && (isNaN(page) || Number(page) < 1)) {
    throw new ApiError(400, "page must be a positive number.");
  }
  if (limit && (isNaN(limit) || Number(limit) < 1)) {
    throw new ApiError(400, "limit must be a positive number.");
  }
 
  next();
};
 
module.exports = { validateEnrollBody, validateEnrollmentQuery };
