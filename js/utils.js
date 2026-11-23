/* Utilidades generales de DOM, formato, fechas y consultas sobre el estado */
(function (App) {
  "use strict";

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

  function fdate(ts) {
    var d = new Date(ts);
    if (d.toDateString() === new Date().toDateString()) return "hoy";
    return d.toLocaleDateString("es-AR", { day: "numeric", month: "short" });
  }

  function dayTitle(ts) {
    var d = new Date(ts);
    var s = App.DIAS[d.getDay()] + " " + d.getDate() + " de " + App.MESES[d.getMonth()];
    s = s.charAt(0).toUpperCase() + s.slice(1);
    return d.toDateString() === new Date().toDateString() ? s + " (hoy)" : s;
  }

  function full(c) {
    var n = [c.nombre, c.apellido].filter(Boolean).join(" ");
    if (c.apodo) n = n ? n + " “" + c.apodo + "”" : "“" + c.apodo + "”";
    return n || "Sin nombre";
  }

  function byId(id) {
    return App.state.clients.filter(function (c) {
      return c.id === id;
    })[0];
  }

  function lastOf(id) {
    var l = null;
    App.state.cuts.forEach(function (e) {
      if (e.cid === id && (!l || e.ts >= l.ts)) l = e;
    });
    return l;
  }

  function lastPrice(cut) {
    var cuts = App.state.cuts;
    for (var i = cuts.length - 1; i >= 0; i--) {
      if (cuts[i].cut === cut && cuts[i].price) return cuts[i].price;
    }
    return 0;
  }

  function matches(q) {
    var t = norm(q);
    return App.state.clients.filter(function (c) {
      return !t || norm([c.nombre, c.apellido, c.apodo].join(" ")).indexOf(t) >= 0;
    });
  }

  function inRange(ts) {
    var st = App.state;
    var d = new Date(ts);
    var n = new Date();
    if (st.range === "hoy") return d.toDateString() === n.toDateString();
    if (st.range === "sem") {
      var s = new Date(n.getFullYear(), n.getMonth(), n.getDate());
      s.setDate(s.getDate() - ((s.getDay() + 6) % 7));
      return d >= s;
    }
    if (st.range === "mes") {
      return d.getMonth() === st.mesM && d.getFullYear() === st.mesY;
    }
    return true;
  }

  function chipNames() {
    var counts = {};
    App.state.cuts.forEach(function (e) {
      counts[e.cut] = (counts[e.cut] || 0) + 1;
    });
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

  function rowHtml(c, extra) {
    var l = lastOf(c.id);
    return (
      '<div class="row go" data-pick="' +
      c.id +
      '"><div class="m"><div class="n">' +
      esc(full(c)) +
      '</div><div class="s">' +
      (l ? "Último: " + esc(l.cut) + ", " + fdate(l.ts) : "Sin cortes todavía") +
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

  function toast(t) {
    var el = $("toast");
    el.textContent = t || "Guardado ✓";
    el.classList.add("on");
    setTimeout(function () {
      el.classList.remove("on");
    }, 1200);
  }

  App.utils = {
    $: $,
    uid: uid,
    esc: esc,
    norm: norm,
    money: money,
    mm: mm,
    hora: hora,
    fdate: fdate,
    dayTitle: dayTitle,
    full: full,
    byId: byId,
    lastOf: lastOf,
    lastPrice: lastPrice,
    matches: matches,
    inRange: inRange,
    chipNames: chipNames,
    rowHtml: rowHtml,
    handleCutDelete: handleCutDelete,
    toast: toast,
  };
})((window.Barberia = window.Barberia || {}));
