const { prisma } = require("../../config/database");
const ApiError = require("../../utils/ApiError");

const courseSelect = {
  id: true,
  title: true,
  description: true,
  thumbnail: true,
  videoUrl: true,
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
const createCourse = async ({ title, description, price, categoryId, category, instructorId, status, videoUrl, thumbnail }) => {
  let resolvedCategoryId = categoryId || null;

  if (!resolvedCategoryId && category) {
    const slug = category.toLowerCase().trim().replace(/ & /g, '-').replace(/ /g, '-');
    const formattedName = category
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    const dbCategory = await prisma.category.upsert({
      where: { slug },
      update: {},
      create: {
        name: formattedName,
        slug,
      },
    });
    resolvedCategoryId = dbCategory.id;
  }

  const course = await prisma.course.create({
    data: {
      title,
      description,
      price: price ? parseFloat(price) : 0,
      status: status || "PUBLISHED",
      instructorId,
      categoryId: resolvedCategoryId,
      videoUrl: videoUrl || null,
      thumbnail: thumbnail || null,
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

// PATCH /api/v1/courses/:id — update course details
const updateCourse = async (courseId, instructorId, updates, isAdmin = false) => {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw new ApiError(404, "Course not found.");
  if (!isAdmin && course.instructorId !== instructorId) {
    throw new ApiError(403, "You do not have permission to modify this course.");
  }

  const { title, description, price, categoryId, category, videoUrl, status } = updates;

  let resolvedCategoryId = categoryId !== undefined ? categoryId : course.categoryId;

  // If a category name string was provided (not an ID), upsert it
  if (!categoryId && category) {
    const slug = category.toLowerCase().trim().replace(/ & /g, "-").replace(/ /g, "-");
    const formattedName = category
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
    const dbCategory = await prisma.category.upsert({
      where: { slug },
      update: {},
      create: { name: formattedName, slug },
    });
    resolvedCategoryId = dbCategory.id;
  }

  const updated = await prisma.course.update({
    where: { id: courseId },
    data: {
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(price !== undefined && { price: parseFloat(price) }),
      ...(resolvedCategoryId !== undefined && { categoryId: resolvedCategoryId }),
      ...(videoUrl !== undefined && { videoUrl }),
      ...(status !== undefined && { status }),
    },
    select: courseSelect,
  });

  return {
    ...updated,
    enrollmentCount: updated._count.enrollments,
    lessonCount: updated._count.lessons,
    _count: undefined,
  };
};

// PATCH /api/v1/courses/:id/status — publish / archive / draft a course
const updateCourseStatus = async (courseId, instructorId, status, isAdmin = false) => {
  const validStatuses = ["DRAFT", "PUBLISHED", "ARCHIVED"];
  if (!validStatuses.includes(status)) {
    throw new ApiError(400, `Invalid status. Must be one of: ${validStatuses.join(", ")}`);
  }

  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw new ApiError(404, "Course not found.");
  if (!isAdmin && course.instructorId !== instructorId) {
    throw new ApiError(403, "You do not have permission to modify this course.");
  }

  const updated = await prisma.course.update({
    where: { id: courseId },
    data: { status },
    select: courseSelect,
  });

  return {
    ...updated,
    enrollmentCount: updated._count.enrollments,
    lessonCount: updated._count.lessons,
    _count: undefined,
  };
};

// DELETE /api/v1/courses/:id — delete a course (instructor or admin)
const deleteCourse = async (courseId, instructorId, isAdmin = false) => {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw new ApiError(404, "Course not found.");
  if (!isAdmin && course.instructorId !== instructorId) {
    throw new ApiError(403, "You do not have permission to delete this course.");
  }

  await prisma.course.delete({ where: { id: courseId } });
  return { id: courseId };
};

module.exports = {
  getCourses,
  getCourseById,
  getMyCourses,
  getEnrolledCourses,
  createCourse,
  updateThumbnail,
  updateCourse,
  updateCourseStatus,
  deleteCourse,
};
