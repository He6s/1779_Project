const express = require("express");
const cors = require("cors");
const pool = require("./db/postgres");
const { getRedisClient } = require("./db/redis");
const { enqueueEmailJob } = require("./queue");
const {
  requestObservabilityMiddleware,
  getMetricsText,
  register
} = require("./observability");
const {
  hashPassword,
  comparePassword,
  signToken,
  authenticate
} = require("./auth");

const app = express();
const PORT = process.env.API_PORT || 3001;

function parseCorsOrigins() {
  const raw = (process.env.CORS_ORIGIN || "*").trim();
  if (raw === "*") {
    return "*";
  }

  const origins = raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return origins.length > 0 ? origins : "*";
}

app.use(cors({ origin: parseCorsOrigins() }));
app.use(express.json());
app.use(requestObservabilityMiddleware);

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizeNickname(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, 40);
}

async function ensureSchemaCompatibility() {
  await pool.query(
    `
    ALTER TABLE group_members
    ADD COLUMN IF NOT EXISTS nickname TEXT
    `
  );
}

async function isGroupMember(groupId, userId) {
  const result = await pool.query(
    `
    SELECT 1
    FROM group_members
    WHERE group_id = $1 AND user_id = $2
    LIMIT 1
    `,
    [groupId, userId]
  );

  return result.rows.length > 0;
}

async function isGroupOwner(groupId, userId) {
  const result = await pool.query(
    `
    SELECT 1
    FROM groups
    WHERE id = $1 AND created_by = $2
    LIMIT 1
    `,
    [groupId, userId]
  );

  return result.rows.length > 0;
}

async function getGroupMemberIds(db, groupId) {
  const result = await db.query(
    `
    SELECT user_id
    FROM group_members
    WHERE group_id = $1
    ORDER BY user_id ASC
    `,
    [groupId]
  );

  return result.rows.map((row) => row.user_id);
}

function buildEqualSplits(amountCents, participantIds) {
  const base = Math.floor(amountCents / participantIds.length);
  const remainder = amountCents % participantIds.length;

  return participantIds.map((userId, index) => ({
    user_id: userId,
    owed_cents: base + (index < remainder ? 1 : 0)
  }));
}

function buildPercentageSplits(amountCents, rawSplits) {
  const normalized = rawSplits.map((item) => ({
    user_id: item.user_id,
    percentage: Number(item.percentage)
  }));

  for (const item of normalized) {
    if (!Number.isFinite(item.percentage) || item.percentage < 0) {
      throw new Error("percentage values must be non-negative numbers");
    }
  }

  const totalPercentage = normalized.reduce(
    (sum, item) => sum + item.percentage,
    0
  );

  if (Math.abs(totalPercentage - 100) > 0.0001) {
    throw new Error("percentage splits must sum to 100");
  }

  const provisional = normalized.map((item) => {
    const exact = (amountCents * item.percentage) / 100;
    const floored = Math.floor(exact);
    return {
      user_id: item.user_id,
      owed_cents: floored,
      fraction: exact - floored
    };
  });

  let allocated = provisional.reduce((sum, item) => sum + item.owed_cents, 0);
  let remainder = amountCents - allocated;

  provisional.sort((a, b) => b.fraction - a.fraction);
  for (let i = 0; i < provisional.length && remainder > 0; i += 1) {
    provisional[i].owed_cents += 1;
    remainder -= 1;
  }

  return provisional.map((item) => ({
    user_id: item.user_id,
    owed_cents: item.owed_cents
  }));
}

function buildExactSplits(amountCents, rawSplits) {
  const normalized = rawSplits.map((item) => ({
    user_id: item.user_id,
    owed_cents: Number(item.owed_cents)
  }));

  for (const item of normalized) {
    if (!Number.isInteger(item.owed_cents) || item.owed_cents < 0) {
      throw new Error("exact split owed_cents must be non-negative integers");
    }
  }

  const total = normalized.reduce((sum, item) => sum + item.owed_cents, 0);
  if (total !== amountCents) {
    throw new Error("exact splits must sum to amount_cents");
  }

  return normalized;
}

