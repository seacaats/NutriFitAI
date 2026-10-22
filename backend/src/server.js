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
const { purgeDueDeletions } = require('./services/user/accountDeletion');
const { runDailyRollup, RUN_EVERY_MS: ROLLUP_EVERY_MS } = require('./services/analytics/dailyRollup');
const { runActivationFunnel, RUN_EVERY_MS: FUNNEL_EVERY_MS } = require('./services/analytics/activationFunnel');
const { runUncheckedRetry, RUN_EVERY_MS: RETRY_EVERY_MS } = require('./services/moderation/retryUnchecked');

// Mongo is connected before listening; bufferCommands:false would reject early queries
let server;
let purgeTimer;
let deletionTimer;
let chainTimer;
let reminderTimer;
let rollupTimer;
let funnelTimer;
let retryTimer;

// Purge expired scan images in batches every 6 hours; scan documents and meal snapshots remain
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

    if (purgedCount > 0) {
      await logSystemAction({
        action: 'system.retention.scan_images_purged',
        targetType: 'system',
        details: { purgedCount, retentionDays: env.storage.scanRetentionDays },
      });
    }
  } catch (err) {
    console.error('[purge] scan image purge failed', err);
  }
}

// Verify audit hash chains daily
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

  
  // Resolve public base URL (LAN or ngrok) before listening so cookies are issued correctly
  const reachable = await resolvePublicBaseUrl();
  setResolved(reachable);


  // Bind all interfaces so LAN devices can connect
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

  verifyMailer();

  purgeScanImages();
  purgeTimer = setInterval(purgeScanImages, PURGE_EVERY_MS);
  purgeTimer.unref();

  purgeDueDeletions();
  deletionTimer = setInterval(purgeDueDeletions, PURGE_EVERY_MS);
  deletionTimer.unref();

  checkAuditChains();
  chainTimer = setInterval(checkAuditChains, CHAIN_CHECK_EVERY_MS);
  chainTimer.unref();

  runDailyRollup();
  rollupTimer = setInterval(runDailyRollup, ROLLUP_EVERY_MS);
  rollupTimer.unref();

  runActivationFunnel();
  funnelTimer = setInterval(runActivationFunnel, FUNNEL_EVERY_MS);
  funnelTimer.unref();

  retryTimer = setInterval(runUncheckedRetry, RETRY_EVERY_MS);
  retryTimer.unref();

  // Scheduled only (not run on boot) to avoid sending duplicate window reminders on restart
  reminderTimer = setInterval(runReminders, REMINDERS_EVERY_MS);
  reminderTimer.unref();

}


// Graceful shutdown: close HTTP server then database connection
async function shutdown(signal) {
  console.log(`Received ${signal}`);

  const forced = setTimeout(() => {
    console.error('Shutdown timed out; forcing exit');
    process.exit(1);
  }, 10000);
  forced.unref();

  clearInterval(purgeTimer);
  clearInterval(deletionTimer);
  clearInterval(chainTimer);
  clearInterval(reminderTimer);
  clearInterval(rollupTimer);
  clearInterval(funnelTimer);
  clearInterval(retryTimer);
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