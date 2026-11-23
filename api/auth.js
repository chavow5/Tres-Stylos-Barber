/* Vercel Serverless Function: login, estado de sesión y cierre de sesión */
const auth = require("./_auth.js");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const method = (req.method || "GET").toUpperCase();

  if (method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (method === "GET") {
    const session = auth.verifySession(req);
    auth.sendJson(res, 200, {
      ok: true,
      configured: auth.isAuthConfigured(),
      authenticated: Boolean(session),
      user: session ? session.u : null,
    });
    return;
  }

  if (method === "DELETE") {
    auth.clearSessionCookie(req, res);
    auth.sendJson(res, 200, { ok: true, authenticated: false });
    return;
  }

  if (method === "POST") {
    let body;
    try {
      body = await auth.readJsonBody(req);
    } catch (e) {
      auth.sendJson(res, 400, { ok: false, error: "Solicitud inválida." });
      return;
    }

    if (body.action === "logout") {
      auth.clearSessionCookie(req, res);
      auth.sendJson(res, 200, { ok: true, authenticated: false });
      return;
    }

    if (!auth.isAuthConfigured()) {
      auth.sendJson(res, 503, {
        ok: false,
        error: "Falta configurar AUTH_PASS_HASH en las variables de entorno.",
      });
      return;
    }

    const expectedUser = auth.getExpectedUser();
    const expectedHash = (process.env.AUTH_PASS_HASH || "").trim();
    const inputUser = String(body.user || "").trim();
    const inputPass = String(body.password || "").trim();

    const userMatch = inputUser.toLowerCase() === expectedUser.toLowerCase();
    const passMatch = auth.verifyPassword(inputPass, expectedHash);

    if (!userMatch || !passMatch) {
      auth.sendJson(res, 401, {
        ok: false,
        error: "Usuario o contraseña incorrectos.",
      });
      return;
    }

    auth.setSessionCookie(req, res, expectedUser);
    auth.sendJson(res, 200, {
      ok: true,
      authenticated: true,
      user: expectedUser,
    });
    return;
  }

  auth.sendJson(res, 405, { ok: false, error: "Método no permitido." });
};
