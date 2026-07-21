const { prisma } = require("../../config/database");
const ApiError = require("../../utils/ApiError");
const ROLES = require("../../constants/roles");

const lessonSelect = {
  id: true,
  title: true,
  description: true,
  type: true,
  videoUrl: true,
  content: true,
  duration: true,
  order: true,
  isPreview: true,
  courseId: true,
  createdAt: true,
  updatedAt: true,
};

// Shared ownership guard. Throws 404 if the course doesn't exist,
// 403 if this user isn't allowed to manage lessons on it.
const assertCourseOwnership = async (courseId, userId, role) => {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, instructorId: true },
  });

  if (!course) throw new ApiError(404, "Course not found.");

  const isPrivileged = [ROLES.ADMIN, ROLES.SUPER_ADMIN].includes(role);
  if (!isPrivileged && course.instructorId !== userId) {
    throw new ApiError(403, "You do not have permission to manage lessons for this course.");
  }

  return course;
};

// GET /api/v1/courses/:courseId/lessons — enrolled students or instructor/admin
const getLessons = async (courseId) => {
  const lessons = await prisma.lesson.findMany({
    where: { courseId },
    select: lessonSelect,
    orderBy: { order: "asc" },
  });
  return lessons;
};

// GET /api/v1/courses/:courseId/lessons/:lessonId
const getLessonById = async (courseId, lessonId) => {
  const lesson = await prisma.lesson.findFirst({
    where: { id: lessonId, courseId },
    select: lessonSelect,
  });
  if (!lesson) throw new ApiError(404, "Lesson not found.");
  return lesson;
};

// POST /api/v1/courses/:courseId/lessons
const createLesson = async (courseId, data, userId, role) => {
  await assertCourseOwnership(courseId, userId, role);

  // Auto-assign the next order number if not provided
  if (data.order === undefined || data.order === null) {
    const lastLesson = await prisma.lesson.findFirst({
      where: { courseId },
      orderBy: { order: "desc" },
      select: { order: true },
    });
    data.order = (lastLesson?.order ?? -1) + 1;
  }

  const lesson = await prisma.lesson.create({
    data: {
      title: data.title,
      description: data.description || null,
      type: data.type || "VIDEO",
      videoUrl: data.videoUrl || null,
      content: data.content || null,
      duration: data.duration !== undefined ? data.duration : null,
      order: data.order,
      isPreview: data.isPreview || false,
      courseId,
    },
    select: lessonSelect,
  });

  return lesson;
};

// PATCH /api/v1/courses/:courseId/lessons/:lessonId
const updateLesson = async (courseId, lessonId, data, userId, role) => {
  await assertCourseOwnership(courseId, userId, role);

  const existing = await prisma.lesson.findFirst({
    where: { id: lessonId, courseId },
    select: { id: true },
  });
  if (!existing) throw new ApiError(404, "Lesson not found.");

  const updateData = {};
  if (data.title !== undefined) updateData.title = data.title;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.type !== undefined) updateData.type = data.type;
  if (data.videoUrl !== undefined) updateData.videoUrl = data.videoUrl;
  if (data.content !== undefined) updateData.content = data.content;
  if (data.duration !== undefined) updateData.duration = data.duration;
  if (data.order !== undefined) updateData.order = data.order;
  if (data.isPreview !== undefined) updateData.isPreview = data.isPreview;

  const lesson = await prisma.lesson.update({
    where: { id: lessonId },
    data: updateData,
    select: lessonSelect,
  });

  return lesson;
};

// DELETE /api/v1/courses/:courseId/lessons/:lessonId
const deleteLesson = async (courseId, lessonId, userId, role) => {
  await assertCourseOwnership(courseId, userId, role);

  const existing = await prisma.lesson.findFirst({
    where: { id: lessonId, courseId },
    select: { id: true },
  });
  if (!existing) throw new ApiError(404, "Lesson not found.");

  await prisma.lesson.delete({ where: { id: lessonId } });

  // Re-order remaining lessons
  const remaining = await prisma.lesson.findMany({
    where: { courseId },
    orderBy: { order: "asc" },
    select: { id: true, order: true },
  });

  await Promise.all(
    remaining.map((lesson, index) =>
      prisma.lesson.update({
        where: { id: lesson.id },
        data: { order: index },
      })
    )
  );

  return { id: lessonId };
};

// POST /api/v1/courses/:courseId/lessons/reorder — batch update order
const reorderLessons = async (courseId, orderedIds, userId, role) => {
  await assertCourseOwnership(courseId, userId, role);

  await Promise.all(
    orderedIds.map((id, index) =>
      prisma.lesson.update({
        where: { id },
        data: { order: index },
      })
    )
  );

  return { reordered: orderedIds.length };
};

module.exports = {
  getLessons,
  getLessonById,
  createLesson,
  updateLesson,
  deleteLesson,
  reorderLessons,
};
