/* Vista "Clientes" y modal para crear o editar clientes */
(function (App) {
  "use strict";

  var u = App.utils;
  var $ = u.$;

  function renderClients() {
    var list = u.matches($("q").value).sort(function (a, b) {
      return u.norm(u.full(a)).localeCompare(u.norm(u.full(b)));
    });

    if (!list.length) {
      $("clist").innerHTML =
        '<div class="empty">' +
        ($("q").value.trim()
          ? "No hay nadie con ese nombre."
          : "Acá van a aparecer tus clientes.") +
        "</div>";
      return;
    }

    $("clist").innerHTML = list
      .map(function (c) {
        var n = App.state.cuts.filter(function (e) {
          return e.cid === c.id;
        }).length;
        return u.rowHtml(
          c,
          '<div class="p">' +
            n +
            (n === 1 ? " visita" : " visitas") +
            '</div><button class="del" data-edit="' +
            c.id +
            '">Editar</button>'
        );
      })
      .join("");
  }

  function openForm(id, text) {
    App.state.editing = id || null;
    var c = id ? u.byId(id) : null;
    var n = "";
    var a = "";
    var k = "";
    if (!c && text) {
      var p = text.trim().split(/\s+/);
      n = p[0] || "";
      a = p[1] || "";
      k = p.slice(2).join(" ");
    }

    $("ovt").textContent = c ? "Editar cliente" : "Cliente nuevo";
    $("fn").value = c ? c.nombre : n;
    $("fa").value = c ? c.apellido : a;
    $("fk").value = c ? c.apodo : k;
    $("ft").value = c ? c.tel : "";
    $("ferr").textContent = "";
    $("ov-bg").hidden = false;
    $("ov").hidden = false;
    if (App.glass) App.glass.sync(true);

    setTimeout(function () {
      var target = "fn";
      if (c) target = "fk";
      else if (k) target = "ft";
      else if (a) target = "fk";
      else if (n) target = "fa";
      $(target).focus();
    }, 50);
  }

  function closeForm() {
    $("ov-bg").hidden = true;
    $("ov").hidden = true;
    if (App.glass) App.glass.sync();
  }

  function init() {
    $("q").oninput = renderClients;
    $("newc2").onclick = function () {
      openForm(null, $("q").value);
    };

    $("clist").onclick = function (ev) {
      var e = ev.target.closest("[data-edit]");
      if (e) {
        openForm(e.dataset.edit);
        return;
      }
      var r = ev.target.closest("[data-pick]");
      if (r) {
        App.tab("hoy");
        App.hoy.selectClient(r.dataset.pick);
        window.scrollTo(0, 0);
      }
    };

    $("fsave").onclick = function () {
      var st = App.state;
      var d = {
        nombre: $("fn").value.trim(),
        apellido: $("fa").value.trim(),
        apodo: $("fk").value.trim(),
        tel: $("ft").value.trim(),
      };

      if (!d.nombre && !d.apodo) {
        $("ferr").textContent = "Poné al menos el nombre o el apodo.";
        return;
      }

      var c;
      if (st.editing) {
        c = u.byId(st.editing);
        Object.keys(d).forEach(function (k) {
          c[k] = d[k];
        });
      } else {
        c = { id: u.uid() };
        Object.keys(d).forEach(function (k) {
          c[k] = d[k];
        });
        st.clients.push(c);
      }

      App.storage.save();
      if (App.sheets) App.sheets.enqueueClient(c);
      closeForm();
      if (!st.editing && st.view === "hoy") {
        App.hoy.selectClient(c.id);
      }
      App.renderAll();
      u.toast("Cliente guardado ✓");
    };

    $("fcancel").onclick = closeForm;
    $("ov-bg").onclick = closeForm;
  }

  App.clientes = {
    renderClients: renderClients,
    openForm: openForm,
    init: init,
  };
})((window.Barberia = window.Barberia || {}));
