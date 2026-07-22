const express = require("express");
const router = express.Router();
const { protect } = require("../../middleware/auth.middleware");
const validate = require("../../middleware/validate.middleware");
const {
  listConversationsQuerySchema,
  createConversationSchema,
  listMessagesQuerySchema,
  sendMessageSchema,
  conversationIdParamSchema,
} = require("./messages.validation");
const {
  listConversations,
  createConversation,
  listMessages,
  sendMessage,
  markAsRead,
} = require("./messages.controller");

// GET  /api/v1/messages/conversations
router.get("/conversations", protect, validate(listConversationsQuerySchema, "query"), listConversations);

// POST /api/v1/messages/conversations
router.post("/conversations", protect, validate(createConversationSchema), createConversation);

// GET  /api/v1/messages/conversations/:conversationId/messages
router.get(
  "/conversations/:conversationId/messages",
  protect,
  validate(conversationIdParamSchema, "params"),
  validate(listMessagesQuerySchema, "query"),
  listMessages,
);

// POST /api/v1/messages/conversations/:conversationId/messages
router.post(
  "/conversations/:conversationId/messages",
  protect,
  validate(conversationIdParamSchema, "params"),
  validate(sendMessageSchema),
  sendMessage,
);

// PATCH /api/v1/messages/conversations/:conversationId/read
router.patch(
  "/conversations/:conversationId/read",
  protect,
  validate(conversationIdParamSchema, "params"),
  markAsRead,
);

module.exports = router;
