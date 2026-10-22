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
 * Role boundaries, enforced at the mount point so no route inside a group can
 * forget them:
 *  - /auth      public + session endpoints (any role)
 *  - /profile   any signed-in role (admins have a profile page too)
 *  - /notifications   any signed-in role (account notices reach admins too)
 *  - /steps, /coach, /workouts, /water, /food, /progress, /recommendations   USERS ONLY. Admin accounts get 403
 *  - /admin     admin only (adminRoutes re-reads the role from the database)
 *
 * The user-only check trusts the token's role claim rather than re-reading it:
 * a stale claim here can at most keep a just-promoted admin on user endpoints
 * until their 15-minute access token expires, which costs nothing, whereas a
 * lookup on every step/workout/coach call would cost a query each
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