function computeDebtEdges(balances) {
  const debtors = [];
  const creditors = [];

  for (const balance of balances) {
    if (balance.net_cents < 0) {
      debtors.push({ user_id: balance.user_id, amount: -balance.net_cents });
    } else if (balance.net_cents > 0) {
      creditors.push({ user_id: balance.user_id, amount: balance.net_cents });
    }
  }

  const edges = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].amount, creditors[j].amount);

    edges.push({
      from_user: debtors[i].user_id,
      to_user: creditors[j].user_id,
      amount_cents: amount
    });

    debtors[i].amount -= amount;
    creditors[j].amount -= amount;

    if (debtors[i].amount === 0) {
      i += 1;
    }
    if (creditors[j].amount === 0) {
      j += 1;
    }
  }

  return edges;
}

async function buildNotificationJobs(
  db,
  {
    groupId,
    actorUserId,
    eventType,
    amountCents,
    description,
    extra,
    recipientUserIds,
    includeActor = false,
    recipientOwedByUserId = null
  }
) {
  const groupResult = await db.query(
    "SELECT name FROM groups WHERE id = $1 LIMIT 1",
    [groupId]
  );

  const groupName = groupResult.rows[0]?.name || "SettleUp Group";

  let recipientsResult;

  if (Array.isArray(recipientUserIds) && recipientUserIds.length > 0) {
    recipientsResult = await db.query(
      `
      SELECT DISTINCT u.id, u.email
      FROM users u
      JOIN group_members gm ON gm.user_id = u.id
      WHERE gm.group_id = $1
      AND u.id = ANY($2)
      `,
      [groupId, recipientUserIds]
    );
  } else {
    if (includeActor) {
      recipientsResult = await db.query(
        `
        SELECT u.id, u.email
        FROM users u
        JOIN group_members gm ON gm.user_id = u.id
        WHERE gm.group_id = $1
        `,
        [groupId]
      );
    } else {
      recipientsResult = await db.query(
        `
        SELECT u.id, u.email
        FROM users u
        JOIN group_members gm ON gm.user_id = u.id
        WHERE gm.group_id = $1
        AND u.id <> $2
        `,
        [groupId, actorUserId]
      );
    }
  }

  return recipientsResult.rows.map((recipient) => ({
    recipientOwedCents:
      recipientOwedByUserId && Object.prototype.hasOwnProperty.call(recipientOwedByUserId, recipient.id)
        ? recipientOwedByUserId[recipient.id]
        : null,
    recipientEmail: recipient.email,
    recipientUserId: recipient.id,
    groupId,
    groupName,
    eventType,
    amountCents,
    description,
    extra
  }));
}

async function enqueueJobsSafely(jobs) {
  for (const job of jobs) {
    try {
      await enqueueEmailJob(job);
    } catch (err) {
      console.error("Failed to enqueue email job:", err.message);
    }
  }
}

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

app.get("/metrics", async (req, res) => {
  try {
    const metricsText = await getMetricsText();
    res.set("Content-Type", register.contentType);
    return res.status(200).send(metricsText);
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message,
      request_id: req.requestId
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

app.post("/auth/register", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        ok: false,
        error: "email and password are required"
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        ok: false,
        error: "invalid email format"
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        ok: false,
        error: "password must be at least 8 characters"
      });
    }

    const passwordHash = await hashPassword(password);

    const result = await pool.query(
      `
      INSERT INTO users (email, password_hash)
      VALUES ($1, $2)
      RETURNING id, email, created_at
      `,
      [email.toLowerCase(), passwordHash]
    );

    const user = result.rows[0];
    const token = signToken({
      sub: user.id,
      email: user.email
    });

    res.status(201).json({
      ok: true,
      user,
      token
    });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({
        ok: false,
        error: "email already exists"
      });
    }

    res.status(500).json({
      ok: false,
      error: err.message
    });
  }
});

app.post("/auth/login", async (req, res) => {
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
      SELECT id, email, password_hash
      FROM users
      WHERE email = $1
      LIMIT 1
      `,
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        ok: false,
        error: "invalid credentials"
      });
    }

    const user = result.rows[0];
    const passwordMatched = await comparePassword(password, user.password_hash);

    if (!passwordMatched) {
      return res.status(401).json({
        ok: false,
        error: "invalid credentials"
      });
    }

    const token = signToken({
      sub: user.id,
      email: user.email
    });

    return res.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email
      },
      token
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message
    });
  }
});

app.get("/me", authenticate, async (req, res) => {
  return res.json({
    ok: true,
    user: req.user
  });
});

app.get("/groups", authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT g.id, g.name, g.created_by, g.created_at
      FROM groups g
      JOIN group_members gm ON gm.group_id = g.id
      WHERE gm.user_id = $1
      ORDER BY g.created_at ASC
      `,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err.message
    });
  }
});

