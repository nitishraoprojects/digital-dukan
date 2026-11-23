// The city: districts, showcase buildings, skyline, street furniture, vehicles, tower.
import * as THREE from "three";
import { neonSign, stripes, roadTexture, tileTexture, websiteScreen, ddEmblem, dotSprite, canvasTexture } from "./textures.js";
import { createFountain, lightBeam } from "./effects.js";

const PI = Math.PI;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];

/* ---------- material helpers ---------- */
const matCache = new Map();
function std(color, { rough = 0.6, metal = 0.1, emissive = null, ei = 1, map = null } = {}) {
  const key = [color, rough, metal, emissive, ei].join("|");
  if (!map && matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, map });
  if (emissive) { m.emissive = new THREE.Color(emissive); m.emissiveIntensity = ei; }
  if (!map) matCache.set(key, m);
  return m;
}
function glow(color, intensity = 2) {
  const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), toneMapped: false });
  return m;
}
const BOX01 = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);

/* ---------- procedural building shader (instanced) ---------- */
export function buildingMaterial(env, base = "#1d2038", top = "#3a3466", edge = null) {
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
    uBase: { value: new THREE.Color(base) }, uTop: { value: new THREE.Color(top) },
    uEdge: { value: new THREE.Color(edge || "#8fe3ff") }
  }]);
  for (const k of ["uTime", "uSunDir", "uSunCol", "uAmb", "uIllum", "uWave", "uWarm", "uCool"]) uniforms[k] = env[k];
  return new THREE.ShaderMaterial({
    uniforms, fog: true,
    vertexShader: /* glsl */`
      varying vec3 vW; varying vec3 vN; varying float vH; varying vec3 vCol; varying float vSeed;
      #include <fog_pars_vertex>
      void main(){
        mat4 im = mat4(1.0);
        #ifdef USE_INSTANCING
          im = instanceMatrix;
        #endif
        vec4 wp = modelMatrix * im * vec4(position, 1.0);
        vW = wp.xyz;
        vN = normalize(mat3(modelMatrix * im) * normal);
        vH = position.y;
        #ifdef USE_INSTANCING_COLOR
          vCol = instanceColor;
        #else
          vCol = vec3(1.0);
        #endif
        vec4 c = modelMatrix * im * vec4(0.0, 0.0, 0.0, 1.0);
        vSeed = fract(c.x * 0.131 + c.z * 0.717);
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uBase, uTop, uEdge, uSunDir, uSunCol, uAmb, uWarm, uCool;
      uniform float uIllum, uWave, uTime;
      varying vec3 vW; varying vec3 vN; varying float vH; varying vec3 vCol; varying float vSeed;
      #include <fog_pars_fragment>
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main(){
        vec3 n = normalize(vN);
        vec3 base = mix(uBase, uTop, clamp(vH, 0.0, 1.0)) * vCol;
        float diff = max(dot(n, normalize(uSunDir)), 0.0);
        vec3 col = base * (uAmb + uSunCol * diff * 0.9);
        float side = 1.0 - step(0.5, abs(n.y));
        if (side > 0.5) {
          float u = abs(n.x) > 0.5 ? vW.z : vW.x;
          vec2 g = vec2(u / 1.9, vW.y / 2.7);
          vec2 cell = floor(g); vec2 f = fract(g);
          float win = step(0.16, f.x) * step(f.x, 0.84) * step(0.2, f.y) * step(f.y, 0.8) * step(2.5, vW.y);
          float r = hash(cell + vSeed * 97.0);
          float lit = step(1.0 - uIllum * 0.8, r);
          float dist = length(vW.xz - vec2(0.0, 40.0));
          float reached = smoothstep(uWave, uWave - 70.0, dist);
          float ring = smoothstep(45.0, 0.0, abs(dist - uWave));
          vec3 wc = mix(uWarm, uCool, step(0.72, hash(cell * 1.7 + vSeed)));
          float flick = 0.88 + 0.12 * sin(uTime * 1.7 + r * 50.0);
          vec3 glass = mix(col * 0.5, uAmb * 0.25 + uSunCol * 0.12 * pow(1.0 - abs(dot(n, vec3(0.0,0.0,1.0))), 2.0), 0.5);
          col = mix(col, glass, win * 0.8);
          col += win * lit * wc * flick * (0.32 + 0.78 * reached) + win * ring * uWarm * 1.4;
          // vertical light seams
          float seam = smoothstep(0.035, 0.0, abs(fract(u / 13.3) - 0.5)) * step(0.82, hash(vec2(floor(u / 13.3), vSeed)));
          col += seam * uEdge * 0.8 * uIllum;
        } else if (n.y > 0.5) {
          col = base * (uAmb * 0.6 + uSunCol * 0.35);
        }
        float crown = smoothstep(0.988, 1.0, vH) * side;
        col += crown * uEdge * (0.6 + uIllum * 1.4);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`
  });
}

/* ---------- facade window texture for showcase upper floors ---------- */
function facadeTex(wall, light, cols = 6, rows = 3) {
  return canvasTexture(512, 256, (ctx, w, h) => {
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, w, h);
    const cw = w / cols, ch = h / rows;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const on = Math.random() > 0.35;
      ctx.fillStyle = on ? light : "#1a1a26";
      ctx.globalAlpha = on ? 0.55 + Math.random() * 0.45 : 1;
      ctx.fillRect(c * cw + cw * 0.18, r * ch + ch * 0.2, cw * 0.64, ch * 0.6);
    }
    ctx.globalAlpha = 1;
  });
}

/* ======================================================================
   SHOWCASE BUILDING — a storefront whose doors open and whose website
   emerges into the street.
   ====================================================================== */
