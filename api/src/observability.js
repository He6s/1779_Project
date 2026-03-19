const { randomUUID } = require("crypto");
const client = require("prom-client");

const register = new client.Registry();
client.collectDefaultMetrics({ register });

const httpRequestsTotal = new client.Counter({
  name: "settleup_http_requests_total",
  help: "Total HTTP requests handled by the API",
  labelNames: ["method", "path", "status_code"],
  registers: [register]
});

const httpRequestDurationSeconds = new client.Histogram({
  name: "settleup_http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "path", "status_code"],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  registers: [register]
});

const httpActiveRequests = new client.Gauge({
  name: "settleup_http_active_requests",
  help: "Current number of in-flight HTTP requests",
  registers: [register]
});

function normalizePath(path) {
  return path
    .replace(
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
      ":id"
    )
    .replace(/\b\d+\b/g, ":n");
}

function requestObservabilityMiddleware(req, res, next) {
  const requestId = randomUUID();
  req.requestId = requestId;
  res.setHeader("x-request-id", requestId);

  const start = process.hrtime.bigint();
  const normalizedPath = normalizePath(req.path || req.originalUrl || "unknown");

  httpActiveRequests.inc();

  res.on("finish", () => {
    const elapsedNs = Number(process.hrtime.bigint() - start);
    const durationSeconds = elapsedNs / 1e9;
    const statusCode = String(res.statusCode);

    httpRequestsTotal.inc({
      method: req.method,
      path: normalizedPath,
      status_code: statusCode
    });

    httpRequestDurationSeconds.observe(
      {
        method: req.method,
        path: normalizedPath,
        status_code: statusCode
      },
      durationSeconds
    );

    httpActiveRequests.dec();

    const log = {
      timestamp: new Date().toISOString(),
      level: "info",
      event: "request_completed",
      request_id: requestId,
      method: req.method,
      path: req.originalUrl ? req.originalUrl.split("?")[0] : req.path,
      status_code: res.statusCode,
      duration_ms: Number((durationSeconds * 1000).toFixed(3)),
      user_id: req.user?.id || null
    };

    console.log(JSON.stringify(log));
  });

  next();
}

async function getMetricsText() {
  return register.metrics();
}

module.exports = {
  requestObservabilityMiddleware,
  getMetricsText,
  register
};
