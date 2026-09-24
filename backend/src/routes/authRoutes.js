const { Router } = require('express');

const controller = require('../controllers/authController');
const { validateBody } = require('../middleware/validateMiddleware');
const { requireAuth } = require('../middleware/authMiddleware');
const { allowOauthPopup } = require('../middleware/oauthheadersMiddleware');

const { loginLimiter, registerLimiter, otpRequestLimiter, otpVerifyLimiter, 
        refreshLimiter } = require('../middleware/rateLimitMiddleware');

const { registerSchema, verifyRegistrationSchema, resendRegistrationOtpSchema, 
        loginSchema, forgotPasswordSchema, verifyPasswordResetSchema, 
        resetPasswordSchema } = require('../validators/authValidators');

const router = Router();

// ----- Registration -----
router.post(
  '/register', 
  registerLimiter, 
  validateBody(registerSchema), 
  controller.register
);
router.post(
  '/verify-registration',
  otpVerifyLimiter,
  validateBody(verifyRegistrationSchema),
  controller.verifyRegistration,
);
router.post(
  '/resend-registration-otp',
  otpRequestLimiter,
  validateBody(resendRegistrationOtpSchema),
  controller.resendRegistrationOtp,
);

// ----- Login/Sign in -----
router.post(
  '/login', 
  loginLimiter, 
  validateBody(loginSchema), 
  controller.login
);
router.post(
  '/refresh', 
  refreshLimiter, 
  controller.refresh
);
router.post(
  '/logout', 
  controller.logout
);
router.get(
  '/me', 
  requireAuth, 
  controller.me
);

// ----- Google OAuth -----
// allowOauthPopup pins Cross-Origin-Opener-Policy: unsafe-none
// to explicitly avoid the pop-up window closing when leaving the main window
router.get(
  '/google', 
  allowOauthPopup, 
  controller.googleAuthStart
);
router.get(
  '/google/callback', 
  allowOauthPopup, 
  controller.googleAuthCallback
);
router.post(
  '/google/exchange', 
  loginLimiter, 
  controller.googleExchange
);

// ----- Forgot/Reset password -----
router.post(
  '/forgot-password',
  otpRequestLimiter,
  validateBody(forgotPasswordSchema),
  controller.forgotPassword,
);
router.post(
  '/verify-password-reset',
  otpVerifyLimiter,
  validateBody(verifyPasswordResetSchema),
  controller.verifyPasswordReset,
);
router.post(
  '/reset-password', 
  validateBody(resetPasswordSchema), 
  controller.resetPassword
);

module.exports = router;