const { prisma } = require("../../config/database");
const ApiError = require("../../utils/ApiError");
const ROLES = require("../../constants/roles");

const ACTIVE_ENROLLMENT_STATUSES = ["ACTIVE", "COMPLETED"];

const assertCourseOwnership = async (courseId, userId, role) => {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, instructorId: true },
  });

  if (!course) throw new ApiError(404, "Course not found.");

  const isPrivileged = [ROLES.ADMIN, ROLES.SUPER_ADMIN].includes(role);
  if (!isPrivileged && course.instructorId !== userId) {
    throw new ApiError(403, "You do not have permission to manage attendance for this course.");
  }

  return course;
};

// Normalizes any Date/string to a UTC midnight Date object so Postgres's
// `@db.Date` column and the unique constraint compare cleanly, regardless of
// what timezone the request came in with.
const toDateOnly = (input) => {
  const d = new Date(input);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /attendance/roster?courseId=&date=  (instructor owner / admin)
// Every actively enrolled student in the course, plus their status for that
// date if it's already been marked (null if this date hasn't been touched yet).
// ─────────────────────────────────────────────────────────────────────────────
const getRoster = async (courseId, date, userId, role) => {
  await assertCourseOwnership(courseId, userId, role);
  const day = toDateOnly(date);

  const enrollments = await prisma.enrollment.findMany({
    where: { courseId, status: { in: ACTIVE_ENROLLMENT_STATUSES } },
    select: { user: { select: { id: true, name: true, avatar: true } } },
    orderBy: { user: { name: "asc" } },
  });

  const existingRecords = await prisma.attendanceRecord.findMany({
    where: { courseId, date: day },
    select: { userId: true, status: true },
  });
  const statusByUser = new Map(existingRecords.map((r) => [r.userId, r.status]));

  return enrollments.map(({ user }) => ({
    userId: user.id,
    name: user.name,
    avatar: user.avatar,
    status: statusByUser.get(user.id) ?? null, // null = not yet marked for this date
  }));
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /attendance/mark  (instructor owner / admin)
// Batch upsert — one call marks the whole roster for one course + date.
// Future dates are rejected; "attendance" for a day that hasn't happened yet
// doesn't mean anything.
// ─────────────────────────────────────────────────────────────────────────────
const markAttendance = async (courseId, date, records, markedById, role) => {
  await assertCourseOwnership(courseId, markedById, role);
  const day = toDateOnly(date);

  const today = toDateOnly(new Date());
  if (day > today) {
    throw new ApiError(400, "Cannot mark attendance for a future date.");
  }

  // Confirm every userId is actually an active enrollee of this course —
  // guards against marking attendance for a student who was never in the class.
  const enrollments = await prisma.enrollment.findMany({
    where: {
      courseId,
      status: { in: ACTIVE_ENROLLMENT_STATUSES },
      userId: { in: records.map((r) => r.userId) },
    },
    select: { userId: true },
  });
  const validUserIds = new Set(enrollments.map((e) => e.userId));

  const invalid = records.filter((r) => !validUserIds.has(r.userId));
  if (invalid.length > 0) {
    throw new ApiError(400, "One or more students are not actively enrolled in this course.");
  }

  const results = await prisma.$transaction(
    records.map(({ userId, status }) =>
      prisma.attendanceRecord.upsert({
        where: { courseId_userId_date: { courseId, userId, date: day } },
        update: { status, markedById },
        create: { courseId, userId, date: day, status, markedById },
      })
    )
  );

  return { date: day, count: results.length };
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /attendance/summary?courseId=  (instructor owner / admin)
// Per-student attendance % across every date this course has ever been marked.
// ─────────────────────────────────────────────────────────────────────────────
const getSummary = async (courseId, userId, role) => {
  await assertCourseOwnership(courseId, userId, role);

  const allRecords = await prisma.attendanceRecord.findMany({
    where: { courseId },
    select: { userId: true, date: true, status: true, user: { select: { id: true, name: true, avatar: true } } },
  });

  const totalMarkedDays = new Set(allRecords.map((r) => r.date.toISOString())).size;

  const byUser = new Map();
  for (const r of allRecords) {
    if (!byUser.has(r.userId)) {
      byUser.set(r.userId, { userId: r.userId, name: r.user.name, avatar: r.user.avatar, present: 0, absent: 0 });
    }
    const entry = byUser.get(r.userId);
    if (r.status === "PRESENT") entry.present += 1;
    else entry.absent += 1;
  }

  const summary = Array.from(byUser.values()).map((s) => ({
    ...s,
    percentage: totalMarkedDays > 0 ? Math.round((s.present / totalMarkedDays) * 100) : 0,
  }));

  return { totalMarkedDays, summary };
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /attendance/my  (student) — UNCHANGED logic, moved here verbatim from
// the old attendance.routes.js so the route file can stay thin like the
// other modules. Still derives from LessonProgress, independent of the new
// manual AttendanceRecord system above (kept as two separate systems, per
// product decision).
// ─────────────────────────────────────────────────────────────────────────────
const getMyAttendance = async (studentUserId) => {
  const toLegacyDateOnly = (date) => new Date(date).toISOString().split("T")[0];

  const enrollments = await prisma.enrollment.findMany({
    where: { userId: studentUserId, status: "ACTIVE" },
    include: {
      course: {
        select: {
          id: true,
          title: true,
          lessons: { select: { id: true, createdAt: true } },
        },
      },
    },
  });

  const progressRecords = await prisma.lessonProgress.findMany({
    where: { userId: studentUserId, completed: true },
    select: { lessonId: true, updatedAt: true },
  });

  const lessonToCourse = new Map();
  enrollments.forEach((enr) => {
    enr.course.lessons.forEach((lesson) => {
      lessonToCourse.set(lesson.id, { courseId: enr.course.id, courseTitle: enr.course.title });
    });
  });

  const seen = new Set();
  const records = [];

  progressRecords.forEach((p) => {
    const course = lessonToCourse.get(p.lessonId);
    if (!course) return;

    const date = toLegacyDateOnly(p.updatedAt);
    const key = `${date}_${course.courseId}`;
    if (seen.has(key)) return;
    seen.add(key);

    records.push({ date, subject: course.courseTitle, status: "present" });
  });

  records.sort((a, b) => (a.date < b.date ? 1 : -1));

  const summary = enrollments.map((enr) => {
    const materialDays = new Set(enr.course.lessons.map((l) => toLegacyDateOnly(l.createdAt))).size;
    const activeDays = new Set(records.filter((r) => r.subject === enr.course.title).map((r) => r.date)).size;
    const percentage = materialDays > 0 ? Math.min(100, Math.round((activeDays / materialDays) * 100)) : 0;

    return { courseId: enr.course.id, courseTitle: enr.course.title, activeDays, materialDays, percentage };
  });

  const overallPercentage = summary.length
    ? Math.round(summary.reduce((acc, s) => acc + s.percentage, 0) / summary.length)
    : 0;

  return { records, summary, overallPercentage };
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /attendance/auto-roster?courseId=&date=  (instructor owner / admin)
// Auto-computed attendance based on lesson completion. For the given course +
// date, finds every lesson that was created on that date, then checks each
// enrolled student's LessonProgress to see if they completed it.
//
// This gives teachers a view of "lesson-based" attendance separate from the
// manual /attendance/roster and /attendance/mark system.
// ─────────────────────────────────────────────────────────────────────────────
const getAutoRoster = async (courseId, date, userId, role) => {
  await assertCourseOwnership(courseId, userId, role);
  const day = toDateOnly(date);

  // Find all lessons created on this date for this course
  const lessons = await prisma.lesson.findMany({
    where: {
      courseId,
      createdAt: {
        gte: day,
        lt: new Date(day.getTime() + 24 * 60 * 60 * 1000),
      },
    },
    select: { id: true, title: true },
  });

  const lessonIds = lessons.map((l) => l.id);

  // Get active enrollees
  const enrollments = await prisma.enrollment.findMany({
    where: { courseId, status: { in: ACTIVE_ENROLLMENT_STATUSES } },
    select: { user: { select: { id: true, name: true, avatar: true } } },
    orderBy: { user: { name: "asc" } },
  });

  // Get which students completed any of these lessons
  const completedProgress = lessonIds.length > 0
    ? await prisma.lessonProgress.findMany({
        where: {
          lessonId: { in: lessonIds },
          completed: true,
          userId: { in: enrollments.map((e) => e.user.id) },
        },
        select: { userId: true },
      })
    : [];

  const completedUserIds = new Set(completedProgress.map((p) => p.userId));

  const roster = enrollments.map(({ user }) => ({
    userId: user.id,
    name: user.name,
    avatar: user.avatar,
    status: completedUserIds.has(user.id) ? "PRESENT" : "ABSENT",
  }));

  return { lessons, roster, date: day };
};

module.exports = {
  getRoster,
  markAttendance,
  getSummary,
  getMyAttendance,
  getAutoRoster,
};
