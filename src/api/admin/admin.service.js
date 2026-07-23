const { prisma } = require("../../config/database");
const ApiError = require("../../utils/ApiError");

// ─────────────────────────────────────────────────────────────────────────────
// AdminService — cross-domain reads/writes for the admin panel.
// Everything here is gated by requireRole("ADMIN","SUPER_ADMIN") at the route
// level (see admin.routes.js), so no per-function role checks needed here.
// ─────────────────────────────────────────────────────────────────────────────

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  avatar: true,
  isVerified: true,
  isActive: true,
  createdAt: true,
  _count: { select: { enrollments: true, courses: true } },
};

const shapeUser = (u) => ({
  ...u,
  enrolledCount: u._count.enrollments,
  coursesCount: u._count.courses,
  _count: undefined,
});

// ── Audit logging ───────────────────────────────────────────────────────────
// Same philosophy as notification.listners.js: an audit-write failure must
// never break the real admin action it's logging. Fire it, catch it, move on.
const logAudit = async (adminId, action, { targetType, targetId, details } = {}) => {
  try {
    const admin = await prisma.user.findUnique({ where: { id: adminId }, select: { name: true, email: true } });
    await prisma.adminAuditLog.create({
      data: {
        adminId,
        adminName: admin?.name || "Unknown",
        adminEmail: admin?.email || "unknown",
        action,
        targetType,
        targetId,
        details,
      },
    });
  } catch (err) {
    console.error("[admin.service] audit log write failed:", err.message);
  }
};

// ── Users ───────────────────────────────────────────────────────────────────

// GET /admin/users — paginated, searchable, filterable by role/status
const getUsers = async ({ search, role, status, page = 1, limit = 20 } = {}) => {
  const skip = (Number(page) - 1) * Number(limit);

  const where = {
    ...(search && {
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ],
    }),
    ...(role && { role: role.toUpperCase() }),
    ...(status && { isActive: status === "active" }),
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: userSelect,
      orderBy: { createdAt: "desc" },
      skip,
      take: Number(limit),
    }),
    prisma.user.count({ where }),
  ]);

  return {
    users: users.map(shapeUser),
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.max(1, Math.ceil(total / Number(limit))),
    },
  };
};

// GET /admin/users/:id
const getUserById = async (userId) => {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: userSelect });
  if (!user) throw new ApiError(404, "User not found.");
  return shapeUser(user);
};

// PATCH /admin/users/:id — edit name / email / role
const updateUser = async (userId, { name, email, role }, requestingAdminId) => {
  const data = {
    ...(name && { name }),
    ...(email && { email }),
    ...(role && { role: role.toUpperCase() }),
  };

  if (Object.keys(data).length === 0) {
    throw new ApiError(400, "Nothing to update.");
  }

  const user = await prisma.user.update({ where: { id: userId }, data, select: userSelect });

  await logAudit(requestingAdminId, role ? "USER_ROLE_CHANGED" : "USER_UPDATED", {
    targetType: "User",
    targetId: userId,
    details: role ? `Role changed to ${role.toUpperCase()}` : `Updated: ${Object.keys(data).join(", ")}`,
  });

  return shapeUser(user);
};

// PATCH /admin/users/:id/status — activate / deactivate
const setUserStatus = async (userId, isActive, requestingAdminId) => {
  if (userId === requestingAdminId) {
    throw new ApiError(400, "You can't deactivate your own account.");
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: { isActive },
    select: userSelect,
  });

  await logAudit(requestingAdminId, isActive ? "USER_ACTIVATED" : "USER_DEACTIVATED", {
    targetType: "User",
    targetId: userId,
    details: `${user.email}`,
  });

  return shapeUser(user);
};

// DELETE /admin/users/:id — soft delete (deactivate), never a hard delete
const deleteUser = async (userId, requestingAdminId) => {
  if (userId === requestingAdminId) {
    throw new ApiError(400, "You can't delete your own account.");
  }

  await prisma.user.update({ where: { id: userId }, data: { isActive: false } });
  await logAudit(requestingAdminId, "USER_DELETED", { targetType: "User", targetId: userId });
  return { deactivated: true };
};

// ── Courses ─────────────────────────────────────────────────────────────────

const courseSelect = {
  id: true,
  title: true,
  status: true,
  price: true,
  createdAt: true,
  instructor: { select: { id: true, name: true, email: true } },
  _count: { select: { enrollments: true } },
};

