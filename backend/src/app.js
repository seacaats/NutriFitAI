const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');

const env = require('../config/env');
const routes = require('./routes');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandlerMiddleware');
const { readTimeZone } = require('./middleware/authMiddleware');
const { getResolved } = require('./utils/network/publicUrl');

const app = express();

// Trust single reverse proxy so rate limits and logs use client IP
app.set('trust proxy', 1);

const LAN = /^http:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/;

const allowed = env.corsOrigin.split(',').map((s) => s.trim()).filter(Boolean);

app.use(
  helmet({
    // Handled explicitly in oauthHeadersMiddleware
    crossOriginOpenerPolicy: false,
  }),
);
app.use(cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true); // Mobile apps send no origin
    if (allowed.includes(origin)) return cb(null, true);
    if (env.nodeEnv !== 'production' && LAN.test(origin)) return cb(null, true);
    if (env.nodeEnv !== 'production' && origin.endsWith('.ngrok-free.dev')) {
      return cb(null, true);
    }
    cb(new Error(`Origin not allowed: ${origin}`));
  },
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(readTimeZone);


// Serve local uploads with immutable caching (content-hashed filenames)
if (env.storage.driver === 'local') app.use(
  '/uploads',
  express.static(env.uploadsDir, {
    maxAge: '30d',
    immutable: true,
    index: false,
    dotfiles: 'deny',

    setHeaders: (res) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    },
  }),
);


// Health check: production exposes liveness only; dev includes local network info
app.get('/health', (req, res) => {
  if (env.nodeEnv === 'production') {
    return res.json({ success: true, data: { status: 'ok' } });
  }
  const reachable = getResolved();
  return res.json({
    success: true,
    data: {
      status: 'ok',
      baseUrl: reachable.baseUrl,
      source: reachable.source,
      lanIp: reachable.lanIp,
      ngrokUrl: reachable.ngrokUrl,
      seenHost: req.headers.host || null,
    },
  });
});

app.use('/api', routes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;