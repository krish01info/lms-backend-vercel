
const express = require("express");
const router = express.Router();
const { protect, requireRole } = require("../../middleware/auth.middleware");
const ROLES = require("../../constants/roles");
const parentController = require("./parent.controller");
const asyncHandler = require("../../utils/asyncHandler");
const ApiError = require("../../utils/ApiError");
const ApiResponse = require("../../utils/ApiResponse");
const { prisma } = require("../../config/database");
// ─── POST /api/v1/parent/children ─────────────────────────────────────────────
// Parent sends a link request to a student using their invite code.
// This creates a PENDING ParentLinkRequest — the student must accept it.
router.post(
  "/children",
  protect,
  requireRole(ROLES.PARENT),
  asyncHandler(async (req, res) => {
    const parentId = req.user.id;
    const { inviteCode } = req.body;

    if (!inviteCode) throw new ApiError(400, "inviteCode is required.");

    const code = inviteCode.trim().toUpperCase();

    // Find student by invite code
    const child = await prisma.user.findUnique({
      where: { parentInviteCode: code },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatar: true,
        parentInviteExpiry: true,
      },
    });

    if (!child) throw new ApiError(404, "Invalid invite code. Ask your child to generate a new one.");
    if (child.role !== ROLES.STUDENT) throw new ApiError(400, "The linked account must be a Student.");
    if (child.id === parentId) throw new ApiError(400, "You cannot link your own account as a child.");

    // Check expiry
    if (!child.parentInviteExpiry || child.parentInviteExpiry < new Date()) {
      throw new ApiError(410, "This invite code has expired. Ask your child to generate a new one.");
    }

    // Check if already confirmed — gracefully skip if parent_student_links table doesn't exist yet
    let existingLink = null;
    try {
      existingLink = await prisma.parentStudentLink.findUnique({
        where: { parentId_studentId: { parentId, studentId: child.id } },
      });
    } catch (_) {
      // Table doesn't exist yet (migration pending)
    }
    if (existingLink) throw new ApiError(409, "This student is already linked to your account.");

    // Check if a pending request already exists — gracefully skip if table doesn't exist
    let existingRequest = null;
    try {
      existingRequest = await prisma.parentLinkRequest.findUnique({
        where: { parentId_childId: { parentId, childId: child.id } },
      });
    } catch (_) {
      // Table doesn't exist yet (migration pending)
    }
    if (existingRequest && existingRequest.status === "PENDING") {
      throw new ApiError(409, "A link request is already pending — waiting for student approval.");
    }

    // Upsert (in case a rejected request exists, re-create it as PENDING)
    try {
      await prisma.parentLinkRequest.upsert({
        where: { parentId_childId: { parentId, childId: child.id } },
        create: { parentId, childId: child.id, status: "PENDING" },
        update: { status: "PENDING" },
      });
    } catch (_) {
      throw new ApiError(503, "Parent link feature is not yet available. Please run database migration.");
    }

    return res.status(201).json(
      new ApiResponse(201, {
        child: { id: child.id, name: child.name, email: child.email, avatar: child.avatar },
        status: "PENDING",
      }, "Link request sent! Waiting for student approval.")
    );
  })
);
 
// ─── GET /api/v1/parent/children ──────────────────────────────────────────────
// List all CONFIRMED children linked to the logged-in parent.
router.get(
  "/children",
  protect,
  requireRole(ROLES.PARENT),
  asyncHandler(async (req, res) => {
    const parentId = req.user.id;

    let children = [];
    try {
      const links = await prisma.parentStudentLink.findMany({
        where: { parentId },
        include: {
          student: {
            select: { id: true, name: true, email: true, avatar: true, createdAt: true },
          },
        },
        orderBy: { createdAt: "asc" },
      });
      children = links.map((l) => l.student);
    } catch (_) {
      // Table doesn't exist yet — return empty list
    }

    return res.status(200).json(
      new ApiResponse(200, { children }, "Linked children fetched successfully.")
    );
  })
);
 