const shapeCourse = (c) => ({ ...c, enrollmentCount: c._count.enrollments, _count: undefined });

// GET /admin/courses — every course on the platform, any instructor, any status
const getCourses = async ({ search, status, page = 1, limit = 20 } = {}) => {
  const skip = (Number(page) - 1) * Number(limit);

  const where = {
    ...(search && { title: { contains: search, mode: "insensitive" } }),
    ...(status && { status: status.toUpperCase() }),
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
    courses: courses.map(shapeCourse),
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.max(1, Math.ceil(total / Number(limit))),
    },
  };
};

// PATCH /admin/courses/:id/status — admin override (publish / archive)
const setCourseStatus = async (courseId, status, requestingAdminId) => {
  const course = await prisma.course.update({
    where: { id: courseId },
    data: { status: status.toUpperCase() },
    select: courseSelect,
  });

  await logAudit(requestingAdminId, "COURSE_STATUS_CHANGED", {
    targetType: "Course",
    targetId: courseId,
    details: `${course.title} → ${status.toUpperCase()}`,
  });

  return shapeCourse(course);
};

// ── Payments ────────────────────────────────────────────────────────────────

// GET /admin/payments — platform-wide transaction list
const getPayments = async ({ status, page = 1, limit = 20 } = {}) => {
  const skip = (Number(page) - 1) * Number(limit);
  const where = { ...(status && { status: status.toUpperCase() }) };

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      select: {
        id: true,
        amount: true,
        status: true,
        gateway: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true } },
        course: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: Number(limit),
    }),
    prisma.payment.count({ where }),
  ]);

  return {
    payments,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.max(1, Math.ceil(total / Number(limit))),
    },
  };
};

// GET /admin/payments/stats — total revenue, pending, this month
const getPaymentStats = async () => {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [totalRevenue, pendingAmount, monthRevenue] = await Promise.all([
    prisma.payment.aggregate({ where: { status: "COMPLETED" }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { status: "PENDING" }, _sum: { amount: true } }),
    prisma.payment.aggregate({
      where: { status: "COMPLETED", createdAt: { gte: startOfMonth } },
      _sum: { amount: true },
    }),
  ]);

  return {
    totalRevenue: totalRevenue._sum.amount || 0,
    pending: pendingAmount._sum.amount || 0,
    thisMonth: monthRevenue._sum.amount || 0,
  };
};

// ── Dashboard ───────────────────────────────────────────────────────────────

// GET /admin/dashboard/stats — the 4 top cards + role breakdown
const getDashboardStats = async () => {
  const [totalUsers, activeCourses, revenue, usersByRole, totalEnrollments, completedEnrollments] =
    await Promise.all([
      prisma.user.count(),
      prisma.course.count({ where: { status: "PUBLISHED" } }),
      prisma.payment.aggregate({ where: { status: "COMPLETED" }, _sum: { amount: true } }),
      prisma.user.groupBy({ by: ["role"], _count: { role: true } }),
      prisma.enrollment.count(),
      prisma.enrollment.count({ where: { status: "COMPLETED" } }),
    ]);

  const completionRate = totalEnrollments > 0 ? Math.round((completedEnrollments / totalEnrollments) * 100) : 0;

  return {
    totalUsers,
    activeCourses,
    totalRevenue: revenue._sum.amount || 0,
    completionRate,
    usersByRole: usersByRole.reduce((acc, r) => ({ ...acc, [r.role]: r._count.role }), {}),
  };
};

// ── Reports ─────────────────────────────────────────────────────────────────
// Each report returns a flat array of plain objects — the frontend turns
// that straight into a table + CSV download, no special-casing needed.

