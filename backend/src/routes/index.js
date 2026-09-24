const { Router } = require('express');
const authRoutes = require('./authRoutes');
const profileRoutes = require('./profileRoutes');
const stepsRoutes = require('./stepsRoutes');
const coachRoutes = require('./coachRoutes');
const workoutRoutes = require('./workoutRoutes');
const adminRoutes = require('./adminRoutes');

const router = Router();

router.use('/auth', authRoutes);
router.use('/profile', profileRoutes);
router.use('/steps', stepsRoutes);
router.use('/coach', coachRoutes);
router.use('/workouts', workoutRoutes);

/* ------------------------------------ */
router.use('/admin', adminRoutes);

module.exports = router;