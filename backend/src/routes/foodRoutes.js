const { Router } = require('express');
const multer = require('multer');

const env = require('../../config/env');
const controller = require('../controllers/foodController');
const { validateBody, validateQuery, validateParams } = require('../middleware/validateMiddleware');
const { requireAuth } = require('../middleware/authMiddleware');
const { foodScanLimiter } = require('../middleware/rateLimitMiddleware');
const {
  scanIdSchema, scanPageSchema, logMealSchema, mealIdSchema, mealHistorySchema, nutritionGoalsSchema,
} = require('../validators/foodValidators');

const router = Router();

// Held in memory, then written through the storage adapter. Same cap as the
// adapter itself (MAX_UPLOAD_BYTES) so a big file is refused before buffering
const scanUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.storage.maxUploadBytes, files: 1 },
});

router.post(
  '/scans',
  requireAuth,
  foodScanLimiter,
  scanUpload.single('image'),
  controller.createScan
);
router.get(
  '/scans',
  requireAuth,
  validateQuery(scanPageSchema),
  controller.listScans
);
router.get(
  '/scans/:id',
  requireAuth,
  validateParams(scanIdSchema),
  controller.getScan
);
router.delete(
  '/scans/:id',
  requireAuth,
  validateParams(scanIdSchema),
  controller.removeScan
);

router.post(
  '/meals',
  requireAuth,
  validateBody(logMealSchema),
  controller.logMeal
);
// /history is declared before /:id so it never parses as an id
router.get(
  '/meals/history',
  requireAuth,
  validateQuery(mealHistorySchema),
  controller.getMealHistory
);
// Daily calorie and macro targets, read and set on the Food Scanner
router.get('/goals', requireAuth, controller.getNutritionGoals);
router.patch('/goals', requireAuth, validateBody(nutritionGoalsSchema), controller.setNutritionGoals);

router.delete(
  '/meals/:id',
  requireAuth,
  validateParams(mealIdSchema),
  controller.removeMeal
);

module.exports = router;