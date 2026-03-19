const { getRedisClient } = require("./db/redis");

const EMAIL_QUEUE_KEY = process.env.EMAIL_QUEUE_KEY || "email_jobs";

async function enqueueEmailJob(job) {
  const redis = await getRedisClient();
  await redis.rPush(EMAIL_QUEUE_KEY, JSON.stringify(job));
}

async function popEmailJob(timeoutSeconds = 5) {
  const redis = await getRedisClient();
  const result = await redis.blPop(EMAIL_QUEUE_KEY, timeoutSeconds);

  if (!result || !result.element) {
    return null;
  }

  try {
    return JSON.parse(result.element);
  } catch (err) {
    console.error("Failed to parse email job:", err.message);
    return null;
  }
}

module.exports = {
  EMAIL_QUEUE_KEY,
  enqueueEmailJob,
  popEmailJob
};
