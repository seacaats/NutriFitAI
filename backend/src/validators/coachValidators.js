const { z } = require('zod');

// Max lenght per message bubble
const MAX_MESSAGE_LENGTH = 2000;

//chat_conversations._id is a Mongo ObjectId (24 hex chars)
const objectId = (label) => z.string().regex(/^[0-9a-fA-F]{24}$/, `Invalid ${label}`);

const sendMessageSchema = z
  .object({
    message: z.string().trim().min(1, 'Please type a message.').max(MAX_MESSAGE_LENGTH),
    // Absent means "start a new conversation". Present and not owned by the
    // caller means 404 (ChatConversation.findOwned)
    conversationId: objectId('conversationId').optional(),
    // "Ask AI Coach" from a scan or a logged meal. Only when starting a
    // thread: an existing one already carries its ref
    scanId: objectId('scanId').optional(),
    mealId: objectId('mealId').optional(),
  })
  .strict()
  .refine((b) => !(b.scanId && b.mealId), { message: 'Ask about a scan or a meal, not both' })
  .refine((b) => !(b.conversationId && (b.scanId || b.mealId)), {
    message: 'A scan or meal can only be attached when starting a conversation',
  });

// GET /coach/subject: the chip shown before the first message is sent
const subjectQuerySchema = z
  .object({
    scanId: objectId('scanId').optional(),
    mealId: objectId('mealId').optional(),
  })
  .strict()
  .refine((q) => Boolean(q.scanId) !== Boolean(q.mealId), { message: 'Pass either scanId or mealId' });

// GET/DELETE /conversations/:id. Malformed ids are caught here, not as a
// generic "not found"
const conversationIdParamSchema = z.object({ id: objectId('conversation id') }).strict();

module.exports = { sendMessageSchema, subjectQuerySchema, conversationIdParamSchema, MAX_MESSAGE_LENGTH };