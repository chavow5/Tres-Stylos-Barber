/* Configuración global, constantes y estado de la aplicación */
(function (App) {
  "use strict";

  var now = new Date();

  App.STORAGE_KEYS = {
    CLIENTS: "barberia:clientes",
    CUTS: "barberia:cortes2",
    LEGACY_CUTS: "barberia:cortes",
    HIDDEN: "barberia:oculto",
    LOGO: "barberia:logo",
    SHEETS_URL: "barberia:sheets_url",
    SHEETS_TOKEN: "barberia:sheets_token",
    PENDING_OPS: "barberia:pending_ops",
    LAST_SYNC: "barberia:last_sync",
  };

  // Proxies serverless en Vercel y servidor local (leen variables desde .env.local / Vercel Env)
  App.AUTH_API = "/api/auth";
  App.SHEETS_API = "/api/sheets";
  App.SHEETS_URL = "";
  App.SHEETS_TOKEN = "";

  App.DEFAULTS = ["Corte", "Corte y barba", "Barba", "Degradé", "Niño"];

  App.DIAS = [
    "domingo",
    "lunes",
    "martes",
    "miércoles",
    "jueves",
    "viernes",
    "sábado",
  ];

  App.MESES = [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
  ];

  App.DEFAULT_LOGO = "assets/img/logo.jpg";

  App.ICONS = {
    EYE_ON:
      '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    EYE_OFF:
      '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.9 10.9 0 0 1 12 19C5 19 1 12 1 12a18.5 18.5 0 0 1 5.06-5.94M9.9 4.24A10.9 10.9 0 0 1 12 5c7 0 11 7 11 7a18.5 18.5 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24"/><path d="M1 1l22 22"/></svg>',
  };

  App.state = {
    view: "hoy",
    clients: [],
    cuts: [],
    sel: null,
    picked: "",
    editing: null,
    pay: "efectivo",
    oculto: false,
    range: "mes",
    mesY: now.getFullYear(),
    mesM: now.getMonth(),
  };
})((window.Barberia = window.Barberia || {}));
