const crypto = require("crypto");

const activeTokens = new Set();

function checkPassword(input) {
  const expected = process.env.ADMIN_PASSWORD || "changeme";

  // Timing-safe comparison — pad to equal length
  const inputBuf = Buffer.from(input);
  const expectedBuf = Buffer.from(expected);

  if (inputBuf.length !== expectedBuf.length) {
    // Still do a comparison to avoid timing leaks on length
    const padded = Buffer.alloc(expectedBuf.length);
    inputBuf.copy(padded);
    crypto.timingSafeEqual(padded, expectedBuf);
    return false;
  }

  return crypto.timingSafeEqual(inputBuf, expectedBuf);
}

function generateToken() {
  const token = crypto.randomBytes(32).toString("hex");
  activeTokens.add(token);
  return token;
}

function validateToken(token) {
  return typeof token === "string" && activeTokens.has(token);
}

module.exports = { checkPassword, generateToken, validateToken };
