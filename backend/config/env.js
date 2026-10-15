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

    // Explicitly pass database name to prevent truncated URI
    // from silently sending data to default test database
    dbName: process.env.MONGODB_DB_NAME || 'nutrifitai',

    // Reasonable pool size for a single Express process
    maxPoolSize: parseInt(process.env.MONGODB_MAX_POOL_SIZE || '10', 10),

    // Indexes are created by migrations/ only, never on boot
    autoIndex: false,

    // Optional. A database user that can only insert into and read audit_logs.
    // When set, audit writes go through it instead of the main connection
    auditUri: process.env.MONGODB_AUDIT_URI || null,
  },

  push: {
    // Optional. Only needed when "enhanced push security" is on in the Expo project
    expoAccessToken: process.env.EXPO_ACCESS_TOKEN || null,
  },

  audit: {
    // HMAC key for details.emailHash / details.tokenHash. Changing it breaks
    // matching against older rows, not the rows themselves
    hashSecret: secret('AUDIT_HASH_SECRET'),
  },

  storage: {
    // "local" (uploads/ folder) or "r2" (Cloudflare R2, utils/storage/r2Store.js)
    driver: STORAGE_DRIVER,

    // From the R2 dashboard: the account id, a bucket, and an API token's
    // S3 access key pair (Object Read & Write on that bucket only)
    r2: {
      accountId: r2Value('R2_ACCOUNT_ID'),
      bucket: r2Value('R2_BUCKET'),
      accessKeyId: r2Value('R2_ACCESS_KEY_ID'),
      secretAccessKey: r2Value('R2_SECRET_ACCESS_KEY'),
      // How long a signed photo link works. The app refetches profiles and
      // scans well within this
      urlTtlSeconds: parseInt(process.env.R2_URL_TTL_SECONDS || '3600', 10),
    },


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

  // Unverified accounts are deleted this long after sign-up (users TTL index)
  unverifiedTtlHours: parseInt(process.env.UNVERIFIED_TTL_HOURS || '48', 10),

  resetToken: {
    secret: secret('RESET_TOKEN_SECRET'),
    expiresIn: process.env.RESET_TOKEN_EXPIRES_IN || '15m',
  },

  mail: {
    // 'smtp' or 'brevo'. 
    provider: (process.env.MAIL_PROVIDER || 'smtp').trim().toLowerCase(),

    // smtp
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,

    // brevo
    brevoApiKey: process.env.BREVO_API_KEY,

    from: process.env.MAIL_FROM || 'NutriFitAI <no-reply@nutrifit.app>',
  },

  cookie: {
    domain: process.env.COOKIE_DOMAIN || undefined,
  },

  corsOrigin: process.env.CORS_ORIGIN || '*',

  // Frontend address used for links in emails (login, reset password).
  // Falls back to the first CORS origin, then the Expo web dev server
  appUrl: (
    process.env.APP_PUBLIC_URL
    || (process.env.CORS_ORIGIN || '').split(',').map((s) => s.trim()).find((s) => s && s !== '*')
    || 'http://localhost:8081'
  ).replace(/\/+$/, ''),

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
      // Local (http://127.0.0.1:11434/v1), or your own PC through an ngrok
      // tunnel (https://<domain>/v1), see scripts/ollama-tunnel.example.yml
      baseUrl: process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434/v1',
      model: process.env.OLLAMA_MODEL || 'llama3.2:3b',
      timeoutMs: parseInt(process.env.OLLAMA_TIMEOUT_MS || '120000', 10),
      // "user:password" from the tunnel's basic-auth policy. Ollama itself
      // has no login, so a tunnel without this is open to anyone
      basicAuth: process.env.OLLAMA_BASIC_AUTH || null,
    },

    // Groq's free tier, the fallback while the PC is off
    // (AI_CHAIN=ollama,groq). Key and model id from console.groq.com.
    // Free tiers rate-limit; a 429 cools it down (router.js)
    groq: {
      baseUrl: process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1',
      apiKey: process.env.GROQ_API_KEY || null,
      model: process.env.GROQ_MODEL || null,
      timeoutMs: parseInt(process.env.GROQ_TIMEOUT_MS || '30000', 10),
      // A ceiling under AI_MAX_OUTPUT_TOKENS: the length rule in
      // contextBuilder keeps replies short, this stops a runaway one
      maxOutputTokens: parseInt(process.env.GROQ_MAX_OUTPUT_TOKENS || '450', 10),
      // Voice input: Whisper turns a short recording into text (coachController.transcribe)
      transcribeModel: process.env.GROQ_TRANSCRIBE_MODEL || 'whisper-large-v3-turbo',
      // Empty = Whisper detects the language. The voice picker sends its own choice, this is only the fallback
      transcribeLanguage: process.env.GROQ_TRANSCRIBE_LANGUAGE || '',
      transcribeTimeoutMs: parseInt(process.env.GROQ_TRANSCRIBE_TIMEOUT_MS || '30000', 10),
      // A 60 s clip is far under this; Groq itself accepts up to 25 MB
      transcribeMaxBytes: parseInt(process.env.GROQ_TRANSCRIBE_MAX_BYTES || String(4 * 1024 * 1024), 10),
    },

    // Cerebras' free tier, the next fallback after Groq
    // (AI_CHAIN=ollama,groq,cerebras). Key and model id from cloud.cerebras.ai
    cerebras: {
      baseUrl: process.env.CEREBRAS_BASE_URL || 'https://api.cerebras.ai/v1',
      apiKey: process.env.CEREBRAS_API_KEY || null,
      model: process.env.CEREBRAS_MODEL || null,
      timeoutMs: parseInt(process.env.CEREBRAS_TIMEOUT_MS || '30000', 10),
      maxOutputTokens: parseInt(process.env.CEREBRAS_MAX_OUTPUT_TOKENS || '450', 10),
    },

    // Food detection server (FastAPI + YOLO). Only this server calls it,
    // the app never does, so the key never leaves the backend
    detect: {
      url: (process.env.AI_DETECT_URL || 'http://127.0.0.1:8000').replace(/\/+$/, ''),
      apiKey: process.env.AI_DETECT_API_KEY || '',
      // First request after the model server boots can be slow
      timeoutMs: parseInt(process.env.AI_DETECT_TIMEOUT_MS || '30000', 10),
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