app.post("/groups", authenticate, async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({
        ok: false,
        error: "name is required"
      });
    }

    const db = await pool.connect();

    try {
      await db.query("BEGIN");

      const groupResult = await db.query(
        `
        INSERT INTO groups (name, created_by)
        VALUES ($1, $2)
        RETURNING id, name, created_by, created_at
        `,
        [name, req.user.id]
      );

      const group = groupResult.rows[0];

      await db.query(
        `
        INSERT INTO group_members (group_id, user_id)
        VALUES ($1, $2)
        `,
        [group.id, req.user.id]
      );

      await db.query("COMMIT");

      return res.status(201).json({
        ok: true,
        group
      });
    } catch (err) {
      await db.query("ROLLBACK");
      throw err;
    } finally {
      db.release();
    }
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err.message
    });
  }
});

app.get("/groups/:groupId/members", authenticate, async (req, res) => {
  try {
    const { groupId } = req.params;

    const member = await isGroupMember(groupId, req.user.id);
    if (!member) {
      return res.status(403).json({
        ok: false,
        error: "forbidden"
      });
    }

    const result = await pool.query(
      `
      SELECT u.id,
             u.email,
             gm.nickname,
             COALESCE(NULLIF(TRIM(gm.nickname), ''), split_part(u.email, '@', 1)) AS display_name,
             gm.joined_at
      FROM group_members gm
      JOIN users u ON u.id = gm.user_id
      WHERE gm.group_id = $1
      ORDER BY gm.joined_at ASC
      `,
      [groupId]
    );

    return res.json({
      ok: true,
      members: result.rows
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message
    });
  }
});

app.post("/groups/:groupId/members", authenticate, async (req, res) => {
  try {
    const { groupId } = req.params;
    const { email, nickname } = req.body;
    const normalizedNickname = normalizeNickname(nickname);

    if (!email) {
      return res.status(400).json({
        ok: false,
        error: "email is required"
      });
    }

    const owner = await isGroupOwner(groupId, req.user.id);
    if (!owner) {
      return res.status(403).json({
        ok: false,
        error: "only group owner can add members"
      });
    }

    const userResult = await pool.query(
      "SELECT id, email FROM users WHERE email = $1 LIMIT 1",
      [email.toLowerCase()]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: "user not found"
      });
    }

    const targetUser = userResult.rows[0];

    await pool.query(
      `
      INSERT INTO group_members (group_id, user_id, nickname)
      VALUES ($1, $2, $3)
      ON CONFLICT (group_id, user_id)
      DO UPDATE SET nickname = COALESCE(EXCLUDED.nickname, group_members.nickname)
      `,
      [groupId, targetUser.id, normalizedNickname]
    );

    const memberResult = await pool.query(
      `
      SELECT u.id,
             u.email,
             gm.nickname,
             COALESCE(NULLIF(TRIM(gm.nickname), ''), split_part(u.email, '@', 1)) AS display_name,
             gm.joined_at
      FROM group_members gm
      JOIN users u ON u.id = gm.user_id
      WHERE gm.group_id = $1 AND gm.user_id = $2
      LIMIT 1
      `,
      [groupId, targetUser.id]
    );

    return res.status(201).json({
      ok: true,
      member: memberResult.rows[0]
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message
    });
  }
});

app.patch("/groups/:groupId/members/:userId", authenticate, async (req, res) => {
  try {
    const { groupId, userId } = req.params;
    const { nickname } = req.body;

    const owner = await isGroupOwner(groupId, req.user.id);
    if (!owner) {
      return res.status(403).json({
        ok: false,
        error: "only group owner can edit member nickname"
      });
    }

    const normalizedNickname = normalizeNickname(nickname);

    const result = await pool.query(
      `
      UPDATE group_members
      SET nickname = $3
      WHERE group_id = $1 AND user_id = $2
      RETURNING group_id, user_id, nickname, joined_at
      `,
      [groupId, userId, normalizedNickname]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: "member not found"
      });
    }

    return res.json({
      ok: true,
      member: result.rows[0]
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message
    });
  }
});

