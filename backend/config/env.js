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

if (!['local', 'r2'].includes(STORAGE_DRIVER)) {
  throw new Error(`Unknown STORAGE_DRIVER "${STORAGE_DRIVER}" (expected "local" or "r2")`);
}

// R2 settings are required only when R2 is the driver
const r2Value = (name) => (STORAGE_DRIVER === 'r2' ? required(name) : process.env[name] || null);

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),

  mongo: {
    uri: required('MONGODB_URI'),
    // Explicit dbName prevents a truncated URI from falling back to 'test'
    dbName: process.env.MONGODB_DB_NAME || 'nutrifitai',
    maxPoolSize: parseInt(process.env.MONGODB_MAX_POOL_SIZE || '10', 10),
    // Indexes are created by migrations/ only
    autoIndex: false,
    // Optional restricted DB user for audit_logs inserts/reads
    auditUri: process.env.MONGODB_AUDIT_URI || null,
  },

  push: {
    // Required only when Expo enhanced push security is enabled
    expoAccessToken: process.env.EXPO_ACCESS_TOKEN || null,
  },

  analytics: {
    // Time zone used by dailyRollup.js
    rollupTimeZone: process.env.ANALYTICS_TIME_ZONE || 'Asia/Manila',
  },

  audit: {
    // HMAC key for details.emailHash / details.tokenHash
    hashSecret: secret('AUDIT_HASH_SECRET'),
  },

  storage: {
    // "local" or "r2"
    driver: STORAGE_DRIVER,

    r2: {
      accountId: r2Value('R2_ACCOUNT_ID'),
      bucket: r2Value('R2_BUCKET'),
      accessKeyId: r2Value('R2_ACCESS_KEY_ID'),
      secretAccessKey: r2Value('R2_SECRET_ACCESS_KEY'),
      urlTtlSeconds: parseInt(process.env.R2_URL_TTL_SECONDS || '3600', 10),
    },

    // Food scan image retention days (nutrition data remains on meal_items)
    scanRetentionDays: parseInt(process.env.SCAN_RETENTION_DAYS || '90', 10),
    maxUploadBytes: parseInt(process.env.MAX_UPLOAD_BYTES || String(8 * 1024 * 1024), 10),
  },

  jwt: {
    accessSecret: secret('JWT_ACCESS_SECRET'),
    refreshSecret: secret('JWT_REFRESH_SECRET'),
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',

    // Sliding refresh TTL (short = without "Remember Me")
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    refreshExpiresInShort: process.env.JWT_REFRESH_EXPIRES_IN_SHORT || '1d',

    // Absolute session ceiling fixed at login and carried across rotations
    sessionMax: process.env.JWT_SESSION_MAX || '30d',
    sessionMaxShort: process.env.JWT_SESSION_MAX_SHORT || '3d',
  },

  otp: {
    length: parseInt(process.env.OTP_LENGTH || '4', 10),
    ttlMinutes: parseInt(process.env.OTP_TTL_MINUTES || '10', 10),
    maxFailedAttempts: parseInt(process.env.OTP_MAX_FAILED_ATTEMPTS || '5', 10),
    resendCooldownSeconds: parseInt(process.env.OTP_RESEND_COOLDOWN_SECONDS || '60', 10),
  },

  // Unverified accounts expire after this window (users TTL index)
  unverifiedTtlHours: parseInt(process.env.UNVERIFIED_TTL_HOURS || '48', 10),

  resetToken: {
    secret: secret('RESET_TOKEN_SECRET'),
    expiresIn: process.env.RESET_TOKEN_EXPIRES_IN || '15m',
  },

  // TOTP two-factor auth secrets (kept separate from JWT secrets)
  mfa: {
    encryptionKey: secret('MFA_ENCRYPTION_KEY'),
    tokenSecret: secret('MFA_TOKEN_SECRET'),
    tokenExpiresIn: process.env.MFA_TOKEN_EXPIRES_IN || '5m',
    issuer: (process.env.MFA_ISSUER || 'NutriFitAI').trim(),
    maxFailedAttempts: parseInt(process.env.MFA_MAX_FAILED_ATTEMPTS || '5', 10),
    lockMinutes: parseInt(process.env.MFA_LOCK_MINUTES || '15', 10),
  },

  mail: {
    // 'smtp' or 'brevo'
    provider: (process.env.MAIL_PROVIDER || 'smtp').trim().toLowerCase(),

    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,

    brevoApiKey: process.env.BREVO_API_KEY,

    from: process.env.MAIL_FROM || 'NutriFitAI <no-reply@nutrifit.app>',
  },

  cookie: {
    domain: process.env.COOKIE_DOMAIN || undefined,
  },

  corsOrigin: process.env.CORS_ORIGIN || '*',

  // Public frontend URL for email links
  appUrl: (
    process.env.APP_PUBLIC_URL
    || (process.env.CORS_ORIGIN || '').split(',').map((s) => s.trim()).find((s) => s && s !== '*')
    || 'http://localhost:8081'
  ).replace(/\/+$/, ''),

  // Image moderation (disabled when OPENAI_API_KEY is unset).
  // >= blockScore rejects; flagged or >= reviewScore queues for admin review
  moderation: {
    enabled: Boolean(process.env.OPENAI_API_KEY) && process.env.MODERATION_ENABLED !== 'false',
    apiKey: process.env.OPENAI_API_KEY || null,
    baseUrl: (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, ''),
    model: process.env.MODERATION_MODEL || 'omni-moderation-latest',
    blockScore: parseFloat(process.env.MODERATION_BLOCK_SCORE || '0.9'),
    reviewScore: parseFloat(process.env.MODERATION_REVIEW_SCORE || '0.4'),
    logScores: process.env.MODERATION_LOG_SCORES === 'true',
    timeoutMs: parseInt(process.env.MODERATION_TIMEOUT_MS || '5000', 10),
    // Hard blocks within repeatWindowHours before flagging the account (0 disables)
    repeatBlocks: parseInt(process.env.MODERATION_REPEAT_BLOCKS || '3', 10),
    repeatWindowHours: parseInt(process.env.MODERATION_REPEAT_WINDOW_HOURS || '24', 10),
  },

  ai: {
    // Ordered provider failover chain for chat
    chain: (process.env.AI_CHAIN || 'ollama')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),

    // Ordered provider failover chain for recommendations (defaults to chat chain if empty)
    recChain: (process.env.AI_REC_CHAIN || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),

    historyTurns: parseInt(process.env.AI_HISTORY_TURNS || '10', 10),
    maxOutputTokens: parseInt(process.env.AI_MAX_OUTPUT_TOKENS || '500', 10),
    requestTimeoutMs: parseInt(process.env.AI_REQUEST_TIMEOUT_MS || '30000', 10),

    ollama: {
      baseUrl: process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434/v1',
      model: process.env.OLLAMA_MODEL || 'llama3.2:3b',
      timeoutMs: parseInt(process.env.OLLAMA_TIMEOUT_MS || '120000', 10),
      // Optional "user:password" for tunnel basic auth
      basicAuth: process.env.OLLAMA_BASIC_AUTH || null,
    },

    groq: {
      baseUrl: process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1',
      apiKey: process.env.GROQ_API_KEY || null,
      model: process.env.GROQ_MODEL || null,
      timeoutMs: parseInt(process.env.GROQ_TIMEOUT_MS || '30000', 10),
      maxOutputTokens: parseInt(process.env.GROQ_MAX_OUTPUT_TOKENS || '450', 10),
      transcribeModel: process.env.GROQ_TRANSCRIBE_MODEL || 'whisper-large-v3-turbo',
      transcribeLanguage: process.env.GROQ_TRANSCRIBE_LANGUAGE || '',
      transcribeTimeoutMs: parseInt(process.env.GROQ_TRANSCRIBE_TIMEOUT_MS || '30000', 10),
      transcribeMaxBytes: parseInt(process.env.GROQ_TRANSCRIBE_MAX_BYTES || String(4 * 1024 * 1024), 10),
    },

    cerebras: {
      baseUrl: process.env.CEREBRAS_BASE_URL || 'https://api.cerebras.ai/v1',
      apiKey: process.env.CEREBRAS_API_KEY || null,
      model: process.env.CEREBRAS_MODEL || null,
      timeoutMs: parseInt(process.env.CEREBRAS_TIMEOUT_MS || '30000', 10),
      maxOutputTokens: parseInt(process.env.CEREBRAS_MAX_OUTPUT_TOKENS || '450', 10),
    },

    // Cloudflare Workers AI (shares R2_ACCOUNT_ID)
    cloudflare: {
      baseUrl: process.env.R2_ACCOUNT_ID
        ? `https://api.cloudflare.com/client/v4/accounts/${process.env.R2_ACCOUNT_ID}/ai/v1`
        : null,
      apiKey: process.env.CLOUDFLARE_AI_API_TOKEN || null,
      model: process.env.CLOUDFLARE_AI_MODEL || '@cf/openai/gpt-oss-120b',
      timeoutMs: parseInt(process.env.CLOUDFLARE_AI_TIMEOUT_MS || '45000', 10),
      maxOutputTokens: parseInt(process.env.CLOUDFLARE_AI_MAX_OUTPUT_TOKENS || '1500', 10),
    },

    // Gemini embeddings for semantic coach search (falls back to keyword search when unset)
    embed: {
      baseUrl: process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai',
      apiKey: process.env.GEMINI_API_KEY || null,
      model: process.env.GEMINI_EMBED_MODEL || 'gemini-embedding-001',
      dims: parseInt(process.env.GEMINI_EMBED_DIMS || '768', 10),
      timeoutMs: parseInt(process.env.GEMINI_EMBED_TIMEOUT_MS || '2500', 10),
      minSimilarity: parseFloat(process.env.EMBED_MIN_SIMILARITY || '0.6'),
    },

    // Food detection service (FastAPI + YOLO)
    detect: {
      url: (process.env.AI_DETECT_URL || 'http://127.0.0.1:8000').replace(/\/+$/, ''),
      apiKey: process.env.AI_DETECT_API_KEY || '',
      timeoutMs: parseInt(process.env.AI_DETECT_TIMEOUT_MS || '30000', 10),
      minConfidence: parseFloat(process.env.AI_DETECT_MIN_CONFIDENCE || '0.5'),
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

  // Matches "expo.scheme" in app.json for native deep-link OAuth redirects
  appScheme: (process.env.APP_SCHEME || '').replace(/:\/\/$/, '').replace(/:$/, '').trim(),

  publicBaseUrl: (process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 4000}`).trim(),

  uploadsDir: require('path').resolve(__dirname, '..', process.env.UPLOADS_DIR || 'uploads'),
};