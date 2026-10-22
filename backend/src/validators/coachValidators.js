const { z } = require('zod');

const MAX_MESSAGE_LENGTH = 2000;

const objectId = (label) => z.string().regex(/^[0-9a-fA-F]{24}$/, `Invalid ${label}`);

const sendMessageSchema = z
  .object({
    message: z.string().trim().min(1, 'Please type a message.').max(MAX_MESSAGE_LENGTH),
    conversationId: objectId('conversationId').optional(),
    scanId: objectId('scanId').optional(),
    mealId: objectId('mealId').optional(),
  })
  .strict()
  .refine((b) => !(b.scanId && b.mealId), { message: 'Ask about a scan or a meal, not both' })
  .refine((b) => !(b.conversationId && (b.scanId || b.mealId)), {
    message: 'A scan or meal can only be attached when starting a conversation',
  });

const subjectQuerySchema = z
  .object({
    scanId: objectId('scanId').optional(),
    mealId: objectId('mealId').optional(),
  })
  .strict()
  .refine((q) => Boolean(q.scanId) !== Boolean(q.mealId), { message: 'Pass either scanId or mealId' });

const conversationIdParamSchema = z.object({ id: objectId('conversation id') }).strict();

const recommendationIdParamSchema = z.object({ id: objectId('recommendation id') }).strict();

const recommendationUpdateSchema = z
  .object({
    status: z.enum(['dismissed', 'done']).optional(),
    feedback: z.enum(['up', 'down']).optional(),
  })
  .strict()
  .refine((b) => b.status || b.feedback, { message: 'There are no changes to save.' });

module.exports = { recommendationIdParamSchema, recommendationUpdateSchema, sendMessageSchema, subjectQuerySchema, conversationIdParamSchema, MAX_MESSAGE_LENGTH };
