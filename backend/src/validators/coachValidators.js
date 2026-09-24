const { z } = require('zod');

// Max lenght per message bubble
const MAX_MESSAGE_LENGTH = 2000;

//chat_conversations._id is a Mongo ObjectId (24 hex chars)
const sendMessageSchema = z
  .object({
    message: z.string().trim().min(1, 'Message cannot be empty').max(MAX_MESSAGE_LENGTH),
    // Absent means "start a new conversation". Present and not owned by the
    // caller means 404 (ChatConversation.findOwned)
    conversationId: z
      .string()
      .regex(/^[0-9a-fA-F]{24}$/, 'Invalid conversationId')
      .optional(),
  })
  .strict();

module.exports = { sendMessageSchema, MAX_MESSAGE_LENGTH };