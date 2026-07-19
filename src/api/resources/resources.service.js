const { prisma } = require("../../config/database");
const ApiError = require("../../utils/ApiError");
const ROLES = require("../../constants/roles");
const { uploadToCloudinary } = require("../../utils/cloudinary");

const resourceSelect = {
  id: true,
  title: true,
  fileUrl: true,
  fileType: true,
  fileSize: true,
  courseId: true,
  createdAt: true,
  uploadedBy: { select: { id: true, name: true } },
};

// Shared ownership guard, mirrors quizzes.service.js's assertCourseOwnership.
// Throws 404 if the course doesn't exist, 403 if this user can't manage it.
const assertCourseOwnership = async (courseId, userId, role) => {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, instructorId: true },
  });

  if (!course) throw new ApiError(404, "Course not found.");

  const isPrivileged = [ROLES.ADMIN, ROLES.SUPER_ADMIN].includes(role);
  if (!isPrivileged && course.instructorId !== userId) {
    throw new ApiError(403, "You do not have permission to manage resources for this course.");
  }

  return course;
};

// Students must be actively (or previously) enrolled to view resources;
// instructors/admins always can.
const assertCanView = async (courseId, userId, role) => {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, instructorId: true },
  });
  if (!course) throw new ApiError(404, "Course not found.");

  const isPrivileged = [ROLES.ADMIN, ROLES.SUPER_ADMIN].includes(role);
  if (isPrivileged || course.instructorId === userId) return course;

  const enrollment = await prisma.enrollment.findFirst({
    where: { courseId, userId, status: { in: ["ACTIVE", "COMPLETED"] } },
  });
  if (!enrollment) {
    throw new ApiError(403, "You must be enrolled in this course to view its resources.");
  }

  return course;
};

// GET /api/v1/courses/:courseId/resources
const listResources = async (courseId, userId, role) => {
  await assertCanView(courseId, userId, role);

  const resources = await prisma.resource.findMany({
    where: { courseId },
    select: resourceSelect,
    orderBy: { createdAt: "desc" },
  });

  return resources;
};

// POST /api/v1/courses/:courseId/resources — instructor/admin only.
// Accepts an array of multer files (memory storage), uploads each to
// Cloudinary, then persists one Resource row per file.
const uploadResources = async (courseId, files, userId, role) => {
  await assertCourseOwnership(courseId, userId, role);

  if (!files || files.length === 0) {
    throw new ApiError(400, "No files received. Attach at least one file with field name 'resources'.");
  }

  const created = [];
  for (const file of files) {
    const uploadResult = await uploadToCloudinary(file.buffer, "courses/resources", "auto");
    const resource = await prisma.resource.create({
      data: {
        title: file.originalname,
        fileUrl: uploadResult.secure_url,
        fileType: file.mimetype,
        fileSize: file.size,
        courseId,
        uploadedById: userId,
      },
      select: resourceSelect,
    });
    created.push(resource);
  }

  return created;
};

// DELETE /api/v1/resources/:id — instructor/admin only.
const deleteResource = async (resourceId, userId, role) => {
  const resource = await prisma.resource.findUnique({
    where: { id: resourceId },
    select: { id: true, course: { select: { instructorId: true } } },
  });
  if (!resource) throw new ApiError(404, "Resource not found.");

  const isPrivileged = [ROLES.ADMIN, ROLES.SUPER_ADMIN].includes(role);
  if (!isPrivileged && resource.course.instructorId !== userId) {
    throw new ApiError(403, "You do not have permission to delete this resource.");
  }

  await prisma.resource.delete({ where: { id: resourceId } });
  // Note: this removes the DB record but does not delete the underlying
  // Cloudinary asset — acceptable for now, but worth a follow-up cleanup
  // job if storage cost ever becomes a concern.
  return { id: resourceId };
};

module.exports = { listResources, uploadResources, deleteResource };
