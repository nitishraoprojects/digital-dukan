// Sky, atmosphere and particle systems.
import * as THREE from "three";

/** Shared environment uniforms — every custom shader references these same objects. */
export function createEnv() {
  return {
    uTime: { value: 0 },
    uSunDir: { value: new THREE.Vector3(0.3, 0.6, -0.7).normalize() },
    uSunCol: { value: new THREE.Color("#ffd0a0") },
    uAmb: { value: new THREE.Color("#404070") },
    uIllum: { value: 0.7 },
    uWave: { value: -200 },
    uWarm: { value: new THREE.Color("#ffc97a") },
    uCool: { value: new THREE.Color("#8fe3ff") }
  };
}

/* ---------------- Sky dome ---------------- */
export function createSky(scene, env) {
  const uniforms = {
    uTop: { value: new THREE.Color("#0a1033") },
    uHorizon: { value: new THREE.Color("#3b2f6b") },
    uBottom: { value: new THREE.Color("#0a0c1c") },
    uSunDir: env.uSunDir,
    uSunCol: env.uSunCol,
    uTime: env.uTime
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`,
    fragmentShader: /* glsl */`
      uniform vec3 uTop, uHorizon, uBottom, uSunCol, uSunDir; uniform float uTime;
      varying vec3 vDir;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(41.3,289.1)))*43758.5); }
      float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
      void main(){
        float h = vDir.y;
        vec3 col = h > 0.0 ? mix(uHorizon, uTop, pow(smoothstep(0.0, 0.55, h), 0.75)) : mix(uHorizon, uBottom, smoothstep(0.0, -0.2, h));
        float s = max(dot(vDir, normalize(uSunDir)), 0.0);
        col += uSunCol * (pow(s, 600.0) * 3.0 + pow(s, 24.0) * 0.35 + pow(s, 4.0) * 0.12);
        // soft streaky clouds near the horizon
        vec2 uv = vDir.xz / max(h + 0.25, 0.05);
        float n = noise(uv * 1.4 + vec2(uTime * 0.01, 0.0)) * noise(uv * 3.1 - vec2(uTime * 0.015, 0.0));
        float band = smoothstep(0.02, 0.18, h) * smoothstep(0.5, 0.15, h);
        col = mix(col, mix(uHorizon, uSunCol, 0.35) * 1.15, n * band * 0.55);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1500, 48, 24), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  scene.add(mesh);

  // Stars
  const n = 1600, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const th = Math.random() * Math.PI * 2, ph = Math.acos(Math.random() * 0.9 + 0.1);
    pos.set([Math.sin(ph) * Math.cos(th) * 1400, Math.cos(ph) * 1400, Math.sin(ph) * Math.sin(th) * 1400], i * 3);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false });
  const stars = new THREE.Points(g, starMat);
  stars.frustumCulled = false;
  scene.add(stars);

  return { mesh, uniforms, stars, follow(cam) { mesh.position.copy(cam.position); stars.position.copy(cam.position); } };
}

/* ---------------- Particle helpers ---------------- */
const pointVS = /* glsl */`
  attribute float aSeed; attribute float aSize;
  uniform float uTime; uniform vec3 uCam; uniform float uSpan; uniform float uPix;
  varying float vA;
  void main(){
    vec3 p = position;
    p += vec3(sin(uTime*0.3 + aSeed*12.0)*2.0, mod(uTime*(0.4 + aSeed*0.6) + aSeed*40.0, uSpan*2.0), cos(uTime*0.25 + aSeed*9.0)*2.0);
    vec3 rel = mod(p - uCam + uSpan, uSpan*2.0) - uSpan;
    vec4 mv = viewMatrix * vec4(uCam + rel, 1.0);
    gl_Position = projectionMatrix * mv;
    float d = length(rel) / uSpan;
    vA = (1.0 - smoothstep(0.55, 1.0, d)) * (0.5 + 0.5*sin(uTime*2.0 + aSeed*30.0));
    gl_PointSize = aSize * uPix * (60.0 / -mv.z);
  }`;
const pointFS = /* glsl */`
  uniform vec3 uColA; uniform vec3 uColB; uniform float uBoost;
  varying float vA;
  void main(){
    vec2 c = gl_PointCoord - 0.5; float r = length(c);
    float a = smoothstep(0.5, 0.0, r);
    vec3 col = mix(uColA, uColB, step(0.5, fract(gl_FragCoord.x*0.013 + gl_FragCoord.y*0.007)));
    gl_FragColor = vec4(col * (1.0 + uBoost), a * vA * (0.65 + uBoost));
  }`;

