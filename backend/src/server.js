const app = require('./app');
const env = require('../config/env');
const { getLanIp } = require('./utils/lanIp');
const { resolvePublicBaseUrl, setResolved } = require('./utils/publicUrl');
const { connect, close } = require('../config/mongo');

// Force mongodb connection before listening to requests through mongo.js
// which sets bufferCommands:false which automatically rejects them
let server;

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
    console.log(`NutriFit API listening on port ${env.port} [${env.nodeEnv}]`);
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
}


// close http listener, and then database
async function shutdown(signal) {
  console.log(`Received ${signal}`);

  const forced = setTimeout(() => {
    console.error('Shutdown timed out; forcing exit');
    process.exit(1);
  }, 10000);
  forced.unref();

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