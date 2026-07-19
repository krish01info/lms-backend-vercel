const { prisma } = require("../../config/database");
const ApiError = require("../../utils/ApiError");
const ROLES = require("../../constants/roles");
const NotificationService = require("../notifications/notifications.service");

const ACTIVE_ENROLLMENT_STATUSES = ["ACTIVE", "COMPLETED"];

const announcementSelect = {
  id: true,
  title: true,
  body: true,
  courseId: true,
  instructorId: true,
  createdAt: true,
  updatedAt: true,
  course: { select: { id: true, title: true } },
  instructor: { select: { id: true, name: true, avatar: true } },
};

const assertCourseOwnership = async (courseId, userId, role) => {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, instructorId: true },
  });
  if (!course) throw new ApiError(404, "Course not found.");

  const isPrivileged = [ROLES.ADMIN, ROLES.SUPER_ADMIN].includes(role);
  if (!isPrivileged && course.instructorId !== userId) {
    throw new ApiError(403, "You do not have permission to post announcements for this course.");
  }
  return course;
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /announcements — instructor/admin.
// courseId given  -> posted to that one course, notifies its enrolled students.
// courseId omitted -> posted to EVERY course this instructor teaches, notifies
//                      every distinct student enrolled in any of them (once each).
// ─────────────────────────────────────────────────────────────────────────────
const createAnnouncement = async ({ title, body, courseId, instructorId, role }) => {
  let targetCourseIds = [];

  if (courseId) {
    await assertCourseOwnership(courseId, instructorId, role);
    targetCourseIds = [courseId];
  } else {
    const myCourses = await prisma.course.findMany({
      where: { instructorId },
      select: { id: true },
    });
    if (myCourses.length === 0) {
      throw new ApiError(400, "You have no courses to broadcast an announcement to.");
    }
    targetCourseIds = myCourses.map((c) => c.id);
  }

  const announcement = await prisma.announcement.create({
    data: { title, body, courseId: courseId ?? null, instructorId },
    select: announcementSelect,
  });

  // Fan out a Notification to every distinct student enrolled in any of the
  // target course(s) — deduped so a student in two of this instructor's
  // courses (in the "all courses" case) only gets notified once.
  const enrollments = await prisma.enrollment.findMany({
    where: { courseId: { in: targetCourseIds }, status: { in: ACTIVE_ENROLLMENT_STATUSES } },
    select: { userId: true },
    distinct: ["userId"],
  });
  const studentIds = enrollments.map((e) => e.userId);

  await NotificationService.createNotificationsForUsers(studentIds, {
    title: `New announcement: ${title}`,
    message: body.length > 200 ? `${body.slice(0, 200)}…` : body,
    type: "ANNOUNCEMENT",
  });

  return announcement;
};

// GET /announcements?courseId=&page=&limit=
const getAnnouncements = async ({ courseId, page = 1, limit = 20, userId, role }) => {
  const skip = (Number(page) - 1) * Number(limit);
  const isPrivileged = [ROLES.INSTRUCTOR, ROLES.ADMIN, ROLES.SUPER_ADMIN].includes(role);

  let where;
  if (courseId) {
    if (isPrivileged) await assertCourseOwnership(courseId, userId, role);
    where = { courseId };
  } else if (role === ROLES.ADMIN || role === ROLES.SUPER_ADMIN) {
    where = {};
  } else if (isPrivileged) {
    // Instructor viewing their own announcements across all their courses
    where = { instructorId: userId };
  } else {
    // Student: announcements for courses they're enrolled in, plus any
    // "all courses" announcement from an instructor whose course they're in.
    const enrollments = await prisma.enrollment.findMany({
      where: { userId, status: { in: ACTIVE_ENROLLMENT_STATUSES } },
      select: { courseId: true, course: { select: { instructorId: true } } },
    });
    const courseIds = enrollments.map((e) => e.courseId);
    const instructorIds = [...new Set(enrollments.map((e) => e.course.instructorId))];

    where = {
      OR: [
        { courseId: { in: courseIds } },
        { courseId: null, instructorId: { in: instructorIds } },
      ],
    };
  }

  const [announcements, total] = await Promise.all([
    prisma.announcement.findMany({
      where,
      select: announcementSelect,
      orderBy: { createdAt: "desc" },
      skip,
      take: Number(limit),
    }),
    prisma.announcement.count({ where }),
  ]);

  return {
    announcements,
    pagination: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) },
  };
};

// GET /announcements/:id
const getAnnouncementById = async (id) => {
  const announcement = await prisma.announcement.findUnique({ where: { id }, select: announcementSelect });
  if (!announcement) throw new ApiError(404, "Announcement not found.");
  return announcement;
};

// PATCH /announcements/:id — instructor (owner)/admin
const updateAnnouncement = async (id, { title, body }, userId, role) => {
  const existing = await prisma.announcement.findUnique({ where: { id }, select: { id: true, instructorId: true } });
  if (!existing) throw new ApiError(404, "Announcement not found.");

  const isPrivileged = [ROLES.ADMIN, ROLES.SUPER_ADMIN].includes(role);
  if (!isPrivileged && existing.instructorId !== userId) {
    throw new ApiError(403, "You do not have permission to edit this announcement.");
  }

  return prisma.announcement.update({
    where: { id },
    data: { ...(title !== undefined && { title }), ...(body !== undefined && { body }) },
    select: announcementSelect,
  });
};

// DELETE /announcements/:id — instructor (owner)/admin
const deleteAnnouncement = async (id, userId, role) => {
  const existing = await prisma.announcement.findUnique({ where: { id }, select: { id: true, instructorId: true } });
  if (!existing) throw new ApiError(404, "Announcement not found.");

  const isPrivileged = [ROLES.ADMIN, ROLES.SUPER_ADMIN].includes(role);
  if (!isPrivileged && existing.instructorId !== userId) {
    throw new ApiError(403, "You do not have permission to delete this announcement.");
  }

  await prisma.announcement.delete({ where: { id } });
  return { id };
};

module.exports = {
  createAnnouncement,
  getAnnouncements,
  getAnnouncementById,
  updateAnnouncement,
  deleteAnnouncement,
};
