const { z } = require('zod');
const {
  EMAIL_MAX, personName, passwordSchema, ageSchema, heightSchema, weightSchema, sexSchema,
  customOption, dietPreferences, healthConditions,
} = require('./shared/fieldSchemas');

const registerSchema = z.object({
  firstName: personName('First name', { required: true }),
  // Consider mononyms
  lastName: personName('Last name').optional(),
  email: z.string().trim().email('Please enter a valid email address.').max(EMAIL_MAX, 'Email is too long.'),
  password: passwordSchema,
  // Required at sign-up (contextBuilder's under-18 rules depend on it)
  age: ageSchema,
  heightCm: heightSchema,
  weightKg: weightSchema,
  // The only optional detail besides last name, same as the form
  sex: sexSchema.optional(),
  // Step 2: all required, same as the form ("None"/"No Preference" are options)
  goal: customOption('Fitness goal'), // slug, label or custom; see goalNormalizer.js
  activityLevel: customOption('Activity level'),
  dietPreference: dietPreferences,
  healthConditions,

  termsAccepted: z.literal(true, {
    errorMap: () => ({ message: 'Please accept the Terms of Service and Privacy Policy.' }),
  }),
});

const otpCode = z.string().trim().min(4).max(8);

const verifyRegistrationSchema = z.object({
  email: z.string().trim().email().max(EMAIL_MAX),
  code: otpCode,
});

// Second step of sign-in. The code is the emailed code (OTP_LENGTH digits, 4 by default),
// a 6-digit app code, or a recovery code. They are told apart server side, so only the
// length is bounded here, from the shortest of them
const mfaLoginSchema = z.object({
  mfaToken: z.string().min(20).max(2000),
  code: z.string().trim().min(4, 'Enter the code we sent you.').max(24),
});

// Settings > two-factor. Changes need the password too
const mfaSetupSchema = z.object({
  password: z.string().min(1, 'Please enter your password.').max(200),
});

// Sign-in step: just the challenge token. Resending the emailed code (regular
// users) and starting the authenticator setup (admins, first sign-in)
const mfaResendSchema = z.object({
  mfaToken: z.string().min(20).max(2000),
});

// First sign-in of an admin: the first code from the app finishes the setup
const mfaEnableSchema = z.object({
  mfaToken: z.string().min(20).max(2000),
  code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code from your app.'),
});

// Confirm turning the emailed code (regular users) on or off

const mfaEmailConfirmSchema = z.object({
  code: z.string().trim().regex(/^\d{4,8}$/, 'Enter the code from your email.'),
  enable: z.boolean(),
});

const mfaChangeSchema = z.object({
  password: z.string().min(1, 'Please enter your password.').max(200),
  code: z.string().trim().min(6).max(24),
});

const resendRegistrationOtpSchema = z.object({
  email: z.string().trim().email().max(EMAIL_MAX),
});

// Deliberately loose on password: accounts created before the no-spaces /
// 64-char rules must still be able to sign in
const loginSchema = z.object({
  email: z.string().trim().email('Please enter a valid email address.').max(EMAIL_MAX),
  password: z.string().min(1, 'Please enter your password.').max(200),
  rememberMe: z.boolean().optional().default(false),
});

const forgotPasswordSchema = z.object({
  email: z.string().trim().email('Please enter a valid email address.').max(EMAIL_MAX),
});

const verifyPasswordResetSchema = z.object({
  email: z.string().trim().email().max(EMAIL_MAX),
  code: otpCode,
});

const resetPasswordSchema = z.object({
  resetToken: z.string().min(1),
  password: passwordSchema,
});

module.exports = {
  registerSchema,
  mfaLoginSchema,
  mfaSetupSchema,
  mfaEnableSchema,
  mfaChangeSchema,
  mfaResendSchema,
  mfaEmailConfirmSchema,
  verifyRegistrationSchema,
  resendRegistrationOtpSchema,
  loginSchema,
  forgotPasswordSchema,
  verifyPasswordResetSchema,
  resetPasswordSchema,
};