const path = require('path');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');

const env = require('../config/env');
const routes = require('./routes');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandlerMiddleware');

const app = express();

const LAN = /^http:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/;

const allowed = env.corsOrigin.split(',').map((s) => s.trim()).filter(Boolean);

app.use(
  helmet({
    // Overriden in oautheadersMiddleware, where explicit
    // configuration is made for the OAuth authentication process
    crossOriginOpenerPolicy: false,
  }),
);
app.use(cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true);           // Mobile apps send no origin
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


// Locally stored avatars. Different files have different 
// hashes, avatars aren't overwritten and have set cache.
// If-None-Match triggers after 30 days to fetch avatar from server.
app.use(
  '/uploads',
  express.static(env.uploadsDir, {
    maxAge: '30d',
    immutable: true,
    index: false,
    dotfiles: 'deny',

    setHeaders: (res) => {
      // Block any potential scripts uploaded such as .js file
      res.setHeader('X-Content-Type-Options', 'nosniff');
      // Load avatars regardless of frontend domain
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    },
  }),
);


// Fetches server health, with details such as LAN address and tunnel if any.
app.get('/health', (req, res) => {
  const { getResolved } = require('./utils/publicUrl');
  const reachable = getResolved();
  return res.json({
    success: true,
    data: {
      status: 'ok',
      baseUrl: reachable.baseUrl,
      source: reachable.source,
      lanIp: reachable.lanIp,
      ngrokUrl: reachable.ngrokUrl,
      // Echoed back so a phone can confirm which host it actually resolved.
      seenHost: req.headers.host || null,
    },
  });
});

app.use('/api', routes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;