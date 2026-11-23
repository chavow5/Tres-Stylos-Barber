/* Vista "Hoy": selección de cliente, carga de corte, precio, pago y último corte */
(function (App) {
  "use strict";

  var u = App.utils;
  var $ = u.$;

  function renderRes() {
    var q = $("cs").value;
    var qTrim = q.trim();
    var list;
    if (qTrim) {
      list = u.matches(qTrim).slice(0, 6);
    } else {
      list = App.state.clients
        .slice()
        .sort(function (a, b) {
          var x = u.lastOf(a.id);
          var y = u.lastOf(b.id);
          return (y ? y.ts : 0) - (x ? x.ts : 0);
        })
        .slice(0, 5);
    }

    var btn = $("newc");
    if (!list.length) {
      $("res").innerHTML =
        '<div class="empty">' +
        (qTrim
          ? "No está registrado. Crealo para poder continuar."
          : "Todavía no hay clientes. Creá el primero.") +
        "</div>";
      if (qTrim) {
        btn.textContent = '+ Crear "' + qTrim + '"';
        btn.classList.add("need-create");
      } else {
        btn.textContent = "+ Cliente nuevo";
        btn.classList.remove("need-create");
      }
      return;
    }

    btn.textContent = "+ Cliente nuevo";
    btn.classList.remove("need-create");

    $("res").innerHTML = list
      .map(function (c) {
        return u.rowHtml(c);
      })
      .join("");
  }

  function renderSel() {
    var c = App.state.sel && u.byId(App.state.sel);
    $("selbox").hidden = !c;
    $("finder").hidden = !!c;
    if (c) {
      $("seln").textContent = u.full(c);
      $("selt").textContent = c.tel || "Sin teléfono / DNI";
    } else {
      renderRes();
    }
  }

  function renderChips() {
    $("chips").innerHTML = u
      .chipNames()
      .map(function (c) {
        return (
          '<button type="button" class="chip" data-c="' +
          u.esc(c) +
          '" aria-pressed="' +
          (App.state.picked === c) +
          '">' +
          u.esc(c) +
          "</button>"
        );
      })
      .join("");
  }

  function renderPay() {
    Array.prototype.forEach.call($("pay").children, function (b) {
      b.setAttribute("aria-pressed", b.dataset.m === App.state.pay);
    });
  }

  function renderToday() {
    var today = App.state.cuts
      .slice()
      .sort(function (a, b) {
        return b.ts - a.ts;
      })
      .slice(0, 1);

    if (!today.length) {
      $("list").innerHTML =
        '<div class="empty">Todavía no cargaste ningún corte.</div>';
      return;
    }

    $("list").innerHTML = today
      .map(function (e) {
        var c = u.byId(e.cid);
        return (
          '<div class="row"><div class="m"><div class="n">' +
          u.esc(c ? u.full(c) : "Cliente borrado") +
          '</div><div class="s">' +
          u.esc(e.cut) +
          " · " +
          u.fdate(e.ts) +
          " " +
          u.hora(e.ts) +
          (e.pay
            ? " · " + (e.pay === "transferencia" ? "Transferencia" : "Efectivo")
            : "") +
          "</div></div>" +
          (e.price ? '<div class="p">' + u.mm(e.price) + "</div>" : "") +
          '<button class="del" data-id="' +
          e.id +
          '">Borrar</button></div>'
        );
      })
      .join("");
  }

  function pickCut(c) {
    App.state.picked = c;
    $("cut").value = "";
    if (!Number($("price").value)) {
      var p = u.lastPrice(c);
      $("price").value = p || "";
    }
    renderChips();
  }

  function selectClient(id) {
    App.state.sel = id;
    $("cs").value = "";
    var l = u.lastOf(id);
    App.state.picked = "";
    $("cut").value = "";
    $("price").value = "";
    if (l) {
      App.state.picked = l.cut;
      if (l.price) $("price").value = l.price;
    }
    $("err").textContent = "";
    renderSel();
    renderChips();
  }

  function init() {
    $("cs").oninput = renderRes;
    $("cs").onkeydown = function (ev) {
      if (ev.key !== "Enter") return;
      var qTrim = $("cs").value.trim();
      if (!qTrim) return;
      ev.preventDefault();
      var found = u.matches(qTrim);
      if (found.length === 1) {
        selectClient(found[0].id);
      } else if (!found.length) {
        App.clientes.openForm(null, qTrim);
      }
    };
    $("newc").onclick = function () {
      App.clientes.openForm(null, $("cs").value);
    };
    $("chg").onclick = function () {
      App.state.sel = null;
      renderSel();
      $("cs").focus();
    };
    $("res").onclick = function (ev) {
      var r = ev.target.closest("[data-pick]");
      if (r) selectClient(r.dataset.pick);
    };
    $("chips").onclick = function (ev) {
      var b = ev.target.closest(".chip");
      if (b) pickCut(b.dataset.c);
    };
    $("cut").oninput = function () {
      if (this.value) {
        App.state.picked = "";
        renderChips();
      }
    };
    document.querySelector(".pr").onclick = function (ev) {
      var b = ev.target.closest("button");
      if (!b) return;
      var v = Number($("price").value) || 0;
      var a = b.dataset.p;
      if (a === "set10") v = 10000;
      else if (a === "add") v += 1000;
      else if (a === "sub") v = Math.max(0, v - 1000);
      else v = 0;
      $("price").value = v || "";
    };
    $("pay").onclick = function (ev) {
      var b = ev.target.closest("button");
      if (b) {
        App.state.pay = b.dataset.m;
        renderPay();
      }
    };
    $("save").onclick = function () {
      var st = App.state;
      var cut = st.picked || $("cut").value.trim();
      if (!st.sel || !u.byId(st.sel)) {
        var typed = $("cs").value.trim();
        $("err").textContent = typed
          ? 'El cliente "' + typed + '" no existe. Crealo primero.'
          : "Elegí un cliente o creá uno nuevo.";
        if (typed) App.clientes.openForm(null, typed);
        return;
      }
      if (!cut) {
        $("err").textContent = "Elegí o escribí el corte.";
        return;
      }
      var newCut = {
        id: u.uid(),
        cid: st.sel,
        cut: cut,
        price: Number($("price").value) || 0,
        pay: st.pay,
        ts: Date.now(),
      };
      st.cuts.push(newCut);
      App.storage.save();
      if (App.sheets) App.sheets.enqueueCut(newCut);
      st.sel = null;
      st.picked = "";
      st.pay = "efectivo";
      $("cut").value = "";
      $("price").value = "";
      $("err").textContent = "";
      App.renderAll();
      u.toast();
      window.scrollTo(0, 0);
    };
    $("list").onclick = u.handleCutDelete;
  }

  App.hoy = {
    renderRes: renderRes,
    renderSel: renderSel,
    renderChips: renderChips,
    renderPay: renderPay,
    renderToday: renderToday,
    pickCut: pickCut,
    selectClient: selectClient,
    init: init,
  };
})((window.Barberia = window.Barberia || {}));
