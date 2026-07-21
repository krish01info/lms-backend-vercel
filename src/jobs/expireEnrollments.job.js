const { prisma } = require("../config/database");

/**
 * Flips any ACTIVE enrollment whose expiresAt has passed to EXPIRED.
 * Enrollment.expiresAt is optional (course access can be time-boxed, e.g.
 * a term-based cohort) — enrollments without an expiresAt are left alone.
 */
const expireEnrollmentsJob = async () => {
  try {
    const result = await prisma.enrollment.updateMany({
      where: { status: "ACTIVE", expiresAt: { not: null, lt: new Date() } },
      data: { status: "EXPIRED" },
    });
    if (result.count > 0) console.log(`⏰ expired ${result.count} enrollment(s)`);
  } catch (err) {
    console.error("❌ expireEnrollments job failed:", err.message);
  }
};

module.exports = expireEnrollmentsJob;
