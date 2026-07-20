const { prisma } = require("../../config/database");
const { notificationEmitter, NOTIFICATION_EVENTS } = require("./notification.events");
const NotificationService = require("../notifications/notifications.service");

// ─────────────────────────────────────────────────────────────────────────────
// notification.listeners.js
//
// This is the ONLY file that turns a domain event into a row in the
// notifications table. Every handler below is fire-and-forget from the
// caller's point of view: emit() is synchronous and returns immediately, the
// actual DB write happens after, and if it fails we log it — we NEVER let a
// notification failure break the real operation (e.g. a payment must still
// succeed even if writing the notification throws).
//
// registerNotificationListeners() must be called ONCE at boot (see app.js).
// ─────────────────────────────────────────────────────────────────────────────

const registerNotificationListeners = () => {
  // ── 1. Student enrolls in a course -> notify BOTH the student and the instructor ──
  // Auto-emitted by the Prisma extension in src/config/database.js on
  // enrollment.create / enrollment.upsert — enrollments.service.js never has
  // to call this itself.
  notificationEmitter.on(NOTIFICATION_EVENTS.ENROLLMENT_CREATED, async ({ studentId, courseId }) => {
    try {
      const [student, course] = await Promise.all([
        prisma.user.findUnique({ where: { id: studentId }, select: { name: true } }),
        prisma.course.findUnique({ where: { id: courseId }, select: { title: true, instructorId: true } }),
      ]);
      if (!student || !course) return;

      // 1a. The student themself: "You've enrolled in <course>"
      await NotificationService.create({
        userId: studentId,
        title: "You're enrolled! 🎉",
        message: `You have successfully enrolled in "${course.title}".`,
        type: "ENROLLMENT",
        link: `/student/courses/${courseId}`,
        meta: { courseId },
      });

      // 1b. The instructor: "<student> enrolled in <course>"
      await NotificationService.create({
        userId: course.instructorId,
        title: "New student enrolled",
        message: `${student.name} just enrolled in "${course.title}".`,
        type: "ENROLLMENT",
        link: `/teacher/courses`,
        meta: { courseId, studentId },
      });
    } catch (err) {
      console.error("[notification.listeners] ENROLLMENT_CREATED failed:", err.message);
    }
  });

  // ── 2. Instructor posts an announcement -> notify every enrolled student ─
  // Emit from courses.service.js (or a dedicated announcements endpoint):
  //   notificationEmitter.emit(NOTIFICATION_EVENTS.COURSE_ANNOUNCEMENT, { courseId, title, message });
  notificationEmitter.on(NOTIFICATION_EVENTS.COURSE_ANNOUNCEMENT, async ({ courseId, title, message }) => {
    try {
      const enrollments = await prisma.enrollment.findMany({
        where: { courseId, status: "ACTIVE" },
        select: { userId: true },
      });
      if (enrollments.length === 0) return;

      await NotificationService.createMany(
        enrollments.map((e) => e.userId),
        {
          title: title || "New announcement",
          message,
          type: "ANNOUNCEMENT",
          link: `/courses/${courseId}`,
          meta: { courseId },
        }
      );
    } catch (err) {
      console.error("[notification.listeners] COURSE_ANNOUNCEMENT failed:", err.message);
    }
  });

  // ── 3. New lesson published -> notify every enrolled student ─────────────
  // Emit from lessons.service.js after creating a (non-draft) lesson:
  //   notificationEmitter.emit(NOTIFICATION_EVENTS.LESSON_PUBLISHED, { courseId, lessonId, lessonTitle });
  notificationEmitter.on(NOTIFICATION_EVENTS.LESSON_PUBLISHED, async ({ courseId, lessonId, lessonTitle }) => {
    try {
      const enrollments = await prisma.enrollment.findMany({
        where: { courseId, status: "ACTIVE" },
        select: { userId: true },
      });
      if (enrollments.length === 0) return;

      await NotificationService.createMany(
        enrollments.map((e) => e.userId),
        {
          title: "New lesson added",
          message: `A new lesson "${lessonTitle}" was added to your course.`,
          type: "GENERAL", // no LESSON_PUBLISHED value in the NotificationType enum yet
          link: `/courses/${courseId}/lessons/${lessonId}`,
          meta: { courseId, lessonId },
        }
      );
    } catch (err) {
      console.error("[notification.listeners] LESSON_PUBLISHED failed:", err.message);
    }
  });

  // ── 4. Payment succeeded -> notify the student (+ instructor gets a sale notice) ─
  // Emit from payments.service.js right after marking the Payment COMPLETED:
  //   notificationEmitter.emit(NOTIFICATION_EVENTS.PAYMENT_SUCCESS, { userId, courseId, amount, paymentId });
  notificationEmitter.on(NOTIFICATION_EVENTS.PAYMENT_SUCCESS, async ({ userId, courseId, amount, paymentId }) => {
    try {
      const course = await prisma.course.findUnique({
        where: { id: courseId },
        select: { title: true, instructorId: true },
      });
      if (!course) return;

      await NotificationService.create({
        userId,
        title: "Payment successful",
        message: `Your payment of ₹${amount} for "${course.title}" was successful. You're enrolled!`,
        type: "PAYMENT",
        link: `/courses/${courseId}`,
        meta: { courseId, amount, paymentId },
      });

      // Bonus: let the instructor know they made a sale
      await NotificationService.create({
        userId: course.instructorId,
        title: "New sale",
        message: `Someone just purchased "${course.title}" for ₹${amount}.`,
        type: "PAYMENT",
        link: `/courses/${courseId}/students`,
        meta: { courseId, amount, paymentId },
      });
    } catch (err) {
      console.error("[notification.listeners] PAYMENT_SUCCESS failed:", err.message);
    }
  });

  // ── 5. Payment failed -> notify the student ───────────────────────────────
  // Emit from payments.service.js (or the Razorpay webhook handler) on failure:
  //   notificationEmitter.emit(NOTIFICATION_EVENTS.PAYMENT_FAILED, { userId, courseId, amount, reason });
  notificationEmitter.on(NOTIFICATION_EVENTS.PAYMENT_FAILED, async ({ userId, courseId, amount, reason }) => {
    try {
      const course = await prisma.course.findUnique({ where: { id: courseId }, select: { title: true } });

      await NotificationService.create({
        userId,
        title: "Payment failed",
        message: `Your payment${amount ? ` of ₹${amount}` : ""} for "${course?.title || "this course"}" could not be processed${reason ? `: ${reason}` : "."}`,
        type: "PAYMENT",
        link: `/courses/${courseId}`,
        meta: { courseId, amount, reason },
      });
    } catch (err) {
      console.error("[notification.listeners] PAYMENT_FAILED failed:", err.message);
    }
  });

  // ── 6. Student submits an assignment -> notify the instructor ────────────
  // Emit from assignments.service.js after creating the submission:
  //   notificationEmitter.emit(NOTIFICATION_EVENTS.ASSIGNMENT_SUBMITTED, { assignmentId, studentId });
  notificationEmitter.on(NOTIFICATION_EVENTS.ASSIGNMENT_SUBMITTED, async ({ assignmentId, studentId }) => {
    try {
      const [assignment, student] = await Promise.all([
        prisma.assignment.findUnique({
          where: { id: assignmentId },
          select: { title: true, course: { select: { id: true, instructorId: true } } },
        }),
        prisma.user.findUnique({ where: { id: studentId }, select: { name: true } }),
      ]);
      if (!assignment || !student) return;

      await NotificationService.create({
        userId: assignment.course.instructorId,
        title: "New assignment submission",
        message: `${student.name} submitted "${assignment.title}".`,
        type: "ASSIGNMENT",
        link: `/assignments/${assignmentId}/submissions`,
        meta: { assignmentId, studentId, courseId: assignment.course.id },
      });
    } catch (err) {
      console.error("[notification.listeners] ASSIGNMENT_SUBMITTED failed:", err.message);
    }
  });

  // ── 7. Instructor grades a submission -> notify the student ──────────────
  // Emit from assignments.service.js after saving the grade:
  //   notificationEmitter.emit(NOTIFICATION_EVENTS.ASSIGNMENT_GRADED, { submissionId, studentId, assignmentId, grade });
  notificationEmitter.on(
    NOTIFICATION_EVENTS.ASSIGNMENT_GRADED,
    async ({ submissionId, studentId, assignmentId, grade }) => {
      try {
        const assignment = await prisma.assignment.findUnique({
          where: { id: assignmentId },
          select: { title: true },
        });

        await NotificationService.create({
          userId: studentId,
          title: "Assignment graded",
          message: `Your submission for "${assignment?.title || "an assignment"}" was graded: ${grade}.`,
          type: "ASSIGNMENT",
          link: `/assignments/${assignmentId}/submissions/${submissionId}`,
          meta: { submissionId, assignmentId, grade },
        });
      } catch (err) {
        console.error("[notification.listeners] ASSIGNMENT_GRADED failed:", err.message);
      }
    }
  );

  // ── 8. Quiz auto-graded -> notify the student ─────────────────────────────
  // Emit from quizzes.service.js right after creating the QuizAttempt:
  //   notificationEmitter.emit(NOTIFICATION_EVENTS.QUIZ_GRADED, { userId, quizId, score, passed });
  notificationEmitter.on(NOTIFICATION_EVENTS.QUIZ_GRADED, async ({ userId, quizId, score, passed }) => {
    try {
      const quiz = await prisma.quiz.findUnique({ where: { id: quizId }, select: { title: true } });

      await NotificationService.create({
        userId,
        title: passed ? "Quiz passed!" : "Quiz result",
        message: `You scored ${score}% on "${quiz?.title || "the quiz"}"${passed ? " — nice work!" : "."}`,
        type: "QUIZ",
        link: `/quizzes/${quizId}/results`,
        meta: { quizId, score, passed },
      });
    } catch (err) {
      console.error("[notification.listeners] QUIZ_GRADED failed:", err.message);
    }
  });

  // ── 9. Certificate generated -> notify the student ───────────────────────
  // Emit from certificates.service.js after the PDF is generated and Certificate row created:
  //   notificationEmitter.emit(NOTIFICATION_EVENTS.CERTIFICATE_ISSUED, { userId, courseId, certificateId });
  notificationEmitter.on(NOTIFICATION_EVENTS.CERTIFICATE_ISSUED, async ({ userId, courseId, certificateId }) => {
    try {
      const course = await prisma.course.findUnique({ where: { id: courseId }, select: { title: true } });

      await NotificationService.create({
        userId,
        title: "Certificate ready 🎓",
        message: `Your certificate for completing "${course?.title || "the course"}" is ready to download.`,
        type: "CERTIFICATE",
        link: `/certificates/${certificateId}`,
        meta: { courseId, certificateId },
      });
    } catch (err) {
      console.error("[notification.listeners] CERTIFICATE_ISSUED failed:", err.message);
    }
  });

  console.log("🔔 Notification listeners registered");
};

module.exports = { registerNotificationListeners };
