const express = require("express");

const app = express();
const PORT = process.env.WEB_PORT || 3000;

app.get("/", (req, res) => {
  res.send("<h1>SettleUp is running</h1>");
});

app.listen(PORT, () => {
  console.log(`Web running on port ${PORT}`);
});
