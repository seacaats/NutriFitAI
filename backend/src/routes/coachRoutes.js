const { Router } = require('express');

const controller = require('../controllers/coachController');
const { validateBody, validateQuery, validateParams } = require('../middleware/validateMiddleware');
const { requireAuth } = require('../middleware/authMiddleware');
const { aiChatLimiter } = require('../middleware/rateLimitMiddleware');
const { sendMessageSchema, subjectQuerySchema, conversationIdParamSchema } = require('../validators/coachValidators');

const router = Router();

// Ownership comes form req.userId (signed token) so no authorization to another user
router.post(
    '/chat', 
    requireAuth, 
    aiChatLimiter, 
    validateBody(sendMessageSchema), 
    controller.sendMessage
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