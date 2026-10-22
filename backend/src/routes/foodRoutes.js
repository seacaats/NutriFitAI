const { Router } = require('express');

const env = require('../../config/env');
const controller = require('../controllers/foodController');
const { validateBody, validateQuery, validateParams } = require('../middleware/validateMiddleware');
const { imageUpload } = require('../middleware/uploadMiddleware');
const { foodScanLimiter } = require('../middleware/rateLimitMiddleware');
const {
  scanIdSchema, scanPageSchema, logMealSchema, mealIdSchema, mealHistorySchema, nutritionGoalsSchema,
} = require('../validators/foodValidators');

const router = Router();

const scanUpload = imageUpload(env.storage.maxUploadBytes);

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
// Declared before /meals/:id so "history" is not parsed as an id
router.get(
  '/meals/history',
  validateQuery(mealHistorySchema),
  controller.getMealHistory
);
router.get('/goals', controller.getNutritionGoals);
router.patch('/goals', validateBody(nutritionGoalsSchema), controller.setNutritionGoals);

router.delete(
  '/meals/:id',
  validateParams(mealIdSchema),
  controller.removeMeal
);

module.exports = router;
