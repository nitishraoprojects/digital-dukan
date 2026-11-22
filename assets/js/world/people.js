// Tiny stylised 3D people — every one with a role, outfit and behaviour.
// Parts use vertex colours + one shared material, so each person costs ~6 draw calls.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const PI = Math.PI;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[(Math.random() * a.length) | 0];

const SKIN = ["#8d5524", "#a86b3c", "#c68642", "#e0ac69", "#7a4a2a", "#b87a4a", "#9c6644"];
const SHIRT = ["#e8772e", "#2c3e8f", "#f6f1e7", "#1f5c3a", "#b83a26", "#7c3aed", "#0ea5e9", "#facc15", "#ec4899", "#334155", "#14b8a6", "#f472b6", "#a3e635"];
const PANTS = ["#1f2937", "#334155", "#3b2f2a", "#1e3a5f", "#6b7280", "#e5e7eb", "#44403c"];
const HAIR = ["#0f0d0b", "#1b1209", "#2b1a10", "#3a2a1a", "#555"];

const MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.05 });
const geoCache = new Map();

function tint(geo, hex) {
  const g = geo.index ? geo : geo;
  const c = new THREE.Color(hex);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  g.setAttribute("color", new THREE.BufferAttribute(arr, 3));
  return g;
}
const merge = (parts) => mergeGeometries(parts.map((p) => (p.index ? p : p)), false);
const cached = (key, fn) => { if (!geoCache.has(key)) geoCache.set(key, fn()); return geoCache.get(key); };

