const { prisma } = require("../../config/database");
const ApiError = require("../../utils/ApiError");

const messageSelect = {
  id: true,
  conversationId: true,
  senderId: true,
  content: true,
  readAt: true,
  createdAt: true,
  sender: {
    select: { id: true, name: true, avatar: true },
  },
};

const conversationSelect = {
  id: true,
  participant1Id: true,
  participant2Id: true,
  lastMessageAt: true,
  createdAt: true,
  participant1: { select: { id: true, name: true, avatar: true } },
  participant2: { select: { id: true, name: true, avatar: true } },
};

/**
 * Find the shared course between two users (one teacher, one student).
 * Looks for a course where userA is the instructor AND userB is enrolled,
 * or vice versa. Returns the first matching course's id and title.
 */
async function findSharedCourse(userIdA, userIdB) {
  // Try A=teacher, B=student
  const courseAsInstructor = await prisma.course.findFirst({
    where: {
      instructorId: userIdA,
      enrollments: { some: { userId: userIdB, status: "ACTIVE" } },
    },
    select: { id: true, title: true },
  });
  if (courseAsInstructor) return courseAsInstructor;

  // Try B=teacher, A=student
  const courseAsStudent = await prisma.course.findFirst({
    where: {
      instructorId: userIdB,
      enrollments: { some: { userId: userIdA, status: "ACTIVE" } },
    },
    select: { id: true, title: true },
  });
  if (courseAsStudent) return courseAsStudent;

  return null;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Normalize the pair so (A, B) and (B, A) resolve to the same unique constraint.
 * participant1Id is always the lexicographically smaller UUID — this ensures
 * the @@unique([participant1Id, participant2Id]) constraint works regardless
 * of who initiates the conversation.
 */
function normalizeParticipants(a, b) {
  return a < b ? { participant1Id: a, participant2Id: b } : { participant1Id: b, participant2Id: a };
}

/**
 * Build a rich conversation response with an `otherParticipant` field
 * (the person *not* making the request), `lastMessage`, and `unreadCount`.
 */
async function enrichConversation(conv, currentUserId) {
  const other = conv.participant1Id === currentUserId ? conv.participant2 : conv.participant1;

  const lastMessage = await prisma.message.findFirst({
    where: { conversationId: conv.id },
    orderBy: { createdAt: "desc" },
    select: { content: true, createdAt: true, senderId: true },
  });

  const unreadCount = await prisma.message.count({
    where: {
      conversationId: conv.id,
      senderId: { not: currentUserId },
      readAt: null,
    },
  });

  // Find the shared course between the two participants
  const course = await findSharedCourse(currentUserId, other.id);

  return {
    id: conv.id,
    participant: {
      id: other.id,
      name: other.name,
      avatar: other.avatar,
    },
    course: course // { id, title } or null if no shared course
      ? { id: course.id, title: course.title }
      : null,
    lastMessage: lastMessage?.content ?? null,
    lastMessageAt: lastMessage?.createdAt ?? conv.lastMessageAt,
    lastMessageSenderId: lastMessage?.senderId ?? null,
    unreadCount,
    createdAt: conv.createdAt,
  };
}

// ─── API Methods ───────────────────────────────────────────────────────────

// GET /messages/conversations
const listConversations = async (userId, { page = 1, limit = 20 }) => {
  const skip = (Number(page) - 1) * Number(limit);

  const [conversations, total] = await Promise.all([
    prisma.conversation.findMany({
      where: {
        OR: [{ participant1Id: userId }, { participant2Id: userId }],
      },
      select: conversationSelect,
      orderBy: { lastMessageAt: "desc" },
      skip,
      take: Number(limit),
    }),
    prisma.conversation.count({
      where: {
        OR: [{ participant1Id: userId }, { participant2Id: userId }],
      },
    }),
  ]);

  const enriched = await Promise.all(
    conversations.map((c) => enrichConversation(c, userId)),
  );

  return {
    conversations: enriched,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    },
  };
};

// POST /messages/conversations
const createConversation = async (currentUserId, participantId) => {
  if (currentUserId === participantId) {
    throw new ApiError(400, "Cannot create a conversation with yourself.");
  }

  // Verify the other participant exists
  const otherUser = await prisma.user.findUnique({
    where: { id: participantId },
    select: { id: true },
  });
  if (!otherUser) throw new ApiError(404, "User not found.");

  const { participant1Id, participant2Id } = normalizeParticipants(currentUserId, participantId);

  // Upsert — return existing conversation if one already exists
  const conversation = await prisma.conversation.upsert({
    where: {
      participant1Id_participant2Id: { participant1Id, participant2Id },
    },
    create: { participant1Id, participant2Id },
    update: {}, // no-op if it exists
    select: conversationSelect,
  });

  return enrichConversation(conversation, currentUserId);
};

// GET /messages/conversations/:conversationId/messages
const listMessages = async (conversationId, userId, { page = 1, limit = 50 }) => {
  // Verify the user is a participant
  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { participant1Id: true, participant2Id: true },
  });
  if (!conv) throw new ApiError(404, "Conversation not found.");
  if (conv.participant1Id !== userId && conv.participant2Id !== userId) {
    throw new ApiError(403, "You are not a participant in this conversation.");
  }

  const skip = (Number(page) - 1) * Number(limit);

  const [messages, total] = await Promise.all([
    prisma.message.findMany({
      where: { conversationId },
      select: messageSelect,
      orderBy: { createdAt: "asc" },
      skip,
      take: Number(limit),
    }),
    prisma.message.count({ where: { conversationId } }),
  ]);

  return {
    messages,
    pagination: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) },
  };
};

// POST /messages/conversations/:conversationId/messages
const sendMessage = async (conversationId, senderId, content) => {
  // Verify the user is a participant
  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { participant1Id: true, participant2Id: true },
  });
  if (!conv) throw new ApiError(404, "Conversation not found.");
  if (conv.participant1Id !== senderId && conv.participant2Id !== senderId) {
    throw new ApiError(403, "You are not a participant in this conversation.");
  }

  const [message] = await prisma.$transaction([
    prisma.message.create({
      data: { conversationId, senderId, content },
      select: messageSelect,
    }),
    prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    }),
  ]);

  return message;
};

// PATCH /messages/conversations/:conversationId/read
const markAsRead = async (conversationId, userId) => {
  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { participant1Id: true, participant2Id: true },
  });
  if (!conv) throw new ApiError(404, "Conversation not found.");
  if (conv.participant1Id !== userId && conv.participant2Id !== userId) {
    throw new ApiError(403, "You are not a participant in this conversation.");
  }

  const result = await prisma.message.updateMany({
    where: {
      conversationId,
      senderId: { not: userId },
      readAt: null,
    },
    data: { readAt: new Date() },
  });

  return { count: result.count };
};

module.exports = {
  listConversations,
  createConversation,
  listMessages,
  sendMessage,
  markAsRead,
};
