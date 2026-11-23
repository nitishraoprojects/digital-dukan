// Nikavi Labs — The City of Digital Possibilities
// Vanilla Three.js + GSAP ScrollTrigger. No framework.
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { CSS3DRenderer, CSS3DObject } from "three/addons/renderers/CSS3DRenderer.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { createEnv, createSky, createMotes, createBurst } from "./effects.js";
import { buildCity, ref } from "./city.js";
import { createPeople } from "./people.js";
import { tickScreens, refreshScreens } from "./textures.js";
import { createAudio } from "./audio.js";
import { setupForms } from "./form.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (x) => x * x * x * (x * (x * 6 - 15) + 10);
const V = (x, y, z) => new THREE.Vector3(x, y, z);

const loaderBar = $("#loaderBar"), loaderText = $("#loaderText");
const progress = (p, msg) => { loaderBar.style.width = p + "%"; if (msg) loaderText.textContent = msg; };

/* ---------------- Capability & quality ---------------- */
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const small = matchMedia("(max-width: 860px)").matches || matchMedia("(pointer: coarse)").matches;
const Q = { low: small, shadows: !small, bloom: !small, css3d: !small, pixelRatio: Math.min(devicePixelRatio || 1, small ? 1.25 : 1.6) };

function failGL() { $("#loader").classList.add("done"); $("#noGL").hidden = false; document.body.classList.remove("locked"); }

async function waitFor(test, ms = 6000) {
  const t0 = performance.now();
  while (!test()) { if (performance.now() - t0 > ms) return false; await new Promise((r) => setTimeout(r, 40)); }
  return true;
}

/* ======================================================================
   Palettes — the city moves from dawn → day → sunset → night as you travel
   ====================================================================== */
const P = (o) => ({
  top: new THREE.Color(o.top), hor: new THREE.Color(o.hor), bot: new THREE.Color(o.bot || "#0a0c1c"), fog: new THREE.Color(o.fog),
  sun: new THREE.Color(o.sun), sunI: o.sunI, dir: new THREE.Vector3(...o.dir).normalize(),
  hs: new THREE.Color(o.hs), hg: new THREE.Color(o.hg), hI: o.hI, illum: o.illum, bloom: o.bloom, thr: o.thr,
  ground: new THREE.Color(o.ground), lamp: o.lamp, mA: new THREE.Color(o.mA), mB: new THREE.Color(o.mB), stars: o.stars, envI: o.envI,
  near: o.near, far: o.far, exp: o.exp || 1
});
const DAWN = P({ top: "#0b1240", hor: "#5b3f8f", fog: "#251f55", sun: "#ff9e7a", sunI: 0.6, dir: [0.2, 0.12, -1], hs: "#6f6fd6", hg: "#1a1530", hI: 0.55, illum: 0.62, bloom: 0.8, thr: 0.72, ground: "#141430", lamp: 3, mA: "#ffd59a", mB: "#a58bff", stars: 0.75, envI: 0.22, near: 80, far: 900, exp: 1.0 });
const JOURNEY = [
  [0.0, P({ top: "#3f78c4", hor: "#ffd6b0", fog: "#b9adbd", sun: "#fff0d8", sunI: 2.4, dir: [0.35, 0.75, -0.55], hs: "#bcd4ff", hg: "#6a5a50", hI: 1.1, illum: 0.22, bloom: 0.35, thr: 0.9, ground: "#3b3b4c", lamp: 0.7, mA: "#fff3d6", mB: "#cfefff", stars: 0, envI: 0.6, near: 70, far: 560, exp: 0.9 })],
  [0.13, P({ top: "#3d74c0", hor: "#d9e2ee", fog: "#b4bfcf", sun: "#fffaf0", sunI: 2.6, dir: [0.25, 0.85, -0.4], hs: "#cfe0ff", hg: "#6a6460", hI: 1.2, illum: 0.2, bloom: 0.3, thr: 0.9, ground: "#40414f", lamp: 0.5, mA: "#fff3d6", mB: "#cfefff", stars: 0, envI: 0.65, near: 70, far: 560, exp: 0.88 })],
  [0.27, P({ top: "#33569a", hor: "#ffc180", fog: "#dcae8c", sun: "#ffc985", sunI: 2.2, dir: [0.5, 0.33, -0.8], hs: "#ffd2a6", hg: "#5a4040", hI: 0.95, illum: 0.36, bloom: 0.45, thr: 0.86, ground: "#34303c", lamp: 1.2, mA: "#ffe2b0", mB: "#ffd0e0", stars: 0, envI: 0.5, near: 60, far: 520, exp: 0.94 })],
  [0.43, P({ top: "#2a2c6a", hor: "#ff7a5c", fog: "#b0617a", sun: "#ff8a5c", sunI: 1.6, dir: [0.08, 0.07, -1], hs: "#ff9a8a", hg: "#3a2440", hI: 0.75, illum: 0.6, bloom: 0.55, thr: 0.83, ground: "#262234", lamp: 2, mA: "#ffb38a", mB: "#ff8ac2", stars: 0.05, envI: 0.4, near: 50, far: 480 })],
  [0.59, P({ top: "#141640", hor: "#b4508e", fog: "#46295a", sun: "#ff7aa8", sunI: 0.8, dir: [-0.2, 0.05, -1], hs: "#8f7ad6", hg: "#241a33", hI: 0.6, illum: 0.82, bloom: 0.62, thr: 0.8, ground: "#17152a", lamp: 2.8, mA: "#ffd27a", mB: "#c89bff", stars: 0.3, envI: 0.3, near: 45, far: 450 })],
  [0.75, P({ top: "#0b0f30", hor: "#3a2f7a", fog: "#1d1b48", sun: "#a8b8ff", sunI: 0.45, dir: [-0.4, 0.4, -0.7], hs: "#5a6ad0", hg: "#15122a", hI: 0.55, illum: 0.95, bloom: 0.72, thr: 0.78, ground: "#10112a", lamp: 3, mA: "#ffd59a", mB: "#8fe3ff", stars: 0.6, envI: 0.25, near: 45, far: 520 })],
  [0.9, P({ top: "#04061a", hor: "#1b2668", fog: "#0b0e2e", sun: "#8fa8ff", sunI: 0.35, dir: [-0.3, 0.6, -0.6], hs: "#3a4aa8", hg: "#0a0a1a", hI: 0.45, illum: 1.0, bloom: 0.82, thr: 0.76, ground: "#0b0c1e", lamp: 3.2, mA: "#ffc76b", mB: "#7fe7ff", stars: 1, envI: 0.2, near: 60, far: 900, exp: 1.05 })]
];
const CUR = P({ top: "#000", hor: "#000", fog: "#000", sun: "#000", sunI: 0, dir: [0, 1, 0], hs: "#000", hg: "#000", hI: 0, illum: 0, bloom: 0, thr: 0, ground: "#000", lamp: 0, mA: "#000", mB: "#000", stars: 0, envI: 0, near: 0, far: 0 });
const TMP = P({ top: "#000", hor: "#000", fog: "#000", sun: "#000", sunI: 0, dir: [0, 1, 0], hs: "#000", hg: "#000", hI: 0, illum: 0, bloom: 0, thr: 0, ground: "#000", lamp: 0, mA: "#000", mB: "#000", stars: 0, envI: 0, near: 0, far: 0 });
function mixPal(out, a, b, t) {
  for (const k of ["top", "hor", "bot", "fog", "sun", "hs", "hg", "ground", "mA", "mB"]) out[k].copy(a[k]).lerp(b[k], t);
  out.dir.copy(a.dir).lerp(b.dir, t).normalize();
  for (const k of ["sunI", "hI", "illum", "bloom", "thr", "lamp", "stars", "envI", "near", "far", "exp"]) out[k] = lerp(a[k], b[k], t);
  return out;
}
function journeyPal(out, p) {
  let i = 0; while (i < JOURNEY.length - 2 && p > JOURNEY[i + 1][0]) i++;
  const [p0, a] = JOURNEY[i], [p1, b] = JOURNEY[i + 1];
  return mixPal(out, a, b, smooth(clamp01((p - p0) / (p1 - p0))));
}