app.delete(
  "/groups/:groupId/members/:userId",
  authenticate,
  async (req, res) => {
    try {
      const { groupId, userId } = req.params;

      const owner = await isGroupOwner(groupId, req.user.id);
      if (!owner) {
        return res.status(403).json({
          ok: false,
          error: "only group owner can remove members"
        });
      }

      await pool.query(
        `
        DELETE FROM group_members
        WHERE group_id = $1 AND user_id = $2
        `,
        [groupId, userId]
      );

      return res.json({
        ok: true
      });
    } catch (err) {
      return res.status(500).json({
        ok: false,
        error: err.message
      });
    }
  }
);

app.post("/groups/:groupId/expenses", authenticate, async (req, res) => {
  try {
    const { groupId } = req.params;
    const {
      description,
      amount_cents: amountCents,
      currency = "CAD",
      split_type: splitType = "equal",
      participant_ids: participantIds,
      splits
    } = req.body;

    if (!description || !amountCents) {
      return res.status(400).json({
        ok: false,
        error: "description and amount_cents are required"
      });
    }

    if (!Number.isInteger(amountCents) || amountCents <= 0) {
      return res.status(400).json({
        ok: false,
        error: "amount_cents must be a positive integer"
      });
    }

    const member = await isGroupMember(groupId, req.user.id);
    if (!member) {
      return res.status(403).json({
        ok: false,
        error: "forbidden"
      });
    }

    const db = await pool.connect();
    let notificationJobs = [];

    try {
      await db.query("BEGIN");

      const groupMemberIds = await getGroupMemberIds(db, groupId);
      const memberSet = new Set(groupMemberIds);

      if (!memberSet.has(req.user.id)) {
        return res.status(403).json({
          ok: false,
          error: "forbidden"
        });
      }

      let computedSplits;

      if (splitType === "equal") {
        const baseParticipants =
          Array.isArray(participantIds) && participantIds.length > 0
            ? participantIds
            : groupMemberIds;

        const uniqueParticipants = [...new Set(baseParticipants)];
        if (uniqueParticipants.length === 0) {
          return res.status(400).json({
            ok: false,
            error: "participants cannot be empty"
          });
        }

        const invalid = uniqueParticipants.find((userId) => !memberSet.has(userId));
        if (invalid) {
          return res.status(400).json({
            ok: false,
            error: "all participants must be group members"
          });
        }

        computedSplits = buildEqualSplits(amountCents, uniqueParticipants);
      } else if (splitType === "percentage") {
        if (!Array.isArray(splits) || splits.length === 0) {
          return res.status(400).json({
            ok: false,
            error: "percentage splits are required"
          });
        }

        const uniqueUsers = new Set(splits.map((item) => item.user_id));
        if (uniqueUsers.size !== splits.length) {
          return res.status(400).json({
            ok: false,
            error: "duplicate users in splits are not allowed"
          });
        }

        for (const split of splits) {
          if (!memberSet.has(split.user_id)) {
            return res.status(400).json({
              ok: false,
              error: "all split users must be group members"
            });
          }
        }

        computedSplits = buildPercentageSplits(amountCents, splits);
      } else if (splitType === "exact") {
        if (!Array.isArray(splits) || splits.length === 0) {
          return res.status(400).json({
            ok: false,
            error: "exact splits are required"
          });
        }

        const uniqueUsers = new Set(splits.map((item) => item.user_id));
        if (uniqueUsers.size !== splits.length) {
          return res.status(400).json({
            ok: false,
            error: "duplicate users in splits are not allowed"
          });
        }

        for (const split of splits) {
          if (!memberSet.has(split.user_id)) {
            return res.status(400).json({
              ok: false,
              error: "all split users must be group members"
            });
          }
        }

        computedSplits = buildExactSplits(amountCents, splits);
      } else {
        return res.status(400).json({
          ok: false,
          error: "split_type must be equal, percentage, or exact"
        });
      }

      const expenseResult = await db.query(
        `
        INSERT INTO expenses (group_id, paid_by, description, amount_cents, currency)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, group_id, paid_by, description, amount_cents, currency, created_at
        `,
        [groupId, req.user.id, description, amountCents, currency]
      );

      const expense = expenseResult.rows[0];

      for (const split of computedSplits) {
        await db.query(
          `
          INSERT INTO splits (expense_id, user_id, owed_cents, split_type, metadata)
          VALUES ($1, $2, $3, $4, $5)
          `,
          [expense.id, split.user_id, split.owed_cents, splitType, null]
        );
      }

      await db.query(
        `
        INSERT INTO activity_log (group_id, user_id, action_type, payload)
        VALUES ($1, $2, $3, $4)
        `,
        [
          groupId,
          req.user.id,
          "expense_created",
          {
            expense_id: expense.id,
            description,
            amount_cents: amountCents,
            currency,
            split_type: splitType
          }
        ]
      );

      notificationJobs = await buildNotificationJobs(db, {
        groupId,
        actorUserId: req.user.id,
        eventType: "expense_created",
        amountCents,
        description,
        extra: `Split type: ${splitType}`,
        recipientUserIds: null,
        includeActor: true,
        recipientOwedByUserId: Object.fromEntries(
          computedSplits.map((split) => [split.user_id, split.owed_cents])
        )
      });

      await db.query("COMMIT");

      await enqueueJobsSafely(notificationJobs);

      return res.status(201).json({
        ok: true,
        expense,
        splits: computedSplits
      });
    } catch (err) {
      await db.query("ROLLBACK");

      if (
        err.message &&
        (
          err.message.includes("splits must") ||
          err.message.includes("percentage values") ||
          err.message.includes("exact split")
        )
      ) {
        return res.status(400).json({
          ok: false,
          error: err.message
        });
      }

      throw err;
    } finally {
      db.release();
    }
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message
    });
  }
});

