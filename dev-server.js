/* Servidor local de desarrollo: sirve archivos estáticos, /api/auth y /api/sheets leyendo .env.local */
const http = require("http");
const fs = require("fs");
const path = require("path");
const authHandler = require("./api/auth.js");
const sheetsHandler = require("./api/sheets.js");

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 3000;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
  ".ico": "image/x-icon",
};

function loadEnvFile(filename) {
  const fullPath = path.join(ROOT, filename);
  if (!fs.existsSync(fullPath)) return;
  const lines = fs.readFileSync(fullPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url || "/", `http://127.0.0.1:${PORT}`);
  const pathname = decodeURIComponent(parsedUrl.pathname);

  if (pathname === "/api/auth") {
    req.query = Object.fromEntries(parsedUrl.searchParams.entries());
    await authHandler(req, res);
    return;
  }

  if (pathname === "/api/sheets") {
    req.query = Object.fromEntries(parsedUrl.searchParams.entries());
    await sheetsHandler(req, res);
    return;
  }

  let rel = pathname === "/" ? "/index.html" : pathname;
  let fp = path.join(ROOT, rel);

  if (!fp.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  // Bloquea acceso HTTP a archivos sensibles o de backend
  const base = path.basename(fp);
  if (
    base.startsWith(".env") ||
    pathname.startsWith("/.git") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/scripts/") ||
    pathname.startsWith("/google-apps-script/")
  ) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  if (!fs.existsSync(fp) && fs.existsSync(fp + ".html")) {
    fp += ".html";
  }

  fs.readFile(fp, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const ext = path.extname(fp).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
  console.log(
    `Login (/api/auth): ${process.env.AUTH_PASS_HASH ? "CONFIGURADO (" + (process.env.AUTH_USER || "Tresstylos") + ")" : "SIN CONFIGURAR"}`
  );
  console.log(
    `Google Sheets proxy (/api/sheets): ${process.env.SHEETS_URL ? "CONFIGURADO (.env.local)" : "SIN CONFIGURAR"}`
  );
});
