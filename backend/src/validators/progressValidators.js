const { z } = require('zod');

const progressQuerySchema = z.object({
  period: z.enum(['week', 'month', '3m', 'year'], {
    errorMap: () => ({ message: 'Pick week, month, 3m or year.' }),
  }).optional(),
  offset: z.coerce.number().int().min(0).max(520).optional(),
}).strict();

module.exports = { progressQuerySchema };