app.get("/groups/:groupId/expenses", authenticate, async (req, res) => {
  try {
    const { groupId } = req.params;

    const member = await isGroupMember(groupId, req.user.id);
    if (!member) {
      return res.status(403).json({
        ok: false,
        error: "forbidden"
      });
    }

    const expenseResult = await pool.query(
      `
      SELECT e.id, e.group_id, e.paid_by, e.description, e.amount_cents, e.currency, e.created_at,
             u.email AS paid_by_email
      FROM expenses e
      JOIN users u ON u.id = e.paid_by
      WHERE e.group_id = $1
      ORDER BY e.created_at DESC
      `,
      [groupId]
    );

    return res.json({
      ok: true,
      expenses: expenseResult.rows
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message
    });
  }
});

app.get("/groups/:groupId/balances", authenticate, async (req, res) => {
  try {
    const { groupId } = req.params;

    const member = await isGroupMember(groupId, req.user.id);
    if (!member) {
      return res.status(403).json({
        ok: false,
        error: "forbidden"
      });
    }

    const result = await pool.query(
      `
      WITH members AS (
        SELECT gm.user_id, u.email
        FROM group_members gm
        JOIN users u ON u.id = gm.user_id
        WHERE gm.group_id = $1
      ),
      paid AS (
        SELECT paid_by AS user_id, COALESCE(SUM(amount_cents), 0) AS total_paid
        FROM expenses
        WHERE group_id = $1
        GROUP BY paid_by
      ),
      owed AS (
        SELECT s.user_id, COALESCE(SUM(s.owed_cents), 0) AS total_owed
        FROM splits s
        JOIN expenses e ON e.id = s.expense_id
        WHERE e.group_id = $1
        GROUP BY s.user_id
      ),
      settled_out AS (
        SELECT from_user AS user_id, COALESCE(SUM(amount_cents), 0) AS total_out
        FROM settlements
        WHERE group_id = $1
        GROUP BY from_user
      ),
      settled_in AS (
        SELECT to_user AS user_id, COALESCE(SUM(amount_cents), 0) AS total_in
        FROM settlements
        WHERE group_id = $1
        GROUP BY to_user
      )
      SELECT m.user_id,
             m.email,
             COALESCE(p.total_paid, 0)::int AS total_paid_cents,
             COALESCE(o.total_owed, 0)::int AS total_owed_cents,
             COALESCE(so.total_out, 0)::int AS settled_out_cents,
             COALESCE(si.total_in, 0)::int AS settled_in_cents,
             (
               COALESCE(p.total_paid, 0) -
               COALESCE(o.total_owed, 0) -
               COALESCE(si.total_in, 0) +
               COALESCE(so.total_out, 0)
             )::int AS net_cents
      FROM members m
      LEFT JOIN paid p ON p.user_id = m.user_id
      LEFT JOIN owed o ON o.user_id = m.user_id
      LEFT JOIN settled_out so ON so.user_id = m.user_id
      LEFT JOIN settled_in si ON si.user_id = m.user_id
      ORDER BY m.email ASC
      `,
      [groupId]
    );

    const balances = result.rows;
    const debt_graph = computeDebtEdges(balances);

    return res.json({
      ok: true,
      balances,
      debt_graph
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message
    });
  }
});

