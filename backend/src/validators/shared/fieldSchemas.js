// Field rules used by more than one validator: names, password, body metrics and
// the profile choices. Mirrored by the frontend's formValidators.js
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
// periods. Must start with a letter. Mirrors NAME_RE in the frontend's formValidators.js
const NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M} '.-]*$/u;
const NAME_CHARSET_MESSAGE = "can only contain letters, spaces, hyphens (-), apostrophes (') and periods (.)";

// Longest first or last name. Mirrors NAME_MAX in the frontend's formValidators.js
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

module.exports = {
  SEXES,
  CUSTOM_OPTION_MAX,
  AGE_MIN,
  AGE_MAX,
  NAME_MAX,
  EMAIL_MAX,
  personName,
  passwordSchema,
  ageSchema,
  heightSchema,
  weightSchema,
  sexSchema,
  customOption,
  dietPreferences,
  healthConditions,
};