const getUserActivityReport = async () => {
  const users = await prisma.user.findMany({
    select: {
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      _count: { select: { enrollments: true, courses: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return users.map((u) => ({
    name: u.name,
    email: u.email,
    role: u.role,
    status: u.isActive ? "Active" : "Deactivated",
    joined: u.createdAt,
    enrollments: u._count.enrollments,
    coursesCreated: u._count.courses,
  }));
};

const getFinancialReport = async () => {
  const payments = await prisma.payment.findMany({
    select: {
      amount: true,
      status: true,
      gateway: true,
      createdAt: true,
      user: { select: { name: true, email: true } },
      course: { select: { title: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return payments.map((p) => ({
    student: p.user.name,
    email: p.user.email,
    course: p.course.title,
    amount: p.amount,
    status: p.status,
    gateway: p.gateway || "—",
    date: p.createdAt,
  }));
};

const getCoursePerformanceReport = async () => {
  const courses = await prisma.course.findMany({
    select: {
      title: true,
      status: true,
      instructor: { select: { name: true } },
      enrollments: { select: { status: true } },
    },
  });

  return courses.map((c) => {
    const total = c.enrollments.length;
    const completed = c.enrollments.filter((e) => e.status === "COMPLETED").length;
    return {
      course: c.title,
      instructor: c.instructor.name,
      status: c.status,
      enrollments: total,
      completed,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  });
};

const getAttendanceSummaryReport = async () => {
  const records = await prisma.attendanceRecord.findMany({
    select: { status: true, course: { select: { id: true, title: true } } },
  });

  const byCourse = {};
  records.forEach((r) => {
    const key = r.course.id;
    if (!byCourse[key]) byCourse[key] = { course: r.course.title, present: 0, absent: 0, total: 0 };
    byCourse[key].total += 1;
    if (r.status === "PRESENT") byCourse[key].present += 1;
    else byCourse[key].absent += 1;
  });

  return Object.values(byCourse).map((c) => ({
    ...c,
    attendanceRate: c.total > 0 ? Math.round((c.present / c.total) * 100) : 0,
  }));
};

const REPORT_GENERATORS = {
  "user-activity": getUserActivityReport,
  financial: getFinancialReport,
  "course-performance": getCoursePerformanceReport,
  "attendance-summary": getAttendanceSummaryReport,
};

// GET /admin/reports/:type
const getReport = async (type) => {
  const generator = REPORT_GENERATORS[type];
  if (!generator) {
    throw new ApiError(400, `Unknown report type "${type}". Valid: ${Object.keys(REPORT_GENERATORS).join(", ")}`);
  }
  return generator();
};

// ── Analytics ───────────────────────────────────────────────────────────────
// Real, calculable numbers only — no fake DAU/session-time since there's no
// session tracking in this stack. These replace those cards on the frontend.

const getAnalytics = async () => {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [newUsersThisWeek, courseCompletions, activeEnrollments, lessonsCompleted] = await Promise.all([
    prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.enrollment.count({ where: { status: "COMPLETED" } }),
    prisma.enrollment.count({ where: { status: "ACTIVE" } }),
    prisma.lessonProgress.count({ where: { completed: true } }),
  ]);

  return { newUsersThisWeek, courseCompletions, activeEnrollments, lessonsCompleted };
};

// ── Settings ────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS = {
  maintenanceMode: "false",
  emailNotifications: "true",
  autoBackup: "true",
  platformName: "LearnFlow",
};

// GET /admin/settings — merges stored rows over the defaults so the page
// always has something sensible to show, even before any row exists.
const getSettings = async () => {
  const rows = await prisma.systemSetting.findMany();
  const stored = rows.reduce((acc, r) => ({ ...acc, [r.key]: r.value }), {});
  return { ...DEFAULT_SETTINGS, ...stored };
};

// PATCH /admin/settings — { key, value } upsert, one row per setting
const updateSetting = async (key, value, requestingAdminId) => {
  if (!(key in DEFAULT_SETTINGS)) {
    throw new ApiError(400, `Unknown setting "${key}".`);
  }

  await prisma.systemSetting.upsert({
    where: { key },
    update: { value: String(value) },
    create: { key, value: String(value) },
  });

  await logAudit(requestingAdminId, "SETTING_UPDATED", { targetType: "SystemSetting", targetId: key, details: `${key} = ${value}` });

  return getSettings();
};

// ── Audit Logs ──────────────────────────────────────────────────────────────

// GET /admin/audit-logs?page=&limit=
const getAuditLogs = async ({ page = 1, limit = 20 } = {}) => {
  const skip = (Number(page) - 1) * Number(limit);

  const [logs, total] = await Promise.all([
    prisma.adminAuditLog.findMany({
      orderBy: { createdAt: "desc" },
      skip,
      take: Number(limit),
    }),
    prisma.adminAuditLog.count(),
  ]);

  return {
    logs,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.max(1, Math.ceil(total / Number(limit))),
    },
  };
};

module.exports = {
  getUsers,
  getUserById,
  updateUser,
  setUserStatus,
  deleteUser,
  getCourses,
  setCourseStatus,
  getPayments,
  getPaymentStats,
  getDashboardStats,
  getReport,
  getAnalytics,
  getSettings,
  updateSetting,
  getAuditLogs,
};