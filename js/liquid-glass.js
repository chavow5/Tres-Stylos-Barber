/* Integración de @ybouane/liquidglass: escena de fondo (canvas) y shader WebGL en cuadros */
import { LiquidGlass } from "./vendor/liquidglass.js";

const App = (window.Barberia = window.Barberia || {});

let instance = null;
let bgCanvas = null;
let logoImg = null;
let logoLoaded = false;
let syncToken = 0;
let syncTimer = null;
let scrollRaf = 0;

function isDarkMode() {
  const root = document.documentElement;
  const theme = root.getAttribute("data-theme");
  if (theme === "dark") return true;
  if (theme === "light") return false;
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function getPanelConfig(type) {
  const dark = isDarkMode();
  const base = {
    blurAmount: 0.22,
    refraction: 0.72,
    chromAberration: 0.08,
    edgeHighlight: dark ? 0.28 : 0.24,
    specular: dark ? 0.26 : 0.3,
    fresnel: 0.85,
    distortion: 0,
    cornerRadius: 20,
    zRadius: 18,
    opacity: 1,
    saturation: 0.22,
    tintStrength: dark ? 0.06 : 0.03,
    brightness: dark ? -0.05 : 0.08,
    shadowOpacity: dark ? 0.42 : 0.18,
    shadowSpread: 14,
    shadowOffsetY: 4,
    floating: false,
    button: false,
    bevelMode: 0,
  };

  if (type === "bar") {
    return {
      ...base,
      cornerRadius: 16,
      zRadius: 14,
      blurAmount: 0.24,
      shadowSpread: 10,
      shadowOffsetY: 3,
    };
  }

  if (type === "stat") {
    return {
      ...base,
      cornerRadius: 18,
      zRadius: 16,
      blurAmount: 0.2,
      shadowSpread: 12,
      shadowOffsetY: 3,
    };
  }

  if (type === "modal") {
    return {
      ...base,
      cornerRadius: 22,
      zRadius: 20,
      blurAmount: 0.38,
      refraction: 0.78,
      chromAberration: 0.1,
      edgeHighlight: dark ? 0.34 : 0.3,
      specular: dark ? 0.32 : 0.36,
      brightness: dark ? -0.08 : 0.12,
      shadowOpacity: dark ? 0.55 : 0.28,
      shadowSpread: 18,
      shadowOffsetY: 6,
    };
  }

  return base;
}

function drawRadialBlob(ctx, w, h, cxPct, cyPct, rxPct, ryPct, color) {
  const cx = w * cxPct;
  const cy = h * cyPct;
  const rx = w * rxPct;
  const ry = h * ryPct;
  const r = Math.max(rx, ry);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(rx / r, ry / r);
  const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.75);
  grad.addColorStop(0, color);
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.75, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBackground() {
  if (!bgCanvas) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (w <= 0 || h <= 0) return;

  if (bgCanvas.width !== Math.round(w * dpr) || bgCanvas.height !== Math.round(h * dpr)) {
    bgCanvas.width = Math.round(w * dpr);
    bgCanvas.height = Math.round(h * dpr);
  }

  const ctx = bgCanvas.getContext("2d");
  if (!ctx) return;

  const cs = getComputedStyle(document.documentElement);
  const bg = cs.getPropertyValue("--bg").trim() || "#eceae6";
  const b1 = cs.getPropertyValue("--b1").trim() || "#9dc0f5";
  const b2 = cs.getPropertyValue("--b2").trim() || "#f4c6a3";
  const b3 = cs.getPropertyValue("--b3").trim() || "#a8dec6";
  const dark = isDarkMode();

  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // Fondo base del tema
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Degradados ambientales para que el vidrio refracté color y profundidad
  drawRadialBlob(ctx, w, h, 0.12, 0.08, 0.65, 0.45, b1);
  drawRadialBlob(ctx, w, h, 0.95, 0.38, 0.6, 0.45, b2);
  drawRadialBlob(ctx, w, h, 0.25, 1.0, 0.7, 0.5, b3);

  // Marca de agua del logo centrada
  if (logoImg && logoLoaded && logoImg.naturalWidth > 0) {
    const padX = w * 0.08;
    const padY = h * 0.14;
    const boxW = Math.max(1, w - padX * 2);
    const boxH = Math.max(1, h - padY * 2);
    const scale = Math.min(boxW / logoImg.naturalWidth, boxH / logoImg.naturalHeight);
    const drawW = logoImg.naturalWidth * scale;
    const drawH = logoImg.naturalHeight * scale;
    const dx = (w - drawW) / 2;
    const dy = (h - drawH) / 2;

    ctx.save();
    if (dark) {
      ctx.globalAlpha = 0.26;
      ctx.globalCompositeOperation = "screen";
      ctx.filter = "invert(1) hue-rotate(180deg)";
    } else {
      ctx.globalAlpha = 0.2;
      ctx.globalCompositeOperation = "multiply";
    }
    ctx.drawImage(logoImg, dx, dy, drawW, drawH);
    ctx.restore();
  }

  ctx.restore();
}

function loadLogoImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      logoImg = img;
      logoLoaded = true;
      resolve(true);
    };
    img.onerror = () => {
      logoLoaded = false;
      resolve(false);
    };
    img.src = src;
  });
}

