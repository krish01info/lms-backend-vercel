const { EventEmitter } = require("events");

// ─────────────────────────────────────────────────────────────────────────────
// notificationEmitter — the single event bus for the whole notification system
// ─────────────────────────────────────────────────────────────────────────────
// Any module (enrollments, payments, courses, assignments, certificates...)
// just does:
//
//   const { notificationEmitter, NOTIFICATION_EVENTS } = require("../../events/notification.events");
//   notificationEmitter.emit(NOTIFICATION_EVENTS.ENROLLMENT_CREATED, { studentId, courseId, ... });
//
// It never has to know HOW the notification gets created/stored/pushed — that
// logic lives only in notification.listeners.js. This keeps modules decoupled:
// payments.service.js doesn't import notifications.service.js directly.
//
// Raise the max listener count a bit — with 8-10 events, each possibly having
// 1-2 listeners (DB write + future socket push), Node's default of 10 gets
// tight fast and prints an ugly "MaxListenersExceededWarning".
const notificationEmitter = new EventEmitter();
notificationEmitter.setMaxListeners(30);

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATION_EVENTS — every event name lives here, nowhere else.
// Never hardcode a string like "enrollment.created" in a service file — always
// import the constant, so a typo becomes a crash-on-boot, not a silently
// missing notification.
// ─────────────────────────────────────────────────────────────────────────────
const NOTIFICATION_EVENTS = {
  // ── Enrollments ──────────────────────────────────────────────────────────
  ENROLLMENT_CREATED: "enrollment.created",   // student enrolls -> notify instructor
  ENROLLMENT_CANCELLED: "enrollment.cancelled", // student unenrolls -> notify instructor

  // ── Courses / Lessons / Announcements ───────────────────────────────────
  COURSE_ANNOUNCEMENT: "course.announcement", // instructor posts something -> notify all enrolled students
  COURSE_PUBLISHED: "course.published",       // instructor publishes a course -> notify admin (optional)
  LESSON_PUBLISHED: "lesson.published",       // new lesson added -> notify enrolled students

  // ── Payments ─────────────────────────────────────────────────────────────
  PAYMENT_SUCCESS: "payment.success",         // payment completed -> notify student (+ instructor)
  PAYMENT_FAILED: "payment.failed",           // payment failed -> notify student

  // ── Assignments ─────────────────────────────────────────────────────────
  ASSIGNMENT_SUBMITTED: "assignment.submitted", // student submits -> notify instructor
  ASSIGNMENT_GRADED: "assignment.graded",       // instructor grades -> notify student

  // ── Quizzes ──────────────────────────────────────────────────────────────
  QUIZ_GRADED: "quiz.graded",                 // auto-graded quiz result -> notify student

  // ── Certificates ─────────────────────────────────────────────────────────
  CERTIFICATE_ISSUED: "certificate.issued",   // certificate generated -> notify student
};

module.exports = { notificationEmitter, NOTIFICATION_EVENTS };
