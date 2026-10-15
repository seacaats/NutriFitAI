const { Router } = require('express');
const multer = require('multer');

const env = require('../../config/env');
const controller = require('../controllers/coachController');
const { validateBody, validateQuery, validateParams } = require('../middleware/validateMiddleware');
const { requireAuth } = require('../middleware/authMiddleware');
const { aiChatLimiter, voiceTranscribeLimiter } = require('../middleware/rateLimitMiddleware');
const { sendMessageSchema, subjectQuerySchema, conversationIdParamSchema } = require('../validators/coachValidators');

const router = Router();

// One short clip, held in memory and size-capped before it is buffered
const voiceUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: env.ai.groq.transcribeMaxBytes, files: 1 },
});

// Ownership comes form req.userId (signed token) so no authorization to another user
router.post(
    '/chat', 
    requireAuth, 
    aiChatLimiter, 
    validateBody(sendMessageSchema), 
    controller.sendMessage
);

router.post(
    '/transcribe',
    requireAuth,
    voiceTranscribeLimiter,
    voiceUpload.single('audio'),
    controller.transcribe
);

router.get(
    '/conversations', 
    requireAuth, 
    controller.listConversations
);
router.get(
    '/conversations/:id', 
    requireAuth, 
    validateParams(conversationIdParamSchema),
    controller.getConversation
);
router.delete(
    '/conversations',
    requireAuth,
    controller.deleteAllConversations
);
router.delete(
    '/conversations/:id', 
    requireAuth, 
    validateParams(conversationIdParamSchema),
    controller.deleteConversation
);

router.get(
    '/subject',
    requireAuth,
    validateQuery(subjectQuerySchema),
    controller.getSubject
);

router.get(
    '/health', 
    requireAuth, 
    controller.getHealth);

module.exports = router;