// code here
const { prisma } = require("../../config/database");
const ApiError = require("../../utils/ApiError");
const ROLES = require("../../constants/roles");

const assignmentSelect = {
  id: true,
  title: true,
  description: true,
  courseId: true,
  dueDate: true,
  createdAt: true,
  updatedAt: true,
  course: { select: { id: true, title: true } },
  _count: { select: { submissions: true } },
};

const submissionSelect = {
  id: true,
  assignmentId: true,
  userId: true,
  fileUrl: true,
  content: true,
  grade: true,
  feedback: true,
  createdAt: true,
  updatedAt: true,
  user: { select: { id: true, name: true, email: true, avatar: true } },
  assignment: { select: { id: true, title: true, courseId: true } },
};

const assertCourseOwnership = async (courseId, userId, role) => {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, instructorId: true },
  });
  if (!course) throw new ApiError(404, "Course not found.");
  const isPrivileged = [ROLES.ADMIN, ROLES.SUPER_ADMIN].includes(role);
  if (!isPrivileged && course.instructorId !== userId) {
    throw new ApiError(403, "You do not have permission to manage assignments for this course.");
  }
  return course;
};

// GET /api/v1/assignments?courseId=&page=&limit=
const getAssignments = async ({ courseId, page = 1, limit = 12 } = {}) => {
  const skip = (Number(page) - 1) * Number(limit);
  const where = { ...(courseId && { courseId }) };

  const [assignments, total] = await Promise.all([
    prisma.assignment.findMany({
      where,
      select: assignmentSelect,
      orderBy: { createdAt: "desc" },
      skip,
      take: Number(limit),
    }),
    prisma.assignment.count({ where }),
  ]);

  return {
    assignments: assignments.map((a) => ({
      ...a,
      submissionCount: a._count.submissions,
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

// GET /api/v1/assignments/:id
const getAssignmentById = async (id) => {
  const assignment = await prisma.assignment.findUnique({
    where: { id },
    select: assignmentSelect,
  });
  if (!assignment) throw new ApiError(404, "Assignment not found.");
  return { ...assignment, submissionCount: assignment._count.submissions, _count: undefined };
};

// POST /api/v1/assignments
const createAssignment = async ({ title, description, courseId, dueDate, userId, role }) => {
  await assertCourseOwnership(courseId, userId, role);

  const assignment = await prisma.assignment.create({
    data: {
      title,
      courseId,
      ...(description && { description }),
      ...(dueDate && { dueDate: new Date(dueDate) }),
    },
    select: assignmentSelect,
  });

  return { ...assignment, submissionCount: assignment._count.submissions, _count: undefined };
};

// POST /api/v1/assignments/:assignmentId/submit
const submitAssignment = async ({ assignmentId, userId, fileUrl, content }) => {
  const assignment = await prisma.assignment.findUnique({ where: { id: assignmentId } });
  if (!assignment) throw new ApiError(404, "Assignment not found.");

  // upsert — student can resubmit
  const submission = await prisma.assignmentSubmission.upsert({
    where: { userId_assignmentId: { userId, assignmentId } },
    create: { userId, assignmentId, fileUrl, content },
    update: { fileUrl, content, updatedAt: new Date() },
    select: submissionSelect,
  });

  return submission;
};

// PATCH /api/v1/assignments/submissions/:submissionId/grade
const gradeSubmission = async (submissionId, { grade, feedback }, graderId, graderRole) => {
  const submission = await prisma.assignmentSubmission.findUnique({
    where: { id: submissionId },
    include: { assignment: { select: { courseId: true } } },
  });
  if (!submission) throw new ApiError(404, "Submission not found.");

  await assertCourseOwnership(submission.assignment.courseId, graderId, graderRole);

  if (typeof grade !== "number" || grade < 0 || grade > 100) {
    throw new ApiError(400, "Grade must be a number between 0 and 100.");
  }

  return prisma.assignmentSubmission.update({
    where: { id: submissionId },
    data: { grade, ...(feedback && { feedback }) },
    select: submissionSelect,
  });
};

// GET /api/v1/assignments/:assignmentId/submissions  (instructor)
const getSubmissions = async (assignmentId, userId, role, { page = 1, limit = 20 } = {}) => {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    select: { courseId: true },
  });
  if (!assignment) throw new ApiError(404, "Assignment not found.");
  await assertCourseOwnership(assignment.courseId, userId, role);

  const skip = (Number(page) - 1) * Number(limit);
  const [submissions, total] = await Promise.all([
    prisma.assignmentSubmission.findMany({
      where: { assignmentId },
      select: submissionSelect,
      orderBy: { createdAt: "desc" },
      skip,
      take: Number(limit),
    }),
    prisma.assignmentSubmission.count({ where: { assignmentId } }),
  ]);

  return {
    submissions,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    },
  };
};

// GET /api/v1/assignments/my-submissions  (student)
const getMySubmissions = async (userId, { page = 1, limit = 12 } = {}) => {
  const skip = (Number(page) - 1) * Number(limit);
  const [submissions, total] = await Promise.all([
    prisma.assignmentSubmission.findMany({
      where: { userId },
      select: submissionSelect,
      orderBy: { createdAt: "desc" },
      skip,
      take: Number(limit),
    }),
    prisma.assignmentSubmission.count({ where: { userId } }),
  ]);

  return {
    submissions,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    },
  };
};

module.exports = {
  getAssignments,
  getAssignmentById,
  createAssignment,
  submitAssignment,
  gradeSubmission,
  getSubmissions,
  getMySubmissions,
};