/* ======================================================================
   Camera path — keyframes; duplicated keys = a hold in front of a website
   ====================================================================== */
let D = 12.5; // viewing distance at a hold (recomputed per aspect ratio)
let OFF = 0; // nudge the website right of centre so the chapter card has room
const HOLO = {
  restaurant: { pos: V(-5.2, 8.6, -30), rotY: Math.PI / 2 },
  hotel: { pos: V(5.5, 10.2, -120), rotY: -Math.PI / 2 },
  health: { pos: V(-5.2, 8.6, -210), rotY: Math.PI / 2 },
  jewel: { pos: V(5.2, 8.6, -300), rotY: -Math.PI / 2 },
  local: { pos: V(0, 9.2, -402), rotY: 0 }
};
const holdCam = (k) => {
  const h = HOLO[k].pos;
  if (k === "local") return [V(0, h.y - 0.4, h.z + D), V(-OFF, h.y - 0.2, h.z)];
  const s = Math.sign(h.x) || 1; // panel on left (-) → camera on right (+)
  return [V(h.x - s * D, h.y - 0.2, h.z), V(h.x, h.y - 0.2, h.z - s * OFF)];
};
const CH = {
  restaurant: { hold: [0.11, 0.155], title: [0.0, 0.075] },
  hotel: { hold: [0.27, 0.315], title: [0.18, 0.245] },
  health: { hold: [0.43, 0.475], title: [0.34, 0.405] },
  jewel: { hold: [0.59, 0.635], title: [0.5, 0.565] },
  local: { hold: [0.75, 0.795], title: [0.66, 0.725] },
  tower: { title: [0.82, 0.89], finale: 0.915 }
};
/** Fit the website panel to the screen: choose a viewing distance and panel size per aspect ratio. */
let PANEL_W = 14;
function layoutFor(fovDeg, aspect) {
  const t = 2 * Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2);
  const need = 14 / (0.66 * t * aspect);
  D = Math.min(15.5, Math.max(11.5, need));
  const vw = t * aspect * D, vh = t * D;
  PANEL_W = Math.min(14, vw * (Q.css3d ? 0.64 : 0.9), vh * 0.72 * (1200 / 706));
  OFF = Q.css3d && aspect > 1.2 ? PANEL_W * 0.2 : 0;
  KEYS = buildKeys();
}
let KEYS = [];
function buildKeys() {
  const k = [];
  const add = (p, pos, look, hold) => k.push({ p, pos, look, hold: !!hold });
  add(0.0, V(0, 9, 58), V(0, 7, 0));
  add(0.05, V(2, 6.5, 12), V(-6, 6, -30));
  for (const [name, mid] of [["restaurant", [V(0, 18, -68), V(14, 26, -120)]], ["hotel", [V(0, 11, -165), V(-8, 10, -210)]], ["health", [V(0, 9, -252), V(8, 12, -300)]], ["jewel", [V(0, 13, -350), V(0, 9, -402)]], ["local", null]]) {
    const [pos, look] = holdCam(name);
    add(CH[name].hold[0], pos, look, true);
    add(CH[name].hold[1], pos.clone(), look.clone(), true);
    if (mid) add(CH[name].hold[1] + 0.06, mid[0], mid[1]);
  }
  add(0.87, V(0, 45, -420), V(0, 85, -560));
  add(0.94, V(0, 36, -440), V(0, 95, -560), true);
  add(1.0, V(0, 36, -446), V(0, 95, -560), true);
  return k;
}
const _a = new THREE.Vector3(), _b = new THREE.Vector3();
function cr(out, p0, p1, p2, p3, u) {
  const u2 = u * u, u3 = u2 * u;
  out.set(0, 0, 0)
    .addScaledVector(p1, 2).addScaledVector(_a.copy(p2).sub(p0), u)
    .addScaledVector(_a.copy(p0).multiplyScalar(2).addScaledVector(p1, -5).addScaledVector(p2, 4).sub(p3), u2)
    .addScaledVector(_a.copy(p0).multiplyScalar(-1).addScaledVector(p1, 3).addScaledVector(p2, -3).add(p3), u3)
    .multiplyScalar(0.5);
  return out;
}
function cameraAt(p, outPos, outLook) {
  p = clamp01(p);
  let i = 0; while (i < KEYS.length - 2 && p > KEYS[i + 1].p) i++;
  const k1 = KEYS[i], k2 = KEYS[i + 1];
  // a hold is perfectly still
  if (k1.hold && k2.hold && k1.pos.equals(k2.pos)) { outPos.copy(k1.pos); outLook.copy(k1.look); return; }
  // zero tangent when leaving/arriving at a hold so the camera eases in and out cleanly
  const k0 = k1.hold ? k1 : KEYS[Math.max(0, i - 1)];
  const k3 = k2.hold ? k2 : KEYS[Math.min(KEYS.length - 1, i + 2)];
  let u = clamp01((p - k1.p) / (k2.p - k1.p || 1));
  if (k1.hold && k2.hold) u = smooth(u);
  else if (k2.hold) u = Math.sin((u * Math.PI) / 2);
  else if (k1.hold) u = 1 - Math.cos((u * Math.PI) / 2);
  cr(outPos, k0.pos, k1.pos, k2.pos, k3.pos, u);
  cr(outLook, k0.look, k1.look, k2.look, k3.look, u);
}

