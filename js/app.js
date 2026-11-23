/* Punto de entrada principal: navegación por pestañas, logo e inicialización */
(function (App) {
  "use strict";

  var $ = App.utils.$;

  function renderAll() {
    App.hoy.renderSel();
    App.hoy.renderChips();
    App.hoy.renderToday();
    App.clientes.renderClients();
    App.hoy.renderPay();
    App.resumen.renderStats();
    App.resumen.renderHist();
    App.resumen.setEyes();
    if (App.glass) App.glass.markChanged();
  }

  function tab(w) {
    App.state.view = w;

    Array.prototype.forEach.call(
      document.querySelectorAll("#lg-root > [data-view]"),
      function (el) {
        el.hidden = el.getAttribute("data-view") !== w;
      }
    );

    $("t-hoy").setAttribute("aria-selected", w === "hoy");
    $("t-cli").setAttribute("aria-selected", w === "cli");
    $("t-res").setAttribute("aria-selected", w === "res");

    if (w === "cli") App.clientes.renderClients();
    if (w === "res") {
      App.resumen.renderStats();
      App.resumen.renderHist();
    } else {
      $("mnav").hidden = true;
    }

    if (App.glass) App.glass.sync();
  }

  function renderLogo() {
    if (App.glass) {
      App.glass.setLogo(App.storage.getLogoSrc());
    }
  }

  function init() {
    $("t-hoy").onclick = function () {
      tab("hoy");
    };
    $("t-cli").onclick = function () {
      tab("cli");
    };
    $("t-res").onclick = function () {
      tab("res");
    };

    App.storage.load();
    App.hoy.init();
    App.clientes.init();
    App.resumen.init();
    renderAll();
    renderLogo();

    if (App.auth) {
      App.auth.init(function () {
        if (App.sheets) App.sheets.init();
      });
    } else if (App.sheets) {
      App.sheets.init();
    }
  }

  App.renderAll = renderAll;
  App.tab = tab;
  App.renderLogo = renderLogo;

  init();
})((window.Barberia = window.Barberia || {}));
