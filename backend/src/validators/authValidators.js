const { z } = require('zod');

const GENDERS = ['male', 'female', 'other', 'prefer-not-to-say'];

const ACTIVITY_LEVELS = ['sedentary', 'lightly-active', 'moderately-active', 'very-active'];

const nameSchema = z
  .object({
    firstName: z.string().trim().min(1).max(75).optional(),
    lastName: z.string().trim().max(75).optional(),
    fullName: z.string().trim().min(1).max(150).optional(),
  })
  .refine((v) => Boolean(v.firstName || v.fullName), {
    message: 'First name is required',
    path: ['firstName'],
  });

const registerSchema = z.object({
  firstName: z.string().trim().min(1).max(75),
  // Consider mononyms
  lastName: z.string().trim().max(75).optional(),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(72), // bcrypt maxxing
  age: z.number().int().min(10).max(120).optional(),
  heightCm: z.number().positive().max(300).optional(),
  weightKg: z.number().positive().max(500).optional(),
  gender: z.enum(GENDERS).optional(),
  goal: z.string().trim().min(1).max(50).optional(), // accepts machine value or label; normalized on goalNormalizer.js

  activityLevel: z.enum(ACTIVITY_LEVELS).optional(),
  dietPreference: z.string().trim().max(30).optional(),
  healthConditions: z.string().trim().max(2000).optional(),

  termsAccepted: z.literal(true, {
    errorMap: () => ({ message: 'Terms must be accepted to register' }),
  }),
})

const verifyRegistrationSchema = z.object({
  email: z.string().trim().email(),
  code: z.string().trim().min(4).max(8),
});

const resendRegistrationOtpSchema = z.object({
  email: z.string().trim().email(),
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
  rememberMe: z.boolean().optional().default(false),
});

const forgotPasswordSchema = z.object({
  email: z.string().trim().email(),
});

const verifyPasswordResetSchema = z.object({
  email: z.string().trim().email(),
  code: z.string().trim().min(4).max(8),
});

const resetPasswordSchema = z.object({
  resetToken: z.string().min(1),
  password: z.string().min(8).max(72),
});

module.exports = {
  GENDERS,
  ACTIVITY_LEVELS,
  nameSchema,
  registerSchema,
  verifyRegistrationSchema,
  resendRegistrationOtpSchema,
  loginSchema,
  forgotPasswordSchema,
  verifyPasswordResetSchema,
  resetPasswordSchema,
};