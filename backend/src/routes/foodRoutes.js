const { Router } = require('express');

const env = require('../../config/env');
const controller = require('../controllers/foodController');
const { validateBody, validateQuery, validateParams } = require('../middleware/validateMiddleware');
const { memoryUpload } = require('../middleware/uploadMiddleware');
const { foodScanLimiter } = require('../middleware/rateLimitMiddleware');
const {
  scanIdSchema, scanPageSchema, logMealSchema, mealIdSchema, mealHistorySchema, nutritionGoalsSchema,
} = require('../validators/foodValidators');

const router = Router();

// Held in memory, then written through the storage adapter. Same cap as the
// adapter itself (MAX_UPLOAD_BYTES) so a big file is refused before buffering
const scanUpload = memoryUpload(env.storage.maxUploadBytes);

router.post(
  '/scans',
  foodScanLimiter,
  scanUpload.single('image'),
  controller.createScan
);
router.get(
  '/scans',
  validateQuery(scanPageSchema),
  controller.listScans
);
router.get(
  '/scans/:id',
  validateParams(scanIdSchema),
  controller.getScan
);
router.delete(
  '/scans/:id',
  validateParams(scanIdSchema),
  controller.removeScan
);

router.post(
  '/meals',
  validateBody(logMealSchema),
  controller.logMeal
);
// /history is declared before /:id so it never parses as an id
router.get(
  '/meals/history',
  validateQuery(mealHistorySchema),
  controller.getMealHistory
);
// Daily calorie and macro targets, read and set on the Food Scanner
router.get('/goals', controller.getNutritionGoals);
router.patch('/goals', validateBody(nutritionGoalsSchema), controller.setNutritionGoals);

router.delete(
  '/meals/:id',
  validateParams(mealIdSchema),
  controller.removeMeal
);

module.exports = router;