// ─── GET /api/v1/parent/pending-requests ──────────────────────────────────────
// List all pending link requests sent by the parent (awaiting student approval).
router.get(
  "/pending-requests",
  protect,
  requireRole(ROLES.PARENT),
  asyncHandler(async (req, res) => {
    const parentId = req.user.id;

    let requests = [];
    try {
      requests = await prisma.parentLinkRequest.findMany({
        where: { parentId, status: "PENDING" },
        include: {
          child: {
            select: { id: true, name: true, email: true, avatar: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });
    } catch (_) {
      // Table doesn't exist yet (migration pending) — return empty list
    }

    return res.status(200).json(
      new ApiResponse(200, { requests }, "Pending requests fetched.")
    );
  })
);
 
// ─── DELETE /api/v1/parent/children/:childId ──────────────────────────────────
// Unlink a confirmed child from the parent account.
router.delete(
  "/children/:childId",
  protect,
  requireRole(ROLES.PARENT),
  asyncHandler(async (req, res) => {
    const parentId = req.user.id;
    const { childId } = req.params;

    let link = null;
    try {
      link = await prisma.parentStudentLink.findUnique({
        where: { parentId_studentId: { parentId, studentId: childId } },
      });
    } catch (_) {
      throw new ApiError(503, "Parent link feature is not yet available. Please run database migration.");
    }
    if (!link) throw new ApiError(404, "This student is not linked to your account.");

    await prisma.parentStudentLink.delete({ where: { parentId_studentId: { parentId, studentId: childId } } });

    return res.status(200).json(
      new ApiResponse(200, null, "Student unlinked successfully.")
    );
  })
);
 
// ─── GET /api/v1/parent/children/:childId/overview ────────────────────────────
router.get(
  "/children/:childId/overview",
  protect,
  requireRole(ROLES.PARENT),
  asyncHandler(async (req, res) => {
    const parentId = req.user.id;
    const { childId } = req.params;

    // Verify parent-student link — gracefully handle missing table
    try {
      const link = await prisma.parentStudentLink.findUnique({
        where: { parentId_studentId: { parentId, studentId: childId } },
      });
      if (!link) throw new ApiError(403, "You are not authorized to view this student's data.");
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(503, "Parent link feature is not yet available. Please run database migration.");
    }

    // ── 1. Enrolled Courses ──────────────────────────────────────────────────
    const enrollments = await prisma.enrollment.findMany({
      where: { userId: childId, status: "ACTIVE" },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            thumbnail: true,
            lessons: { select: { id: true } },
          },
        },
      },
    });

    // ── 2. Lesson Progress ───────────────────────────────────────────────────
    const lessonProgressRecords = await prisma.lessonProgress.findMany({
      where: { userId: childId, completed: true },
      select: { lessonId: true },
    });
    const completedLessonIds = new Set(lessonProgressRecords.map((p) => p.lessonId));

    const courses = enrollments.map((enr) => {
      const totalLessons = enr.course.lessons.length;
      const completedLessons = enr.course.lessons.filter((l) =>
        completedLessonIds.has(l.id)
      ).length;
      const percentage =
        totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
      return {
        courseId: enr.course.id,
        courseTitle: enr.course.title,
        thumbnail: enr.course.thumbnail,
        totalLessons,
        completedLessons,
        percentage,
      };
    });

    // ── 3. Attendance Summary ────────────────────────────────────────────────
    const attendanceRecords = await prisma.attendanceRecord.findMany({
      where: { userId: childId },
      select: { courseId: true, status: true, date: true },
    });

    const totalClasses = attendanceRecords.length;
    const presentCount = attendanceRecords.filter((r) => r.status === "PRESENT").length;
    const attendancePercentage =
      totalClasses > 0 ? Math.round((presentCount / totalClasses) * 100) : 0;

    // ── 4. Recent Assignment Submissions ────────────────────────────────────
    // Fixed: uses correct field names from the Prisma schema (userId, createdAt,
    // grade). Assignment model has no totalMarks — omitted.
    let recentAssignments = [];
    try {
      const recentSubmissions = await prisma.assignmentSubmission.findMany({
        where: { userId: childId },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
          assignment: { select: { title: true, dueDate: true } },
        },
      });

      recentAssignments = recentSubmissions.map((s) => ({
        assignmentTitle: s.assignment.title,
        dueDate: s.assignment.dueDate,
        grade: s.grade,
        submittedAt: s.createdAt,
      }));
    } catch (_) {
      // assignment_submissions table may not exist — skip gracefully
    }

    // ── 5. Recent Quiz Attempts ──────────────────────────────────────────────
    const recentQuizAttempts = await prisma.quizAttempt.findMany({
      where: { userId: childId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        quiz: { select: { title: true, passMark: true } },
      },
    });

    const recentQuizzes = recentQuizAttempts.map((a) => ({
      quizTitle: a.quiz.title,
      score: a.score,
      passMark: a.quiz.passMark,
      passed: a.passed,
      attemptedAt: a.createdAt,
    }));

    const quizPassed  = recentQuizAttempts.filter((a) => a.passed).length;
    const quizTotal   = recentQuizAttempts.length;

    // ── 6. Child Profile ─────────────────────────────────────────────────────
    const child = await prisma.user.findUnique({
      where: { id: childId },
      select: { id: true, name: true, email: true, avatar: true },
    });

    return res.status(200).json(
      new ApiResponse(200, {
        child,
        stats: {
          totalCourses: courses.length,
          avgProgress:
            courses.length > 0
              ? Math.round(courses.reduce((a, c) => a + c.percentage, 0) / courses.length)
              : 0,
          attendancePercentage,
          totalClasses,
          presentCount,
          quizPassed,
          quizTotal,
        },
        courses,
        recentAssignments,
        recentQuizzes,
      }, "Child overview fetched successfully.")
    );
  })
);
 
module.exports = router;
 
