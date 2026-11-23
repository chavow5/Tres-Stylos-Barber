/* Vista "Resumen": filtros de período, métricas, privacidad de importes e historial */
(function (App) {
  "use strict";

  var u = App.utils;
  var $ = u.$;

  function setEyes() {
    var oculto = App.state.oculto;
    Array.prototype.forEach.call(document.querySelectorAll("[data-eye]"), function (b) {
      b.innerHTML = oculto ? App.ICONS.EYE_OFF : App.ICONS.EYE_ON;
      b.setAttribute("aria-label", oculto ? "Mostrar importes" : "Ocultar importes");
    });
  }

  function renderStats() {
    var st = App.state;
    var l = st.cuts.filter(function (e) {
      return u.inRange(e.ts);
    });
    var tot = 0;
    var tr = 0;
    var ef = 0;
    var nd = 0;

    l.forEach(function (e) {
      tot += Number(e.price) || 0;
      if (e.pay === "transferencia") tr++;
      else if (e.pay === "efectivo") ef++;
      else nd++;
    });

    $("s-n").textContent = l.length;
    $("s-t").textContent = u.mm(tot);
    $("s-tr").textContent = tr;
    $("s-ef").textContent = ef;
    $("s-nd").textContent = nd
      ? nd +
        (nd === 1
          ? " corte anterior sin forma de pago."
          : " cortes anteriores sin forma de pago.")
      : "";

    Array.prototype.forEach.call($("rng").querySelectorAll("button"), function (b) {
      b.setAttribute("aria-pressed", b.dataset.r === st.range);
    });

    var now = new Date();
    $("mnav").hidden = st.view !== "res" || st.range !== "mes";
    $("mname").textContent =
      App.MESES[st.mesM].charAt(0).toUpperCase() +
      App.MESES[st.mesM].slice(1) +
      " " +
      st.mesY;
    $("mnext").disabled =
      st.mesY * 12 + st.mesM >= now.getFullYear() * 12 + now.getMonth();
  }

  function setHistMarkup(html) {
    var root = $("lg-root");
    var isHidden = App.state.view !== "res";

    Array.prototype.slice
      .call(root.querySelectorAll("[data-hist-item]"))
      .forEach(function (el) {
        el.remove();
      });

    var tpl = document.createElement("template");
    tpl.innerHTML = html;

    Array.prototype.slice.call(tpl.content.children).forEach(function (node) {
      node.setAttribute("data-hist-item", "");
      node.setAttribute("data-view", "res");
      if (isHidden) node.hidden = true;
      root.appendChild(node);
    });

    if (App.state.view === "res" && App.glass) {
      App.glass.sync();
    }
  }

  function renderHist() {
    if (!App.state.cuts.length) {
      setHistMarkup(
        '<div class="card lg-panel" data-lg="card"><div class="empty">Acá va a aparecer el historial, día por día.</div></div>'
      );
      return;
    }

    var groups = [];
    App.state.cuts
      .filter(function (e) {
        return u.inRange(e.ts);
      })
      .sort(function (a, b) {
        return b.ts - a.ts;
      })
      .forEach(function (e) {
        var k = new Date(e.ts).toDateString();
        if (!groups.length || groups[groups.length - 1].k !== k) {
          groups.push({ k: k, ts: e.ts, items: [] });
        }
        groups[groups.length - 1].items.push(e);
      });

    if (!groups.length) {
      setHistMarkup(
        '<div class="card lg-panel" data-lg="card"><div class="empty">No hay cortes en este período.</div></div>'
      );
      return;
    }

    var html = groups
      .map(function (g) {
        var tot = g.items.reduce(function (s, e) {
          return s + (Number(e.price) || 0);
        }, 0);
        return (
          '<div class="dh"><b>' +
          u.esc(u.dayTitle(g.ts)) +
          "</b><span>" +
          g.items.length +
          (g.items.length === 1 ? " corte" : " cortes") +
          (tot ? " · " + u.mm(tot) : "") +
          '</span></div><div class="card lg-panel" data-lg="card"><div>' +
          g.items
            .map(function (e) {
              var c = u.byId(e.cid);
              return (
                '<div class="row"><div class="m"><div class="n">' +
                u.esc(c ? u.full(c) : "Cliente borrado") +
                '</div><div class="s">' +
                u.esc(e.cut) +
                " · " +
                u.hora(e.ts) +
                (e.pay
                  ? " · " +
                    (e.pay === "transferencia" ? "Transferencia" : "Efectivo")
                  : "") +
                "</div></div>" +
                (e.price ? '<div class="p">' + u.mm(e.price) + "</div>" : "") +
                '<button class="del" data-id="' +
                e.id +
                '">Borrar</button></div>'
              );
            })
            .join("") +
          "</div></div>"
        );
      })
      .join("");

    setHistMarkup(html);
  }

  function moveMes(d) {
    var st = App.state;
    var t = st.mesY * 12 + st.mesM + d;
    var now = new Date();
    if (t > now.getFullYear() * 12 + now.getMonth()) return;
    st.mesY = Math.floor(t / 12);
    st.mesM = t % 12;
    renderStats();
    renderHist();
  }

  function init() {
    $("rng").onclick = function (ev) {
      var b = ev.target.closest("button");
      if (b) {
        App.state.range = b.dataset.r;
        renderStats();
        renderHist();
      }
    };

    $("mprev").onclick = function () {
      moveMes(-1);
    };
    $("mnext").onclick = function () {
      moveMes(1);
    };

    $("lg-root").addEventListener("click", function (ev) {
      if (!ev.target.closest("[data-hist-item]")) return;
      u.handleCutDelete(ev);
    });

    document.addEventListener("click", function (ev) {
      if (!ev.target.closest("[data-eye]")) return;
      App.state.oculto = !App.state.oculto;
      App.storage.saveOculto();
      App.renderAll();
    });
  }

  App.resumen = {
    setEyes: setEyes,
    renderStats: renderStats,
    renderHist: renderHist,
    moveMes: moveMes,
    init: init,
  };
})((window.Barberia = window.Barberia || {}));