function legGeo(pants, shoe) {
  return cached(`leg${pants}${shoe}`, () => merge([
    tint(new THREE.CapsuleGeometry(0.09, 0.6, 3, 8).translate(0, -0.39, 0), pants),
    tint(new THREE.BoxGeometry(0.15, 0.1, 0.28).translate(0, -0.82, 0.05), shoe)
  ]));
}
function armGeo(sleeve, skin, long, extra) {
  return cached(`arm${sleeve}${skin}${long}${extra || ""}`, () => {
    const parts = [
      tint(new THREE.CapsuleGeometry(0.072, 0.2, 3, 8).translate(0, -0.16, 0), sleeve),
      tint(new THREE.CapsuleGeometry(0.064, 0.22, 3, 8).translate(0, -0.42, 0), long ? sleeve : skin),
      tint(new THREE.SphereGeometry(0.07, 8, 6).translate(0, -0.62, 0.01), skin)
    ];
    if (extra && extra.startsWith("bag")) parts.push(tint(new THREE.BoxGeometry(0.26, 0.3, 0.1).translate(0, -0.86, 0), extra.slice(3)));
    return merge(parts);
  });
}
function torsoGeo(o) {
  return cached(`torso${o.shirt}${o.skin}${o.coat || ""}${o.tunic || ""}${o.pack || ""}${o.tie || ""}${o.apron || ""}`, () => {
    const parts = [
      tint(new THREE.CapsuleGeometry(0.2, 0.34, 4, 10).scale(1, 1, 0.78).translate(0, 1.24, 0), o.shirt),
      tint(new THREE.CylinderGeometry(0.065, 0.07, 0.14, 8).translate(0, 1.64, 0), o.skin)
    ];
    if (o.coat) parts.push(tint(new THREE.CylinderGeometry(0.235, 0.3, 0.92, 12).scale(1, 1, 0.82).translate(0, 1.12, 0), o.coat));
    if (o.tunic) parts.push(tint(new THREE.CylinderGeometry(0.22, 0.34, 0.78, 12).scale(1, 1, 0.82).translate(0, 1.02, 0), o.tunic));
    if (o.apron) parts.push(tint(new THREE.BoxGeometry(0.34, 0.6, 0.04).translate(0, 1.05, 0.17), o.apron));
    if (o.pack) parts.push(tint(new THREE.BoxGeometry(0.42, 0.42, 0.3).translate(0, 1.3, -0.3), o.pack));
    if (o.tie) parts.push(tint(new THREE.BoxGeometry(0.06, 0.34, 0.03).translate(0, 1.38, 0.16), o.tie));
    return merge(parts);
  });
}
function headGeo(o) {
  return cached(`head${o.skin}${o.hair}${o.style}${o.hat || ""}`, () => {
    const parts = [
      tint(new THREE.SphereGeometry(0.17, 14, 10).translate(0, 0.16, 0), o.skin),
      tint(new THREE.SphereGeometry(0.024, 6, 4).translate(-0.06, 0.18, 0.155), "#141414"),
      tint(new THREE.SphereGeometry(0.024, 6, 4).translate(0.06, 0.18, 0.155), "#141414")
    ];
    if (o.hat !== "helmet") {
      parts.push(tint(new THREE.SphereGeometry(0.182, 14, 8, 0, PI * 2, 0, PI * 0.52).rotateX(-0.35).translate(0, 0.17, -0.01), o.hair));
      if (o.style === "long") parts.push(tint(new THREE.CapsuleGeometry(0.13, 0.26, 3, 8).scale(1.1, 1, 0.6).translate(0, 0.0, -0.11), o.hair));
      if (o.style === "bun") parts.push(tint(new THREE.SphereGeometry(0.085, 8, 6).translate(0, 0.25, -0.15), o.hair));
    }
    if (o.hat === "chef") { parts.push(tint(new THREE.CylinderGeometry(0.14, 0.13, 0.2, 12).translate(0, 0.38, 0), "#ffffff")); parts.push(tint(new THREE.SphereGeometry(0.17, 10, 8).scale(1, 0.7, 1).translate(0, 0.52, 0), "#ffffff")); }
    if (o.hat === "helmet") { parts.push(tint(new THREE.SphereGeometry(0.205, 14, 8, 0, PI * 2, 0, PI * 0.6).translate(0, 0.17, 0), "#e8772e")); parts.push(tint(new THREE.BoxGeometry(0.26, 0.06, 0.06).translate(0, 0.2, 0.19), "#1b2a44")); }
    if (o.hat === "cap") { parts.push(tint(new THREE.CylinderGeometry(0.18, 0.18, 0.09, 12).translate(0, 0.32, 0), o.capCol || "#1f2937")); parts.push(tint(new THREE.BoxGeometry(0.22, 0.02, 0.12).translate(0, 0.29, 0.2), o.capCol || "#1f2937")); }
    if (o.hat === "dupatta") parts.push(tint(new THREE.SphereGeometry(0.2, 12, 8, 0, PI * 2, 0, PI * 0.62).rotateX(-0.5).translate(0, 0.14, -0.03), o.hair));
    return merge(parts);
  });
}

