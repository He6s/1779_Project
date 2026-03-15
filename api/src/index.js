const express = require("express");

const app = express();
const PORT = process.env.API_PORT || 3001;

app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`API running on port ${PORT}`);
});
