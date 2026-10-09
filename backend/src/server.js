const app = require('./app');
const env = require('../config/env');
const { getLanIp } = require('./utils/network/lanIp');
const { resolvePublicBaseUrl, setResolved } = require('./utils/network/publicUrl');
const { connect, close } = require('../config/mongo');
const FoodScan = require('./models/food/FoodScan');
const storage = require('./utils/storage');
const AuditLog = require('./models/audit-logs/AuditLog');
const { SEVERITIES } = require('./utils/audit-logs/actions');
const { logSystemAction } = require('./utils/audit-logs/auditLogger');
const { runReminders, RUN_EVERY_MS: REMINDERS_EVERY_MS } = require('./services/notifications/reminders');
const { verifyMailer } = require('./services/mailer');

// Force mongodb connection before listening to requests through mongo.js
// which sets bufferCommands:false which automatically rejects them
let server;
let purgeTimer;
let chainTimer;
let reminderTimer;

// Scan photos past SCAN_RETENTION_DAYS are deleted; the scan document and
// the nutrition snapshotted on meals stay. Runs on boot, then every 6 hours.
// Batched so one run never holds a large query open on the free tier
const PURGE_EVERY_MS = 6 * 60 * 60 * 1000;

async function purgeScanImages() {
  try {
    let released;
    let purgedCount = 0;
    do {
      released = await FoodScan.purgeExpiredImages(env.storage.scanRetentionDays);
      for (const scan of released) {
        await storage.remove(scan.storageKey);
      }
      purgedCount += released.length;
    } while (released.length);

    // One row per run that purged something, not one per image. The scans
    // themselves already record which ones lost their photo
    if (purgedCount > 0) {
      await logSystemAction({
        action: 'system.retention.scan_images_purged',
        targetType: 'system',
        details: { purgedCount, retentionDays: env.storage.scanRetentionDays },
      });
    }
  } catch (err) {
    // Picked up again on the next run, nothing is lost by skipping one
    console.error('[purge] scan image purge failed', err);
  }
}

// Re-hashes every audit chain once a day. A break is written to the trail
// itself (critical, superadmin) and to the server log
const CHAIN_CHECK_EVERY_MS = 24 * 60 * 60 * 1000;

async function checkAuditChains() {
  for (const chain of SEVERITIES) {
    try {
      const broken = await AuditLog.verifyChain(chain);
      if (broken) {
        console.error('[audit] chain check failed', broken);
        await logSystemAction({
          action: 'system.audit_chain.broken',
          targetType: 'system',
          details: broken,
        });
      }
    } catch (err) {
      console.error(`[audit] chain check could not run (${chain})`, err);
    }
  }
}

async function start() {
  await connect();
  // eslint-disable-next-line no-console
  console.log(`MongoDB connected [${env.mongo.dbName}]`);

  
  // Detect how server is accessed (local or ngrok tunnel) before the 
  // server listens to avoid returning broken cookies to requests
  const reachable = await resolvePublicBaseUrl();
  setResolved(reachable);


  // '0.0.0.0' binds the network interface to allow other
  //  devices on the local network to reach the server
  server = app.listen(env.port, '0.0.0.0', () => {
    const lan = getLanIp();
    console.log(`NutriFitAI API listening on port ${env.port} [${env.nodeEnv}]`);
    console.log(`  local:   http://localhost:${env.port}`);
    if (lan) {
      console.log(`  network: http://${lan}:${env.port}`);
    }
    if (reachable.ngrokUrl) {
      console.log(`  tunnel:  ${reachable.ngrokUrl}`);
    }
    console.log(`  public base URL: ${reachable.baseUrl}  (source: ${reachable.source})`);
    if (reachable.source === 'localhost') {
      console.warn('  ! No LAN address and no ngrok tunnel -- a phone will not reach this server.');
    }
  });

  // Logs whether OTP emails can actually be sent; never throws
  verifyMailer();

  purgeScanImages();
  purgeTimer = setInterval(purgeScanImages, PURGE_EVERY_MS);
  purgeTimer.unref();

  checkAuditChains();
  chainTimer = setInterval(checkAuditChains, CHAIN_CHECK_EVERY_MS);
  chainTimer.unref();

  // Reminders every 15 minutes. Not run on boot: a restart mid-window would
  // otherwise send the same window early (the dedupe key still stops repeats)
  reminderTimer = setInterval(runReminders, REMINDERS_EVERY_MS);
  reminderTimer.unref();
}


// close http listener, and then database
async function shutdown(signal) {
  console.log(`Received ${signal}`);

  const forced = setTimeout(() => {
    console.error('Shutdown timed out; forcing exit');
    process.exit(1);
  }, 10000);
  forced.unref();

  clearInterval(purgeTimer);
  clearInterval(chainTimer);
  clearInterval(reminderTimer);
  try {
    if (server) await new Promise((resolve) => server.close(resolve));
    await close();
    process.exit(0);
  } catch (err) {
    console.error('Error during shutdown', err);
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});