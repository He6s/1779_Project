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

app.post("/users", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        ok: false,
        error: "email and password are required"
      });
    }

    const result = await pool.query(
      `
      INSERT INTO users (email, password_hash)
      VALUES ($1, $2)
      RETURNING id, email, created_at
      `,
      [email, password]
    );

    res.status(201).json({
      ok: true,
      user: result.rows[0]
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err.message
    });
  }
});

app.get("/groups", async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT id, name, created_by, created_at
      FROM groups
      ORDER BY created_at ASC
      `
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err.message
    });
  }
});

app.post("/groups", async (req, res) => {
  try {
    const { name, created_by } = req.body;

    if (!name || !created_by) {
      return res.status(400).json({
        ok: false,
        error: "name and created_by are required"
      });
    }

    const userCheck = await pool.query(
      "SELECT id FROM users WHERE id = $1",
      [created_by]
    );

    if (userCheck.rows.length === 0) {
      return res.status(400).json({
        ok: false,
        error: "created_by user does not exist"
      });
    }

    const result = await pool.query(
      `
      INSERT INTO groups (name, created_by)
      VALUES ($1, $2)
      RETURNING id, name, created_by, created_at
      `,
      [name, created_by]
    );

    res.status(201).json({
      ok: true,
      group: result.rows[0]
    });
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
