const nodemailer = require("nodemailer");

let transporter = null;

function emailEnabled() {
  return String(process.env.EMAIL_ENABLED || "false").toLowerCase() === "true";
}

function getTransporter() {
  if (transporter) {
    return transporter;
  }

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass
    }
  });

  return transporter;
}

async function sendNotificationEmail({ to, subject, text, html }) {
  const from = process.env.EMAIL_FROM || "no-reply@settleup.local";

  if (!emailEnabled()) {
    console.log("EMAIL_DISABLED: simulated email", { to, subject });
    return { delivered: false, simulated: true };
  }

  const tx = getTransporter();
  if (!tx) {
    throw new Error("email enabled but SMTP configuration is missing");
  }

  const info = await tx.sendMail({
    from,
    to,
    subject,
    text,
    html
  });

  return {
    delivered: true,
    messageId: info.messageId
  };
}

module.exports = {
  sendNotificationEmail
};
