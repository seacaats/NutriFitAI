const { z } = require('zod');

// Expo's own format, so a random string can't be stored as a device
const expoToken = z.string().trim().regex(/^Expo(nent)?PushToken\[[^\]]{10,180}\]$/, 'Not an Expo push token');

const registerTokenSchema = z.object({
  token: expoToken,
  platform: z.enum(['ios', 'android']),
}).strict();

const revokeTokenSchema = z.object({ token: expoToken }).strict();

// Inbox paging: rows older than `before`, newest first
const inboxQuerySchema = z.object({
  before: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
}).strict();

// One or more ids, or none for "mark all read"
const markReadSchema = z.object({
  ids: z.array(z.string().regex(/^[0-9a-f]{24}$/i)).max(100).optional(),
}).strict();

module.exports = { registerTokenSchema, revokeTokenSchema, inboxQuerySchema, markReadSchema };