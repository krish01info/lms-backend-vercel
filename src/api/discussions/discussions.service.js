const { prisma } = require("../../config/database");
const ApiError = require("../../utils/ApiError");
const ROLES = require("../../constants/roles");

/**
 * Confirms the requester may see/post in a course's discussion board:
 * admins, the course's instructor, or an enrolled student. Throws otherwise.
 */
const canAccessCourse = async (courseId, userId, role) => {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, instructorId: true },
  });
  if (!course) throw new ApiError(404, "Course not found.");

  const isPrivileged = [ROLES.ADMIN, ROLES.SUPER_ADMIN].includes(role);
  if (isPrivileged || course.instructorId === userId) return course;

  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  if (!enrollment) throw new ApiError(403, "You are not enrolled in this course.");

  return course;
};

const threadSelect = (userId) => ({
  id: true,
  title: true,
  content: true,
  tags: true,
  pinned: true,
  createdAt: true,
  updatedAt: true,
  courseId: true,
  course: { select: { id: true, title: true } },
  author: { select: { id: true, name: true, avatar: true } },
  _count: { select: { replies: true, likes: true } },
  likes: { where: { userId }, select: { id: true } },
});

const formatThread = (thread) => ({
  id: thread.id,
  title: thread.title,
  content: thread.content,
  tags: thread.tags,
  pinned: thread.pinned,
  createdAt: thread.createdAt,
  updatedAt: thread.updatedAt,
  courseId: thread.courseId,
  course: thread.course,
  author: thread.author,
  replies: thread._count.replies,
  likes: thread._count.likes,
  likedByMe: thread.likes.length > 0,
});

/** Threads for a course, pinned first then newest, with optional title/content search. */
const getThreads = async ({ courseId, search, userId, role, page = 1, limit = 20 }) => {
  if (!courseId) throw new ApiError(400, "courseId is required.");
  await canAccessCourse(courseId, userId, role);

  const where = {
    courseId,
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: "insensitive" } },
            { content: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const take = Number(limit);
  const skip = (Number(page) - 1) * take;

  const [threads, total] = await Promise.all([
    prisma.discussionThread.findMany({
      where,
      select: threadSelect(userId),
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      skip,
      take,
    }),
    prisma.discussionThread.count({ where }),
  ]);

  return {
    threads: threads.map(formatThread),
    pagination: { page: Number(page), limit: take, total, totalPages: Math.ceil(total / take) },
  };
};

/** A single thread with its replies, oldest first. */
const getThreadById = async (id, userId, role) => {
  const thread = await prisma.discussionThread.findUnique({
    where: { id },
    select: {
      ...threadSelect(userId),
      replies: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          content: true,
          createdAt: true,
          author: { select: { id: true, name: true, avatar: true } },
        },
      },
    },
  });
  if (!thread) throw new ApiError(404, "Thread not found.");

  await canAccessCourse(thread.courseId, userId, role);

  return { ...formatThread(thread), replies: thread.replies };
};

const createThread = async ({ courseId, title, content, tags = [] }, userId, role) => {
  if (!courseId || !title?.trim() || !content?.trim()) {
    throw new ApiError(400, "courseId, title, and content are required.");
  }
  await canAccessCourse(courseId, userId, role);

  return prisma.discussionThread.create({
    data: { courseId, title: title.trim(), content: content.trim(), tags, authorId: userId },
    include: { author: { select: { id: true, name: true, avatar: true } } },
  });
};

const addReply = async (threadId, content, userId, role) => {
  if (!content?.trim()) throw new ApiError(400, "Reply content is required.");

  const thread = await prisma.discussionThread.findUnique({
    where: { id: threadId },
    select: { courseId: true },
  });
  if (!thread) throw new ApiError(404, "Thread not found.");
  await canAccessCourse(thread.courseId, userId, role);

  return prisma.discussionReply.create({
    data: { threadId, content: content.trim(), authorId: userId },
    include: { author: { select: { id: true, name: true, avatar: true } } },
  });
};

/** Toggle a like on/off for the current user; returns the resulting state. */
const toggleLike = async (threadId, userId, role) => {
  const thread = await prisma.discussionThread.findUnique({
    where: { id: threadId },
    select: { courseId: true },
  });
  if (!thread) throw new ApiError(404, "Thread not found.");
  await canAccessCourse(thread.courseId, userId, role);

  const existing = await prisma.discussionLike.findUnique({
    where: { threadId_userId: { threadId, userId } },
  });

  if (existing) {
    await prisma.discussionLike.delete({ where: { id: existing.id } });
    return { liked: false };
  }

  await prisma.discussionLike.create({ data: { threadId, userId } });
  return { liked: true };
};

/** Author can delete their own thread; instructor/admin/super_admin can moderate any. */
const deleteThread = async (threadId, userId, role) => {
  const thread = await prisma.discussionThread.findUnique({ where: { id: threadId } });
  if (!thread) throw new ApiError(404, "Thread not found.");

  const isPrivileged = [ROLES.INSTRUCTOR, ROLES.ADMIN, ROLES.SUPER_ADMIN].includes(role);
  if (thread.authorId !== userId && !isPrivileged) {
    throw new ApiError(403, "You do not have permission to delete this thread.");
  }

  await prisma.discussionThread.delete({ where: { id: threadId } });
  return { id: threadId };
};

/** Instructor/admin only — enforced at the route level via requireRole. */
const setPinned = async (threadId, pinned) => {
  const thread = await prisma.discussionThread.findUnique({ where: { id: threadId } });
  if (!thread) throw new ApiError(404, "Thread not found.");

  return prisma.discussionThread.update({
    where: { id: threadId },
    data: { pinned: Boolean(pinned) },
  });
};

module.exports = {
  getThreads,
  getThreadById,
  createThread,
  addReply,
  toggleLike,
  deleteThread,
  setPinned,
};