/* ======================================================================
   BOOT
   ====================================================================== */
(async function boot() {
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  progress(8, "Laying the foundations…");
  const okGsap = await waitFor(() => window.gsap && window.ScrollTrigger);
  if (!okGsap) { failGL(); return; }
  gsap.registerPlugin(ScrollTrigger);

  // Fonts used on canvas signs must be ready before drawing them
  try {
    await Promise.race([
      Promise.all(["400 100px 'DM Serif Display'", "400 100px Fraunces", "700 100px Manrope", "400 100px 'Bodoni Moda'", "500 100px 'Cormorant Garamond'", "800 100px 'Plus Jakarta Sans'", "500 40px 'JetBrains Mono'", "400 100px Italiana", "700 100px 'Bricolage Grotesque'"].map((f) => document.fonts.load(f))),
      new Promise((r) => setTimeout(r, 3500))
    ]);
  } catch (e) { /* fall back to system fonts */ }
  progress(22, "Raising the skyline…");

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  } catch (e) { failGL(); return; }
  if (!renderer.getContext()) { failGL(); return; }
  renderer.setPixelRatio(Q.pixelRatio);
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = Q.shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  $("#stage").appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog("#251f55", 80, 900);
  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.4, 3200);

  // reflections for metal & glass
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const env = createEnv();
  const sky = createSky(scene, env);
  const hemi = new THREE.HemisphereLight("#6f6fd6", "#1a1530", 0.6); scene.add(hemi);
  const sun = new THREE.DirectionalLight("#ffd0a0", 1.5); scene.add(sun, sun.target);
  if (Q.shadows) {
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera; sc.left = -42; sc.right = 42; sc.top = 42; sc.bottom = -42; sc.near = 1; sc.far = 400;
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
  }

  progress(38, "Opening the shops…");
  await new Promise((r) => setTimeout(r, 20));
  const city = buildCity(scene, env, Q);
  progress(60, "Waking up the people…");
  await new Promise((r) => setTimeout(r, 20));
  const people = createPeople(scene, city.spots, Q);
  const motes = createMotes(scene, env, Q.low ? 500 : 1600, Q.pixelRatio);
  const burst = createBurst(scene, Q.pixelRatio, Q.low ? 140 : 300);

  // tone down environment reflections on standard materials; time of day adjusts them
  const stdMats = new Set();
  scene.traverse((o) => { if (o.material && o.material.isMeshStandardMaterial) stdMats.add(o.material); });

  /* ---------- post-processing ---------- */
  let composer = null, bloom = null;
  if (Q.bloom) {
    // Default composer target: multisampled float targets render incorrectly on some GPUs.
    composer = new EffectComposer(renderer);
    composer.setPixelRatio(Q.pixelRatio);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.9, 0.55, 0.65);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
  }

  /* ---------- website holograms ---------- */
  const cssScene = new THREE.Scene();
  let cssRenderer = null;
  const hs = () => PANEL_W / 1200; // CSS px → world units
  const holos = {};
  for (const key of Object.keys(HOLO)) {
    const el = $(`#holo-${key}`);
    const h = { key, el, state: "out", tl: null, sc: city.showcases[key] || null };
    if (Q.css3d) {
      const obj = new CSS3DObject(el);
      obj.visible = false;
      cssScene.add(obj);
      h.obj = obj;
    } else {
      const wrap = document.createElement("div"); wrap.className = "holo-scaler"; wrap.appendChild(el);
      $("#holo2d").appendChild(wrap); h.wrap = wrap;
    }
    holos[key] = h;
  }
  if (Q.css3d) {
    cssRenderer = new CSS3DRenderer();
    cssRenderer.setSize(innerWidth, innerHeight);
    cssRenderer.domElement.style.pointerEvents = "none";
    $("#css3d").appendChild(cssRenderer.domElement);
  }

  progress(78, "Switching on the lights…");
  const audio = createAudio();
  const forms = setupForms({ audio });

  /* ---------- state ---------- */
  const S = { mode: "intro", p: 0, target: 0, dayMix: 0, hover: 0, hoverT: 0, flight: null, mx: 0, my: 0, smx: 0, smy: 0, userScrolled: false, guideDone: false };
  const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
  const INTRO_POS = V(0, 150, 190), INTRO_LOOK = V(0, 20, -220);

  /* ---------- palette application ---------- */
  function applyPalette() {
    journeyPal(TMP, S.p);
    mixPal(CUR, DAWN, TMP, S.dayMix);
    const h = S.hover;
    sky.uniforms.uTop.value.copy(CUR.top); sky.uniforms.uHorizon.value.copy(CUR.hor).multiplyScalar(1 + h * 0.25); sky.uniforms.uBottom.value.copy(CUR.bot);
    scene.fog.color.copy(CUR.fog); scene.fog.near = CUR.near; scene.fog.far = CUR.far;
    sun.color.copy(CUR.sun); sun.intensity = CUR.sunI;
    hemi.color.copy(CUR.hs); hemi.groundColor.copy(CUR.hg); hemi.intensity = CUR.hI;
    env.uSunDir.value.copy(CUR.dir); env.uSunCol.value.copy(CUR.sun).multiplyScalar(CUR.sunI * 0.42);
    env.uAmb.value.copy(CUR.hs).multiplyScalar(CUR.hI * 0.42);
    env.uIllum.value = Math.min(1, CUR.illum + h * 0.3);
    if (bloom) { bloom.strength = CUR.bloom + h * 0.4; bloom.threshold = CUR.thr; }
    renderer.toneMappingExposure = CUR.exp + h * 0.12;
    if (ref.groundMat) ref.groundMat.color.copy(CUR.ground);
    if (ref.lampMat) ref.lampMat.color.set("#ffe2b0").multiplyScalar(CUR.lamp);
    motes.uniforms.uColA.value.copy(CUR.mA); motes.uniforms.uColB.value.copy(CUR.mB); motes.uniforms.uBoost.value = h * 0.9;
    sky.stars.material.opacity = CUR.stars;
    stdMats.forEach((m) => (m.envMapIntensity = CUR.envI));
  }

  /* ---------- camera ---------- */
  const right = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), fwd = new THREE.Vector3();
  function placeCamera(pos, look, dt) {
    S.smx += (S.mx - S.smx) * Math.min(1, dt * 2.5); S.smy += (S.my - S.smy) * Math.min(1, dt * 2.5);
    fwd.copy(look).sub(pos).normalize(); right.crossVectors(fwd, up).normalize();
    const amp = S.mode === "intro" ? 6 : 0.55;
    camera.position.copy(pos).addScaledVector(right, S.smx * amp).addScaledVector(up, -S.smy * amp * 0.6);
    camera.lookAt(look);
  }
  addEventListener("pointermove", (e) => { if (reduce || small) return; S.mx = e.clientX / innerWidth - 0.5; S.my = e.clientY / innerHeight - 0.5; }, { passive: true });

  /* ---------- scroll ---------- */
  const journeyEl = $("#journey");
  let st = null;
  function createScroll() {
    st = ScrollTrigger.create({ trigger: journeyEl, start: "top top", end: "bottom bottom", onUpdate: (self) => { S.target = self.progress; if (S.mode === "journey" && !S.autoScrolling) S.userScrolled = true; } });
  }
  function scrollYFor(p) { return st ? st.start + p * (st.end - st.start) : 0; }
  let scrollTween = null;
  function jumpTo(p, dur) {
    if (S.mode !== "journey") return;
    const y = scrollYFor(p), from = scrollY;
    if (scrollTween) scrollTween.kill();
    if (reduce) { scrollTo(0, y); return; }
    const o = { y: from };
    S.autoScrolling = true;
    scrollTween = gsap.to(o, { y, duration: dur || Math.min(4.5, Math.max(1.4, Math.abs(y - from) / 2600)), ease: "power2.inOut", onUpdate: () => scrollTo(0, o.y), onComplete: () => (S.autoScrolling = false) });
  }
  const stopAuto = () => { if (scrollTween && S.autoScrolling) { scrollTween.kill(); S.autoScrolling = false; } };
  addEventListener("wheel", stopAuto, { passive: true });
  addEventListener("touchstart", stopAuto, { passive: true });

  /* ---------- chapter UI ---------- */
  const titles = Object.fromEntries($$(".ch-title").map((e) => [e.dataset.title, e]));
  const cards = Object.fromEntries($$(".ch-card").map((e) => [e.dataset.card, e]));
  const hudItems = $$("#hudTrack li");
  hudItems.forEach((li, i) => li.setAttribute("data-n", i + 1));
  const finale = $("#finale");
  const order = ["restaurant", "hotel", "health", "jewel", "local", "tower"];
  function holdMid(k) { return k === "tower" ? 0.96 : (CH[k].hold[0] + CH[k].hold[1]) / 2; }
  document.addEventListener("click", (e) => {
    const j = e.target.closest("[data-jump]");
    if (j) { e.preventDefault(); if (S.mode !== "journey") enter(j.dataset.jump); else jumpTo(holdMid(j.dataset.jump)); audio.tick(); }
    const ex = e.target.closest("[data-action='explore']");
    if (ex) { e.preventDefault(); closeMenu(); if (S.mode === "intro") enter(); else jumpTo(holdMid("restaurant")); }
  });
  let lastUI = "";
  function updateUI(p) {
    const on = (r) => p >= r[0] && p <= r[1];
    let key = "";
    for (const k of order) {
      const c = CH[k];
      const tOn = S.mode === "journey" && on(c.title);
      titles[k].classList.toggle("on", tOn);
      if (cards[k]) cards[k].classList.toggle("on", S.mode === "journey" && on([c.hold[0] - 0.012, c.hold[1] + 0.02]));
      if (p >= c.title[0] - 0.02) key = k;
      if (tOn) key += "!";
    }
    const fin = S.mode === "journey" && p >= CH.tower.finale;
    finale.classList.toggle("on", fin);
    const k = key.replace("!", "");
    if (k !== lastUI) { hudItems.forEach((li) => li.classList.toggle("active", li.dataset.jump === k)); if (lastUI && key.endsWith("!")) audio.whoosh(0, 1.4); lastUI = k; }
    $("#hudBar").style.width = (p * 100).toFixed(1) + "%";
  }

  /* ---------- emerge / retract: the signature moment ---------- */
  const tmpV = new THREE.Vector3();
  function emerge(key) {
    const h = holos[key];
    if (h.state === "in" || h.state === "opening") return;
    if (h.tl) h.tl.kill();
    h.state = "opening";
    const sc = h.sc, dl = city.doorLights[key];
    const tl = gsap.timeline({ onComplete: () => (h.state = "in") });
    h.tl = tl;
    let delay = 0;

    // Restaurant: the owner walks to the door and opens it — first time only
    if (key === "restaurant" && !S.guideDone && people.guide && !reduce) {
      S.guideDone = true;
      const g = people.guide;
      const front = tmpV.copy(sc.doorWorld).addScaledVector(sc.normal, 1.1).setY(0.2).clone();
      g.speed = 2.0;
      tl.call(() => g.goTo(front, () => { g.root.rotation.y = -Math.PI / 2; }));
      delay = Math.min(2.6, g.root.position.distanceTo(front) / 2.0 + 0.2);
      tl.to({}, { duration: delay });
      tl.call(() => { gsap.to(g.root.scale, { x: 0.001, y: 0.001, z: 0.001, duration: 0.5, delay: 0.55, ease: "power2.in" }); gsap.to(g.root.position, { x: sc.doorWorld.x - sc.normal.x * 0.6, duration: 0.6, delay: 0.45 }); });
    }
    if (sc) {
      tl.to(sc.doorL.rotation, { y: -1.7, duration: 1.0, ease: "power3.out" }, delay);
      tl.to(sc.doorR.rotation, { y: 1.7, duration: 1.0, ease: "power3.out" }, delay);
      tl.to(sc.doorGlow.material, { opacity: 1, duration: 0.5 }, delay);
      tl.to(sc.spill.material, { opacity: 0.85, duration: 0.8 }, delay + 0.1);
      if (dl) tl.to(dl, { intensity: Q.low ? 25 : 70, duration: 0.9 }, delay);
      tl.call(() => { burst.fire(sc.doorWorld, sc.normal, sc.glowCol, gsap); audio.emerge(); }, null, delay + 0.25);
    } else tl.call(() => audio.emerge(), null, 0);

    const target = HOLO[key];
    h.el.classList.add("is-on");
    if (h.obj) {
      const o = h.obj; o.visible = true;
      const from = sc ? sc.doorWorld.clone().addScaledVector(sc.normal, 0.4) : target.pos.clone().setY(1);
      if (h.state !== "in") { o.position.copy(from); o.scale.setScalar(0.0006); o.rotation.set(0.35, target.rotY + (key === "local" ? 0 : (target.rotY > 0 ? 0.7 : -0.7)), 0); }
      tl.to(o.position, { x: target.pos.x, y: target.pos.y, z: target.pos.z, duration: 1.5, ease: "expo.out" }, delay + 0.35);
      tl.to(o.scale, { x: hs(), y: hs(), z: hs(), duration: 1.5, ease: "expo.out" }, delay + 0.35);
      tl.to(o.rotation, { x: 0, y: target.rotY, duration: 1.7, ease: "expo.out" }, delay + 0.35);
      tl.fromTo(h.el, { opacity: 0, "--scan": 1 }, { opacity: 1, duration: 0.6 }, delay + 0.35);
      tl.to(h.el, { "--scan": 0, duration: 1.2 }, delay + 1.0);
    } else {
      fitMobile(h);
      tl.fromTo(h.wrap, { opacity: 0, y: 140, scale: 0.15, rotateX: 40 }, { opacity: 1, y: 0, scale: 1, rotateX: 0, duration: 1.1, ease: "expo.out" }, delay + 0.3);
      tl.fromTo(h.el, { opacity: 0 }, { opacity: 1, duration: 0.4 }, delay + 0.3);
    }
  }
  function retract(key) {
    const h = holos[key];
    if (h.state === "out" || h.state === "closing") return;
    if (h.tl) h.tl.kill();
    h.state = "closing";
    const sc = h.sc, dl = city.doorLights[key];
    const tl = gsap.timeline({ onComplete: () => { h.state = "out"; h.el.classList.remove("is-on"); if (h.obj) h.obj.visible = false; } });
    h.tl = tl;
    if (h.obj) {
      const to = sc ? sc.doorWorld.clone().addScaledVector(sc.normal, 0.4) : HOLO[key].pos.clone().setY(1);
      tl.to(h.obj.position, { x: to.x, y: to.y, z: to.z, duration: 0.7, ease: "power3.in" }, 0);
      tl.to(h.obj.scale, { x: 0.0006, y: 0.0006, z: 0.0006, duration: 0.7, ease: "power3.in" }, 0);
      tl.to(h.el, { opacity: 0, duration: 0.5 }, 0.2);
    } else {
      tl.to(h.wrap, { opacity: 0, y: 80, scale: 0.3, duration: 0.5, ease: "power2.in" }, 0);
    }
    if (sc) {
      tl.to(sc.doorL.rotation, { y: 0, duration: 0.8, ease: "power2.inOut" }, 0.4);
      tl.to(sc.doorR.rotation, { y: 0, duration: 0.8, ease: "power2.inOut" }, 0.4);
      tl.to(sc.doorGlow.material, { opacity: 0.35, duration: 0.6 }, 0.5);
      tl.to(sc.spill.material, { opacity: 0, duration: 0.6 }, 0.4);
      if (dl) tl.to(dl, { intensity: 0, duration: 0.6 }, 0.4);
    }
    if (key === "restaurant" && people.guide) {
      const g = people.guide;
      tl.call(() => { gsap.killTweensOf(g.root.scale); gsap.killTweensOf(g.root.position); g.target = null; g.mode = "proud"; g.root.position.copy(city.spots.restaurantOwner); g.root.rotation.y = Math.PI / 2; g.root.scale.setScalar(1.02); S.guideDone = false; }, null, 1.2);
    }
  }
  function fitMobile(h) {
    const avail = innerHeight - 70 - 240;
    const r = h.el.getBoundingClientRect();
    const s = Math.min(1, avail / Math.max(1, r.height / (parseFloat(h.wrap.dataset.s) || 1)));
    h.wrap.dataset.s = s; h.wrap.style.setProperty("--fit", s);
  }
  function updateHolos(p) {
    for (const k of Object.keys(HOLO)) {
      const [a, b] = CH[k].hold;
      const want = S.mode === "journey" && p >= a - 0.022 && p <= b + 0.028 && !forms.isOpen();
      if (want) emerge(k); else retract(k);
    }
  }

  /* ---------- the portal intro ---------- */
  const enterBtn = $("#enterBtn"), intro = $("#intro");
  enterBtn.addEventListener("pointerenter", () => { S.hoverT = 1; audio.hover(); });
  enterBtn.addEventListener("pointerleave", () => (S.hoverT = 0));
  enterBtn.addEventListener("focus", () => (S.hoverT = 1));
  enterBtn.addEventListener("blur", () => (S.hoverT = 0));
  enterBtn.addEventListener("click", () => enter());
  addEventListener("keydown", (e) => { if (S.mode === "intro" && e.key === "Enter" && document.activeElement === document.body) enter(); });

  const portal = portalFX($("#portalFx"), enterBtn, Q.low ? 70 : 170);

  function enter(jump) {
    if (S.mode !== "intro") return;
    S.mode = "flying";
    S.hoverT = 0;
    audio.portal();
    enterBtn.classList.add("firing");
    portal.explode();
    const tl = gsap.timeline();
    const flight = { f: 0 };
    const mid = V(0, 70, 120), midLook = V(0, 12, -40);
    const p0 = KEYS[0];
    const fromPos = camera.position.clone(), fromLook = INTRO_LOOK.clone();
    const dur = reduce ? 0.01 : 3.8;
    tl.to(intro, { opacity: 0, y: -40, duration: reduce ? 0.2 : 0.9, ease: "power2.in", onComplete: () => (intro.style.display = "none") }, 0);
    if (!reduce) tl.to("#flash", { opacity: 0.85, duration: 0.35, ease: "power2.in" }, 0.85).to("#flash", { opacity: 0, duration: 1.4, ease: "power2.out" }, 1.2);
    tl.to(flight, {
      f: 1, duration: dur, ease: "power3.inOut",
      onUpdate: () => {
        const f = flight.f, a = 1 - f;
        // quadratic bezier through the sky down to the gate
        camPos.set(0, 0, 0).addScaledVector(fromPos, a * a).addScaledVector(mid, 2 * a * f).addScaledVector(p0.pos, f * f);
        camLook.set(0, 0, 0).addScaledVector(fromLook, a * a).addScaledVector(midLook, 2 * a * f).addScaledVector(p0.look, f * f);
        S.dayMix = smooth(clamp01(f * 1.15));
      }
    }, 0.25);
    tl.to(env.uWave, { value: 900, duration: reduce ? 0.01 : 3.4, ease: "power1.in" }, 0.6);
    tl.call(() => {
      S.mode = "journey";
      document.body.classList.remove("locked");
      scrollTo(0, 0);
      if (!st) createScroll();
      ScrollTrigger.refresh();
      $("#hud").classList.add("on");
      S.p = 0; S.target = 0;
      const dest = jump ? holdMid(jump) : holdMid("restaurant") - 0.012;
      setTimeout(() => jumpTo(dest, reduce ? 0 : 4.2), reduce ? 0 : 250);
      setTimeout(() => { if (!S.userScrolled) $("#scrollHint").classList.add("on"); }, reduce ? 500 : 7000);
      perf.reset();
    }, null, 0.25 + dur);
  }
  addEventListener("scroll", () => { if (S.mode === "journey" && !S.autoScrolling) $("#scrollHint").classList.remove("on"); }, { passive: true });

  /* ---------- nav / sound ---------- */
  const soundBtn = $("#soundBtn");
  const setSound = async (on) => {
    await audio.set(on);
    soundBtn.setAttribute("aria-pressed", String(on));
    soundBtn.setAttribute("aria-label", on ? "Sound on. Turn sound off" : "Sound off. Turn sound on");
    try { localStorage.setItem("dd-sound", on ? "1" : "0"); } catch (e) {}
  };
  soundBtn.addEventListener("click", () => setSound(!audio.enabled));
  const menuBtn = $("#menuBtn"), mnav = $("#mobileNav");
  function closeMenu() { mnav.hidden = true; menuBtn.setAttribute("aria-expanded", "false"); }
  menuBtn.addEventListener("click", () => { const o = mnav.hidden; mnav.hidden = !o; menuBtn.setAttribute("aria-expanded", String(o)); });
  mnav.addEventListener("click", (e) => { if (e.target.closest("a,button")) closeMenu(); });

  /* ---------- resize ---------- */
  function resize() {
    const w = innerWidth, h = innerHeight, a = w / h;
    camera.aspect = a; camera.fov = a < 0.8 ? 66 : a < 1.25 ? 56 : 50; camera.updateProjectionMatrix();
    layoutFor(camera.fov, a);
    Object.values(holos).forEach((hh) => { if (hh.obj && hh.state === "in") hh.obj.scale.setScalar(hs()); });
    renderer.setSize(w, h);
    if (composer) { composer.setSize(w, h); bloom.resolution.set(w / 2, h / 2); }
    if (cssRenderer) cssRenderer.setSize(w, h);
    Object.values(holos).forEach((hh) => hh.wrap && hh.state !== "out" && fitMobile(hh));
  }
  addEventListener("resize", resize);
  resize();

  /* ---------- performance governor ---------- */
  const perf = {
    acc: 0, n: 0, level: 0,
    reset() { this.acc = 0; this.n = 0; },
    sample(dt) {
      this.acc += dt; this.n++;
      if (this.n < 150) return;
      const avg = this.acc / this.n; this.reset();
      if (avg > 1 / 34 && this.level === 0) { this.level = 1; renderer.setPixelRatio(1); if (composer) composer.setPixelRatio(1); sun.castShadow = false; renderer.shadowMap.enabled = false; resize(); }
      else if (avg > 1 / 26 && this.level === 1) { this.level = 2; composer = null; }
    }
  };

  /* ---------- initial frame ---------- */
  S.p = 0; applyPalette();
  camPos.copy(INTRO_POS); camLook.copy(INTRO_LOOK);
  placeCamera(camPos, camLook, 0.016);
  progress(90, "Final touches…");
  try { renderer.compile(scene, camera); } catch (e) {}
  refreshScreens();

  const clock = new THREE.Clock();
  function frame() {
    requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
    env.uTime.value = t;
    S.hover += (S.hoverT - S.hover) * Math.min(1, dt * 4);

    if (S.mode === "intro") {
      const o = reduce ? 0 : t * 0.04;
      camPos.set(Math.sin(o) * 40, INTRO_POS.y + Math.sin(t * 0.2) * 4 - S.hover * 10, INTRO_POS.z - S.hover * 22);
      camLook.copy(INTRO_LOOK);
    } else if (S.mode === "journey") {
      S.p = reduce ? S.target : S.p + (S.target - S.p) * (1 - Math.exp(-dt * 3.4));
      cameraAt(S.p, camPos, camLook);
      S.dayMix = 1;
      perf.sample(dt);
    }
    placeCamera(camPos, camLook, dt);
    applyPalette();

    // sun + shadows follow the action
    sun.position.copy(camLook).addScaledVector(env.uSunDir.value, 160);
    sun.target.position.copy(camLook);

    city.update(dt, t);
    people.update(dt, t, camera);
    tickScreens(dt);
    motes.update(camera);
    sky.follow(camera);
    if (S.mode !== "intro") { updateUI(S.p); updateHolos(S.p); }
    if (S.mode === "intro") portal.draw(dt, S.hover);

    if (composer) composer.render(); else renderer.render(scene, camera);
    if (cssRenderer) cssRenderer.render(cssScene, camera);
  }
  frame();

  // reveal
  progress(100, "Welcome.");
  try { if (localStorage.getItem("dd-sound") === "1") soundBtn.classList.add("suggest"); } catch (e) {}
  setTimeout(() => {
    $("#loader").classList.add("done");
    if (!reduce) {
      gsap.from(".intro-title .ln > span", { yPercent: 110, duration: 1.3, stagger: 0.12, ease: "expo.out", delay: 0.2 });
      gsap.from([".intro-kicker", ".intro-sub", ".intro-what", ".portal-btn", ".intro-alt", ".intro-hint"], { opacity: 0, y: 24, duration: 1, stagger: 0.1, ease: "expo.out", delay: 0.6 });
    }
    enterBtn.focus({ preventScroll: true });
  }, 350);

  // Deep link: world.html#city jumps straight in
  if (location.hash === "#city") setTimeout(() => enter(), 900);
})().catch((err) => { console.error(err); failGL(); });

