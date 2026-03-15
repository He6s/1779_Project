const { createClient } = require("redis");

const client = createClient({
  url: `redis://${process.env.REDIS_HOST || "redis"}:${process.env.REDIS_PORT || 6379}`
});

client.on("error", (err) => {
  console.error("Redis error:", err.message);
});

let connectPromise = null;

async function getRedisClient() {
  if (!connectPromise) {
    connectPromise = client.connect();
  }
  await connectPromise;
  return client;
}

module.exports = { getRedisClient };
