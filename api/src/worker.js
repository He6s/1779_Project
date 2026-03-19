const { popEmailJob } = require("./queue");
const { sendNotificationEmail } = require("./mailer");

let shuttingDown = false;

function log(level, event, payload = {}) {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      event,
      ...payload
    })
  );
}

function buildEmailContent(job) {
  const appBase = process.env.APP_BASE_URL || "http://localhost:3000";
  const detailsUrl = job.groupId ? `${appBase}/?group=${job.groupId}` : appBase;
  const hasRecipientShare = Number.isInteger(job.recipientOwedCents);

  const text = [
    `Hello ${job.recipientEmail},`,
    "",
    `SettleUp event: ${job.eventType}`,
    `Group: ${job.groupName}`,
    `Total amount: ${job.amountCents} cents`,
    hasRecipientShare ? `Your share: ${job.recipientOwedCents} cents` : "",
    job.description ? `Description: ${job.description}` : "",
    job.extra ? `Details: ${job.extra}` : "",
    `View details: ${detailsUrl}`
  ]
    .filter(Boolean)
    .join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #222;">
      <h2>SettleUp Notification</h2>
      <p>Hello ${job.recipientEmail},</p>
      <p><strong>Event:</strong> ${job.eventType}</p>
      <p><strong>Group:</strong> ${job.groupName}</p>
      <p><strong>Total amount:</strong> ${job.amountCents} cents</p>
      ${hasRecipientShare ? `<p><strong>Your share:</strong> ${job.recipientOwedCents} cents</p>` : ""}
      ${job.description ? `<p><strong>Description:</strong> ${job.description}</p>` : ""}
      ${job.extra ? `<p><strong>Details:</strong> ${job.extra}</p>` : ""}
      <p><a href="${detailsUrl}">Open SettleUp</a></p>
    </div>
  `;

  return { text, html };
}

async function processJob(job) {
  const subject = `[SettleUp] ${job.eventType} in ${job.groupName}`;
  const { text, html } = buildEmailContent(job);

  const result = await sendNotificationEmail({
    to: job.recipientEmail,
    subject,
    text,
    html
  });

  log("info", "email_job_processed", {
    to: job.recipientEmail,
    eventType: job.eventType,
    delivered: result.delivered,
    simulated: result.simulated || false
  });
}

async function run() {
  log("info", "worker_started", { message: "waiting for email jobs" });

  while (!shuttingDown) {
    try {
      const job = await popEmailJob(5);
      if (!job) {
        continue;
      }

      await processJob(job);
    } catch (err) {
      log("error", "worker_loop_error", {
        error: err.message,
        code: err.code,
        responseCode: err.responseCode,
        response: err.response,
        command: err.command
      });
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  log("info", "worker_exiting");
}

process.on("SIGTERM", () => {
  shuttingDown = true;
});

process.on("SIGINT", () => {
  shuttingDown = true;
});

run().catch((err) => {
  log("error", "worker_fatal", { error: err.message });
  process.exit(1);
});
