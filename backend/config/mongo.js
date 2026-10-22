const mongoose = require('mongoose');

const env = require('./env');

// Model methods accept an optional transaction ClientSession via `opts(client)`
let connection = null;

async function connect() {
  if (connection) return connection;

  mongoose.set('strictQuery', true);
  mongoose.set('bufferCommands', false);

  mongoose.connection.on('error', (err) => {
    console.error('MongoDB connection error', err);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB disconnected; driver will attempt to reconnect');
  });

  await mongoose.connect(env.mongo.uri, {
    dbName: env.mongo.dbName,
    maxPoolSize: env.mongo.maxPoolSize,
    autoIndex: env.mongo.autoIndex,
    serverSelectionTimeoutMS: 10000,
  });   

  connection = mongoose.connection;

  if (env.nodeEnv === 'development') {
    mongoose.set('debug', (collectionName, method, query) => {
      console.debug('mongo', `${collectionName}.${method}`, JSON.stringify(query));
    });
  }

  return connection;
}


// Runs `fn(session)` inside a transaction; callback must be idempotent across retries
async function withTransaction(fn) {
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(() => fn(session));
  } finally {
    await session.endSession();
  }
}


// Converts an active ClientSession into `{ session }` query options
function opts(client) {
  return client && typeof client.inTransaction === 'function' ? { session: client } : {};
}

async function close() {
  if (!connection) return;
  await mongoose.connection.close();
  connection = null;
}

module.exports = { mongoose, connect, withTransaction, opts, close };