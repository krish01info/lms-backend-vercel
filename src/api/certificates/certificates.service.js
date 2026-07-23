const { prisma } = require("../../config/database");
const ApiError = require("../../utils/ApiError");

/** All certificates earned by a student, newest first. */
const getMyCertificates = async (userId) => {
  return prisma.certificate.findMany({
    where: { userId },
    orderBy: { issuedAt: "desc" },
    include: { course: { select: { id: true, title: true, thumbnail: true } } },
  });
};

/** A single certificate — scoped to its owner so students can't fetch each other's. */
const getCertificateById = async (id, userId) => {
  const certificate = await prisma.certificate.findFirst({
    where: { id, userId },
    include: { course: { select: { id: true, title: true, thumbnail: true } } },
  });
  if (!certificate) throw new ApiError(404, "Certificate not found.");
  return certificate;
};

/**
 * Issue (or re-issue) a certificate. Upserted on [userId, courseId] so calling
 * this twice for the same completion just refreshes the fileUrl instead of
 * creating a duplicate row — safe to call from a "course completed" trigger later.
 */
const issueCertificate = async ({ userId, courseId, fileUrl }) => {
  if (!userId || !courseId) throw new ApiError(400, "userId and courseId are required.");

  const [user, course] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.course.findUnique({ where: { id: courseId } }),
  ]);
  if (!user) throw new ApiError(404, "User not found.");
  if (!course) throw new ApiError(404, "Course not found.");

  return prisma.certificate.upsert({
    where: { userId_courseId: { userId, courseId } },
    update: { fileUrl },
    create: { userId, courseId, fileUrl },
  });
};

module.exports = { getMyCertificates, getCertificateById, issueCertificate };
