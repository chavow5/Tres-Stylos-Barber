/* Vercel Serverless Function: proxy seguro hacia Google Apps Script (requiere sesión iniciada) */
const auth = require("./_auth.js");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  const sheetsUrl = (process.env.SHEETS_URL || "").trim();
  const sheetsToken = (process.env.SHEETS_TOKEN || "").trim();
  const method = (req.method || "GET").toUpperCase();

  if (method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  const action = (req.query && req.query.action) || "";
  const session = auth.verifySession(req);

  if (method === "GET" && action === "status") {
    auth.sendJson(res, 200, {
      ok: true,
      configured: Boolean(sheetsUrl),
      authenticated: Boolean(session),
    });
    return;
  }

  // Bloquea cualquier lectura/escritura si no hay sesión válida (cuando auth está configurado)
  if (auth.isAuthConfigured() && !session) {
    auth.sendJson(res, 401, {
      ok: false,
      authRequired: true,
      error: "Sesión expirada. Iniciá sesión nuevamente.",
    });
    return;
  }

  if (!sheetsUrl) {
    auth.sendJson(res, 503, {
      ok: false,
      configured: false,
      error: "Falta configurar SHEETS_URL en las variables de entorno.",
    });
    return;
  }

  try {
    let upstreamRes;

    if (method === "GET") {
      const sep = sheetsUrl.indexOf("?") >= 0 ? "&" : "?";
      const targetUrl =
        sheetsUrl +
        sep +
        "action=" +
        encodeURIComponent(action || "pull") +
        (sheetsToken ? "&token=" + encodeURIComponent(sheetsToken) : "");

      upstreamRes = await fetch(targetUrl, {
        method: "GET",
        redirect: "follow",
      });
    } else if (method === "POST") {
      const body = await auth.readJsonBody(req);
      const payload = Object.assign({}, body, { token: sheetsToken });

      upstreamRes = await fetch(sheetsUrl, {
        method: "POST",
        redirect: "follow",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
      });
    } else {
      auth.sendJson(res, 405, { ok: false, error: "Método no permitido." });
      return;
    }

    const text = await upstreamRes.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (parseErr) {
      auth.sendJson(res, 502, {
        ok: false,
        error: "Google Apps Script no devolvió JSON válido. Verificá los permisos de la implementación.",
      });
      return;
    }

    auth.sendJson(res, upstreamRes.ok ? 200 : upstreamRes.status, data);
  } catch (err) {
    auth.sendJson(res, 502, {
      ok: false,
      error: err && err.message ? err.message : "Error conectando con Google Sheets.",
    });
  }
};