/** Floating magical motes that always surround the camera. */
export function createMotes(scene, env, count, pixelRatio) {
  const span = 60;
  const pos = new Float32Array(count * 3), seed = new Float32Array(count), size = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos.set([(Math.random() - 0.5) * span * 2, (Math.random() - 0.5) * span * 2, (Math.random() - 0.5) * span * 2], i * 3);
    seed[i] = Math.random(); size[i] = 0.6 + Math.random() * 1.8;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
  g.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
  const uniforms = { uTime: env.uTime, uCam: { value: new THREE.Vector3() }, uSpan: { value: span }, uPix: { value: pixelRatio },
    uColA: { value: new THREE.Color("#ffd59a") }, uColB: { value: new THREE.Color("#9fe8ff") }, uBoost: { value: 0 } };
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: pointVS, fragmentShader: pointFS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false;
  scene.add(pts);
  return { points: pts, uniforms, update(cam) { uniforms.uCam.value.copy(cam.position); } };
}

/** A fountain: water arcs simulated entirely on the GPU. */
export function createFountain(scene, env, origin, count = 600, pixelRatio = 1) {
  const pos = new Float32Array(count * 3), seed = new Float32Array(count);
  for (let i = 0; i < count; i++) seed[i] = Math.random();
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: env.uTime, uO: { value: origin.clone() }, uPix: { value: pixelRatio } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      attribute float aSeed; uniform float uTime; uniform vec3 uO; uniform float uPix; varying float vA;
      void main(){
        float life = 1.6; float t = mod(uTime*0.8 + aSeed*7.0, 1.0) * life;
        float a = aSeed * 6.2831 * 13.0; float ring = step(0.35, fract(aSeed*7.3));
        float r = mix(0.6, 2.2, ring);
        vec3 v = vec3(cos(a)*r, mix(9.0, 6.0, ring), sin(a)*r);
        vec3 p = uO + v*t + vec3(0.0, -9.8*0.5*t*t, 0.0);
        vA = (1.0 - t/life) * step(uO.y - 0.1, p.y);
        vec4 mv = viewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv; gl_PointSize = uPix * 40.0 / -mv.z;
      }`,
    fragmentShader: /* glsl */`
      varying float vA;
      void main(){ float r = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vec3(0.75, 0.93, 1.0)*1.3, smoothstep(0.5, 0.0, r) * vA * 0.8); }`
  });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false;
  scene.add(pts);
  return pts;
}

/** Sparkle burst used when a building "opens" and its website emerges. */
export function createBurst(scene, pixelRatio = 1, count = 260) {
  const dir = new Float32Array(count * 3), seed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const v = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.9, Math.random() - 0.5).normalize().multiplyScalar(0.4 + Math.random());
    dir.set([v.x, v.y, v.z], i * 3); seed[i] = Math.random();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(dir, 3));
  g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
  const uniforms = { uP: { value: 1 }, uO: { value: new THREE.Vector3() }, uN: { value: new THREE.Vector3(1, 0, 0) }, uCol: { value: new THREE.Color("#ffc76b") }, uPix: { value: pixelRatio } };
  const mat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      attribute float aSeed; uniform float uP; uniform vec3 uO; uniform vec3 uN; uniform float uPix; varying float vA;
      void main(){
        float e = 1.0 - pow(1.0 - uP, 3.0);
        vec3 d = position + uN * 1.2;
        vec3 p = uO + d * e * (6.0 + aSeed*8.0) + vec3(0.0, sin(uP*3.14)*2.0, 0.0);
        vA = (1.0 - uP) * (0.6 + 0.4*sin(aSeed*50.0 + uP*20.0));
        vec4 mv = viewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv; gl_PointSize = uPix * (30.0 + aSeed*40.0) / -mv.z;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uCol; varying float vA;
      void main(){ float r = length(gl_PointCoord - 0.5); gl_FragColor = vec4(uCol*2.0, smoothstep(0.5, 0.0, r) * vA); }`
  });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false; pts.visible = false;
  scene.add(pts);
  return {
    points: pts, uniforms,
    fire(origin, normal, color, gsap) {
      uniforms.uO.value.copy(origin); uniforms.uN.value.copy(normal);
      if (color) uniforms.uCol.value.set(color);
      pts.visible = true; uniforms.uP.value = 0;
      gsap.to(uniforms.uP, { value: 1, duration: 2.2, ease: "power2.out", onComplete: () => (pts.visible = false) });
    }
  };
}

/** Additive vertical light beam (tower beacon, gate, plazas). */
export function lightBeam(height, radius, color) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uCol: { value: new THREE.Color(color) }, uI: { value: 1 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 uCol; uniform float uI; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){ float rim = pow(1.0 - abs(dot(vN, vV)), 1.5); float a = (1.0 - vUv.y) * (0.25 + rim*0.75) * uI;
        gl_FragColor = vec4(uCol * 1.6, a * 0.55); }`
  });
  const m = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.6, radius, height, 24, 1, true), mat);
  m.geometry.translate(0, height / 2, 0);
  return m;
}
