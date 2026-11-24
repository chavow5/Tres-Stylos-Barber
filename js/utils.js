/* Utilidades generales de DOM, formato, fechas e índices rápidos O(1) sobre el estado */
(function (App) {
  "use strict";

  var indexDirty = true;
  var indexedClientsRef = null;
  var indexedClientsLen = -1;
  var indexedCutsRef = null;
  var indexedCutsLen = -1;

  var clientsById = Object.create(null);
  var searchByClientId = Object.create(null);
  var lastCutByClient = Object.create(null);
  var cutCountByClient = Object.create(null);

  function $(id) {
    return document.getElementById(id);
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function norm(s) {
    return String(s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }

  function invalidateIndex() {
    indexDirty = true;
  }

  function ensureIndex() {
    var st = App.state;
    if (
      !indexDirty &&
      indexedClientsRef === st.clients &&
      indexedClientsLen === st.clients.length &&
      indexedCutsRef === st.cuts &&
      indexedCutsLen === st.cuts.length
    ) {
      return;
    }

    clientsById = Object.create(null);
    searchByClientId = Object.create(null);
    lastCutByClient = Object.create(null);
    cutCountByClient = Object.create(null);

    var clients = st.clients;
    for (var i = 0; i < clients.length; i++) {
      var c = clients[i];
      clientsById[c.id] = c;
      searchByClientId[c.id] = norm([c.nombre, c.apellido, c.apodo].join(" "));
    }

    var cuts = st.cuts;
    for (var j = 0; j < cuts.length; j++) {
      var e = cuts[j];
      var cid = e.cid;
      cutCountByClient[cid] = (cutCountByClient[cid] || 0) + 1;
      var prev = lastCutByClient[cid];
      if (!prev || e.ts >= prev.ts) {
        lastCutByClient[cid] = e;
      }
    }

    indexedClientsRef = clients;
    indexedClientsLen = clients.length;
    indexedCutsRef = cuts;
    indexedCutsLen = cuts.length;
    indexDirty = false;
  }

  function money(n) {
    return "$" + Number(n).toLocaleString("es-AR");
  }

  function mm(n) {
    return App.state.oculto ? "$ ••••" : money(n);
  }

  function hora(ts) {
    return new Date(ts).toLocaleTimeString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function fdate(ts, todayStr) {
    var d = new Date(ts);
    if (d.toDateString() === (todayStr || new Date().toDateString())) return "hoy";
    return d.toLocaleDateString("es-AR", { day: "numeric", month: "short" });
  }

  function dayTitle(ts, todayStr) {
    var d = new Date(ts);
    var s = App.DIAS[d.getDay()] + " " + d.getDate() + " de " + App.MESES[d.getMonth()];
    s = s.charAt(0).toUpperCase() + s.slice(1);
    return d.toDateString() === (todayStr || new Date().toDateString()) ? s + " (hoy)" : s;
  }

  function full(c) {
    var n = [c.nombre, c.apellido].filter(Boolean).join(" ");
    if (c.apodo) n = n ? n + " “" + c.apodo + "”" : "“" + c.apodo + "”";
    return n || "Sin nombre";
  }

  function byId(id) {
    ensureIndex();
    return clientsById[id];
  }

  function lastOf(id) {
    ensureIndex();
    return lastCutByClient[id] || null;
  }

  function visitCount(id) {
    ensureIndex();
    return cutCountByClient[id] || 0;
  }

  function lastPrice(cut) {
    var cuts = App.state.cuts;
    for (var i = cuts.length - 1; i >= 0; i--) {
      if (cuts[i].cut === cut && cuts[i].price) return cuts[i].price;
    }
    return 0;
  }

  function matches(q) {
    ensureIndex();
    var t = norm(q);
    if (!t) return App.state.clients.slice();
    return App.state.clients.filter(function (c) {
      return (searchByClientId[c.id] || "").indexOf(t) >= 0;
    });
  }

  function getRangeContext() {
    var st = App.state;
    var n = new Date();
    var weekStart = new Date(n.getFullYear(), n.getMonth(), n.getDate());
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
    return {
      range: st.range,
      mesM: st.mesM,
      mesY: st.mesY,
      todayStr: n.toDateString(),
      weekStartMs: weekStart.getTime(),
    };
  }

  function inRange(ts, ctx) {
    var c = ctx || getRangeContext();
    if (c.range === "todo") return true;
    if (c.range === "sem") return ts >= c.weekStartMs;
    var d = new Date(ts);
    if (c.range === "hoy") return d.toDateString() === c.todayStr;
    if (c.range === "mes") {
      return d.getMonth() === c.mesM && d.getFullYear() === c.mesY;
    }
    return true;
  }

  function chipNames() {
    var counts = Object.create(null);
    var cuts = App.state.cuts;
    for (var i = 0; i < cuts.length; i++) {
      var cut = cuts[i].cut;
      counts[cut] = (counts[cut] || 0) + 1;
    }
    var extra = Object.keys(counts)
      .filter(function (c) {
        return App.DEFAULTS.indexOf(c) < 0;
      })
      .sort(function (a, b) {
        return counts[b] - counts[a];
      })
      .slice(0, 4);
    return App.DEFAULTS.concat(extra);
  }

  function rowHtml(c, extra, todayStr) {
    var l = lastOf(c.id);
    return (
      '<div class="row go" data-pick="' +
      c.id +
      '"><div class="m"><div class="n">' +
      esc(full(c)) +
      '</div><div class="s">' +
      (l ? "Último: " + esc(l.cut) + ", " + fdate(l.ts, todayStr) : "Sin cortes todavía") +
      (c.tel ? " · " + esc(c.tel) : "") +
      "</div></div>" +
      (extra || "") +
      "</div>"
    );
  }

  function handleCutDelete(ev) {
    var b = ev.target.closest(".del");
    if (!b) return;
    if (!b.classList.contains("sure")) {
      b.classList.add("sure");
      b.textContent = "¿Seguro?";
      setTimeout(function () {
        b.classList.remove("sure");
        b.textContent = "Borrar";
      }, 2500);
      return;
    }
    var delId = b.dataset.id;
    App.state.cuts = App.state.cuts.filter(function (e) {
      return e.id !== delId;
    });
    App.storage.save();
    if (App.sheets) App.sheets.enqueueDeleteCut(delId);
    App.renderAll();
  }

  var toastTimer = 0;
  function toast(t) {
    var el = $("toast");
    el.textContent = t || "Guardado ✓";
    el.classList.add("on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.classList.remove("on");
    }, 1200);
  }

  App.utils = {
    $: $,
    uid: uid,
    esc: esc,
    norm: norm,
    invalidateIndex: invalidateIndex,
    money: money,
    mm: mm,
    hora: hora,
    fdate: fdate,
    dayTitle: dayTitle,
    full: full,
    byId: byId,
    lastOf: lastOf,
    visitCount: visitCount,
    lastPrice: lastPrice,
    matches: matches,
    getRangeContext: getRangeContext,
    inRange: inRange,
    chipNames: chipNames,
    rowHtml: rowHtml,
    handleCutDelete: handleCutDelete,
    toast: toast,
  };
})((window.Barberia = window.Barberia || {}));
