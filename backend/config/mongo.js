const mongoose = require('mongoose');

const env = require('./env');

// Model functions use `async fn(input, client = db)`, where `client` is either this module
// or a transaction-scoped ClientSession. Controllers run updates via withTransaction(), 
// which dynamically passes the active database session down to the models.
let connection = null;

async function connect() {
  if (connection) return connection;

  // Rejects query filters with paths missing from the schema so typos error out immediately.
  mongoose.set('strictQuery', true);

  // Disables buffering so dead database connections error fast instead of hanging requests.
  mongoose.set('bufferCommands', false);

  mongoose.connection.on('error', (err) => {
    // Unrecoverable pool drops are logged because a broken driver compromises stability.
    console.error('MongoDB connection error', err);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB disconnected; driver will attempt to reconnect');
  });

  await mongoose.connect(env.mongo.uri, {
    dbName: env.mongo.dbName,
    maxPoolSize: env.mongo.maxPoolSize,
    autoIndex: env.mongo.autoIndex,

    // A 10s timeout on Cluster scans exposes bad connection strings quickly.
    serverSelectionTimeoutMS: 10000,
  });   

  connection = mongoose.connection;

  if (env.nodeEnv === 'development') {
    // Enforces detailed query logging during development
    mongoose.set('debug', (collectionName, method, query) => {
      console.debug('mongo', `${collectionName}.${method}`, JSON.stringify(query));
    });
  }

  return connection;
}


// Helper to manually create transactions. Callback 
// retries on errors, so logic must be repeatable
async function withTransaction(fn) {
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(() => fn(session));
  } finally {
    await session.endSession();
  }
}


// Converts the model's `client` parameter into an options object (`{ session }`).
// Acts a safety check for all queries/transactiosn to prevent execution errors.`
function opts(client) {
  return client && typeof client.inTransaction === 'function' ? { session: client } : {};
}

async function close() {
  if (!connection) return;
  await mongoose.connection.close();
  connection = null;
}

module.exports = { mongoose, connect, withTransaction, opts, close };