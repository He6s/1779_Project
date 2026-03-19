const { createClient } = require("redis");

const client = createClient({
  url: `redis://${process.env.REDIS_HOST || "redis"}:${process.env.REDIS_PORT || 6379}`,
  socket: {
    reconnectStrategy: (retries) => Math.min(retries * 100, 3000)
  }
});

let lastRedisErrorLogAt = 0;

client.on("error", (err) => {
  const now = Date.now();
  // Avoid flooding logs during startup reconnect loops.
  if (now - lastRedisErrorLogAt >= 5000) {
    console.error("Redis error:", err.message);
    lastRedisErrorLogAt = now;
  }
});

let connectPromise = null;

async function getRedisClient() {
  if (client.isOpen) {
    return client;
  }

  if (!connectPromise) {
    connectPromise = client.connect().catch((err) => {
      connectPromise = null;
      throw err;
    });
  }

  await connectPromise;
  return client;
}

module.exports = { getRedisClient };
