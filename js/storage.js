/* Persistencia en localStorage y migración de formato anterior */
(function (App) {
  "use strict";

  var K = App.STORAGE_KEYS;

  function load() {
    var st = App.state;
    var u = App.utils;

    try {
      st.clients = JSON.parse(localStorage.getItem(K.CLIENTS) || "[]");
      st.cuts = JSON.parse(localStorage.getItem(K.CUTS) || "[]");
    } catch (e) {
      st.clients = [];
      st.cuts = [];
    }

    if (!st.clients.length && !st.cuts.length) {
      try {
        var old = JSON.parse(localStorage.getItem(K.LEGACY_CUTS) || "[]");
        var map = {};
        old.forEach(function (o) {
          var k = u.norm(o.name);
          if (!map[k]) {
            map[k] = { id: u.uid(), nombre: o.name, apellido: "", apodo: "", tel: "" };
            st.clients.push(map[k]);
          }
          st.cuts.push({
            id: o.id,
            cid: map[k].id,
            cut: o.cut,
            price: o.price || 0,
            ts: o.ts,
          });
        });
        if (old.length) save();
      } catch (e) {}
    }

    try {
      st.oculto = localStorage.getItem(K.HIDDEN) === "1";
    } catch (e) {
      st.oculto = false;
    }
  }

  function save() {
    var st = App.state;
    try {
      localStorage.setItem(K.CLIENTS, JSON.stringify(st.clients));
      localStorage.setItem(K.CUTS, JSON.stringify(st.cuts));
    } catch (e) {}
  }

  function saveOculto() {
    try {
      localStorage.setItem(K.HIDDEN, App.state.oculto ? "1" : "0");
    } catch (e) {}
  }

  function getLogoSrc() {
    var src = App.DEFAULT_LOGO;
    try {
      var s = localStorage.getItem(K.LOGO);
      if (s) src = s;
    } catch (e) {}
    return src;
  }

  App.storage = {
    load: load,
    save: save,
    saveOculto: saveOculto,
    getLogoSrc: getLogoSrc,
  };
})((window.Barberia = window.Barberia || {}));
