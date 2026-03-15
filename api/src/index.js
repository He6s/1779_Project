const express = require("express");
const pool = require("./db/postgres");
const { getRedisClient } = require("./db/redis");

const app = express();
const PORT = process.env.API_PORT || 3001;

app.use(express.json());

app.get("/health", async (req, res) => {
  try {
    const redis = await getRedisClient();
    const count = await redis.incr("health_hits");

    res.json({
      ok: true,
      service: "api",
      redis_health_hits: count
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      service: "api",
      error: err.message
    });
  }
});

app.get("/ready", async (req, res) => {
  try {
    const dbResult = await pool.query("SELECT NOW() AS now");
    const redis = await getRedisClient();
    await redis.set("ready_check", "ok");

    res.json({
      ok: true,
      db: "connected",
      db_time: dbResult.rows[0].now,
      redis: "connected"
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err.message
    });
  }
});

app.get("/users", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, email, created_at FROM users ORDER BY created_at ASC"
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`API running on port ${PORT}`);
});