/* ======================================================================
   Portal particles (2D canvas around the Enter button)
   ====================================================================== */
function portalFX(canvas, btn, count) {
  const ctx = canvas.getContext("2d");
  let W = 0, H = 0, dpr = Math.min(devicePixelRatio || 1, 2);
  const resize = () => { W = canvas.clientWidth; H = canvas.clientHeight; canvas.width = W * dpr; canvas.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
  resize(); addEventListener("resize", resize);
  const cols = ["255,199,107", "255,138,61", "127,231,255", "255,240,220"];
  const ps = Array.from({ length: count }, () => ({ a: Math.random() * Math.PI * 2, r: 140 + Math.random() * 260, s: (0.15 + Math.random() * 0.35) * (Math.random() < 0.5 ? -1 : 1), z: Math.random(), c: cols[(Math.random() * cols.length) | 0], vx: 0, vy: 0, x: 0, y: 0, life: 1 }));
  let exploding = false, alive = true;
  return {
    explode() { exploding = true; ps.forEach((p) => { const k = 6 + Math.random() * 14; p.vx = Math.cos(p.a) * k; p.vy = Math.sin(p.a) * k * 0.6; }); setTimeout(() => (alive = false), 1800); },
    draw(dt, hover) {
      if (!alive && !exploding) return;
      const b = btn.getBoundingClientRect(), cx = b.left + b.width / 2, cy = b.top + b.height / 2;
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = "lighter";
      for (const p of ps) {
        if (exploding) { p.x += p.vx; p.y += p.vy; p.vx *= 0.985; p.vy *= 0.985; p.life -= dt * 0.7; }
        else {
          p.a += p.s * dt * (1 + hover * 2.5);
          const r = p.r * (1 - hover * 0.45) * (0.9 + Math.sin(p.a * 3 + p.z * 10) * 0.08);
          p.x = cx + Math.cos(p.a) * r * 1.4; p.y = cy + Math.sin(p.a) * r * 0.42;
        }
        const al = Math.max(0, p.life) * (0.25 + p.z * 0.55) * (0.6 + hover * 0.8);
        const sz = (1 + p.z * 2.2) * (1 + hover * 0.6);
        ctx.fillStyle = `rgba(${p.c},${al})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, sz, 0, 7); ctx.fill();
        if (p.z > 0.8) { ctx.fillStyle = `rgba(${p.c},${al * 0.15})`; ctx.beginPath(); ctx.arc(p.x, p.y, sz * 5, 0, 7); ctx.fill(); }
      }
      ctx.globalCompositeOperation = "source-over";
    }
  };
}
