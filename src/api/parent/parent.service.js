const { prisma } = require("../../config/database");
const ApiError = require("../../utils/ApiError");
const { getMyAttendance } = require("../attendance/attendance.service");
const { getMyResults } = require("../results/results.service");

/** All students linked to this parent account. */
const getMyChildren = async (parentId) => {
  const links = await prisma.parentStudentLink.findMany({
    where: { parentId },
    include: { student: { select: { id: true, name: true, email: true, avatar: true } } },
  });
  return links.map((l) => l.student);
};

/** Verifies the parent<->student link exists — throws 403 if not. */
const assertLinked = async (parentId, studentId) => {
  const link = await prisma.parentStudentLink.findUnique({
    where: { parentId_studentId: { parentId, studentId } },
  });
  if (!link) throw new ApiError(403, "You are not linked to this student.");
};

/**
 * A dashboard summary for one linked child — real attendance %, real grades,
 * pending fees, and unread messages between the parent and that child.
 * Reuses the same services the student's own dashboard/results pages use,
 * just scoped to the child's userId instead of req.user.id.
 */
const getChildSummary = async (parentId, studentId) => {
  await assertLinked(parentId, studentId);

  const [attendance, results, pendingPayments, conversation] = await Promise.all([
    getMyAttendance(studentId),
    getMyResults(studentId),
    prisma.payment.aggregate({
      where: { userId: studentId, status: "PENDING" },
      _sum: { amount: true },
    }),
    prisma.conversation.findUnique({
      where: {
        participant1Id_participant2Id: { participant1Id: parentId, participant2Id: studentId },
      },
    }).catch(() => null),
  ]);

  let unreadMessages = 0;
  if (conversation) {
    unreadMessages = await prisma.message.count({
      where: { conversationId: conversation.id, senderId: studentId, readAt: null },
    });
  }

  return {
    attendance,
    results,
    pendingFees: pendingPayments._sum.amount || 0,
    unreadMessages,
  };
};

module.exports = { getMyChildren, getChildSummary };
