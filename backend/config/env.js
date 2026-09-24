require('dotenv').config();

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}
const MIN_SECRET_LENGTH = 32;

function secret(name) {
  const value = required(name);
  if (process.env.NODE_ENV === 'production' && value.length < MIN_SECRET_LENGTH) {
    throw new Error(`${name} must be at least ${MIN_SECRET_LENGTH} characters in production`);
  }
  return value;
}

const STORAGE_DRIVER = (process.env.STORAGE_DRIVER || 'local').trim().toLowerCase();

if (!['local'].includes(STORAGE_DRIVER)) {
  throw new Error(`Unknown STORAGE_DRIVER "${STORAGE_DRIVER}" (expected "local")`);
}

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),

  mongo: {
    uri: required('MONGODB_URI'),

    // Explicitly pass database name to prevent truncated URI
    // from silently sending data to default test database
    dbName: process.env.MONGODB_DB_NAME || 'nutrifitai',

    // Reasonable pool size for a single Express process
    maxPoolSize: parseInt(process.env.MONGODB_MAX_POOL_SIZE || '10', 10),

    // Index creation is always a deploy-time action (.js scripts)
    autoIndex: false,

    // Chat message retention: 180 days (subject to change)
    chatMessageTtlSeconds: parseInt(
      process.env.CHAT_MESSAGE_TTL_SECONDS || String(180 * 24 * 60 * 60),
      10,
    ),
  },

  storage: {
    // Only local, but configurable if ever
    driver: STORAGE_DRIVER,


    // Food scan image retention: 90 days (subject to change) since
    // nutritional data is already logged on meal_items
    scanRetentionDays: parseInt(process.env.SCAN_RETENTION_DAYS || '90', 10),

    // 8 MB limit for uploads
    maxUploadBytes: parseInt(process.env.MAX_UPLOAD_BYTES || String(8 * 1024 * 1024), 10),
  },

  jwt: {
    accessSecret: secret('JWT_ACCESS_SECRET'),
    refreshSecret: secret('JWT_REFRESH_SECRET'),
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',

    // Short tokens are simply tokens that were 
    // created without the "Remember Me" toggle

    // Refresh tokens mint short-lived access tokens 
    // Resets every time token is used, keeps token refreshing indefinitely
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    refreshExpiresInShort: process.env.JWT_REFRESH_EXPIRES_IN_SHORT || '1d',

    // Computed once at initial login, never reset
    // Carried through every rotation to fix refresh token logic
    sessionMax: process.env.JWT_SESSION_MAX || '30d',
    sessionMaxShort: process.env.JWT_SESSION_MAX_SHORT || '3d',
  },

  otp: {
    length: parseInt(process.env.OTP_LENGTH || '4', 10),
    ttlMinutes: parseInt(process.env.OTP_TTL_MINUTES || '10', 10),
    maxFailedAttempts: parseInt(process.env.OTP_MAX_FAILED_ATTEMPTS || '5', 10),
    resendCooldownSeconds: parseInt(process.env.OTP_RESEND_COOLDOWN_SECONDS || '60', 10),
  },

  resetToken: {
    secret: secret('RESET_TOKEN_SECRET'),
    expiresIn: process.env.RESET_TOKEN_EXPIRES_IN || '15m',
  },

  mail: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.MAIL_FROM || 'NutriFit AI <no-reply@nutrifit.app>',
  },

  cookie: {
    domain: process.env.COOKIE_DOMAIN || undefined,
  },

  corsOrigin: process.env.CORS_ORIGIN || '*',

  ai: {

    // Set as an ordered failover chain for AI models used for the 
    // chatbot Set to be configurable later without restructuring
    // router.js should also be reconfigured if ever
    chain: (process.env.AI_CHAIN || 'ollama')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),

    // Conversation limit per user
    historyTurns: parseInt(process.env.AI_HISTORY_TURNS || '10', 10),

    // Reply length cap
    maxOutputTokens: parseInt(process.env.AI_MAX_OUTPUT_TOKENS || '500', 10),
    requestTimeoutMs: parseInt(process.env.AI_REQUEST_TIMEOUT_MS || '30000', 10),

    ollama: {
      // Ollama is always reached from this server
      baseUrl: process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434/v1',
      model: process.env.OLLAMA_MODEL || 'llama3.2:3b',
      timeoutMs: parseInt(process.env.OLLAMA_TIMEOUT_MS || '120000', 10),
    },
  },

  google: {
    clientId: required('GOOGLE_CLIENT_ID'),
    clientSecret: required('GOOGLE_CLIENT_SECRET'),
    callbackUrl: required('GOOGLE_CALLBACK_URL'),
  },

  oauthExchange: {
    secret: secret('OAUTH_EXCHANGE_SECRET'),
    expiresIn: '60s',
  },

  appRedirectUris: (process.env.APP_REDIRECT_URIS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  // Matches "expo.scheme" in app.json to accept native deep-link 
  // redirects, which can't just be added in APP_REDIRECT_URIS
  // during the OAuth sign-in process
  appScheme: (process.env.APP_SCHEME || '').replace(/:\/\/$/, '').replace(/:$/, '').trim(),

  // Turn stored relative file paths into readable URLs,
  // changing the environment for other devices to reach
  publicBaseUrl: (process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 4000}`).trim(),

  // Helper function for "uploads" folder to resolve consistently
  uploadsDir: require('path').resolve(__dirname, '..', process.env.UPLOADS_DIR || 'uploads'),
};