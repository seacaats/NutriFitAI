const { Router } = require('express');

const controller = require('../controllers/progressController');
const { validateQuery } = require('../middleware/validateMiddleware');
const { requireAuth } = require('../middleware/authMiddleware');
const { progressQuerySchema } = require('../validators/progressValidators');

const router = Router();

// Dashboard data. Before '/' only for reading order; the paths don't overlap
router.get(
    '/today', 
    requireAuth, 
    controller.getToday
);
router.get(
    '/', 
    requireAuth, 
    validateQuery(progressQuerySchema), 
    controller.getProgress
);

module.exports = router;