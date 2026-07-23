const { prisma } = require("../../config/database");
const ApiError = require("../../utils/ApiError");
const ROLES = require("../../constants/roles");

// Fields returned to the client for every assignment.
// Mirrors the `quizSelect` pattern in quizzes.service.js.
// For students, also pulls their own submission (if any) so the client can
// show real Pending/Submitted/Graded/Overdue status without a second call.
const assignmentSelect = (userId, role) => {
  const isPrivileged = [ROLES.INSTRUCTOR, ROLES.ADMIN, ROLES.SUPER_ADMIN].includes(role);

  return {
    id: true,
    title: true,
    description: true,
    courseId: true,
    dueDate: true,
    createdAt: true,
    updatedAt: true,
    course: { select: { id: true, title: true } },
    _count: { select: { submissions: true } },
    ...(!isPrivileged && {
      submissions: {
        where: { userId },
        select: { id: true, grade: true, feedback: true, fileUrl: true, createdAt: true },
      },
    }),
  };
};

// Reshapes Prisma's _count object into a flat, friendly field, and — for
// students — derives a single `status` field (pending/submitted/graded/overdue)
// plus `mySubmission` from the filtered `submissions` array above.
const formatAssignment = (assignment) => {
  const mySubmission = assignment.submissions?.[0] ?? null;
  const isOverdue = assignment.dueDate ? new Date() > new Date(assignment.dueDate) : false;

  let status;
  if (mySubmission) {
    status = mySubmission.grade !== null && mySubmission.grade !== undefined ? "graded" : "submitted";
  } else {
    status = isOverdue ? "overdue" : "pending";
  }

  return {
    ...assignment,
    submissionCount: assignment._count.submissions,
    _count: undefined,
    submissions: undefined,
    mySubmission,
    status,
  };
};

const submissionSelect = {
  id: true,
  userId: true,
  assignmentId: true,
  fileUrl: true,
  grade: true,
  feedback: true,
  createdAt: true,
  updatedAt: true,
  user: { select: { id: true, name: true, avatar: true } },
};

// Shared ownership guard, same shape as quizzes.service.js / resources.service.js.
// Throws 404 if the course doesn't exist, 403 if this user isn't allowed to
// manage assignments on it.
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

// Students must be actively (or previously) enrolled to view/submit;
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
    throw new ApiError(403, "You must be enrolled in this course to view its assignments.");
  }

  return course;
};

// ─────────────────────────────────────────────────────────────────────────────
// Assignment CRUD
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/v1/courses/:courseId/assignments
const createAssignment = async ({ title, description, courseId, dueDate, userId, role }) => {
  await assertCourseOwnership(courseId, userId, role);

  const assignment = await prisma.assignment.create({
    data: {
      title,
      courseId,
      ...(description !== undefined && { description }),
      ...(dueDate !== undefined && { dueDate }),
    },
    select: assignmentSelect(userId, role),
  });

  return formatAssignment(assignment);
};

// GET /api/v1/assignments?courseId=&page=&limit=
// courseId omitted => "all my assignments" for instructor/admin (scoped to
// courses they own), or "all assignments in my enrolled courses" for a student.
const getAssignments = async ({ courseId, page = 1, limit = 20, userId, role }) => {
  const skip = (Number(page) - 1) * Number(limit);
  const isPrivileged = [ROLES.INSTRUCTOR, ROLES.ADMIN, ROLES.SUPER_ADMIN].includes(role);

  if (courseId) {
    await assertCanView(courseId, userId, role);
  }

  let where;
  if (courseId) {
    where = { courseId };
  } else if (role === ROLES.ADMIN || role === ROLES.SUPER_ADMIN) {
    where = {};
  } else if (isPrivileged) {
    where = { course: { instructorId: userId } };
  } else {
    // Student, no courseId given — scope to their enrolled courses only.
    where = { course: { enrollments: { some: { userId, status: { in: ["ACTIVE", "COMPLETED"] } } } } };
  }

  const [assignments, total] = await Promise.all([
    prisma.assignment.findMany({
      where,
      select: assignmentSelect(userId, role),
      orderBy: { createdAt: "desc" },
      skip,
      take: Number(limit),
    }),
    prisma.assignment.count({ where }),
  ]);

  let formatted = assignments.map(formatAssignment);

  // Students need their own submission (status/grade) per assignment — attach
  // it here so the frontend doesn't need a second round-trip per card.
  if (!isPrivileged && formatted.length > 0) {
    const submissions = await prisma.assignmentSubmission.findMany({
      where: { userId, assignmentId: { in: formatted.map((a) => a.id) } },
      select: submissionSelect,
    });
    const byAssignment = Object.fromEntries(submissions.map((s) => [s.assignmentId, s]));
    formatted = formatted.map((a) => ({ ...a, mySubmission: byAssignment[a.id] || null }));
  }

  return {
    assignments: formatted,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    },
  };
};

