const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "24h";

async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, 10);
}

async function comparePassword(plainPassword, passwordHash) {
  return bcrypt.compare(plainPassword, passwordHash);
}

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN
  });
}

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({
      ok: false,
      error: "missing or invalid authorization header"
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = {
      id: decoded.sub,
      email: decoded.email
    };
    return next();
  } catch (err) {
    return res.status(401).json({
      ok: false,
      error: "invalid or expired token"
    });
  }
}

function verifyToken(token) {
  const decoded = jwt.verify(token, JWT_SECRET);
  return {
    id: decoded.sub,
    email: decoded.email
  };
}

module.exports = {
  hashPassword,
  comparePassword,
  signToken,
  authenticate,
  verifyToken
};