/* ---------------- Person ---------------- */
class Person {
  constructor(o, shadows) {
    this.o = o;
    this.seed = Math.random() * 100;
    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.root.add(this.body);
    const mk = (geo) => { const m = new THREE.Mesh(geo, MAT); m.castShadow = shadows; return m; };

    this.legL = new THREE.Group(); this.legR = new THREE.Group();
    this.legL.position.set(-0.11, 0.87, 0); this.legR.position.set(0.11, 0.87, 0);
    this.legL.add(mk(legGeo(o.pants, o.shoe))); this.legR.add(mk(legGeo(o.pants, o.shoe)));
    this.torso = mk(torsoGeo(o));
    this.armL = new THREE.Group(); this.armR = new THREE.Group();
    this.armL.position.set(-0.28, 1.53, 0); this.armR.position.set(0.28, 1.53, 0);
    this.armL.add(mk(armGeo(o.sleeve || o.shirt, o.skin, o.long, o.bagL)));
    this.armR.add(mk(armGeo(o.sleeve || o.shirt, o.skin, o.long, o.bagR)));
    this.head = new THREE.Group(); this.head.position.set(0, 1.68, 0);
    this.head.add(mk(headGeo(o)));
    this.body.add(this.legL, this.legR, this.torso, this.armL, this.armR, this.head);

    if (o.tray) {
      const tr = new THREE.Group(); tr.position.set(0, -0.62, 0.05); tr.rotation.x = 1.3;
      tr.add(new THREE.Mesh(tint(new THREE.CylinderGeometry(0.26, 0.26, 0.03, 16), "#d1d5db"), MAT));
      const cup = new THREE.Mesh(tint(new THREE.CylinderGeometry(0.05, 0.04, 0.12, 8).translate(0.08, 0.08, 0), "#f59e0b"), MAT); tr.add(cup);
      const plate = new THREE.Mesh(tint(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 12).translate(-0.08, 0.03, 0.02), "#fef3c7"), MAT); tr.add(plate);
      this.armR.add(tr);
    }
    if (o.ring) {
      const r = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.02, 8, 20), new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffd27a").multiplyScalar(2.2), toneMapped: false }));
      r.position.set(0, -0.72, 0.02); this.ring = r; this.armR.add(r);
    }
    if (o.clip) { const c = new THREE.Mesh(tint(new THREE.BoxGeometry(0.2, 0.28, 0.03), "#cbd5e1"), MAT); c.position.set(0, -0.6, 0.08); c.rotation.x = 1.2; this.armL.add(c); }

    const s = o.scale || rand(0.9, 1.04);
    this.root.scale.setScalar(s);
    this.mode = o.mode || "idle";
    this.phase = Math.random() * 6;
    this.speed = o.speed || rand(1.1, 1.5);
    this.wait = 0;
  }
  place(v, ry = 0) { this.root.position.copy(v); this.root.rotation.y = ry; return this; }
  face(target) { this.root.rotation.y = Math.atan2(target.x - this.root.position.x, target.z - this.root.position.z); }

  /** Walk to a point, then run a callback. */
  goTo(target, cb, speed) { this.target = target.clone(); this.onArrive = cb; this.prevMode = this.mode === "walk" ? this.prevMode : this.mode; this.mode = "walk"; if (speed) this.speed = speed; }

  pose(dt, t) {
    const L = this.legL.rotation, R = this.legR.rotation, AL = this.armL.rotation, AR = this.armR.rotation, H = this.head.rotation, B = this.body;
    const sd = this.seed;
    // reset
    B.position.y = 0; B.rotation.x = 0; L.set(0, 0, 0); R.set(0, 0, 0); AL.set(0, 0, 0.06); AR.set(0, 0, -0.06);
    H.set(0, 0, 0);
    switch (this.mode) {
      case "walk": case "serve": case "carry": {
        this.phase += dt * this.speed * 3.4;
        const s = Math.sin(this.phase);
        L.x = s * 0.6; R.x = -s * 0.6;
        AL.x = -s * 0.5; AR.x = s * 0.5;
        if (this.o.bagR) AR.x *= 0.3; if (this.o.bagL) AL.x *= 0.3;
        if (this.mode === "serve" || this.o.tray) AR.x = -1.3;
        if (this.o.clip) AL.x = -0.9;
        B.position.y = Math.abs(Math.cos(this.phase)) * 0.04;
        H.y = Math.sin(this.phase * 0.25 + sd) * 0.15;
        break;
      }
      case "idle": {
        AL.x = Math.sin(t * 0.9 + sd) * 0.06; AR.x = -Math.sin(t * 0.9 + sd) * 0.06;
        H.y = Math.sin(t * 0.35 + sd) * 0.55; H.x = Math.sin(t * 0.5 + sd) * 0.06;
        B.position.y = Math.sin(t * 1.6 + sd) * 0.008;
        if (this.o.tray) AR.x = -1.3;
        if (this.o.clip) AL.x = -0.9;
        break;
      }
      case "lookup": { H.x = -0.55; AL.z = 0.12; AR.z = -0.12; H.y = Math.sin(t * 0.3 + sd) * 0.3; if (Math.sin(t * 0.7 + sd) > 0.6) { AR.z = -2.6 + Math.sin(t * 6) * 0.2; } break; }
      case "sit": case "eat": {
        B.position.y = -0.4; L.x = -1.45; R.x = -1.45;
        AL.x = -0.5; AR.x = -0.5;
        if (this.mode === "eat") { AR.x = -1.0 - (Math.sin(t * 2.2 + sd) * 0.5 + 0.5) * 0.9; H.x = Math.sin(t * 2.2 + sd) * 0.08; H.y = Math.sin(t * 0.4 + sd) * 0.4; }
        break;
      }
      case "lounge": { B.position.y = -0.5; B.rotation.x = -0.9; L.x = -0.7; R.x = -0.7; AL.z = 0.5; AR.z = -2.6; H.x = 0.4; break; }
      case "talk": {
        AR.x = -0.55 + Math.sin(t * 3 + sd) * 0.35; AR.z = -0.2 + Math.sin(t * 2.1 + sd) * 0.15;
        AL.x = -0.25 + Math.sin(t * 2.4 + sd + 1) * 0.2;
        H.x = Math.sin(t * 4 + sd) * 0.07; H.y = Math.sin(t * 0.8 + sd) * 0.2;
        break;
      }
      case "wave": { AR.z = -2.55 + Math.sin(t * 7 + sd) * 0.3; AL.x = 0.05; H.y = Math.sin(t * 0.5 + sd) * 0.2; break; }
      case "chef": {
        AL.x = -1.1; AR.x = -1.15 + Math.sin(t * 14 + sd) * 0.28; H.x = 0.35; H.y = Math.sin(t * 0.6) * 0.2;
        B.position.y = Math.sin(t * 7) * 0.006;
        break;
      }
      case "proud": { AL.z = 0.75; AR.z = -0.75; AL.x = -0.35; AR.x = -0.35; B.rotation.x = -0.05; H.y = Math.sin(t * 0.4 + sd) * 0.5; break; }
      case "present": { AR.x = -1.35 + Math.sin(t * 1.5) * 0.06; AL.x = -0.4; AL.z = 0.35; H.x = 0.15; if (this.ring) this.ring.rotation.y = t * 3; break; }
      case "ride": { B.position.y = -0.25; L.x = -1.2; R.x = -1.2; AL.x = -1.2; AR.x = -1.2; B.rotation.x = 0.12; break; }
    }
  }

  update(dt, t) {
    if (this.mode === "walk" && this.target) {
      const p = this.root.position, dx = this.target.x - p.x, dz = this.target.z - p.z, d = Math.hypot(dx, dz);
      if (d < 0.12) {
        p.x = this.target.x; p.z = this.target.z;
        this.target = null; this.mode = this.prevMode && this.prevMode !== "walk" ? this.prevMode : "idle";
        const cb = this.onArrive; this.onArrive = null; if (cb) cb(this);
      } else {
        const step = Math.min(d, this.speed * dt);
        p.x += (dx / d) * step; p.z += (dz / d) * step;
        const ry = Math.atan2(dx, dz);
        let diff = ry - this.root.rotation.y; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        this.root.rotation.y += diff * Math.min(1, dt * 8);
      }
    }
    if (this.brain) this.brain(dt, t, this);
    this.pose(dt, t);
  }
}

