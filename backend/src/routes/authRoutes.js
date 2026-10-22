const { Router } = require('express');

const controller = require('../controllers/auth');
const { validateBody } = require('../middleware/validateMiddleware');
const { requireAuth } = require('../middleware/authMiddleware');
const { allowOauthPopup } = require('../middleware/oauthHeadersMiddleware');

const { loginLimiter, mfaLoginLimiter, mfaManageLimiter, mfaResendLimiter, registerLimiter, otpRequestLimiter, otpVerifyLimiter, 
        refreshLimiter } = require('../middleware/rateLimitMiddleware');

const { registerSchema, mfaLoginSchema, mfaSetupSchema, mfaEnableSchema, mfaChangeSchema, mfaResendSchema, mfaEmailConfirmSchema, verifyRegistrationSchema, resendRegistrationOtpSchema, 
        loginSchema, forgotPasswordSchema, verifyPasswordResetSchema, 
        resetPasswordSchema, emailChangeRequestSchema, emailChangeConfirmSchema } = require('../validators/authValidators');

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
  '/login/mfa',
  mfaLoginLimiter,
  validateBody(mfaLoginSchema),
  controller.loginMfa
);

router.post(
  '/login/mfa/resend',
  mfaResendLimiter,
  validateBody(mfaResendSchema),
  controller.resendLoginMfa
);

// First sign-in of an admin: authenticator setup, from the challenge token
router.post(
  '/login/mfa/setup',
  mfaLoginLimiter,
  validateBody(mfaResendSchema),
  controller.loginMfaSetup
);

router.post(
  '/login/mfa/enable',
  mfaLoginLimiter,
  validateBody(mfaEnableSchema),
  controller.loginMfaEnable
);

// ----- Two-factor (Settings and onboarding), signed in -----
// Regular users: a code by email. Admins: recovery codes only, their
// authenticator is set up at sign-in (above) and can't be turned off
router.post('/mfa/email/request', requireAuth, mfaManageLimiter, validateBody(mfaSetupSchema), controller.mfaEmailRequest);
router.post('/mfa/email/confirm', requireAuth, mfaManageLimiter, validateBody(mfaEmailConfirmSchema), controller.mfaEmailConfirm);
router.post('/mfa/recovery-codes', requireAuth, mfaManageLimiter, validateBody(mfaChangeSchema), controller.mfaRecoveryCodes);

// ----- Change email (regular users), signed in -----
router.post('/email/request', requireAuth, otpRequestLimiter, validateBody(emailChangeRequestSchema), controller.requestEmailChange);
router.post('/email/confirm', requireAuth, otpVerifyLimiter, validateBody(emailChangeConfirmSchema), controller.confirmEmailChange);

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