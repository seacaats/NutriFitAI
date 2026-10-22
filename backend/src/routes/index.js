const { Router } = require('express');
const authRoutes = require('./authRoutes');
const profileRoutes = require('./profileRoutes');
const stepsRoutes = require('./stepsRoutes');
const coachRoutes = require('./coachRoutes');
const workoutRoutes = require('./workoutRoutes');
const waterRoutes = require('./waterRoutes');
const foodRoutes = require('./foodRoutes');
const progressRoutes = require('./progressRoutes');
const adminRoutes = require('./adminRoutes');
const notificationRoutes = require('./notificationRoutes');
const recommendationRoutes = require('./recommendationRoutes');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');

const router = Router();

/**
 * Route role boundaries:
 *  - /auth: public + session endpoints
 *  - /profile, /notifications: any authenticated role
 *  - /steps, /coach, /workouts, /water, /food, /progress, /recommendations: 'user' role only
 *  - /admin: 'admin' role only (re-verified against DB in adminRoutes)
 */
const userOnly = [requireAuth, requireRole('user')];

router.use('/auth', authRoutes);
router.use('/profile', requireAuth, profileRoutes);
router.use('/notifications', requireAuth, notificationRoutes);
router.use('/steps', ...userOnly, stepsRoutes);
router.use('/coach', ...userOnly, coachRoutes);
router.use('/workouts', ...userOnly, workoutRoutes);
router.use('/water', ...userOnly, waterRoutes);
router.use('/food', ...userOnly, foodRoutes);
router.use('/progress', ...userOnly, progressRoutes);
router.use('/recommendations', ...userOnly, recommendationRoutes);

/* ------------------------------------ */
router.use('/admin', adminRoutes);

module.exports = router;