function outfit(extra = {}) {
  const fem = Math.random() < 0.5;
  const shirt = pick(SHIRT);
  return {
    skin: pick(SKIN), shirt, pants: pick(PANTS), shoe: pick(["#111", "#3b2a22", "#f6f1e7", "#7c2d12"]),
    hair: pick(HAIR), style: fem ? pick(["long", "bun", "long"]) : "short",
    tunic: fem && Math.random() < 0.55 ? shirt : null, long: Math.random() < 0.4,
    ...extra
  };
}

/* ================= POPULATION ================= */
export function createPeople(scene, spots, Q) {
  const people = [];
  const add = (o, pos, ry, brain, core) => {
    if (Q.low && !core) return null;
    const p = new Person(o, Q.shadows);
    p.place(pos, ry);
    p.home = pos.clone();
    if (brain) p.brain = brain;
    scene.add(p.root);
    people.push(p);
    return p;
  };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  // ---- brains ----
  const patrol = (a, b, pause = [1, 3]) => (dt, t, p) => {
    if (p.mode === "walk") return;
    p.wait -= dt;
    if (p.wait <= 0) { const next = p.leg ? a : b; p.leg = !p.leg; p.wait = rand(pause[0], pause[1]); p.goTo(next); }
  };
  const visitor = (start, door) => (dt, t, p) => {
    if (p.mode === "walk" || p.entering) return;
    p.wait -= dt;
    if (p.wait > 0) return;
    p.goTo(door, () => {
      p.entering = true;
      const s0 = p.root.scale.x; let k = 0;
      const shrink = () => { k += 0.06; p.root.scale.setScalar(s0 * Math.max(0, 1 - k)); if (k < 1) requestAnimationFrame(shrink); else { p.root.position.copy(start); p.root.scale.setScalar(s0); p.entering = false; p.wait = rand(3, 8); } };
      shrink();
    });
  };

  /* ---------- Restaurant Street ---------- */
  const guide = add(outfit({ shirt: "#f6f1e7", sleeve: "#f6f1e7", pants: "#3b2a22", tunic: null, style: "short", apron: "#b83a26", hair: "#111", scale: 1.02 }), spots.restaurantOwner, PI / 2, null, true);
  guide.mode = "proud";
  spots.seats.forEach((s, i) => add(outfit({ mode: "eat" }), s.pos, s.face, null, i < 4));
  add(outfit({ shirt: "#f6f1e7", sleeve: "#f6f1e7", pants: "#1f2937", tunic: null, style: "short", hat: "chef", apron: "#e5e7eb", mode: "chef" }), V(-12.5, 0.2, -16.5), PI / 2, null, true);
  const waiter = add(outfit({ shirt: "#111827", sleeve: "#111827", pants: "#111827", tunic: null, tie: "#c9a45c", tray: true, mode: "idle", style: "short" }), V(-11.2, 0.2, -21), 0, patrol(V(-11.2, 0.2, -21.5), V(-11.2, 0.2, -38.5), [1.5, 3]), true);
  if (waiter) waiter.speed = 1.2;
  for (let i = 0; i < 3; i++) add(outfit({ bagR: Math.random() < 0.5 ? "bag" + pick(["#e8772e", "#f6f1e7", "#7c3aed", "#1f5c3a"]) : null }), V(11.6, 0.2, rand(-2, -58)), 0, patrol(V(11.6, 0.2, -2 - i * 3), V(11.6, 0.2, -58 + i * 4)), i === 0);
  for (let i = 0; i < 2; i++) add(outfit(), V(-10.3, 0.2, rand(-42, -60)), 0, patrol(V(-10.3, 0.2, -42 - i * 2), V(-10.3, 0.2, -64)), false);
  // customers entering restaurants
  add(outfit(), V(11.2, 0.2, -2), 0, visitor(V(11.2, 0.2, -2), V(15.2, 0.2, -12)), true);
  add(outfit(), V(11.2, 0.2, -58), 0, visitor(V(11.2, 0.2, -58), V(15.2, 0.2, -46)), false);
  add(outfit(), V(-10.5, 0.2, 2), 0, visitor(V(-10.5, 0.2, 2), V(-15.2, 0.2, -8)), false);

  /* ---------- Hotel Avenue ---------- */
  add(outfit({ shirt: "#1c2a22", sleeve: "#1c2a22", pants: "#1c2a22", tunic: null, tie: "#c9a45c", hat: "cap", capCol: "#1c2a22", style: "short", mode: "wave" }), V(23.6, 0.22, -115.5), -PI / 2, null, true);
  add(outfit({ shirt: "#f6f1e7", tunic: null, tie: "#c9a45c", mode: "idle" }), V(24.4, 0.22, -124.5), -PI / 2, null, false);
  for (let i = 0; i < 3; i++) add(outfit({ bagR: "bag" + pick(["#3b2a22", "#1f2937", "#c9a45c"]) }), V(10.5, 0.22, -100 - i * 12), 0, visitor(V(10.5, 0.22, -98 - i * 14), V(25.8, 0.22, -120 + (i - 1) * 1.2)), i === 0);
  (spots.loungers || []).forEach((l, i) => add(outfit({ mode: "lounge", tunic: null }), l, 0, null, false));
  add(outfit({ mode: "talk" }), V(15.2, 0.22, -116.4), PI * 0.8, null, false);
  add(outfit({ mode: "talk" }), V(14.6, 0.22, -117.8), PI * 0.2 - 0.4, null, false);
  for (let i = 0; i < 2; i++) add(outfit(), V(-10.4, 0.2, -90), 0, patrol(V(-10.4, 0.2, -88 - i * 6), V(-10.4, 0.2, -150)), i === 0);

  /* ---------- Healthcare District ---------- */
  const doc = () => outfit({ coat: "#f8fafc", sleeve: "#f8fafc", tunic: null, long: true, clip: Math.random() < 0.6 });
  add(doc(), V(-10.6, 0.2, -186), 0, visitor(V(-10.6, 0.2, -184), V(-15.2, 0.2, -210)), true);
  add(doc(), V(-11.8, 0.2, -236), 0, visitor(V(-11.8, 0.2, -244), V(-15.2, 0.2, -208.8)), false);
  add(doc(), V(-12.6, 0.2, -205), 0, patrol(V(-12.6, 0.2, -200), V(-12.6, 0.2, -220), [2, 4]), true);
  add(outfit({ mode: "idle" }), V(-9.7, 0.2, -223), -PI / 2, null, true);
  add(outfit({ shirt: "#5eead4", sleeve: "#5eead4", pants: "#5eead4", tunic: null, mode: "talk", style: "bun" }), V(-12.8, 0.2, -196.6), PI * 0.75, null, false);
  add(outfit({ mode: "talk" }), V(-12.0, 0.2, -197.6), -PI * 0.25, null, false);
  for (let i = 0; i < 2; i++) add(outfit(), V(11, 0.2, -180), 0, patrol(V(11, 0.2, -176 - i * 5), V(11, 0.2, -250)), false);

  /* ---------- Jewellery Street ---------- */
  add(outfit({ shirt: "#111", sleeve: "#111", pants: "#111", tunic: null, tie: "#d4af61", ring: true, mode: "present" }), spots.jewelOwner, -PI / 2, null, true);
  add(outfit({ mode: "idle", bagL: "bag#d4af61", tunic: "#be185d", style: "long" }), V(10.9, 0.2, -295.6), PI / 2, null, true);
  add(outfit({ mode: "talk", bagR: "bag#111" }), V(12.6, 0.2, -308.8), PI * 0.1, null, false);
  add(outfit({ mode: "talk" }), V(12.9, 0.2, -307.2), PI * 1.1, null, false);
  add(outfit({ bagR: "bag#d4af61" }), V(11.2, 0.2, -270), 0, visitor(V(11.2, 0.2, -268), V(15.2, 0.2, -300)), false);
  for (let i = 0; i < 3; i++) add(outfit({ bagL: Math.random() < 0.6 ? "bag" + pick(["#d4af61", "#111", "#f6f1e7"]) : null }), V(-10.6, 0.2, -270), 0, patrol(V(-10.6, 0.2, -266 - i * 4), V(-10.6, 0.2, -334)), i === 0);

  /* ---------- Main Street ---------- */
  (spots.localDoors || []).forEach(({ door, side }, i) => {
    const nx = side < 0 ? 1 : -1;
    const owner = V(door.x + nx * 1.4, 0.2, door.z + 0.8);
    const cust = V(door.x + nx * 2.9, 0.2, door.z + 0.2);
    const ownerP = add(outfit({ apron: pick(["#1f5c3a", "#c97b6c", "#6d28d9", "#1f8fff", "#e8772e"]), mode: "talk" }), owner, 0, null, i < 3);
    const custP = add(outfit({ mode: "talk", bagR: Math.random() < 0.5 ? "bag" + pick(SHIRT) : null }), cust, 0, null, i < 3);
    if (ownerP && custP) { ownerP.face(cust); custP.face(owner); }
  });
  for (let i = 0; i < 3; i++) add(outfit({ bagR: Math.random() < 0.5 ? "bag" + pick(SHIRT) : null }), V(i % 2 ? 11.2 : -11.2, 0.2, -360), 0, patrol(V(i % 2 ? 11.2 : -11.2, 0.2, -350 - i * 3), V(i % 2 ? 11.2 : -11.2, 0.2, -428)), i === 0);

  /* ---------- Tower plaza: a crowd looking up ---------- */
  for (let i = 0; i < 8; i++) {
    const a = rand(-0.9, 0.9), r = rand(36, 46);
    add(outfit({ mode: "lookup" }), V(Math.sin(a) * r, 0.05, -560 + Math.cos(a) * r), PI + a, null, i < 3);
  }

  /* ---------- Delivery rider on a scooter ---------- */
  const scooter = new THREE.Group();
  {
    const m = (g, c) => new THREE.Mesh(tint(g, c), MAT);
    const bodyS = m(new THREE.BoxGeometry(0.5, 0.45, 1.5).translate(0, 0.55, 0), "#e8772e"); scooter.add(bodyS);
    const seat = m(new THREE.BoxGeometry(0.45, 0.12, 0.7).translate(0, 0.85, -0.25), "#111"); scooter.add(seat);
    const col = m(new THREE.BoxGeometry(0.12, 0.9, 0.12).translate(0, 1.0, 0.65).rotateX(-0.25), "#2a2a36"); scooter.add(col);
    for (const z of [-0.6, 0.65]) { const w = m(new THREE.TorusGeometry(0.28, 0.1, 8, 16).rotateY(PI / 2).translate(0, 0.3, z), "#111"); scooter.add(w); }
    const box = m(new THREE.BoxGeometry(0.55, 0.5, 0.5).translate(0, 1.2, -0.75), "#e8772e"); scooter.add(box);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 3, 2.6), toneMapped: false })); lamp.position.set(0, 1.25, 0.82); scooter.add(lamp);
    const rider = new Person(outfit({ hat: "helmet", shirt: "#e8772e", sleeve: "#e8772e", tunic: null, pack: null, mode: "ride", long: true }), Q.shadows);
    rider.root.position.set(0, 0.35, -0.2);
    scooter.add(rider.root);
    scooter.userData.rider = rider;
    scooter.position.set(4.4, 0.02, 30);
    scene.add(scooter);
  }
  let sz = 30;

  return {
    guide, list: people,
    update(dt, t, cam) {
      const cx = cam.position.x, cz = cam.position.z, lim = Q.low ? 75 * 75 : 120 * 120;
      for (const p of people) {
        const dx = p.root.position.x - cx, dz = p.root.position.z - cz;
        const vis = dx * dx + dz * dz < lim;
        p.root.visible = vis;
        if (vis || p === guide) p.update(dt, t);
      }
      sz -= dt * 9; if (sz < -480) sz = 50;
      scooter.position.z = sz;
      scooter.rotation.y = PI;
      const r = scooter.userData.rider; r.pose(dt, t);
    }
  };
}
