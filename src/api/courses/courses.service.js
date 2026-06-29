const { prisma } = require("../../config/database");
const ApiError = require("../../utils/ApiError");

const courseSelect = {
  id: true,
  title: true,
  description: true,
  thumbnail: true,
  price: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  instructor: { select: { id: true, name: true, avatar: true } },
  category: { select: { id: true, name: true, slug: true } },
  _count: { select: { enrollments: true, lessons: true } },
};

// GET /api/v1/courses — list published courses with optional filters
const getCourses = async ({ search, categoryId, page = 1, limit = 12 } = {}) => {
  const skip = (Number(page) - 1) * Number(limit);

  const where = {
    status: "PUBLISHED",
    ...(search && {
      OR: [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ],
    }),
    ...(categoryId && { categoryId }),
  };

  const [courses, total] = await Promise.all([
    prisma.course.findMany({
      where,
      select: courseSelect,
      orderBy: { createdAt: "desc" },
      skip,
      take: Number(limit),
    }),
    prisma.course.count({ where }),
  ]);

  return {
    courses: courses.map((c) => ({
      ...c,
      enrollmentCount: c._count.enrollments,
      lessonCount: c._count.lessons,
      _count: undefined,
    })),
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    },
  };
};

// GET /api/v1/courses/:id — single course detail
const getCourseById = async (courseId) => {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: {
      ...courseSelect,
      lessons: {
        select: {
          id: true,
          title: true,
          type: true,
          duration: true,
          order: true,
          isPreview: true,
        },
        orderBy: { order: "asc" },
      },
    },
  });

  if (!course) throw new ApiError(404, "Course not found.");

  return {
    ...course,
    enrollmentCount: course._count.enrollments,
    lessonCount: course._count.lessons,
    _count: undefined,
  };
};

// GET /api/v1/courses/my — instructor's own courses
const getMyCourses = async (instructorId) => {
  const courses = await prisma.course.findMany({
    where: { instructorId },
    select: courseSelect,
    orderBy: { createdAt: "desc" },
  });

  return courses.map((c) => ({
    ...c,
    enrollmentCount: c._count.enrollments,
    lessonCount: c._count.lessons,
    _count: undefined,
  }));
};

// GET /api/v1/courses/enrolled — student's enrolled courses
const getEnrolledCourses = async (userId) => {
  const enrollments = await prisma.enrollment.findMany({
    where: { userId, status: "ACTIVE" },
    include: {
      course: { select: courseSelect },
    },
    orderBy: { createdAt: "desc" },
  });

  return enrollments.map((e) => ({
    enrollmentId: e.id,
    enrolledAt: e.createdAt,
    ...e.course,
    enrollmentCount: e.course._count.enrollments,
    lessonCount: e.course._count.lessons,
    _count: undefined,
  }));
};

// POST /api/v1/courses — create new course
const createCourse = async ({ title, description, price, categoryId, instructorId, status }) => {
  const course = await prisma.course.create({
    data: {
      title,
      description,
      price: price ? parseFloat(price) : 0,
      status: status || "PUBLISHED", // Default to PUBLISHED for ease of visibility in frontend
      instructorId,
      categoryId: categoryId || null,
    },
    select: courseSelect,
  });

  return {
    ...course,
    enrollmentCount: 0,
    lessonCount: 0,
    _count: undefined,
  };
};

// PATCH /api/v1/courses/:courseId/thumbnail — update course thumbnail
const updateThumbnail = async (courseId, thumbnailUrl, instructorId) => {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw new ApiError(404, "Course not found.");
  if (course.instructorId !== instructorId) {
    throw new ApiError(403, "You do not have permission to modify this course.");
  }

  const updated = await prisma.course.update({
    where: { id: courseId },
    data: { thumbnail: thumbnailUrl },
    select: courseSelect,
  });

  return {
    ...updated,
    enrollmentCount: updated._count.enrollments,
    lessonCount: updated._count.lessons,
    _count: undefined,
  };
};

module.exports = { getCourses, getCourseById, getMyCourses, getEnrolledCourses, createCourse, updateThumbnail };
