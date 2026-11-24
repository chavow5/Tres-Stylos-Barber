/* Controlador liviano de fondo y marca de agua (100% GPU/CSS, sin WebGL ni lag en móvil) */
(function (App) {
  "use strict";

  var DEFAULT_WATERMARK = "assets/img/logo-watermark.png";

  function applyLogo(src) {
    var img = document.getElementById("bg-watermark");
    if (!img) return;

    var isDefault = !src || src === App.DEFAULT_LOGO || src === DEFAULT_WATERMARK;
    if (isDefault) {
      img.classList.remove("is-custom");
      if (img.getAttribute("src") !== DEFAULT_WATERMARK) {
        img.src = DEFAULT_WATERMARK;
      }
      return;
    }

    img.classList.add("is-custom");
    if (img.getAttribute("src") !== src) {
      img.src = src;
    }
  }

  function init() {
    var logoSrc = App.storage ? App.storage.getLogoSrc() : App.DEFAULT_LOGO;
    applyLogo(logoSrc);
  }

  App.glass = {
    sync: function () {},
    refreshBackground: function () {},
    markChanged: function () {},
    setLogo: applyLogo,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})((window.Barberia = window.Barberia || {}));