app.post("/groups/:groupId/settlements", authenticate, async (req, res) => {
  try {
    const { groupId } = req.params;
    const { to_user: toUser, amount_cents: amountCents } = req.body;

    if (!toUser || !amountCents) {
      return res.status(400).json({
        ok: false,
        error: "to_user and amount_cents are required"
      });
    }

    if (!Number.isInteger(amountCents) || amountCents <= 0) {
      return res.status(400).json({
        ok: false,
        error: "amount_cents must be a positive integer"
      });
    }

    if (toUser === req.user.id) {
      return res.status(400).json({
        ok: false,
        error: "cannot settle with self"
      });
    }

    const requesterMember = await isGroupMember(groupId, req.user.id);
    const targetMember = await isGroupMember(groupId, toUser);

    if (!requesterMember || !targetMember) {
      return res.status(403).json({
        ok: false,
        error: "both users must be group members"
      });
    }

    const db = await pool.connect();
    let notificationJobs = [];

    try {
      await db.query("BEGIN");

      const settlementResult = await db.query(
        `
        INSERT INTO settlements (group_id, from_user, to_user, amount_cents)
        VALUES ($1, $2, $3, $4)
        RETURNING id, group_id, from_user, to_user, amount_cents, created_at
        `,
        [groupId, req.user.id, toUser, amountCents]
      );

      const settlement = settlementResult.rows[0];

      await db.query(
        `
        INSERT INTO activity_log (group_id, user_id, action_type, payload)
        VALUES ($1, $2, $3, $4)
        `,
        [
          groupId,
          req.user.id,
          "settlement_recorded",
          {
            settlement_id: settlement.id,
            to_user: toUser,
            amount_cents: amountCents
          }
        ]
      );

      notificationJobs = await buildNotificationJobs(db, {
        groupId,
        actorUserId: req.user.id,
        eventType: "settlement_recorded",
        amountCents,
        description: "Settlement payment",
        extra: `${req.user.email} paid user ${toUser}`,
        recipientUserIds: [req.user.id, toUser]
      });

      await db.query("COMMIT");

      await enqueueJobsSafely(notificationJobs);

      return res.status(201).json({
        ok: true,
        settlement
      });
    } catch (err) {
      await db.query("ROLLBACK");
      throw err;
    } finally {
      db.release();
    }
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message
    });
  }
});

app.get("/groups/:groupId/settlements", authenticate, async (req, res) => {
  try {
    const { groupId } = req.params;

    const member = await isGroupMember(groupId, req.user.id);
    if (!member) {
      return res.status(403).json({
        ok: false,
        error: "forbidden"
      });
    }

    const result = await pool.query(
      `
      SELECT s.id, s.group_id, s.from_user, fu.email AS from_email,
             s.to_user, tu.email AS to_email, s.amount_cents, s.created_at
      FROM settlements s
      JOIN users fu ON fu.id = s.from_user
      JOIN users tu ON tu.id = s.to_user
      WHERE s.group_id = $1
      ORDER BY s.created_at DESC
      `,
      [groupId]
    );

    return res.json({
      ok: true,
      settlements: result.rows
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message
    });
  }
});

app.get("/groups/:groupId/activity", authenticate, async (req, res) => {
  try {
    const { groupId } = req.params;
    const limit = Math.min(Number(req.query.limit || 50), 200);
    const offset = Math.max(Number(req.query.offset || 0), 0);

    const member = await isGroupMember(groupId, req.user.id);
    if (!member) {
      return res.status(403).json({
        ok: false,
        error: "forbidden"
      });
    }

    const result = await pool.query(
      `
      SELECT a.id, a.group_id, a.user_id, u.email AS user_email,
             a.action_type, a.payload, a.created_at
      FROM activity_log a
      JOIN users u ON u.id = a.user_id
      WHERE a.group_id = $1
      ORDER BY a.created_at DESC
      LIMIT $2 OFFSET $3
      `,
      [groupId, limit, offset]
    );

    return res.json({
      ok: true,
      activity: result.rows,
      pagination: {
        limit,
        offset
      }
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message
    });
  }
});

async function startServer() {
  try {
    await ensureSchemaCompatibility();

    app.listen(PORT, () => {
      console.log(`API running on port ${PORT}`);
    });
  } catch (err) {
    console.error("Failed to start API:", err.message);
    process.exit(1);
  }
}

startServer();
