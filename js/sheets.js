/* Sincronización híbrida con Google Sheets vía proxy /api/sheets (Vercel / local) o URL manual */
(function (App) {
  "use strict";

  var K = App.STORAGE_KEYS;
  var u = App.utils;
  var $ = u.$;

  var queue = [];
  var syncing = false;
  var lastError = "";
  var proxyReady = false;

  function getManualUrl() {
    try {
      var saved = localStorage.getItem(K.SHEETS_URL);
      if (saved && saved.trim()) return saved.trim();
    } catch (e) {}
    return (App.SHEETS_URL || "").trim();
  }

  function getManualToken() {
    try {
      var saved = localStorage.getItem(K.SHEETS_TOKEN);
      if (saved !== null) return saved.trim();
    } catch (e) {}
    return (App.SHEETS_TOKEN || "").trim();
  }

  function usingProxy() {
    return !getManualUrl() && proxyReady && Boolean(App.SHEETS_API);
  }

  function isConfigured() {
    return Boolean(getManualUrl()) || proxyReady;
  }

  function loadQueue() {
    try {
      queue = JSON.parse(localStorage.getItem(K.PENDING_OPS) || "[]");
      if (!Array.isArray(queue)) queue = [];
    } catch (e) {
      queue = [];
    }
  }

  function saveQueue() {
    try {
      localStorage.setItem(K.PENDING_OPS, JSON.stringify(queue));
    } catch (e) {}
  }

  function setLastSync(ts) {
    try {
      localStorage.setItem(K.LAST_SYNC, String(ts));
    } catch (e) {}
  }

  function getLastSync() {
    try {
      return Number(localStorage.getItem(K.LAST_SYNC)) || 0;
    } catch (e) {
      return 0;
    }
  }

  function updateStatusUI(mode, customText) {
    var dot = $("sync-dot");
    var txt = $("sync-txt");
    if (!dot || !txt) return;

    dot.className = "sync-dot";

    if (!isConfigured()) {
      dot.classList.add("off");
      txt.textContent = "Excel · Sin conectar";
      return;
    }

    if (mode === "busy" || syncing) {
      dot.classList.add("busy");
      txt.textContent = customText || "Sincronizando…";
      return;
    }

    if (mode === "err" || lastError) {
      dot.classList.add("err");
      txt.textContent =
        customText ||
        (queue.length
          ? "Pendiente (" + queue.length + ") · Reintentar"
          : "Error de conexión · Tocar para ver");
      return;
    }

    if (queue.length) {
      dot.classList.add("busy");
      txt.textContent = "Pendiente (" + queue.length + ")";
      return;
    }

    dot.classList.add("ok");
    var ts = getLastSync();
    txt.textContent = ts
      ? "Excel · " + u.hora(ts)
      : "Excel · Conectado";
  }

  function checkProxyStatus() {
    if (!App.SHEETS_API || window.location.protocol === "file:") {
      proxyReady = false;
      return Promise.resolve(false);
    }

    return fetch(App.SHEETS_API + "?action=status&_t=" + Date.now(), {
      method: "GET",
      cache: "no-store",
    })
      .then(function (res) {
        if (!res.ok) return { configured: false };
        return res.json();
      })
      .then(function (data) {
        proxyReady = Boolean(data && data.ok && data.configured);
        return proxyReady;
      })
      .catch(function () {
        proxyReady = false;
        return false;
      });
  }

  function postAction(payload) {
    if (usingProxy()) {
      return fetch(App.SHEETS_API, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then(function (res) {
          return res.json().catch(function () {
            throw new Error("HTTP " + res.status);
          });
        })
        .then(function (data) {
          if (data && data.authRequired && App.auth) {
            App.auth.requireLogin(data.error);
          }
          if (!data || !data.ok) {
            throw new Error((data && data.error) || "Respuesta inválida del servidor.");
          }
          return data;
        });
    }

    var url = getManualUrl();
    if (!url) return Promise.reject(new Error("Sin conexión configurada."));

    var body = Object.assign({}, payload, { token: getManualToken() });
    return fetch(url, {
      method: "POST",
      redirect: "follow",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(body),
    })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (data) {
        if (!data || !data.ok) {
          throw new Error((data && data.error) || "Respuesta inválida de Sheets.");
        }
        return data;
      });
  }

  function getAction(action) {
    if (usingProxy()) {
      return fetch(
        App.SHEETS_API +
          "?action=" +
          encodeURIComponent(action) +
          "&_t=" +
          Date.now(),
        { method: "GET", cache: "no-store", credentials: "same-origin" }
      )
        .then(function (res) {
          return res.json().catch(function () {
            throw new Error("HTTP " + res.status);
          });
        })
        .then(function (data) {
          if (data && data.authRequired && App.auth) {
            App.auth.requireLogin(data.error);
          }
          if (!data || !data.ok) {
            throw new Error((data && data.error) || "Respuesta inválida del servidor.");
          }
          return data;
        });
    }

    var url = getManualUrl();
    if (!url) return Promise.reject(new Error("Sin conexión configurada."));

    var sep = url.indexOf("?") >= 0 ? "&" : "?";
    var token = getManualToken();
    var fullUrl =
      url +
      sep +
      "action=" +
      encodeURIComponent(action) +
      (token ? "&token=" + encodeURIComponent(token) : "") +
      "&_t=" +
      Date.now();

    return fetch(fullUrl, { method: "GET", redirect: "follow" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (data) {
        if (!data || !data.ok) {
          throw new Error((data && data.error) || "Respuesta inválida de Sheets.");
        }
        return data;
      });
  }

  function flushQueue() {
    if (!isConfigured() || syncing || !queue.length) {
      return Promise.resolve(true);
    }

    syncing = true;
    lastError = "";
    updateStatusUI("busy", "Guardando en Excel…");

    function next() {
      if (!queue.length) {
        syncing = false;
        setLastSync(Date.now());
        updateStatusUI("ok");
        return Promise.resolve(true);
      }

      var op = queue[0];
      return postAction(op)
        .then(function () {
          queue.shift();
          saveQueue();
          return next();
        })
        .catch(function (err) {
          syncing = false;
          lastError = err && err.message ? err.message : "Sin conexión";
          updateStatusUI("err");
          return false;
        });
    }

    return next();
  }

  function applyRemoteData(data) {
    if (!data) return;
    var remoteClients = Array.isArray(data.clients) ? data.clients : [];
    var remoteCuts = Array.isArray(data.cuts) ? data.cuts : [];

    // Si la planilla está recién creada/vacía y hay datos locales, los subimos en vez de borrarlos
    if (
      !remoteClients.length &&
      !remoteCuts.length &&
      (App.state.clients.length || App.state.cuts.length)
    ) {
      return pushAll(false);
    }

    App.state.clients = remoteClients;
    App.state.cuts = remoteCuts;
    App.storage.save();
    App.renderAll();
    setLastSync(Date.now());
    lastError = "";
    updateStatusUI("ok");
  }

  function pull(showToast) {
    if (!isConfigured()) {
      updateStatusUI("off");
      return Promise.resolve(false);
    }

    return flushQueue().then(function (flushed) {
      if (!flushed) return false;
      syncing = true;
      lastError = "";
      updateStatusUI("busy", "Sincronizando…");

      return getAction("pull")
        .then(function (data) {
          syncing = false;
          applyRemoteData(data);
          if (showToast) u.toast("Sincronizado con Excel ✓");
          return true;
        })
        .catch(function (err) {
          syncing = false;
          lastError = err && err.message ? err.message : "Error al leer Excel";
          updateStatusUI("err");
          if (showToast) u.toast("No se pudo conectar");
          return false;
        });
    });
  }

  function pushAll(showToast) {
    if (!isConfigured()) return Promise.resolve(false);
    syncing = true;
    lastError = "";
    updateStatusUI("busy", "Subiendo a Excel…");

    return postAction({
      action: "syncAll",
      clients: App.state.clients,
      cuts: App.state.cuts,
    })
      .then(function (data) {
        syncing = false;
        queue = [];
        saveQueue();
        if (data && Array.isArray(data.clients) && Array.isArray(data.cuts)) {
          App.state.clients = data.clients;
          App.state.cuts = data.cuts;
          App.storage.save();
          App.renderAll();
        }
        setLastSync(Date.now());
        updateStatusUI("ok");
        if (showToast) u.toast("Datos subidos a Excel ✓");
        return true;
      })
      .catch(function (err) {
        syncing = false;
        lastError = err && err.message ? err.message : "Error al subir datos";
        updateStatusUI("err");
        return false;
      });
  }

  function enqueue(op) {
    if (!isConfigured()) return;
    queue.push(op);
    saveQueue();
    flushQueue();
  }

  function enqueueClient(client) {
    enqueue({ action: "upsertClient", client: Object.assign({}, client) });
  }

  function enqueueCut(cut) {
    var c = u.byId(cut.cid);
    enqueue({
      action: "addCut",
      cut: Object.assign({}, cut),
      clientName: c ? u.full(c) : "",
    });
  }

  function enqueueDeleteCut(id) {
    enqueue({ action: "deleteCut", id: id });
  }

  function openModal() {
    var manualUrl = getManualUrl();
    var isProxy = usingProxy();

    $("sh-url").value = manualUrl;
    $("sh-tok").value = getManualToken();
    $("sh-err").textContent = lastError ? "Último error: " + lastError : "";

    var modeEl = $("sh-mode");
    if (modeEl) {
      if (isProxy) {
        modeEl.textContent =
          "Conectado de forma segura mediante el servidor (/api/sheets). Tus credenciales están protegidas en variables de entorno.";
      } else if (manualUrl) {
        modeEl.textContent =
          "Conectado con URL manual guardada solo en este navegador.";
      } else {
        modeEl.textContent =
          "Configurá SHEETS_URL y SHEETS_TOKEN en .env.local (local) / Vercel Environment Variables, o pegá una URL manual abajo.";
      }
    }

    $("sh-sync-btn").hidden = !isConfigured();
    $("sh-push-btn").hidden = !isConfigured();
    $("sh-disc-btn").hidden = !manualUrl;
    $("ov-sheets-bg").hidden = false;
    $("ov-sheets").hidden = false;
    if (App.glass) App.glass.sync(true);
  }

  function closeModal() {
    $("ov-sheets-bg").hidden = true;
    $("ov-sheets").hidden = true;
    if (App.glass) App.glass.sync();
  }

  function init() {
    loadQueue();
    updateStatusUI();

    $("sync-btn").onclick = openModal;
    $("sh-cancel").onclick = closeModal;
    $("ov-sheets-bg").onclick = closeModal;

    $("sh-save").onclick = function () {
      var url = $("sh-url").value.trim();
      var tok = $("sh-tok").value.trim();

      if (!url) {
        $("sh-err").textContent = "Pegá la URL de la aplicación web de Apps Script.";
        return;
      }
      if (!/^https:\/\/script\.google\.com\//i.test(url)) {
        $("sh-err").textContent =
          "La URL debe comenzar con https://script.google.com/...";
        return;
      }

      $("sh-err").textContent = "";
      try {
        localStorage.setItem(K.SHEETS_URL, url);
        localStorage.setItem(K.SHEETS_TOKEN, tok);
      } catch (e) {}

      $("sh-save").disabled = true;
      $("sh-save").textContent = "Conectando…";

      var op =
        App.state.clients.length || App.state.cuts.length
          ? pushAll(false)
          : pull(false);

      op.then(function (ok) {
        $("sh-save").disabled = false;
        $("sh-save").textContent = "Guardar URL manual";
        if (ok) {
          closeModal();
          u.toast("Excel conectado ✓");
        } else {
          $("sh-err").textContent =
            lastError || "No se pudo conectar. Verificá la URL y permisos.";
        }
      });
    };

    $("sh-sync-btn").onclick = function () {
      $("sh-err").textContent = "";
      pull(true).then(function (ok) {
        if (ok) closeModal();
        else $("sh-err").textContent = lastError || "No se pudo sincronizar.";
      });
    };

    $("sh-push-btn").onclick = function () {
      $("sh-err").textContent = "";
      pushAll(true).then(function (ok) {
        if (ok) closeModal();
        else $("sh-err").textContent = lastError || "No se pudo subir los datos.";
      });
    };

    $("sh-disc-btn").onclick = function () {
      try {
        localStorage.removeItem(K.SHEETS_URL);
        localStorage.removeItem(K.SHEETS_TOKEN);
      } catch (e) {}
      lastError = "";
      updateStatusUI();
      closeModal();
      if (proxyReady) {
        pull(false);
        u.toast("Usando conexión segura del servidor");
      } else {
        u.toast("URL manual eliminada");
      }
    };

    window.addEventListener("online", function () {
      if (isConfigured()) {
        pull(false);
      }
    });

    checkProxyStatus().then(function () {
      updateStatusUI();
      if (isConfigured()) {
        pull(false);
      }
    });
  }

  function refreshAfterLogin() {
    checkProxyStatus().then(function () {
      updateStatusUI();
      if (isConfigured()) {
        pull(false);
      }
    });
  }

  App.sheets = {
    init: init,
    refreshAfterLogin: refreshAfterLogin,
    pull: pull,
    pushAll: pushAll,
    enqueueClient: enqueueClient,
    enqueueCut: enqueueCut,
    enqueueDeleteCut: enqueueDeleteCut,
    openModal: openModal,
    isConfigured: isConfigured,
  };
})((window.Barberia = window.Barberia || {}));