// GET /api/v1/assignments/:id
const getAssignmentById = async (id, userId, role) => {
  const assignment = await prisma.assignment.findUnique({
    where: { id },
    select: assignmentSelect(userId, role),
  });
  if (!assignment) throw new ApiError(404, "Assignment not found.");

  await assertCanView(assignment.courseId, userId, role);

  return formatAssignment(assignment);
};

// PATCH /api/v1/assignments/:id
const updateAssignment = async (id, { title, description, dueDate }, userId, role) => {
  const existing = await prisma.assignment.findUnique({
    where: { id },
    select: { id: true, courseId: true },
  });
  if (!existing) throw new ApiError(404, "Assignment not found.");

  await assertCourseOwnership(existing.courseId, userId, role);

  const updated = await prisma.assignment.update({
    where: { id },
    data: {
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(dueDate !== undefined && { dueDate }),
    },
    select: assignmentSelect(userId, role),
  });

  return formatAssignment(updated);
};

// DELETE /api/v1/assignments/:id
const deleteAssignment = async (id, userId, role) => {
  const existing = await prisma.assignment.findUnique({
    where: { id },
    select: { id: true, courseId: true },
  });
  if (!existing) throw new ApiError(404, "Assignment not found.");

  await assertCourseOwnership(existing.courseId, userId, role);

  await prisma.assignment.delete({ where: { id } });

  return { id };
};

// ─────────────────────────────────────────────────────────────────────────────
// Submissions
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/v1/assignments/:assignmentId/submit — student, file only.
// Resubmission before the due date overwrites the file but leaves any
// existing grade/feedback untouched (per product decision — a teacher's
// grade shouldn't silently vanish just because a student re-uploaded).
const submitAssignment = async ({ assignmentId, userId, fileUrl }) => {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    select: { id: true, courseId: true, dueDate: true },
  });
  if (!assignment) throw new ApiError(404, "Assignment not found.");

  const enrollment = await prisma.enrollment.findFirst({
    where: {
      courseId: assignment.courseId,
      userId,
      status: { in: ["ACTIVE", "COMPLETED"] },
    },
  });
  if (!enrollment) {
    throw new ApiError(403, "You must be enrolled in this course to submit this assignment.");
  }

  if (assignment.dueDate && new Date() > assignment.dueDate) {
    throw new ApiError(403, "The due date for this assignment has passed. Submissions are closed.");
  }

  const submission = await prisma.assignmentSubmission.upsert({
    where: { userId_assignmentId: { userId, assignmentId } },
    update: { fileUrl },
    create: { userId, assignmentId, fileUrl },
    select: submissionSelect,
  });

  return submission;
};

// GET /api/v1/assignments/:assignmentId/submissions — instructor/admin only.
const getSubmissions = async (assignmentId, userId, role) => {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    select: { id: true, courseId: true },
  });
  if (!assignment) throw new ApiError(404, "Assignment not found.");

  await assertCourseOwnership(assignment.courseId, userId, role);

  const submissions = await prisma.assignmentSubmission.findMany({
    where: { assignmentId },
    select: submissionSelect,
    orderBy: { createdAt: "desc" },
  });

  // Ungraded submissions surface first so the teacher sees what needs
  // attention without having to hunt for it.
  submissions.sort((a, b) => (a.grade === null ? -1 : 1) - (b.grade === null ? -1 : 1));

  return submissions;
};

// GET /api/v1/assignments/submissions/:submissionId — instructor/admin, or the
// student who owns the submission.
const getSubmissionById = async (submissionId, userId, role) => {
  const submission = await prisma.assignmentSubmission.findUnique({
    where: { id: submissionId },
    select: { ...submissionSelect, assignment: { select: { id: true, courseId: true } } },
  });
  if (!submission) throw new ApiError(404, "Submission not found.");

  const isPrivileged = [ROLES.ADMIN, ROLES.SUPER_ADMIN].includes(role);
  if (!isPrivileged && submission.userId !== userId) {
    await assertCourseOwnership(submission.assignment.courseId, userId, role);
  }

  return submission;
};

// PATCH /api/v1/assignments/submissions/:submissionId/grade — instructor/admin only.
const gradeSubmission = async (submissionId, { grade, feedback }, userId, role) => {
  const submission = await prisma.assignmentSubmission.findUnique({
    where: { id: submissionId },
    select: { id: true, assignment: { select: { courseId: true } } },
  });
  if (!submission) throw new ApiError(404, "Submission not found.");

  await assertCourseOwnership(submission.assignment.courseId, userId, role);

  const updated = await prisma.assignmentSubmission.update({
    where: { id: submissionId },
    data: {
      grade,
      ...(feedback !== undefined && { feedback }),
    },
    select: submissionSelect,
  });

  return updated;
};

module.exports = {
  createAssignment,
  getAssignments,
  getAssignmentById,
  updateAssignment,
  deleteAssignment,
  submitAssignment,
  getSubmissions,
  getSubmissionById,
  gradeSubmission,
  assertCourseOwnership,
};