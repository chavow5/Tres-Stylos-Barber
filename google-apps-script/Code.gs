/**
 * Tres Stylos Barber — Backend en Google Apps Script para usar Google Sheets como base de datos.
 *
 * Cómo instalarlo:
 * 1. Abrí una planilla nueva en Google Sheets (sheets.new).
 * 2. Menú: Extensiones -> Apps Script.
 * 3. Borrá el contenido inicial, pegá todo este archivo y guardá.
 * 4. Botón "Implementar" -> "Nueva implementación" -> Tipo: "Aplicación web".
 *    - Ejecutar como: "Yo"
 *    - Quién tiene acceso: "Cualquier persona"
 * 5. Copiá la URL de la aplicación web (termina en /exec) y pegala en la app o en js/config.js.
 */

// Opcional: si querés proteger la planilla con una clave simple, escribila acá
// y poné la misma clave en la app (o en js/config.js -> SHEETS_TOKEN).
var SECRET_TOKEN = "";

var SHEET_CLIENTS = "Clientes";
var SHEET_CUTS = "Cortes";

var CLIENT_HEADERS = ["id", "nombre", "apellido", "apodo", "tel", "updatedAt"];
var CUT_HEADERS = ["id", "cid", "cliente", "cut", "price", "pay", "ts", "fecha"];

function doGet(e) {
  try {
    var params = (e && e.parameter) || {};
    if (!checkToken_(params.token)) {
      return jsonOut_({ ok: false, error: "Token inválido." });
    }
    var action = params.action || "pull";
    if (action === "ping") {
      return jsonOut_({ ok: true, serverTime: Date.now() });
    }
    if (action === "pull") {
      return jsonOut_(pullAll_());
    }
    return jsonOut_({ ok: false, error: "Acción GET no soportada: " + action });
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var raw = (e && e.postData && e.postData.contents) || "{}";
    var body = JSON.parse(raw);

    if (!checkToken_(body.token)) {
      return jsonOut_({ ok: false, error: "Token inválido." });
    }

    var action = body.action || "";

    if (action === "pull") {
      return jsonOut_(pullAll_());
    }
    if (action === "upsertClient") {
      upsertClient_(body.client);
      return jsonOut_({ ok: true, serverTime: Date.now() });
    }
    if (action === "addCut") {
      addCut_(body.cut, body.clientName || "");
      return jsonOut_({ ok: true, serverTime: Date.now() });
    }
    if (action === "deleteCut") {
      deleteCut_(body.id);
      return jsonOut_({ ok: true, serverTime: Date.now() });
    }
    if (action === "syncAll") {
      syncAll_(body.clients || [], body.cuts || []);
      return jsonOut_(pullAll_());
    }

    return jsonOut_({ ok: false, error: "Acción POST no soportada: " + action });
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err && err.message ? err.message : err) });
  } finally {
    lock.releaseLock();
  }
}

function checkToken_(token) {
  if (!SECRET_TOKEN) return true;
  return String(token || "") === String(SECRET_TOKEN);
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function getOrCreateSheet_(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
  }
  if (sh.getLastRow() === 0) {
    sh.appendRow(headers);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, headers.length).setFontWeight("bold");
  }
  return sh;
}

function formatDateAR_(ts) {
  try {
    return Utilities.formatDate(
      new Date(Number(ts) || Date.now()),
      Session.getScriptTimeZone(),
      "dd/MM/yyyy HH:mm"
    );
  } catch (e) {
    return "";
  }
}

function pullAll_() {
  var shC = getOrCreateSheet_(SHEET_CLIENTS, CLIENT_HEADERS);
  var shE = getOrCreateSheet_(SHEET_CUTS, CUT_HEADERS);

  var clients = [];
  var lastC = shC.getLastRow();
  if (lastC > 1) {
    var rowsC = shC.getRange(2, 1, lastC - 1, CLIENT_HEADERS.length).getValues();
    for (var i = 0; i < rowsC.length; i++) {
      var r = rowsC[i];
      if (!r[0]) continue;
      clients.push({
        id: String(r[0]),
        nombre: String(r[1] || ""),
        apellido: String(r[2] || ""),
        apodo: String(r[3] || ""),
        tel: String(r[4] || ""),
      });
    }
  }

  var cuts = [];
  var lastE = shE.getLastRow();
  if (lastE > 1) {
    var rowsE = shE.getRange(2, 1, lastE - 1, CUT_HEADERS.length).getValues();
    for (var j = 0; j < rowsE.length; j++) {
      var e = rowsE[j];
      if (!e[0]) continue;
      cuts.push({
        id: String(e[0]),
        cid: String(e[1] || ""),
        cut: String(e[3] || ""),
        price: Number(e[4]) || 0,
        pay: String(e[5] || ""),
        ts: Number(e[6]) || 0,
      });
    }
  }

  return {
    ok: true,
    clients: clients,
    cuts: cuts,
    serverTime: Date.now(),
  };
}

function findRowById_(sheet, id) {
  var last = sheet.getLastRow();
  if (last <= 1) return -1;
  var ids = sheet.getRange(2, 1, last - 1, 1).getValues();
  var target = String(id);
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === target) return i + 2;
  }
  return -1;
}

function upsertClient_(c) {
  if (!c || !c.id) return;
  var sh = getOrCreateSheet_(SHEET_CLIENTS, CLIENT_HEADERS);
  var rowValues = [
    String(c.id),
    String(c.nombre || ""),
    String(c.apellido || ""),
    String(c.apodo || ""),
    String(c.tel || ""),
    formatDateAR_(Date.now()),
  ];
  var rowIdx = findRowById_(sh, c.id);
  if (rowIdx > 0) {
    sh.getRange(rowIdx, 1, 1, CLIENT_HEADERS.length).setValues([rowValues]);
  } else {
    sh.appendRow(rowValues);
  }
}

function addCut_(cut, clientName) {
  if (!cut || !cut.id) return;
  var sh = getOrCreateSheet_(SHEET_CUTS, CUT_HEADERS);
  if (findRowById_(sh, cut.id) > 0) return; // Evita duplicados en reintentos

  var rowValues = [
    String(cut.id),
    String(cut.cid || ""),
    String(clientName || ""),
    String(cut.cut || ""),
    Number(cut.price) || 0,
    String(cut.pay || ""),
    Number(cut.ts) || Date.now(),
    formatDateAR_(cut.ts),
  ];
  sh.appendRow(rowValues);
}

function deleteCut_(id) {
  if (!id) return;
  var sh = getOrCreateSheet_(SHEET_CUTS, CUT_HEADERS);
  var rowIdx = findRowById_(sh, id);
  if (rowIdx > 0) {
    sh.deleteRow(rowIdx);
  }
}

function syncAll_(clients, cuts) {
  var clientMap = {};
  for (var i = 0; i < clients.length; i++) {
    var c = clients[i];
    if (!c || !c.id) continue;
    upsertClient_(c);
    var name = [c.nombre, c.apellido].filter(Boolean).join(" ");
    if (c.apodo) name = name ? name + ' "' + c.apodo + '"' : '"' + c.apodo + '"';
    clientMap[String(c.id)] = name || "Sin nombre";
  }
  for (var j = 0; j < cuts.length; j++) {
    var cut = cuts[j];
    if (!cut || !cut.id) continue;
    addCut_(cut, clientMap[String(cut.cid)] || "");
  }
}
