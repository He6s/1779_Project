const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.POSTGRES_HOST || "db",
  port: Number(process.env.POSTGRES_PORT || 5432),
  database: process.env.POSTGRES_DB || "settleup",
  user: process.env.POSTGRES_USER || "settleup_user",
  password: process.env.POSTGRES_PASSWORD || "change_me"
});

module.exports = pool;