function makeShowcase(o) {
  const {
    side, z, front = 16, W = 16, D = 14, H = 12,
    wall = "#2b2233", trim = "#ffb36b", sign, signColor = "#ffb36b", signFont = "700 112px Manrope", signSub = "",
    awningA, awningB, glowCol = "#ffcf8a", screen, shadows
  } = o;
  const g = new THREE.Group();
  g.position.set(side * front, 0.2, z);
  g.rotation.y = side < 0 ? PI / 2 : -PI / 2;

  const body = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), std(wall, { rough: 0.55, metal: 0.25 }));
  body.position.set(0, H / 2, -D / 2);
  body.castShadow = shadows; body.receiveShadow = shadows;
  g.add(body);

  // upper-floor windows
  if (H > 8) {
    const fm = new THREE.MeshStandardMaterial({ color: wall, roughness: 0.4, metalness: 0.4, emissive: "#ffffff", emissiveMap: facadeTex(wall, glowCol, Math.round(W / 2.6), Math.max(1, Math.round((H - 7) / 2.6))), emissiveIntensity: 0.9 });
    const fac = new THREE.Mesh(new THREE.PlaneGeometry(W - 1.2, H - 7.2), fm);
    fac.position.set(0, 7.2 + (H - 7.2) / 2 - 0.3, 0.02);
    g.add(fac);
  }

  // storefront glass
  const glassW = W / 2 - 2.3;
  const glassMat = new THREE.MeshStandardMaterial({ color: "#120f18", emissive: glowCol, emissiveIntensity: 0.85, roughness: 0.15, metalness: 0.5 });
  for (const s of [-1, 1]) {
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(glassW, 3.3), glassMat);
    gl.position.set(s * (2.05 + glassW / 2), 2.05, 0.03);
    g.add(gl);
  }
  // neon trims
  const trimMat = glow(trim, 2.2);
  const t1 = new THREE.Mesh(new THREE.BoxGeometry(W, 0.12, 0.12), trimMat); t1.position.set(0, 4.15, 0.08); g.add(t1);
  const t2 = new THREE.Mesh(new THREE.BoxGeometry(W + 0.2, 0.16, 0.16), trimMat); t2.position.set(0, H, 0.05); g.add(t2);
  for (const s of [-1, 1]) { const v = new THREE.Mesh(new THREE.BoxGeometry(0.12, H, 0.12), trimMat); v.position.set(s * W / 2, H / 2, 0.06); g.add(v); }

  // door frame, inner glow, leaves
  const frame = new THREE.Mesh(new THREE.BoxGeometry(3.5, 4.0, 0.25), std("#111018", { rough: 0.4, metal: 0.6 }));
  frame.position.set(0, 2.0, 0.0); g.add(frame);
  const doorGlowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(glowCol), transparent: true, opacity: 0.35, toneMapped: false });
  const doorGlow = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 3.6), doorGlowMat);
  doorGlow.position.set(0, 1.8, 0.14); g.add(doorGlow);
  const leafMat = new THREE.MeshStandardMaterial({ color: "#2a2632", roughness: 0.25, metalness: 0.7, emissive: trim, emissiveIntensity: 0.15 });
  const mkLeaf = (s) => {
    const pivot = new THREE.Group();
    pivot.position.set(s * -1.5, 1.8, 0.2);
    const geo = new THREE.BoxGeometry(1.48, 3.55, 0.08).translate(s * -0.74 * -1, 0, 0);
    const leaf = new THREE.Mesh(geo, leafMat);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.8, 0.12), trimMat);
    handle.position.set(s * 1.3, 0, 0.06);
    pivot.add(leaf, handle);
    g.add(pivot);
    return pivot;
  };
  const doorL = mkLeaf(1);   // hinge on the left (-x), opens with negative rotation
  const doorR = mkLeaf(-1);  // hinge on the right (+x), opens with positive rotation

  // awning
  if (awningA) {
    const aw = new THREE.Mesh(new THREE.BoxGeometry(W * 0.92, 0.14, 2.4), new THREE.MeshStandardMaterial({ map: stripes(awningA, awningB || "#f6f1e7"), roughness: 0.8 }));
    aw.position.set(0, 4.9, 1.1); aw.rotation.x = 0.28; g.add(aw);
  }
  // neon sign
  let signMesh = null;
  if (sign) {
    const tex = neonSign(sign, { color: signColor, font: signFont, sub: signSub });
    signMesh = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(W * 0.85, 12), Math.min(W * 0.85, 12) / 4), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, depthWrite: false }));
    signMesh.position.set(0, 6.25, 0.3); g.add(signMesh);
  }
  // rooftop billboard showing the business's own website
  if (screen) {
    const sw = Math.min(W * 0.7, 10);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(sw, sw * 0.625), new THREE.MeshBasicMaterial({ map: websiteScreen(screen), toneMapped: false, color: new THREE.Color(1.15, 1.15, 1.15) }));
    scr.position.set(0, H + 0.6 + sw * 0.31, -1.2); g.add(scr);
    const bez = new THREE.Mesh(new THREE.BoxGeometry(sw + 0.4, sw * 0.625 + 0.4, 0.2), std("#0b0b12", { metal: 0.7, rough: 0.3 }));
    bez.position.set(0, scr.position.y, -1.35); g.add(bez);
    for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.2, 0.2), std("#222")); p.position.set(s * sw * 0.35, H + 0.6, -1.3); g.add(p); }
  }
  // light spill on the pavement
  const spill = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), new THREE.MeshBasicMaterial({ map: dotSprite(), color: new THREE.Color(glowCol), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  spill.rotation.x = -PI / 2; spill.position.set(0, 0.04, 3.2); g.add(spill);

  g.updateMatrixWorld(true);
  const doorWorld = g.localToWorld(new THREE.Vector3(0, 1.8, 0.6));
  const normal = new THREE.Vector3(side < 0 ? 1 : -1, 0, 0);
  return { group: g, doorL, doorR, doorGlow, spill, signMesh, doorWorld, normal, glowCol };
}

/* ======================================================================
   BUILD
   ====================================================================== */
export function buildCity(scene, env, Q) {
  const updaters = [];
  const showcases = {};
  const spots = {};
  const shadows = Q.shadows;

  /* ----- Ground, road, sidewalks ----- */
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshStandardMaterial({ color: "#1a1a2a", roughness: 0.42, metalness: 0.55 }));
  ground.rotation.x = -PI / 2; ground.receiveShadow = shadows;
  scene.add(ground);

  const roadLen = 640, roadZ = -250;
  const road = new THREE.Mesh(new THREE.PlaneGeometry(18, roadLen), new THREE.MeshStandardMaterial({ map: roadTexture(), roughness: 0.35, metalness: 0.5, emissive: "#ffffff", emissiveIntensity: 0.0 }));
  road.material.map.repeat.set(1, roadLen / 16);
  road.rotation.x = -PI / 2; road.position.set(0, 0.02, roadZ); road.receiveShadow = shadows;
  scene.add(road);
  // emissive lane glow strip (cyan edges pop at night)
  const edgeMat = glow("#7fe7ff", 1.3);
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, roadLen), edgeMat);
    e.position.set(s * 9, 0.05, roadZ); scene.add(e);
  }
  const paver = tileTexture("#3a3a4c", "rgba(255,255,255,.08)");
  paver.repeat.set(2, roadLen / 4);
  const walkMat = new THREE.MeshStandardMaterial({ map: paver, roughness: 0.6, metalness: 0.2 });
  for (const s of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(7, 0.2, roadLen), walkMat);
    w.position.set(s * 12.5, 0.1, roadZ); w.receiveShadow = shadows; scene.add(w);
  }
  ref.groundMat = ground.material; ref.roadMat = road.material; ref.walkMat = walkMat;

  /* ----- Gate (z = 40) ----- */
  {
    const gate = new THREE.Group(); gate.position.set(0, 0, 40);
    const pm = std("#1c1a2e", { metal: 0.7, rough: 0.3 });
    for (const s of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(2.4, 20, 2.4), pm); p.position.set(s * 11, 10, 0); gate.add(p);
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.16, 19, 0.16), glow("#ffb36b", 2.4)); l.position.set(s * 11 - s * 1.25, 10, 1.25); gate.add(l);
      const l2 = l.clone(); l2.position.x = s * 11 + s * 1.25; gate.add(l2);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(25, 2.6, 2.6), pm); beam.position.set(0, 21, 0); gate.add(beam);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(18, 4.5), new THREE.MeshBasicMaterial({ map: neonSign("NIKAVI LABS", { color: "#ffb36b", font: "400 118px Fraunces", sub: "WELCOME TO THE CITY", subColor: "#8fe3ff" }), transparent: true, toneMapped: false, depthWrite: false }));
    sign.position.set(0, 21, 1.35); gate.add(sign);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(7.5, 0.12, 8, 96), glow("#8fe3ff", 2.2));
    ring.position.set(0, 11, 0); gate.add(ring);
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(6.6, 0.06, 8, 96), glow("#ffb36b", 2.2));
    ring2.position.set(0, 11, 0); gate.add(ring2);
    scene.add(gate);
    updaters.push((dt, t) => { ring.rotation.z = t * 0.25; ring2.rotation.z = -t * 0.4; ring.rotation.y = Math.sin(t * 0.5) * 0.2; });
  }

  /* ----- Reserved spans (custom architecture) ----- */
  const reserved = { "-1": [[-15, -1], [-40, -20], [-59, -45], [-142, -94], [-246, -194], [-418, -366]], "1": [[-20, -4], [-36, -22], [-54, -38], [-148, -92], [-324, -276], [-418, -366]] };
  const isReserved = (side, z0, z1) => reserved[side].some(([a, b]) => Math.max(z0, z1) >= a && Math.min(z0, z1) <= b);

  /* ======================= RESTAURANT STREET ======================= */
  showcases.restaurant = makeShowcase({ side: -1, z: -30, W: 18, D: 14, H: 12, wall: "#2a1714", trim: "#ffb36b", sign: "TANDOOR & TALES", signColor: "#ffa54b", signFont: "400 104px 'DM Serif Display'", signSub: "OPEN FIRE KITCHEN", awningA: "#b83a26", awningB: "#f5e6d3", glowCol: "#ffbf73", screen: "restaurant", shadows });
  scene.add(showcases.restaurant.group);
  const restShops = [
    { side: -1, z: -8, W: 12, wall: "#3a2a22", trim: "#ffd59a", sign: "CAFÉ LUMEN", signColor: "#ffd59a", awningA: "#c06a2b", screen: "cafe", H: 10 },
    { side: 1, z: -12, W: 14, wall: "#191c2c", trim: "#ff6b6b", sign: "WOK STREET", signColor: "#ff5e57", awningA: "#ef4444", awningB: "#111827", screen: "noodle", H: 13 },
    { side: 1, z: -29, W: 12, wall: "#2b2030", trim: "#ffcf6b", sign: "THE THALI HOUSE", signColor: "#ffcf6b", awningA: "#d97706", screen: "restaurant", H: 9 },
    { side: 1, z: -46, W: 14, wall: "#2e1a17", trim: "#ff8a5c", sign: "FORNO PIZZA", signColor: "#ff6a3d", awningA: "#dc2626", awningB: "#fff7ed", screen: "pizza", H: 11 },
    { side: -1, z: -52, W: 12, wall: "#183424", trim: "#facc15", sign: "CHAI & CO.", signColor: "#facc15", awningA: "#14532d", awningB: "#fef9c3", screen: "chai", H: 10 }
  ];
  restShops.forEach((s) => scene.add(makeShowcase({ ...s, D: 12, signFont: "700 104px Manrope", shadows }).group));

  // outdoor tables with chairs → seats for diners
  const tableMat = std("#e9dcc6", { rough: 0.5 }), chairMat = std("#3b2a22", { rough: 0.7 });
  const seats = [];
  for (const tz of [-23, -37, -10]) {
    const tx = -12.6;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.06, 20), tableMat); top.position.set(tx, 0.95, tz);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.25, 0.75, 8), chairMat); leg.position.set(tx, 0.58, tz);
    top.castShadow = shadows; scene.add(top, leg);
    for (const s of [-1, 1]) {
      const ch = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.5), chairMat); ch.position.set(tx, 0.68, tz + s * 1.0); scene.add(ch);
      const bk = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.06), chairMat); bk.position.set(tx, 1.0, tz + s * 1.25); scene.add(bk);
      seats.push({ pos: new THREE.Vector3(tx, 0.2, tz + s * 1.0), face: s > 0 ? PI : 0 });
    }
    // floating digital menu above each table
    const menu = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.375), new THREE.MeshBasicMaterial({ map: websiteScreen("restaurant", { w: 384, h: 240 }), toneMapped: false, transparent: true, opacity: 0.92, side: THREE.DoubleSide }));
    menu.position.set(tx + 0.4, 3.2, tz); menu.rotation.y = PI / 2;
    scene.add(menu);
    const off = Math.random() * 6;
    updaters.push((dt, t) => { menu.position.y = 3.2 + Math.sin(t * 1.2 + off) * 0.15; menu.rotation.y = PI / 2 + Math.sin(t * 0.6 + off) * 0.25; });
  }
  // street-food cart (chef cooks here)
  {
    const cart = new THREE.Group(); cart.position.set(-11.2, 0.2, -16.5); cart.rotation.y = PI / 2;
    const b = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.0, 1.2), std("#b83a26", { rough: 0.5 })); b.position.y = 0.7; cart.add(b);
    const tp = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.08, 1.4), std("#cfcfd6", { metal: 0.8, rough: 0.25 })); tp.position.y = 1.24; cart.add(tp);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(3, 0.1, 1.8), new THREE.MeshStandardMaterial({ map: stripes("#facc15", "#b83a26", 10) })); roof.position.y = 2.7; cart.add(roof);
    for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.5), std("#222")); p.position.set(s * 1.3, 1.95, -0.6); cart.add(p); }
    const pan = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.35, 0.12, 20), std("#2a2a2a", { metal: 0.8, rough: 0.3 })); pan.position.set(0.4, 1.34, 0); cart.add(pan);
    const fire = new THREE.Mesh(new THREE.CircleGeometry(0.38, 20), glow("#ff7a2a", 2.5)); fire.rotation.x = -PI / 2; fire.position.set(0.4, 1.29, 0); cart.add(fire);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6), new THREE.MeshBasicMaterial({ map: neonSign("CHAAT STATION", { color: "#ffd166", font: "700 110px Manrope" }), transparent: true, toneMapped: false }));
    sign.position.set(0, 3.05, 0.9); cart.add(sign);
    scene.add(cart);
    updaters.push((dt, t) => { fire.material.color.setRGB(2.5 + Math.sin(t * 13) * 0.4, 1.0 + Math.sin(t * 9) * 0.2, 0.3); });
    spots.cart = new THREE.Vector3(-10.0, 0.2, -16.5);
  }
  spots.seats = seats;
  spots.restaurantDoor = showcases.restaurant.doorWorld.clone().setY(0.2);
  spots.restaurantOwner = new THREE.Vector3(-12.4, 0.2, -26.6);

  /* ======================= HOTEL AVENUE ======================= */
  showcases.hotel = makeShowcase({ side: 1, z: -120, front: 27, W: 30, D: 22, H: 9, wall: "#1c2a22", trim: "#e6c27a", sign: "ARANYA GRAND", signColor: "#f2d28f", signFont: "500 110px 'Cormorant Garamond'", signSub: "HOTEL · SPA · VILLAS", glowCol: "#ffd9a0", shadows });
  scene.add(showcases.hotel.group);
  // Tower above the podium
  const hotelMat = buildingMaterial(env, "#3a3226", "#7a6440", "#ffd79a");
  const tower = new THREE.Mesh(BOX01, hotelMat);
  tower.scale.set(22, 78, 30); tower.position.set(38, 9.2, -120); scene.add(tower);
  const crown = new THREE.Mesh(new THREE.BoxGeometry(23, 0.5, 31), glow("#ffd79a", 2)); crown.position.set(38, 87.4, -120); scene.add(crown);
  // gold fins
  {
    const n = 12, fins = new THREE.InstancedMesh(new THREE.BoxGeometry(0.35, 78, 0.6), std("#c9a45c", { metal: 0.9, rough: 0.25, emissive: "#5a4520", ei: 0.4 }), n);
    const m = new THREE.Matrix4();
    for (let i = 0; i < n; i++) { m.makeTranslation(26.8, 9.2 + 39, -134 + i * (28 / (n - 1))); fins.setMatrixAt(i, m); }
    scene.add(fins);
  }
  // canopy
  {
    const c = new THREE.Mesh(new THREE.BoxGeometry(5, 0.4, 9), std("#1a1a1a", { metal: 0.8, rough: 0.3 })); c.position.set(23.5, 5.2, -120); scene.add(c);
    const u = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 8.6), glow("#ffd9a0", 1.6)); u.rotation.x = PI / 2; u.position.set(23.5, 4.98, -120); scene.add(u);
  }
  // glass elevators gliding up the facade
  {
    const capMat = new THREE.MeshStandardMaterial({ color: "#9fdcff", emissive: "#bfe9ff", emissiveIntensity: 1.2, transparent: true, opacity: 0.75, roughness: 0.1, metalness: 0.3 });
    [[-110, 0], [-130, 2.1]].forEach(([z, ph]) => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.15, 76, 0.15), glow("#ffd79a", 1.2)); rail.position.set(26.4, 47, z); scene.add(rail);
      const e = new THREE.Mesh(new THREE.CapsuleGeometry(0.9, 1.6, 4, 12), capMat); e.position.set(26.0, 10, z); scene.add(e);
      updaters.push((dt, t) => { e.position.y = 12 + (Math.sin(t * 0.25 + ph) * 0.5 + 0.5) * 66; });
    });
  }
  // plaza + fountain
  {
    const plaza = new THREE.Mesh(new THREE.BoxGeometry(11, 0.22, 50), new THREE.MeshStandardMaterial({ map: tileTexture("#4a4438", "rgba(255,230,180,.12)"), roughness: 0.5, metalness: 0.3 }));
    plaza.material.map.repeat.set(3, 12);
    plaza.position.set(21.5, 0.11, -120); plaza.receiveShadow = shadows; scene.add(plaza);
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.4, 0.8, 40), std("#e9e2d2", { rough: 0.4 })); basin.position.set(18.5, 0.6, -120); scene.add(basin);
    const water = new THREE.Mesh(new THREE.CircleGeometry(2.9, 40), new THREE.MeshStandardMaterial({ color: "#5fc9ff", emissive: "#2fa7e0", emissiveIntensity: 0.9, roughness: 0.05, metalness: 0.4 }));
    water.rotation.x = -PI / 2; water.position.set(18.5, 0.98, -120); scene.add(water);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.25, 0.06, 6, 60), glow("#ffd79a", 2)); ring.rotation.x = PI / 2; ring.position.set(18.5, 1.02, -120); scene.add(ring);
    createFountain(scene, env, new THREE.Vector3(18.5, 1.0, -120), Q.low ? 250 : 700, Q.pixelRatio);
  }
  // floating room showcases
  [[-104, "rooms"], [-136, "hotel"]].forEach(([z, th], i) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 4.5), new THREE.MeshBasicMaterial({ map: websiteScreen(th), toneMapped: false, transparent: true, opacity: 0.95, side: THREE.DoubleSide }));
    p.position.set(15, 16, z); p.rotation.y = -PI / 2 + (i ? 0.25 : -0.25); scene.add(p);
    const fr = new THREE.Mesh(new THREE.PlaneGeometry(7.6, 4.9), glow("#ffd79a", 1.1)); fr.position.copy(p.position); fr.rotation.copy(p.rotation); fr.translateZ(-0.02); scene.add(fr);
    updaters.push((dt, t) => { p.position.y = fr.position.y = 16 + Math.sin(t * 0.8 + i * 2) * 0.4; });
  });
  // pool deck on the left
  {
    const deck = new THREE.Mesh(new THREE.BoxGeometry(18, 0.6, 44), std("#d9cfbd", { rough: 0.6 })); deck.position.set(-25, 0.3, -118); deck.receiveShadow = shadows; scene.add(deck);
    const poolMat = new THREE.ShaderMaterial({
      uniforms: { uTime: env.uTime },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `uniform float uTime; varying vec2 vUv;
        void main(){ vec2 p = vUv*vec2(6.0,12.0); float c = sin(p.x*3.0+uTime*1.3)*sin(p.y*2.0-uTime*1.1) + sin((p.x+p.y)*2.3+uTime*0.9);
          c = smoothstep(0.9, 1.9, c); vec3 col = mix(vec3(0.05,0.45,0.75), vec3(0.4,0.95,1.0), c*0.8);
          gl_FragColor = vec4(col*1.25, 1.0); }`
    });
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(9, 28), poolMat); pool.rotation.x = -PI / 2; pool.position.set(-27.5, 0.62, -118); scene.add(pool);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.1, 28.6), glow("#bff3ff", 1.3)); edge.position.set(-27.5, 0.6, -118); scene.add(edge);
    const loungeMat = std("#f6f1e7", { rough: 0.7 });
    const loungers = [];
    for (let i = 0; i < 4; i++) {
      const z = -106 - i * 7;
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.25, 2.2), loungeMat); l.position.set(-20.2, 0.85, z); scene.add(l);
      loungers.push(new THREE.Vector3(-20.2, 0.62, z));
      if (i % 2 === 0) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3), std("#333")); pole.position.set(-18.4, 2, z + 1.8); scene.add(pole);
        const um = new THREE.Mesh(new THREE.ConeGeometry(1.8, 0.7, 12, 1, true), new THREE.MeshStandardMaterial({ map: stripes("#e8772e", "#f6f1e7", 12), side: THREE.DoubleSide })); um.position.set(-18.4, 3.5, z + 1.8); scene.add(um);
      }
    }
    spots.loungers = loungers;
  }
  spots.hotelDoor = showcases.hotel.doorWorld.clone().setY(0.2);
  spots.hotelPlaza = new THREE.Vector3(20, 0.22, -112);

  /* ======================= HEALTHCARE DISTRICT ======================= */
  showcases.health = makeShowcase({ side: -1, z: -210, W: 26, D: 20, H: 10, wall: "#e8edf4", trim: "#2ee6c0", sign: "CAREPOINT", signColor: "#35e0c4", signFont: "800 120px 'Plus Jakarta Sans'", signSub: "MULTISPECIALITY HOSPITAL", glowCol: "#cfefff", shadows });
  scene.add(showcases.health.group);
  const hospMat = buildingMaterial(env, "#c9d4e2", "#f2f6fb", "#2ee6c0");
  hospMat.uniforms.uWarm = { value: new THREE.Color("#d8f3ff") };
  const hosp = new THREE.Mesh(BOX01, hospMat); hosp.scale.set(22, 34, 30); hosp.position.set(-28, 10.2, -210); scene.add(hosp);
  const wing = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 26, 40), std("#eef2f7", { rough: 0.35, metal: 0.2 })); wing.position.set(-24, 13.2, -232); wing.castShadow = shadows; scene.add(wing);
  for (let i = 0; i < 5; i++) { const band = new THREE.Mesh(new THREE.CylinderGeometry(7.05, 7.05, 0.9, 40, 1, true), new THREE.MeshStandardMaterial({ color: "#0b2545", emissive: "#4aa8ff", emissiveIntensity: 0.6, roughness: 0.1, metalness: 0.6 })); band.position.set(-24, 3.5 + i * 4.6, -232); scene.add(band); }
  // glowing cross on the roof
  {
    const cm = glow("#35e0c4", 2.4);
    const a = new THREE.Mesh(new THREE.BoxGeometry(0.6, 7, 2.2), cm), b = new THREE.Mesh(new THREE.BoxGeometry(0.6, 2.2, 7), cm);
    a.position.set(-16.8, 49, -210); b.position.copy(a.position); scene.add(a, b);
    updaters.push((dt, t) => { const k = 2.0 + Math.sin(t * 2) * 0.4; cm.color.setRGB(0.21 * k, 0.88 * k, 0.77 * k); });
  }
  // appointment kiosks
  const kioskMat = std("#f4f7fb", { rough: 0.3, metal: 0.3 });
  [-197, -223].forEach((z) => {
    const k = new THREE.Group(); k.position.set(-11, 0.2, z); k.rotation.y = PI / 2;
    const ped = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.8, 0.5), kioskMat); ped.position.y = 0.9; k.add(ped);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.0), new THREE.MeshBasicMaterial({ map: websiteScreen("clinic", { w: 384, h: 240 }), toneMapped: false }));
    scr.position.set(0, 2.25, 0.05); scr.rotation.x = -0.15; k.add(scr);
    const head = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.2, 0.15), kioskMat); head.position.set(0, 2.25, -0.05); head.rotation.x = -0.15; k.add(head);
    scene.add(k);
  });
  // floating specialist profiles
  [[-196, 0], [-226, 1]].forEach(([z, i]) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 3), new THREE.MeshBasicMaterial({ map: websiteScreen("doctor", { w: 384, h: 240 }), toneMapped: false, transparent: true, opacity: 0.95, side: THREE.DoubleSide }));
    p.position.set(-10, 12.5, z); p.rotation.y = PI / 2 - (i ? -0.3 : 0.3); scene.add(p);
    updaters.push((dt, t) => { p.position.y = 12.5 + Math.sin(t + i * 3) * 0.35; });
  });
  // ambulance with blinking light
  {
    const amb = new THREE.Group(); amb.position.set(-11.6, 0.2, -238);
    const b = new THREE.Mesh(new THREE.BoxGeometry(2.1, 2.1, 5), std("#f7f7f7", { rough: 0.3 })); b.position.y = 1.35; amb.add(b);
    const s = new THREE.Mesh(new THREE.BoxGeometry(2.12, 0.35, 5.02), std("#d93a26")); s.position.y = 1.2; amb.add(s);
    const lightMat = glow("#3b82f6", 3); const l = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.2, 0.4), lightMat); l.position.set(0, 2.5, 1.6); amb.add(l);
    for (const [x, z] of [[-1, 1.6], [1, 1.6], [-1, -1.6], [1, -1.6]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.3, 14), std("#111")); w.rotation.z = PI / 2; w.position.set(x, 0.4, z); amb.add(w); }
    scene.add(amb);
    updaters.push((dt, t) => { const on = Math.sin(t * 9) > 0; lightMat.color.set(on ? "#3b82f6" : "#ff3b3b").multiplyScalar(3); });
  }
  spots.healthDoor = showcases.health.doorWorld.clone().setY(0.2);
  spots.kiosk = new THREE.Vector3(-11, 0.2, -223);

  /* ======================= JEWELLERY STREET ======================= */
  showcases.jewel = makeShowcase({ side: 1, z: -300, W: 16, D: 14, H: 11, wall: "#0e0c0a", trim: "#e6c27a", sign: "SWARNIKA", signColor: "#f0cf7f", signFont: "400 128px 'Bodoni Moda'", signSub: "FINE JEWELLERY", glowCol: "#ffe2a8", shadows });
  scene.add(showcases.jewel.group);
  [{ z: -284, sign: "AURUM ATELIER" }, { z: -316, sign: "HEERA HOUSE" }].forEach((s) => scene.add(makeShowcase({ side: 1, z: s.z, W: 12, D: 12, H: 13, wall: "#14110d", trim: "#d4af61", sign: s.sign, signColor: "#e8c675", signFont: "400 100px 'Bodoni Moda'", glowCol: "#ffe2a8", screen: "jewel", shadows }).group));
  // pedestals with rotating jewellery
  const goldMat = std("#e2b75a", { metal: 1, rough: 0.18, emissive: "#6b4a10", ei: 0.35 });
  const gemMat = new THREE.MeshStandardMaterial({ color: "#e8f6ff", emissive: "#bfe6ff", emissiveIntensity: 1.6, metalness: 0.2, roughness: 0.05 });
  const jewels = [];
  [-280, -292, -308, -320].forEach((z, i) => {
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 1.2, 20), std("#111", { metal: 0.6, rough: 0.3 })); ped.position.set(13.8, 0.8, z); scene.add(ped);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.06, 20), glow("#ffe2a8", 1.6)); cap.position.set(13.8, 1.42, z); scene.add(cap);
    const j = new THREE.Group(); j.position.set(13.8, 2.1, z);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.08, 12, 40), goldMat); j.add(ring);
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.18), gemMat); gem.position.y = 0.52; j.add(gem);
    scene.add(j); jewels.push(j);
  });
  // giant floating ring above the street
  const bigRing = new THREE.Group(); bigRing.position.set(2, 19, -292);
  bigRing.add(new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.55, 20, 80), goldMat));
  const bigGem = new THREE.Mesh(new THREE.OctahedronGeometry(1.4), gemMat); bigGem.position.y = 4.1; bigRing.add(bigGem);
  scene.add(bigRing);
  updaters.push((dt, t) => {
    jewels.forEach((j, i) => { j.rotation.y = t * 0.9 + i; j.position.y = 2.1 + Math.sin(t * 1.5 + i) * 0.1; });
    bigRing.rotation.y = t * 0.35; bigRing.position.y = 19 + Math.sin(t * 0.7) * 0.6;
  });
  spots.jewelDoor = showcases.jewel.doorWorld.clone().setY(0.2);
  spots.jewelOwner = new THREE.Vector3(12.4, 0.2, -296);

  /* ======================= MAIN STREET (LOCAL) ======================= */
  const localShops = [
    { side: -1, z: -376, W: 12, wall: "#3a2418", trim: "#ffb347", sign: "MITHAI CORNER", signColor: "#ffb347", awningA: "#e8772e", screen: "dd", H: 9 },
    { side: 1, z: -376, W: 12, wall: "#1e2433", trim: "#9fd3ff", sign: "BOOK NOOK", signColor: "#9fd3ff", awningA: "#2563eb", screen: "dd", H: 9 },
    { side: -1, z: -392, W: 14, wall: "#173322", trim: "#d6e86a", sign: "HAAT & CO.", signColor: "#d6e86a", awningA: "#1f5c3a", awningB: "#fffaf0", screen: "grocery", H: 10 },
    { side: -1, z: -408, W: 14, wall: "#3a2826", trim: "#f4b6a6", sign: "NŪR SALON", signColor: "#ffb3a3", signFont: "400 120px Italiana", awningA: "#c97b6c", awningB: "#f4e4de", screen: "salon", H: 10 },
    { side: 1, z: -392, W: 14, wall: "#2a1f3d", trim: "#c9a4ff", sign: "THREAD STORY", signColor: "#c9a4ff", signFont: "italic 400 110px Fraunces", awningA: "#6d28d9", screen: "cloth", H: 10 },
    { side: 1, z: -408, W: 14, wall: "#0f1b2d", trim: "#57c8ff", sign: "VOLT CORNER", signColor: "#57c8ff", signFont: "500 100px 'JetBrains Mono'", awningA: "#1f8fff", awningB: "#0f1b2d", screen: "elec", H: 10 }
  ];
  spots.localDoors = [];
  localShops.forEach((s) => {
    const sc = makeShowcase({ D: 12, signFont: "700 104px Manrope", ...s, shadows });
    scene.add(sc.group);
    spots.localDoors.push({ door: sc.doorWorld.clone().setY(0.2), side: s.side });
  });
  // bunting lights across the street
  {
    const n = Q.low ? 30 : 70; const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.14, 8, 6), glow("#ffd59a", 2.6), n * 2);
    const m = new THREE.Matrix4(); let k = 0;
    for (const z of [-382, -400]) for (let i = 0; i < n; i++) {
      const u = i / (n - 1); const x = -16 + u * 32; const y = 9 - Math.sin(u * PI) * 2.4;
      m.makeTranslation(x, y, z); bulbs.setMatrixAt(k++, m);
    }
    scene.add(bulbs);
  }

  /* ======================= TOWER (finale) ======================= */
  const TOWER_Z = -560;
  {
    const T = new THREE.Group(); T.position.set(0, 0, TOWER_Z);
    const darkGlass = new THREE.MeshStandardMaterial({ color: "#0c0f22", roughness: 0.15, metalness: 0.85, emissive: "#1a2050", emissiveIntensity: 0.4 });
    const tiers = [[26, 22, 60], [21, 17, 55], [16, 12, 50], [11, 6, 30]];
    let y = 0;
    tiers.forEach(([rb, rt, h], i) => {
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 8, 1), darkGlass); seg.position.y = y + h / 2; seg.rotation.y = PI / 8; T.add(seg);
      const band = new THREE.Mesh(new THREE.TorusGeometry(rt + 0.6, 0.3, 8, 64), glow(i % 2 ? "#8fe3ff" : "#ffb36b", 2.4)); band.rotation.x = PI / 2; band.position.y = y + h; T.add(band);
      y += h;
    });
    // vertical light seams
    const seamMat = glow("#ffb36b", 1.8);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * PI * 2;
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.25, 160, 0.25), seamMat);
      s.position.set(Math.cos(a) * 21, 80, Math.sin(a) * 21); s.rotation.z = Math.cos(a) * 0.06; s.rotation.x = -Math.sin(a) * 0.06; T.add(s);
    }
    // emblem screen facing the city
    const emb = new THREE.Mesh(new THREE.PlaneGeometry(42, 42), new THREE.MeshBasicMaterial({ map: ddEmblem(), transparent: true, toneMapped: false, depthWrite: false }));
    emb.position.set(0, 118, 19.5); T.add(emb);
    const embBack = new THREE.Mesh(new THREE.PlaneGeometry(46, 46), new THREE.MeshBasicMaterial({ color: "#090b1d", transparent: true, opacity: 0.85 })); embBack.position.set(0, 118, 19.3); T.add(embBack);
    // orbit rings
    const orbits = [];
    [[38, 0.35, "#ffb36b", 90, 0.3], [46, 0.22, "#8fe3ff", 120, -0.22], [32, 0.18, "#ffd59a", 150, 0.4]].forEach(([r, th, c, yy, sp]) => {
      const o = new THREE.Mesh(new THREE.TorusGeometry(r, th, 8, 160), glow(c, 2.2)); o.position.y = yy; o.rotation.x = PI / 2 + 0.25; T.add(o); orbits.push([o, sp]);
    });
    const beacon = lightBeam(520, 5, "#ffc76b"); beacon.position.y = 195; T.add(beacon);
    const baseRing = new THREE.Mesh(new THREE.RingGeometry(30, 34, 96), glow("#ffb36b", 1.6)); baseRing.rotation.x = -PI / 2; baseRing.position.y = 0.06; T.add(baseRing);
    const baseRing2 = new THREE.Mesh(new THREE.RingGeometry(44, 44.6, 128), glow("#8fe3ff", 1.6)); baseRing2.rotation.x = -PI / 2; baseRing2.position.y = 0.06; T.add(baseRing2);
    scene.add(T);
    updaters.push((dt, t) => { orbits.forEach(([o, sp], i) => { o.rotation.z = t * sp; o.rotation.x = PI / 2 + 0.25 * Math.sin(t * 0.2 + i); }); beacon.material.uniforms.uI.value = 0.8 + Math.sin(t * 1.5) * 0.2; });
    ref.towerEmblem = emb;
  }

  /* ======================= INSTANCED BUILDINGS ======================= */
  const cityMat = buildingMaterial(env, "#1b1f3a", "#3e3a6e");
  const list = [];
  const district = (z) => (z > -70 ? [12, 26] : z > -160 ? [28, 64] : z > -250 ? [16, 38] : z > -340 ? [16, 30] : z > -430 ? [10, 18] : [36, 80]);
  // near row (facing the street)
  const billboardSlots = [];
  for (const side of [-1, 1]) {
    let z = 34;
    while (z > -480) {
      const w = rand(8, 14), d = rand(10, 16);
      const z0 = z, z1 = z - w;
      if (!isReserved(String(side), z1, z0)) {
        const [hmin, hmax] = district(z - w / 2);
        const h = rand(hmin, hmax);
        list.push({ x: side * (16 + d / 2), z: z - w / 2, w: d, d: w, h });
        if (h > 16 && Math.random() < 0.45) billboardSlots.push({ x: side * 15.9, z: z - w / 2, y: Math.min(h * 0.62, 20), side, w: Math.min(w * 0.7, 8) });
      }
      z -= w + rand(0.5, 1.5);
    }
  }
  // second row
  for (const side of [-1, 1]) {
    let z = 40;
    while (z > -500) {
      const w = rand(12, 22), d = rand(14, 24);
      const skip = (side === 1 && z < -88 && z > -152) || (side === -1 && z < -186 && z > -250);
      if (!skip) list.push({ x: side * rand(36, 52), z: z - w / 2, w: d, d: w, h: rand(30, z < -430 ? 140 : 100) });
      z -= w + rand(2, 6);
    }
  }
  // far skyline + ring around the tower
  const far = Q.low ? 220 : 620;
  for (let i = 0; i < far; i++) {
    let x, z;
    if (i % 3 === 0) { const a = Math.random() * PI * 2, r = rand(70, 260); x = Math.cos(a) * r; z = TOWER_Z + Math.sin(a) * r; if (Math.abs(x) < 26 && z > TOWER_Z) continue; }
    else { x = (Math.random() < 0.5 ? -1 : 1) * rand(66, 460); z = rand(140, -900); }
    const near = Math.max(0, 1 - Math.hypot(x, z - TOWER_Z) / 400);
    list.push({ x, z, w: rand(12, 30), d: rand(12, 30), h: rand(30, 120) + near * 110 + Math.random() * 60 * Math.random() });
  }
  const inst = new THREE.InstancedMesh(BOX01, cityMat, list.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color();
  const tints = ["#ffffff", "#e6e1ff", "#ffe9e0", "#dff4ff", "#f1e8ff"];
  list.forEach((b, i) => {
    m4.compose(new THREE.Vector3(b.x, 0, b.z), q, new THREE.Vector3(b.w, b.h, b.d));
    inst.setMatrixAt(i, m4);
    inst.setColorAt(i, col.set(pick(tints)));
  });
  inst.computeBoundingSphere();
  scene.add(inst);

  // billboards on near-row buildings: every shop has a digital identity
  const themes = ["dd", "restaurant", "hotel", "clinic", "jewel", "grocery", "salon", "cloth", "elec", "cafe", "pizza", "rooms"];
  billboardSlots.slice(0, Q.low ? 6 : 18).forEach((b, i) => {
    const bw = Math.max(5, b.w), bh = bw * 0.625;
    const p = new THREE.Mesh(new THREE.PlaneGeometry(bw, bh), new THREE.MeshBasicMaterial({ map: websiteScreen(themes[i % themes.length]), toneMapped: false }));
    p.position.set(b.x - b.side * 0.1, b.y, b.z); p.rotation.y = b.side < 0 ? PI / 2 : -PI / 2;
    scene.add(p);
    const fr = new THREE.Mesh(new THREE.PlaneGeometry(bw + 0.3, bh + 0.3), glow(i % 2 ? "#8fe3ff" : "#ffb36b", 1.4));
    fr.position.copy(p.position); fr.rotation.copy(p.rotation); fr.translateZ(-0.03); scene.add(fr);
  });

  /* ======================= STREET FURNITURE ======================= */
  {
    const lamps = [], trees = [];
    for (let z = 34; z > -480; z -= 12) for (const s of [-1, 1]) {
      lamps.push([s * 9.6, z]);
      const tz = z - 6;
      if (!isReserved(String(s), tz - 3, tz + 3)) trees.push([s * 14.4, tz]);
    }
    const poleM = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.08, 0.12, 6.5, 6).translate(0, 3.25, 0), std("#2a2a36", { metal: 0.7, rough: 0.4 }), lamps.length);
    const armM = new THREE.InstancedMesh(new THREE.BoxGeometry(1.4, 0.08, 0.08).translate(-0.7, 6.4, 0), std("#2a2a36"), lamps.length);
    const bulbM = new THREE.InstancedMesh(new THREE.SphereGeometry(0.22, 10, 8).translate(-1.3, 6.25, 0), glow("#ffe2b0", 3), lamps.length);
    lamps.forEach(([x, z], i) => {
      m4.compose(new THREE.Vector3(x, 0.2, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), x > 0 ? 0 : PI), new THREE.Vector3(1, 1, 1));
      poleM.setMatrixAt(i, m4); armM.setMatrixAt(i, m4); bulbM.setMatrixAt(i, m4);
    });
    scene.add(poleM, armM, bulbM);
    ref.lampMat = bulbM.material;

    const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.18, 2.4, 6).translate(0, 1.2, 0), std("#4a3426"), trees.length);
    const crownM = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.3, 1).translate(0, 3.2, 0), new THREE.MeshStandardMaterial({ color: "#3f8f5a", roughness: 0.8, emissive: "#0f3a24", emissiveIntensity: 0.5, flatShading: true }), trees.length);
    const pot = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.7, 0.6, 0.5, 12).translate(0, 0.25, 0), std("#e9e2d2"), trees.length);
    const potGlow = new THREE.InstancedMesh(new THREE.TorusGeometry(0.7, 0.04, 6, 24).rotateX(PI / 2).translate(0, 0.5, 0), glow("#8fe3ff", 1.6), trees.length);
    trees.forEach(([x, z], i) => {
      const s = rand(0.85, 1.2);
      m4.compose(new THREE.Vector3(x, 0.2, z), new THREE.Quaternion(), new THREE.Vector3(s, s, s));
      trunk.setMatrixAt(i, m4); crownM.setMatrixAt(i, m4); pot.setMatrixAt(i, m4); potGlow.setMatrixAt(i, m4);
    });
    scene.add(trunk, crownM, pot, potGlow);
  }

  /* ======================= VEHICLES ======================= */
  {
    const n = Q.low ? 12 : 30;
    const body = new THREE.InstancedMesh(new THREE.BoxGeometry(1.9, 0.75, 4.2).translate(0, 0.65, 0), new THREE.MeshStandardMaterial({ roughness: 0.25, metalness: 0.7 }), n);
    const cabin = new THREE.InstancedMesh(new THREE.BoxGeometry(1.6, 0.6, 2.2).translate(0, 1.3, -0.2), std("#0c0f1a", { rough: 0.1, metal: 0.9 }), n);
    const head = new THREE.InstancedMesh(new THREE.BoxGeometry(1.6, 0.14, 0.06).translate(0, 0.75, 2.12), glow("#ffffff", 3), n);
    const tail = new THREE.InstancedMesh(new THREE.BoxGeometry(1.6, 0.14, 0.06).translate(0, 0.75, -2.12), glow("#ff2d4a", 2.6), n);
    const carCols = ["#f6f1e7", "#e8772e", "#2c3e8f", "#b83a26", "#1f5c3a", "#c9a45c", "#5b6b8a", "#111318"];
    const cars = [];
    for (let i = 0; i < n; i++) {
      const lane = [-6.4, -2.4, 2.4, 6.4][i % 4];
      cars.push({ x: lane, z: rand(60, -580), v: (lane < 0 ? 1 : -1) * rand(7, 13) });
      body.setColorAt(i, new THREE.Color(pick(carCols)));
    }
    scene.add(body, cabin, head, tail);
    const rot = new THREE.Quaternion(), fl = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), PI), one = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
    updaters.push((dt) => {
      cars.forEach((c, i) => {
        c.z += c.v * dt;
        if (c.z > 70) c.z = -590; if (c.z < -590) c.z = 70;
        m4.compose(p.set(c.x, 0.02, c.z), c.v > 0 ? rot : fl, one);
        body.setMatrixAt(i, m4); cabin.setMatrixAt(i, m4); head.setMatrixAt(i, m4); tail.setMatrixAt(i, m4);
      });
      body.instanceMatrix.needsUpdate = cabin.instanceMatrix.needsUpdate = head.instanceMatrix.needsUpdate = tail.instanceMatrix.needsUpdate = true;
    });
    [body, cabin, head, tail].forEach((x) => (x.frustumCulled = false));

    // flying pods
    const pn = Q.low ? 10 : 34;
    const pod = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.7, 2.2, 4, 10).rotateX(PI / 2), new THREE.MeshStandardMaterial({ color: "#e9edf7", roughness: 0.2, metalness: 0.6 }), pn);
    const halo = new THREE.InstancedMesh(new THREE.TorusGeometry(0.9, 0.07, 6, 24).rotateX(PI / 2).translate(0, -0.55, 0), glow("#8fe3ff", 3), pn);
    const pods = [];
    for (let i = 0; i < pn; i++) {
      const alongX = i % 3 === 0;
      pods.push({ alongX, a: rand(-500, 400), fixed: alongX ? rand(-560, 20) : (Math.random() < 0.5 ? -1 : 1) * rand(14, 60), y: rand(26, 70), v: (Math.random() < 0.5 ? -1 : 1) * rand(14, 26), ph: Math.random() * 6 });
    }
    scene.add(pod, halo);
    pod.frustumCulled = halo.frustumCulled = false;
    const qx = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), PI / 2), qx2 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -PI / 2);
    updaters.push((dt, t) => {
      pods.forEach((o, i) => {
        o.a += o.v * dt;
        if (o.alongX) { if (o.a > 400) o.a = -400; if (o.a < -400) o.a = 400; p.set(o.a, o.y + Math.sin(t + o.ph) * 1.2, o.fixed); }
        else { if (o.a > 120) o.a = -700; if (o.a < -700) o.a = 120; p.set(o.fixed, o.y + Math.sin(t + o.ph) * 1.2, o.a); }
        m4.compose(p, o.alongX ? (o.v > 0 ? qx : qx2) : (o.v > 0 ? rot : fl), one);
        pod.setMatrixAt(i, m4); halo.setMatrixAt(i, m4);
      });
      pod.instanceMatrix.needsUpdate = halo.instanceMatrix.needsUpdate = true;
    });
  }

  /* ======================= LIGHTS AT SHOWCASES ======================= */
  const doorLights = {};
  for (const [k, sc] of Object.entries(showcases)) {
    const l = new THREE.PointLight(sc.glowCol, 0, 22, 1.6);
    l.position.copy(sc.doorWorld).addScaledVector(sc.normal, 2.5).setY(3);
    scene.add(l);
    doorLights[k] = l;
  }
  const gold = new THREE.PointLight("#ffcf7a", Q.low ? 0 : 40, 26, 1.8); gold.position.set(12, 6, -300); scene.add(gold);

  return {
    showcases, spots, doorLights, TOWER_Z,
    update(dt, t) { for (const u of updaters) u(dt, t); }
  };
}

/** Handles to materials the time-of-day system adjusts. */
export const ref = {};
