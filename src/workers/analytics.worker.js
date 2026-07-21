const { prisma } = require("../config/database");

/**
 * Not queue-backed (nothing enqueues analytics jobs on demand) — this is the
 * function that src/jobs/generateAnalytics.job.js calls on a schedule. Kept
 * in workers/ alongside the other processors since it does the same kind of
 * "heavy, off the request path" work.
 *
 * Computes and upserts a system-wide daily snapshot into system_settings
 * (key: "analytics_snapshot") so the admin dashboard has cheap aggregate
 * numbers to read instead of recomputing counts on every page load.
 */
const runAnalyticsSnapshot = async () => {
  const [userCount, courseCount, enrollmentCount, activeEnrollments, paymentTotals] = await Promise.all([
    prisma.user.count(),
    prisma.course.count(),
    prisma.enrollment.count(),
    prisma.enrollment.count({ where: { status: "ACTIVE" } }),
    prisma.payment.aggregate({ _sum: { amount: true }, where: { status: "COMPLETED" } }),
  ]);

  const snapshot = {
    generatedAt: new Date().toISOString(),
    userCount,
    courseCount,
    enrollmentCount,
    activeEnrollments,
    totalRevenue: paymentTotals._sum.amount || 0,
  };

  await prisma.systemSetting.upsert({
    where: { key: "analytics_snapshot" },
    update: { value: JSON.stringify(snapshot) },
    create: { key: "analytics_snapshot", value: JSON.stringify(snapshot) },
  });

  console.log(`📊 analytics snapshot generated: ${userCount} users, ${courseCount} courses`);
  return snapshot;
};

module.exports = { runAnalyticsSnapshot };