function getVisibleGlassElements(root) {
  const els = [];
  for (const child of root.children) {
    if (!child.classList.contains("lg-panel")) continue;
    if (child.hidden) continue;
    if (child.offsetWidth <= 0 || child.offsetHeight <= 0) continue;
    const type = child.dataset.lg || "card";
    child.dataset.config = JSON.stringify(getPanelConfig(type));
    els.push(child);
  }
  return els;
}

async function runSync() {
  const token = ++syncToken;
  const root = document.getElementById("lg-root");
  if (!root) return;

  drawBackground();

  if (instance) {
    try {
      instance.destroy();
    } catch (e) {}
    instance = null;
  }

  const glassElements = getVisibleGlassElements(root);
  if (!glassElements.length) return;

  try {
    const next = await LiquidGlass.init({
      root,
      glassElements,
      defaults: getPanelConfig("card"),
    });

    if (token !== syncToken) {
      next.destroy();
      return;
    }

    instance = next;
    document.documentElement.classList.add("lg-ready");
  } catch (err) {
    console.warn("LiquidGlass no disponible, usando fallback CSS:", err);
    document.documentElement.classList.remove("lg-ready");
  }
}

function sync(immediate = false) {
  clearTimeout(syncTimer);
  if (immediate) {
    runSync();
    return;
  }
  syncTimer = setTimeout(runSync, 20);
}

function refreshBackground() {
  drawBackground();
  if (instance && bgCanvas) {
    instance.markChanged(bgCanvas);
  }
}

function markChanged() {
  if (instance) {
    instance.markChanged();
  }
}

async function setLogo(src) {
  await loadLogoImage(src);
  refreshBackground();
}

async function init() {
  bgCanvas = document.getElementById("bg-canvas");
  const logoSrc = App.storage ? App.storage.getLogoSrc() : "assets/img/logo.jpg";

  await loadLogoImage(logoSrc);
  drawBackground();

  window.addEventListener("resize", () => {
    drawBackground();
    if (instance && bgCanvas) instance.markChanged(bgCanvas);
  });

  window.addEventListener(
    "scroll",
    () => {
      if (!instance || !bgCanvas || scrollRaf) return;
      scrollRaf = requestAnimationFrame(() => {
        scrollRaf = 0;
        if (instance && bgCanvas) instance.markChanged(bgCanvas);
      });
    },
    { passive: true }
  );

  if (window.matchMedia) {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onThemeChange = () => {
      drawBackground();
      sync(true);
    };
    if (mq.addEventListener) mq.addEventListener("change", onThemeChange);
    else if (mq.addListener) mq.addListener(onThemeChange);
  }

  await runSync();
}

App.glass = {
  sync,
  refreshBackground,
  markChanged,
  setLogo,
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
