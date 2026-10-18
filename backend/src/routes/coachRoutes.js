const { Router } = require('express');

const env = require('../../config/env');
const controller = require('../controllers/coachController');
const { validateBody, validateQuery, validateParams } = require('../middleware/validateMiddleware');
const { memoryUpload } = require('../middleware/uploadMiddleware');
const { aiChatLimiter, voiceTranscribeLimiter } = require('../middleware/rateLimitMiddleware');
const { sendMessageSchema, subjectQuerySchema, conversationIdParamSchema } = require('../validators/coachValidators');

const router = Router();

// One short clip, held in memory and size-capped before it is buffered
const voiceUpload = memoryUpload(env.ai.groq.transcribeMaxBytes);

// Ownership comes form req.userId (signed token) so no authorization to another user
router.post(
    '/chat', 
    aiChatLimiter, 
    validateBody(sendMessageSchema), 
    controller.sendMessage
);

router.post(
    '/transcribe',
    voiceTranscribeLimiter,
    voiceUpload.single('audio'),
    controller.transcribe
);

router.get(
    '/conversations', 
    controller.listConversations
);
router.get(
    '/conversations/:id', 
    validateParams(conversationIdParamSchema),
    controller.getConversation
);
router.delete(
    '/conversations',
    controller.deleteAllConversations
);
router.delete(
    '/conversations/:id', 
    validateParams(conversationIdParamSchema),
    controller.deleteConversation
);

router.get(
    '/subject',
    validateQuery(subjectQuerySchema),
    controller.getSubject
);

router.get(
    '/health', 
    controller.getHealth);

module.exports = router;