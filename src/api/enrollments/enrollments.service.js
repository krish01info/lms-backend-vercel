const { prisma } = require("../../config/database");
const ApiError = require("../../utils/ApiError");
 
const enrollmentSelect = {
  id: true,
  userId: true,
  courseId: true,
  status: true,
  expiresAt: true,
  createdAt: true,
  updatedAt: true,
  course: {
    select: {
      id: true,
      title: true,
      thumbnail: true,
      price: true,
      status: true,
      instructor: { select: { id: true, name: true, avatar: true } },
    },
  },
};
 
// POST /api/v1/enrollments — enroll the logged-in student in a course
// NOTE: payments are not wired in yet — enrollment happens directly
// regardless of course.price. Revisit this once the payments flow exists.
const enrollInCourse = async (userId, courseId) => {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw new ApiError(404, "Course not found.");
  if (course.status !== "PUBLISHED") {
    throw new ApiError(400, "This course is not open for enrollment.");
  }
 
  const existing = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
 
  if (existing && existing.status === "ACTIVE") {
    throw new ApiError(409, "You are already enrolled in this course.");
  }
 
  // Re-activate a previously cancelled/expired enrollment instead of
  // creating a duplicate row (userId+courseId is unique in the schema).
  const enrollment = await prisma.enrollment.upsert({
    where: { userId_courseId: { userId, courseId } },
    update: { status: "ACTIVE", expiresAt: null },
    create: { userId, courseId, status: "ACTIVE" },
    select: enrollmentSelect,
  });
 
  return enrollment;
};
 
// GET /api/v1/enrollments/my — logged-in student's own enrollments
const getMyEnrollments = async (userId, { status, page = 1, limit = 12 } = {}) => {
  const skip = (Number(page) - 1) * Number(limit);
  const where = { userId, ...(status && { status }) };
 
  const [enrollments, total] = await Promise.all([
    prisma.enrollment.findMany({
      where,
      select: enrollmentSelect,
      orderBy: { createdAt: "desc" },
      skip,
      take: Number(limit),
    }),
    prisma.enrollment.count({ where }),
  ]);
 
  return {
    enrollments,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    },
  };
};
 
// GET /api/v1/enrollments/:id — single enrollment (owner or admin)
const getEnrollmentById = async (enrollmentId, requestingUser) => {
  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    select: enrollmentSelect,
  });
 
  if (!enrollment) throw new ApiError(404, "Enrollment not found.");
 
  const isOwner = enrollment.userId === requestingUser.id;
  const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(requestingUser.role);
  if (!isOwner && !isAdmin) {
    throw new ApiError(403, "You do not have permission to view this enrollment.");
  }
 
  return enrollment;
};
 
// DELETE /api/v1/enrollments/:id — cancel an enrollment (owner or admin)
const cancelEnrollment = async (enrollmentId, requestingUser) => {
  const enrollment = await prisma.enrollment.findUnique({ where: { id: enrollmentId } });
  if (!enrollment) throw new ApiError(404, "Enrollment not found.");
 
  const isOwner = enrollment.userId === requestingUser.id;
  const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(requestingUser.role);
  if (!isOwner && !isAdmin) {
    throw new ApiError(403, "You do not have permission to cancel this enrollment.");
  }
 
  if (enrollment.status === "CANCELLED") {
    throw new ApiError(409, "This enrollment is already cancelled.");
  }
 
  return prisma.enrollment.update({
    where: { id: enrollmentId },
    data: { status: "CANCELLED" },
    select: enrollmentSelect,
  });
};
 
// GET /api/v1/enrollments — admin: list all enrollments with filters
const getAllEnrollments = async ({ status, courseId, userId, page = 1, limit = 20 } = {}) => {
  const skip = (Number(page) - 1) * Number(limit);
  const where = {
    ...(status && { status }),
    ...(courseId && { courseId }),
    ...(userId && { userId }),
  };
 
  const [enrollments, total] = await Promise.all([
    prisma.enrollment.findMany({
      where,
      select: { ...enrollmentSelect, user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      skip,
      take: Number(limit),
    }),
    prisma.enrollment.count({ where }),
  ]);
 
  return {
    enrollments,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    },
  };
};
 
// ── Instructor endpoints ────────────────────────────────────────────────

// POST /api/v1/enrollments/instructor-enroll
const instructorEnroll = async (courseId, studentId, requestingUser) => {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw new ApiError(404, "Course not found.");

  const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(requestingUser.role);
  if (!isAdmin && course.instructorId !== requestingUser.id) {
    throw new ApiError(403, "You do not own this course.");
  }

  const student = await prisma.user.findUnique({ where: { id: studentId } });
  if (!student) throw new ApiError(404, "Student not found.");

  const enrollment = await prisma.enrollment.upsert({
    where: { userId_courseId: { userId: studentId, courseId } },
    update: { status: "ACTIVE", expiresAt: null },
    create: { userId: studentId, courseId, status: "ACTIVE" },
    select: {
      id: true,
      userId: true,
      courseId: true,
      status: true,
      createdAt: true,
      user: { select: { id: true, name: true, email: true } },
      course: { select: { id: true, title: true } },
    },
  });

  return enrollment;
};

// GET /api/v1/enrollments/course/:courseId
const getCourseEnrollments = async (courseId, requestingUser, { status, page = 1, limit = 50 } = {}) => {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw new ApiError(404, "Course not found.");

  const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(requestingUser.role);
  if (!isAdmin && course.instructorId !== requestingUser.id) {
    throw new ApiError(403, "You do not own this course.");
  }

  const skip = (Number(page) - 1) * Number(limit);
  const where = { courseId, ...(status && { status }) };

  const [enrollments, total] = await Promise.all([
    prisma.enrollment.findMany({
      where,
      select: {
        id: true,
        userId: true,
        status: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true, avatar: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: Number(limit),
    }),
    prisma.enrollment.count({ where }),
  ]);

  return {
    enrollments,
    pagination: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) },
  };
};

module.exports = {
  enrollInCourse,
  getMyEnrollments,
  getEnrollmentById,
  cancelEnrollment,
  getAllEnrollments,
  instructorEnroll,
  getCourseEnrollments,
};
