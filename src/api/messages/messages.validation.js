const Joi = require("joi");

// ─── Conversations ─────────────────────────────────────────────────────────

// GET /api/v1/messages/conversations
const listConversationsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(50).default(20),
});

// POST /api/v1/messages/conversations (start a new conversation)
const createConversationSchema = Joi.object({
  participantId: Joi.string().uuid().required(),
});

// ─── Messages ──────────────────────────────────────────────────────────────

// GET /api/v1/messages/conversations/:conversationId/messages?page=&limit=
const listMessagesQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(50),
});

// POST /api/v1/messages/conversations/:conversationId/messages
const sendMessageSchema = Joi.object({
  content: Joi.string().trim().min(1).max(5000).required(),
});

// ─── Params ────────────────────────────────────────────────────────────────

const conversationIdParamSchema = Joi.object({
  conversationId: Joi.string().uuid().required(),
});

module.exports = {
  listConversationsQuerySchema,
  createConversationSchema,
  listMessagesQuerySchema,
  sendMessageSchema,
  conversationIdParamSchema,
};
