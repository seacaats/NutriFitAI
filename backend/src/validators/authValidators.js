const { z } = require('zod');
const {
  EMAIL_MAX, personName, passwordSchema, ageSchema, heightSchema, weightSchema, sexSchema,
  customOption, dietPreferences, healthConditions,
} = require('./shared/fieldSchemas');

const registerSchema = z.object({
  firstName: personName('First name', { required: true }),
  lastName: personName('Last name').optional(),
  email: z.string().trim().email('Please enter a valid email address.').max(EMAIL_MAX, 'Email is too long.'),
  password: passwordSchema,
  age: ageSchema,
  heightCm: heightSchema,
  weightKg: weightSchema,
  sex: sexSchema.optional(),
  goal: customOption('Fitness goal'),
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

// Accepts email OTP, 6-digit TOTP code, or recovery code
const mfaLoginSchema = z.object({
  mfaToken: z.string().min(20).max(2000),
  code: z.string().trim().min(4, 'Enter the code we sent you.').max(24),
});

const mfaSetupSchema = z.object({
  password: z.string().min(1, 'Please enter your password.').max(200),
});

const mfaResendSchema = z.object({
  mfaToken: z.string().min(20).max(2000),
});

const mfaEnableSchema = z.object({
  mfaToken: z.string().min(20).max(2000),
  code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code from your app.'),
});

const mfaEmailConfirmSchema = z.object({
  code: z.string().trim().regex(/^\d{4,8}$/, 'Enter the code from your email.'),
  enable: z.boolean(),
});

const emailChangeRequestSchema = z.object({
  newEmail: z.string().trim().toLowerCase().email('Please enter a valid email address.').max(EMAIL_MAX, 'Email is too long.'),
  password: z.string().min(1, 'Please enter your password.').max(200),
});

const emailChangeConfirmSchema = z.object({
  code: z.string().trim().regex(/^\d{4,8}$/, 'Enter the code from your email.'),
});

const mfaChangeSchema = z.object({
  password: z.string().min(1, 'Please enter your password.').max(200),
  code: z.string().trim().min(6).max(24),
});

const resendRegistrationOtpSchema = z.object({
  email: z.string().trim().email().max(EMAIL_MAX),
});

// Permissive password rules on login so legacy accounts remain accessible
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
  emailChangeRequestSchema,
  emailChangeConfirmSchema,
  mfaResendSchema,
  mfaEmailConfirmSchema,
  verifyRegistrationSchema,
  resendRegistrationOtpSchema,
  loginSchema,
  forgotPasswordSchema,
  verifyPasswordResetSchema,
  resetPasswordSchema,
};
