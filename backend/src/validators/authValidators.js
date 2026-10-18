const { z } = require('zod');

// Biological sex only, stored as profile.sex (renamed from gender in migration 002)
const SEXES = ['male', 'female'];

// Activity level, diet preference and goal accept a known option or custom
// text ("Other"). Matches the 50-char limits in models/user/User.js and migration 002
const CUSTOM_OPTION_MAX = 50;

// Diet is multi-select like health conditions: known options and custom text,
// comma-joined into one string, with the same 2,000-character bound
const DIET_PREFERENCES_MAX = 2000;

// Longest email address (RFC 5321 allows 254)
const EMAIL_MAX = 254;

const AGE_MIN = 13;
const AGE_MAX = 122;

const PASSWORD_MIN = 8;
// Not advertised to users (the UI only nudges toward 16). Kept under bcrypt's
// 72-byte input limit, past which extra characters are silently ignored
const PASSWORD_MAX = 64;

// Letters in any script (incl. accents), plus spaces, hyphens, apostrophes and
// periods. Must start with a letter. Mirrors NAME_RE in the frontend's authValidators.js
const NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M} '.-]*$/u;
const NAME_CHARSET_MESSAGE = "can only contain letters, spaces, hyphens (-), apostrophes (') and periods (.)";

// Longest first or last name. Mirrors NAME_MAX in the frontend's authValidators.js
const NAME_MAX = 75;

function personName(label, { required = false, max = NAME_MAX } = {}) {
  let schema = z.string().trim();
  if (required) schema = schema.min(1, `Please enter your ${label.toLowerCase()}.`);
  return schema
    .max(max, `${label} is too long.`)
    // Blank is left to `required`, so an empty field reports one message, not two
    .refine((v) => v === '' || NAME_RE.test(v), `${label} ${NAME_CHARSET_MESSAGE}.`);
}

const passwordSchema = z
  .string({ required_error: 'Please enter your password.' })
  .min(PASSWORD_MIN, `Password must be at least ${PASSWORD_MIN} characters.`)
  .max(PASSWORD_MAX, 'Password is too long.')
  // Only spaces gets its own message rather than "can't contain spaces"
  .superRefine((v, ctx) => {
    if (!/\S/.test(v)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Password can't be only spaces." });
    else if (/\s/.test(v)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Password can't contain spaces." });
  });

const ageSchema = z
  .number({ required_error: 'Please enter your age.', invalid_type_error: 'Age must be a number.' })
  .int('Age must be a whole number.')
  .min(AGE_MIN, `Age must be at least ${AGE_MIN}.`)
  .max(AGE_MAX, `Age must be ${AGE_MAX} or less.`);

const heightSchema = z
  .number({ required_error: 'Please enter your height.', invalid_type_error: 'Height must be a number.' })
  .positive('Height must be greater than 0.')
  .max(300, 'Height must be 300 or less.');

const weightSchema = z
  .number({ required_error: 'Please enter your weight.', invalid_type_error: 'Weight must be a number.' })
  .positive('Weight must be greater than 0.')
  .max(500, 'Weight must be 500 or less.');

const sexSchema = z.enum(SEXES, { errorMap: () => ({ message: 'Please choose a valid option for sex.' }) });

// A choice the form requires: missing and blank report the same message
const chosen = (message) => z.string({ required_error: message }).trim().min(1, message);

// Known slug or a short custom description
const customOption = (label) => chosen(`Please choose your ${label.toLowerCase()}.`)
  .max(CUSTOM_OPTION_MAX, `${label} is too long.`);
const dietPreferences = chosen('Please choose your diet preference.')
  .max(DIET_PREFERENCES_MAX, 'Diet preferences are too long.');
// "None" is one of the options, so an empty answer is never valid
const healthConditions = chosen('Please choose your health conditions, or None.')
  .max(2000, 'Health conditions are too long.');

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
  SEXES,
  CUSTOM_OPTION_MAX,
  dietPreferences,
  healthConditions,
  AGE_MIN,
  AGE_MAX,
  NAME_MAX,
  EMAIL_MAX,
  heightSchema,
  weightSchema,
  personName,
  passwordSchema,
  ageSchema,
  sexSchema,
  customOption,
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