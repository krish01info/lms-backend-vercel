const { prisma } = require("../../config/database");
const ApiError = require("../../utils/ApiError");
const { notificationEmitter, NOTIFICATION_EVENTS } = require("../events/notification.events");

/** All payments made by a student, newest first. */
const getMyPayments = async (userId) => {
  return prisma.payment.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { course: { select: { id: true, title: true, thumbnail: true } } },
  });
};

/** A single payment — scoped to its owner. */
const getPaymentById = async (id, userId) => {
  const payment = await prisma.payment.findFirst({
    where: { id, userId },
    include: { course: { select: { id: true, title: true, thumbnail: true } } },
  });
  if (!payment) throw new ApiError(404, "Payment not found.");
  return payment;
};

/**
 * Record a payment. A real gateway webhook (Razorpay/Stripe) would call this
 * with status: "COMPLETED" once it confirms the charge; for now it's also
 * directly callable so the flow works end-to-end without a gateway wired up.
 */
const createPayment = async ({ userId, courseId, amount, status = "PENDING", gateway, gatewayId }) => {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw new ApiError(404, "Course not found.");

  const payment = await prisma.payment.create({
    data: { userId, courseId, amount, status, gateway, gatewayId },
  });

  if (status === "COMPLETED") {
    notificationEmitter.emit(NOTIFICATION_EVENTS.PAYMENT_SUCCESS, { userId, courseId, paymentId: payment.id });
  } else if (status === "FAILED") {
    notificationEmitter.emit(NOTIFICATION_EVENTS.PAYMENT_FAILED, { userId, courseId, paymentId: payment.id });
  }

  return payment;
};

module.exports = { getMyPayments, getPaymentById, createPayment };
