/* Utilidades compartidas de autenticación (hash scrypt + cookie HttpOnly firmada con HMAC-SHA256) */
const crypto = require("crypto");

const COOKIE_NAME = "tsb_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 días

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return "scrypt$" + salt + "$" + derived;
}

function timingSafeEqualHex(aHex, bHex) {
  try {
    const a = Buffer.from(aHex, "hex");
    const b = Buffer.from(bHex, "hex");
    if (a.length === 0 || a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch (e) {
    return false;
  }
}

function verifyPassword(password, storedHash) {
  if (!storedHash || typeof storedHash !== "string") return false;
  const pwd = String(password || "");
  const trimmed = storedHash.trim();

  if (trimmed.startsWith("scrypt$")) {
    const parts = trimmed.split("$");
    if (parts.length !== 3) return false;
    const salt = parts[1];
    const expectedHex = parts[2];
    const derivedHex = crypto.scryptSync(pwd, salt, 64).toString("hex");
    return timingSafeEqualHex(derivedHex, expectedHex);
  }

  if (trimmed.startsWith("sha256$")) {
    const expectedHex = trimmed.slice(7);
    const derivedHex = crypto.createHash("sha256").update(pwd, "utf8").digest("hex");
    return timingSafeEqualHex(derivedHex, expectedHex);
  }

  return false;
}

function getSecret() {
  return (
    process.env.AUTH_SECRET ||
    process.env.AUTH_PASS_HASH ||
    "dev-fallback-secret-change-me"
  ).trim();
}

function signPayload(payloadB64) {
  return crypto
    .createHmac("sha256", getSecret())
    .update(payloadB64)
    .digest("base64url");
}

function createSessionToken(user) {
  const payload = {
    u: String(user || ""),
    exp: Date.now() + SESSION_TTL_MS,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = signPayload(payloadB64);
  return payloadB64 + "." + sig;
}

function parseCookies(req) {
  const header = (req.headers && req.headers.cookie) || "";
  const map = {};
  header.split(";").forEach(function (pair) {
    const idx = pair.indexOf("=");
    if (idx <= 0) return;
    const k = pair.slice(0, idx).trim();
    const v = pair.slice(idx + 1).trim();
    try {
      map[k] = decodeURIComponent(v);
    } catch (e) {
      map[k] = v;
    }
  });
  return map;
}

function verifySession(req) {
  const cookies = parseCookies(req);
  const token = cookies[COOKIE_NAME];
  if (!token || typeof token !== "string") return null;

  const dot = token.indexOf(".");
  if (dot <= 0) return null;

  const payloadB64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expectedSig = signPayload(payloadB64);

  try {
    const a = Buffer.from(sig, "utf8");
    const b = Buffer.from(expectedSig, "utf8");
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
    if (!payload || !payload.u || !payload.exp || Date.now() > Number(payload.exp)) {
      return null;
    }
    return payload;
  } catch (e) {
    return null;
  }
}

function isSecureRequest(req) {
  const proto = (req.headers && req.headers["x-forwarded-proto"]) || "";
  return proto === "https" || process.env.VERCEL === "1";
}

function setSessionCookie(req, res, user) {
  const token = createSessionToken(user);
  const maxAge = Math.floor(SESSION_TTL_MS / 1000);
  const parts = [
    COOKIE_NAME + "=" + encodeURIComponent(token),
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=" + maxAge,
  ];
  if (isSecureRequest(req)) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

function clearSessionCookie(req, res) {
  const parts = [
    COOKIE_NAME + "=",
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
  ];
  if (isSecureRequest(req)) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

function isAuthConfigured() {
  return Boolean((process.env.AUTH_PASS_HASH || "").trim());
}

function getExpectedUser() {
  return (process.env.AUTH_USER || "Tresstylos").trim();
}

function sendJson(res, status, obj) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(obj));
}

function readJsonBody(req) {
  if (req.body && typeof req.body === "object") {
    return Promise.resolve(req.body);
  }
  if (typeof req.body === "string") {
    try {
      return Promise.resolve(JSON.parse(req.body || "{}"));
    } catch (e) {
      return Promise.reject(new Error("JSON inválido."));
    }
  }
  return new Promise(function (resolve, reject) {
    const chunks = [];
    req.on("data", function (chunk) {
      chunks.push(chunk);
    });
    req.on("end", function () {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(new Error("JSON inválido."));
      }
    });
    req.on("error", reject);
  });
}

module.exports = {
  hashPassword,
  verifyPassword,
  verifySession,
  setSessionCookie,
  clearSessionCookie,
  isAuthConfigured,
  getExpectedUser,
  sendJson,
  readJsonBody,
};
