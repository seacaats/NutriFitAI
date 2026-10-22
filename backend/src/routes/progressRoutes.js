const { Router } = require('express');

const controller = require('../controllers/progressController');
const { validateQuery } = require('../middleware/validateMiddleware');
const { progressQuerySchema } = require('../validators/progressValidators');

const router = Router();

router.get(
    '/today', 
    controller.getToday
);
router.get(
    '/', 
    validateQuery(progressQuerySchema), 
    controller.getProgress
);

module.exports = router;