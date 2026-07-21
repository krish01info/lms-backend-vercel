const ApiError = require("../utils/ApiError");
const { verifyAccessToken, extractBearerToken } = require("../utils/jwtUtils");
const HTTP_STATUS = require("../constants/httpStatus");
const ROLES = require("../constants/roles");
const { prisma } = require("../config/database");
// const redis = require("../config/redis");       // uncomment when Redis is running

// ─────────────────────────────────────────────────────────────────────────────
// protect — verifies JWT and attaches req.user
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @middleware protect
 * Validates the Bearer access token in the Authorization header.
 * On success, attaches the decoded payload as `req.user`:
 *   { id, role, jti, iat, exp }
 *
 * Also checks the Redis blacklist so revoked tokens are rejected instantly.
 *
 * @throws 401 – missing / invalid / expired / blacklisted token
 */
const protect = async (req, res, next) => {
  try {
    const token = extractBearerToken(req);

    if (!token) {
      throw new ApiError(
        HTTP_STATUS.UNAUTHORIZED,
        "No token provided. Please log in."
      );
    }

    // Verify signature & expiry
    const decoded = verifyAccessToken(token);

    // ── Redis blacklist check ─────────────────────────────────────────────────
    // Uncomment once Redis is running:
    // const isBlacklisted = await redis.get(`blacklist:${decoded.jti}`);
    // if (isBlacklisted) {
    //   throw new ApiError(HTTP_STATUS.UNAUTHORIZED, "Token has been revoked. Please log in again.");
    // }

    // ── Optional: re-fetch user from DB to ensure account still active ────────
    // const user = await prisma.user.findUnique({
    //   where: { id: decoded.id },
    //   select: { id: true, role: true, deletedAt: true, isActive: true },
    // });
    // if (!user || user.deletedAt || !user.isActive) {
    //   throw new ApiError(HTTP_STATUS.UNAUTHORIZED, "Account not found or deactivated.");
    // }

    // Attach decoded user to request
    req.user = decoded; // { id, role, jti, iat, exp }

    next();
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// requireRole — role-based access guard (must run AFTER protect)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @middleware requireRole(...roles)
 * Allows access only to users whose role is in the given list.
 * Must be used AFTER the `protect` middleware.
 *
 * Usage:
 *   router.delete("/:id", protect, requireRole("ADMIN"), controller.delete);
 *   router.post("/",       protect, requireRole("INSTRUCTOR", "ADMIN"), controller.create);
 *
 * @param {...string} roles – one or more role strings from ROLES constant
 * @throws 403 – authenticated user's role not in the allowed list
 */
const requireRole = (...roles) => {
  // Validate at definition time so typos fail early
  roles.forEach((r) => {
    if (!Object.values(ROLES).includes(r)) {
      throw new Error(`[requireRole] Unknown role: "${r}". Check src/constants/roles.js`);
    }
  });

  return (req, res, next) => {
    if (!req.user) {
      return next(new ApiError(HTTP_STATUS.UNAUTHORIZED, "Not authenticated."));
    }

    if (!roles.includes(req.user.role)) {
      return next(
        new ApiError(
          HTTP_STATUS.FORBIDDEN,
          `Access denied. Required role(s): ${roles.join(", ")}. Your role: ${req.user.role}`
        )
      );
    }

    next();
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// requireOwnerOrRole — resource ownership check with role bypass
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @middleware requireOwnerOrRole(getOwnerId, ...bypassRoles)
 * Allows access if:
 *   a) the authenticated user is the resource owner (getOwnerId returns their id), OR
 *   b) the user has one of the bypassRoles (e.g. ADMIN can always access)
 *
 * Usage:
 *   // Only the course instructor or ADMIN can update a course
 *   router.patch(
 *     "/:courseId",
 *     protect,
 *     requireOwnerOrRole(
 *       async (req) => {
 *         const course = await CourseService.findById(req.params.courseId);
 *         return course.instructorId;          // the owner's userId
 *       },
 *       ROLES.ADMIN
 *     ),
 *     controller.update
 *   );
 *
 * @param {(req: Request) => Promise<string>} getOwnerId – async fn returning owner's userId
 * @param {...string} bypassRoles – roles that bypass ownership check
 */
const requireOwnerOrRole = (getOwnerId, ...bypassRoles) => async (req, res, next) => {
  try {
    if (!req.user) {
      return next(new ApiError(HTTP_STATUS.UNAUTHORIZED, "Not authenticated."));
    }

    // Role bypass — admins/super-admins don't need ownership
    if (bypassRoles.includes(req.user.role)) {
      return next();
    }

    const ownerId = await getOwnerId(req);
    if (!ownerId) {
      return next(new ApiError(HTTP_STATUS.NOT_FOUND, "Resource not found."));
    }

    if (String(ownerId) !== String(req.user.id)) {
      return next(
        new ApiError(
          HTTP_STATUS.FORBIDDEN,
          "You do not have permission to access this resource."
        )
      );
    }

    next();
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// optionalAuth — attaches req.user if a valid token is present, never throws
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @middleware optionalAuth
 * Use on public routes that behave differently for authenticated users.
 * e.g. GET /courses — enrolled students see a "Continue" button, guests see "Enroll"
 *
 * Never blocks the request — if token is missing or invalid, req.user stays null.
 */
const optionalAuth = (req, res, next) => {
  const token = extractBearerToken(req);
  if (!token) return next();

  try {
    req.user = verifyAccessToken(token);
  } catch {
    req.user = null; // silently ignore invalid/expired tokens
  }

  next();
};

// ─────────────────────────────────────────────────────────────────────────────
// checkEnrollment — verifies student has ACTIVE enrollment in the course
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @middleware checkEnrollment
 * Blocks access if student's enrollment is CANCELLED or doesn't exist.
 * Must be used AFTER protect middleware.
 * Expects courseId in req.params.courseId
 *
 * @throws 403 – no active enrollment found
 */
const checkEnrollment = async (req, res, next) => {
  try {
    // Instructors and Admins skip enrollment check
    if ([ROLES.INSTRUCTOR, ROLES.ADMIN, ROLES.SUPER_ADMIN].includes(req.user.role)) {
      return next()
    }

    const courseId = req.params.courseId

    if (!courseId) {
      return next(new ApiError(HTTP_STATUS.BAD_REQUEST, 'courseId is required.'))
    }

    const enrollment = await prisma.enrollment.findFirst({
      where: {
        userId: req.user.id,
        courseId: courseId,
        status: 'ACTIVE'          // ← CANCELLED enrollments are blocked here
      }
    })

    if (!enrollment) {
      return next(new ApiError(
        HTTP_STATUS.FORBIDDEN,
        'Access denied. You are not enrolled in this course or your enrollment has been cancelled.'
      ))
    }

    req.enrollment = enrollment   // attach for use in controllers
    next()
  } catch (err) {
    next(err)
  }
}

module.exports = {
  protect,
  requireRole,
  requireOwnerOrRole,
  optionalAuth,
  checkEnrollment,
};
