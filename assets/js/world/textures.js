// Procedural canvas textures: neon signs, animated website billboards, patterns.
import * as THREE from "three";

const cache = new Map();

export function canvasTexture(w, h, draw, { srgb = true, repeat } = {}) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d");
  draw(ctx, w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  t.userData.canvas = c; t.userData.ctx = ctx;
  return t;
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

/** Glowing neon sign text. */
export function neonSign(text, { color = "#ffb36b", bg = "rgba(0,0,0,0)", font = "700 120px Manrope", w = 1024, h = 256, sub = "", subColor } = {}) {
  const key = "sign:" + text + color + font + sub;
  if (cache.has(key)) return cache.get(key);
  const t = canvasTexture(w, h, (ctx) => {
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = font;
    const y = sub ? h * 0.42 : h / 2;
    for (const [blur, alpha] of [[40, 0.9], [18, 1], [4, 1]]) {
      ctx.shadowColor = color; ctx.shadowBlur = blur; ctx.globalAlpha = alpha;
      ctx.fillStyle = blur === 4 ? "#fff7ea" : color;
      ctx.fillText(text, w / 2, y);
    }
    if (sub) {
      ctx.globalAlpha = 1; ctx.shadowBlur = 10; ctx.shadowColor = subColor || color;
      ctx.font = "600 " + Math.round(h * 0.16) + "px 'JetBrains Mono', monospace";
      ctx.fillStyle = subColor || color;
      ctx.fillText(sub.split("").join(" "), w / 2, h * 0.8);
    }
  });
  cache.set(key, t);
  return t;
}

/** Striped awning texture. */
export function stripes(a, b, n = 8) {
  const key = "stripe" + a + b + n;
  if (cache.has(key)) return cache.get(key);
  const t = canvasTexture(256, 64, (ctx, w, h) => {
    for (let i = 0; i < n; i++) { ctx.fillStyle = i % 2 ? b : a; ctx.fillRect((i * w) / n, 0, w / n + 1, h); }
  });
  cache.set(key, t);
  return t;
}

/** Road with lane markings. */
export function roadTexture() {
  return canvasTexture(256, 512, (ctx, w, h) => {
    ctx.fillStyle = "#1a1b26"; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 1400; i++) { ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.035})`; ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    ctx.fillStyle = "#ffcf7a"; ctx.fillRect(w / 2 - 3, 0, 2, h); ctx.fillRect(w / 2 + 1, 0, 2, h);
    ctx.fillStyle = "rgba(255,255,255,.75)";
    for (let y = 0; y < h; y += 64) { ctx.fillRect(w * 0.25 - 2, y, 4, 34); ctx.fillRect(w * 0.75 - 2, y, 4, 34); }
    ctx.fillStyle = "rgba(127,231,255,.9)"; ctx.fillRect(4, 0, 3, h); ctx.fillRect(w - 7, 0, 3, h);
  }, { repeat: [1, 40] });
}

export function tileTexture(base = "#2a2b38", line = "rgba(255,255,255,.07)") {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = line; ctx.lineWidth = 2;
    for (let i = 0; i <= 4; i++) { ctx.beginPath(); ctx.moveTo(i * 64, 0); ctx.lineTo(i * 64, h); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, i * 64); ctx.lineTo(w, i * 64); ctx.stroke(); }
  }, { repeat: [1, 1] });
}

/* ------------------------------------------------------------
   Animated "website" screens for building billboards.
   Each theme has a few frames that cycle like a live site.
------------------------------------------------------------- */
const THEMES = {
  restaurant: { bg: "#1c0f0d", fg: "#f5e6d3", ac: "#f0a04b", title: "Tandoor & Tales", tag: "Reserve a table", serif: "DM Serif Display", frames: ["Every dish has a story.", "Tonight's specials", "Book in 10 seconds"] },
  cafe: { bg: "#f3e7d6", fg: "#3b2a1e", ac: "#c06a2b", title: "Café Lumen", tag: "Order ahead", serif: "Fraunces", frames: ["Slow coffee, fast Wi-Fi", "Fresh bakes daily", "Find us on Maps"] },
  noodle: { bg: "#111827", fg: "#fef3c7", ac: "#ef4444", title: "Wok Street", tag: "Order online", serif: "Bricolage Grotesque", frames: ["Hand-pulled noodles", "Combo of the day", "Delivery in 30 min"] },
  pizza: { bg: "#fff7ed", fg: "#7c2d12", ac: "#dc2626", title: "Forno Pizza", tag: "Order now", serif: "DM Serif Display", frames: ["Wood-fired since day one", "2 + 1 Thursdays", "Track your order"] },
  chai: { bg: "#14532d", fg: "#fef9c3", ac: "#facc15", title: "Chai & Co.", tag: "Visit us", serif: "Fraunces", frames: ["Kadak chai, soft buns", "Open 6 am – 11 pm", "Bulk orders welcome"] },
  hotel: { bg: "#122219", fg: "#f1ead9", ac: "#c9a45c", title: "Aranya Grand", tag: "Book direct", serif: "Cormorant Garamond", frames: ["Stay where the forest breathes", "Valley Pool Villa", "Best rate, guaranteed"] },
  rooms: { bg: "#1b1a2e", fg: "#f4efe6", ac: "#e8b86b", title: "The Suites", tag: "View rooms", serif: "Cormorant Garamond", frames: ["Skyline Suite · ₹18,000", "Garden Room · ₹9,500", "Penthouse · on request"] },
  clinic: { bg: "#eaf2ff", fg: "#0b2545", ac: "#0e5fd8", title: "CarePoint", tag: "Book appointment", serif: "Plus Jakarta Sans", frames: ["Care close to home", "Specialists available today", "Reports on your phone"] },
  doctor: { bg: "#ffffff", fg: "#0b2545", ac: "#16a37f", title: "Specialist", tag: "Available today", serif: "Plus Jakarta Sans", frames: ["General Physician", "Paediatrician", "Orthopaedic Surgeon"] },
  jewel: { bg: "#0b0a08", fg: "#efe3c4", ac: "#d4af61", title: "SWARNIKA", tag: "Explore collection", serif: "Bodoni Moda", frames: ["The Bridal Edit", "Hallmarked gold", "Book a private visit"] },
  grocery: { bg: "#fffaf0", fg: "#1c1f1a", ac: "#1f5c3a", title: "Haat & Co.", tag: "Order on WhatsApp", serif: "Bricolage Grotesque", frames: ["Your store, now online", "Fresh today", "Free delivery 3 km"] },
  salon: { bg: "#f4e4de", fg: "#2e2724", ac: "#c97b6c", title: "Nūr Salon", tag: "Book a slot", serif: "Italiana", frames: ["Slow down. Glow up.", "Bridal packages", "Prices you can see"] },
  cloth: { bg: "#2a1f3d", fg: "#f3e8ff", ac: "#b07cff", title: "Thread Story", tag: "Shop the edit", serif: "Fraunces", frames: ["Handloom, made here", "Festive collection", "New arrivals weekly"] },
  elec: { bg: "#0f1b2d", fg: "#e6f2ff", ac: "#57c8ff", title: "Volt Corner", tag: "Get a quote", serif: "JetBrains Mono", frames: ["Repairs in 1 hour", "Phones on EMI", "Genuine accessories"] },
  dd: { bg: "#0a0c1c", fg: "#f6f1e7", ac: "#ff8a3d", title: "Digital Dukan", tag: "Build my website", serif: "Fraunces", frames: ["Your business deserves a website", "From ₹2,000", "Taking local businesses digital"] }
};

const screens = [];

export function websiteScreen(theme, { w = 512, h = 320 } = {}) {
  const th = THEMES[theme] || THEMES.dd;
  const t = canvasTexture(w, h, () => {});
  const s = { t, th, frame: 0, w, h, next: Math.random() * 2.5 };
  drawScreen(s);
  screens.push(s);
  return t;
}

function drawScreen(s) {
  const { th, w, h } = s;
  const ctx = s.t.userData.ctx;
  const f = s.frame % th.frames.length;
  ctx.fillStyle = th.bg; ctx.fillRect(0, 0, w, h);
  // browser chrome
  ctx.fillStyle = "rgba(255,255,255,.08)"; ctx.fillRect(0, 0, w, 24);
  ["#e7836b", "#e9bd5c", "#8dc07a"].forEach((c, i) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(14 + i * 14, 12, 4, 0, 7); ctx.fill(); });
  // nav
  ctx.fillStyle = th.fg; ctx.font = `700 22px "${th.serif}", serif`; ctx.textBaseline = "middle";
  ctx.fillText(th.title, 20, 50);
  ctx.fillStyle = th.ac; rr(ctx, w - 150, 38, 130, 26, 13); ctx.fill();
  ctx.fillStyle = th.bg; ctx.font = "700 12px Manrope, sans-serif"; ctx.textAlign = "center"; ctx.fillText(th.tag, w - 85, 51); ctx.textAlign = "left";
  // hero
  const grd = ctx.createLinearGradient(0, 80, w, h);
  grd.addColorStop(0, th.ac + "55"); grd.addColorStop(1, th.ac + "00");
  ctx.fillStyle = grd; ctx.fillRect(20, 78, w - 40, 120);
  ctx.fillStyle = th.fg; ctx.font = `400 32px "${th.serif}", serif`;
  wrap(ctx, th.frames[f], 36, 118, w - 220, 36);
  // accent shape changes per frame
  ctx.fillStyle = th.ac; ctx.globalAlpha = 0.85;
  ctx.beginPath(); ctx.arc(w - 90, 138, 34 + f * 6, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
  // cards
  for (let i = 0; i < 3; i++) {
    const x = 20 + i * ((w - 40) / 3);
    ctx.fillStyle = i === f ? th.ac : "rgba(127,127,127,.18)";
    rr(ctx, x + 4, 214, (w - 40) / 3 - 8, 84, 10); ctx.fill();
    ctx.fillStyle = i === f ? th.bg : th.fg; ctx.globalAlpha = 0.8;
    ctx.fillRect(x + 16, 232, 60, 8); ctx.fillRect(x + 16, 248, 90, 6); ctx.fillRect(x + 16, 262, 40, 6);
    ctx.globalAlpha = 1;
  }
  s.t.needsUpdate = true;
}

function wrap(ctx, text, x, y, maxW, lh) {
  const words = text.split(" ");
  let line = "", yy = y;
  for (const wd of words) {
    const test = line ? line + " " + wd : wd;
    if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, x, yy); line = wd; yy += lh; }
    else line = test;
  }
  ctx.fillText(line, x, yy);
}

/** Advance billboard screens; call every frame with elapsed seconds. */
export function tickScreens(dt) {
  for (const s of screens) {
    s.next -= dt;
    if (s.next <= 0) { s.frame++; s.next = 2.6 + Math.random() * 1.5; drawScreen(s); }
  }
}

/** Redraw everything once web fonts have loaded. */
export function refreshScreens() { screens.forEach(drawScreen); }

/** Digital Dukan emblem for the tower. */
export function ddEmblem() {
  return canvasTexture(1024, 1024, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.save(); ctx.translate(w / 2, h * 0.38);
    ctx.shadowColor = "#ff8a3d"; ctx.shadowBlur = 60;
    ctx.fillStyle = "#f6f1e7"; rr(ctx, -200, -200, 400, 400, 90); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#e8772e";
    ctx.beginPath(); ctx.moveTo(-150, -90); ctx.lineTo(150, -90); ctx.lineTo(150, -40);
    for (let i = 3; i >= 0; i--) { const cx = -150 + i * 75 + 37.5; ctx.arc(cx, -40, 37.5, 0, Math.PI, false); }
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "#16140f"; ctx.lineWidth = 28; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath(); ctx.moveTo(-120, 30); ctx.lineTo(-120, 130); ctx.lineTo(120, 130); ctx.lineTo(120, 30); ctx.stroke();
    ctx.fillStyle = "#16140f"; rr(ctx, -38, 60, 76, 76, 12); ctx.fill();
    ctx.restore();
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.shadowColor = "#ff8a3d"; ctx.shadowBlur = 30; ctx.fillStyle = "#fff4e6";
    ctx.font = "400 120px Fraunces, serif"; ctx.fillText("Digital Dukan", w / 2, h * 0.76);
    ctx.shadowBlur = 16; ctx.fillStyle = "#ffc76b"; ctx.font = "500 34px 'JetBrains Mono', monospace";
    ctx.fillText("T A K I N G   L O C A L   B U S I N E S S E S   D I G I T A L", w / 2, h * 0.88);
  });
}

/** Soft round sprite for particles. */
export function dotSprite() {
  return canvasTexture(64, 64, (ctx, w) => {
    const g = ctx.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.25, "rgba(255,255,255,.6)"); g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, w);
  }, { srgb: false });
}
