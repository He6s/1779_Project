const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.WEB_PORT || 3000;

const distPath = path.join(__dirname, "dist");

app.get("/runtime-config.js", (req, res) => {
  const apiBaseUrl = process.env.API_BASE_URL || "http://localhost:3001";
  res.type("application/javascript");
  res.send(`window.__SETTLEUP_CONFIG__ = { apiBaseUrl: ${JSON.stringify(apiBaseUrl)} };`);
});

app.use(express.static(distPath));

app.get("*", (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Web running on port ${PORT}`);
});
