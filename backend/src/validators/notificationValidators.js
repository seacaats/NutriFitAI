const { z } = require('zod');

const expoToken = z.string().trim().regex(/^Expo(nent)?PushToken\[[^\]]{10,180}\]$/, 'Not an Expo push token');

const registerTokenSchema = z.object({
  token: expoToken,
  platform: z.enum(['ios', 'android']),
}).strict();

const revokeTokenSchema = z.object({ token: expoToken }).strict();

const inboxQuerySchema = z.object({
  before: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
}).strict();

const markReadSchema = z.object({
  ids: z.array(z.string().regex(/^[0-9a-f]{24}$/i)).max(100).optional(),
}).strict();

module.exports = { registerTokenSchema, revokeTokenSchema, inboxQuerySchema, markReadSchema };
