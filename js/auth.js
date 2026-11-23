/* Controlador de login y sesión (cookie HttpOnly vía /api/auth) */
(function (App) {
  "use strict";

  var u = App.utils;
  var $ = u.$;

  var authenticated = false;
  var authEnabled = false;
  var onReadyCallback = null;
  var booted = false;

  function setAppVisible(visible) {
    var appShell = document.querySelectorAll("#lg-root > [data-app]");
    Array.prototype.forEach.call(appShell, function (el) {
      el.hidden = !visible;
    });

    if (!visible) {
      var views = document.querySelectorAll("#lg-root > [data-view]");
      Array.prototype.forEach.call(views, function (el) {
        el.hidden = true;
      });
      $("ov-bg").hidden = true;
      $("ov").hidden = true;
      $("ov-sheets-bg").hidden = true;
      $("ov-sheets").hidden = true;
    }

    var logoutBtn = $("logout-btn");
    if (logoutBtn) logoutBtn.hidden = !authEnabled;
  }

  function showLogin(errorMsg) {
    authenticated = false;
    setAppVisible(false);
    $("login-card").hidden = false;
    $("login-err").textContent = errorMsg || "";
    $("login-pass").value = "";

    if (App.glass) App.glass.sync(true);

    setTimeout(function () {
      var userInput = $("login-user");
      if (userInput && !userInput.value.trim()) {
        userInput.focus();
      } else {
        $("login-pass").focus();
      }
    }, 60);
  }

  function showApp() {
    authenticated = true;
    $("login-card").hidden = true;
    setAppVisible(true);
    App.tab(App.state.view || "hoy");

    if (!booted) {
      booted = true;
      if (typeof onReadyCallback === "function") onReadyCallback();
    } else if (App.sheets) {
      App.sheets.refreshAfterLogin();
    }
  }

  function checkSession() {
    if (!App.AUTH_API || window.location.protocol === "file:") {
      authEnabled = false;
      showApp();
      return;
    }

    fetch(App.AUTH_API + "?_t=" + Date.now(), {
      method: "GET",
      cache: "no-store",
      credentials: "same-origin",
    })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (data) {
        authEnabled = Boolean(data && data.configured);
        if (!authEnabled || (data && data.authenticated)) {
          showApp();
        } else {
          showLogin("");
        }
      })
      .catch(function () {
        // Si no hay servidor (ej. hosting puramente estático sin /api), deja operar en local
        authEnabled = false;
        showApp();
      });
  }

  function handleLoginSubmit(ev) {
    ev.preventDefault();
    var user = $("login-user").value.trim();
    var password = $("login-pass").value.trim();

    if (!user || !password) {
      $("login-err").textContent = "Completá usuario y contraseña.";
      return;
    }

    var btn = $("login-btn");
    btn.disabled = true;
    btn.textContent = "Ingresando…";
    $("login-err").textContent = "";

    fetch(App.AUTH_API, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user: user, password: password }),
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok, data: data };
        });
      })
      .then(function (result) {
        btn.disabled = false;
        btn.textContent = "Ingresar";

        if (!result.ok || !result.data || !result.data.ok) {
          $("login-err").textContent =
            (result.data && result.data.error) ||
            "Usuario o contraseña incorrectos.";
          $("login-pass").focus();
          $("login-pass").select();
          return;
        }

        $("login-pass").value = "";
        showApp();
        u.toast("Bienvenido ✓");
      })
      .catch(function () {
        btn.disabled = false;
        btn.textContent = "Ingresar";
        $("login-err").textContent = "No se pudo conectar con el servidor.";
      });
  }

  function logout() {
    fetch(App.AUTH_API, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    })
      .catch(function () {})
      .finally(function () {
        showLogin("");
        u.toast("Sesión cerrada");
      });
  }

  function requireLogin(msg) {
    if (!authEnabled) return;
    showLogin(msg || "Tu sesión expiró. Ingresá nuevamente.");
  }

  function init(onAuthenticated) {
    onReadyCallback = onAuthenticated;
    $("login-form").onsubmit = handleLoginSubmit;
    $("logout-btn").onclick = logout;
    checkSession();
  }

  App.auth = {
    init: init,
    logout: logout,
    requireLogin: requireLogin,
    isAuthenticated: function () {
      return authenticated;
    },
  };
})((window.Barberia = window.Barberia || {}));
