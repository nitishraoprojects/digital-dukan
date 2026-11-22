// Synthesised sound design — no audio files. Off by default; user opts in.
export function createAudio() {
  let ctx = null, master = null, amb = null, enabled = false;

  function init() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
    const comp = ctx.createDynamicsCompressor(); comp.connect(master);
    master.input = comp;

    // --- ambience: warm pad + soft city hum ---
    amb = ctx.createGain(); amb.gain.value = 0.55; amb.connect(comp);
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 900; lp.Q.value = 0.4; lp.connect(amb);
    [[110, -6], [164.81, 4], [220, 7], [329.63, -3]].forEach(([f, det], i) => {
      const o = ctx.createOscillator(); o.type = i % 2 ? "triangle" : "sine"; o.frequency.value = f; o.detune.value = det;
      const g = ctx.createGain(); g.gain.value = 0.045;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.05 + i * 0.03;
      const lg = ctx.createGain(); lg.gain.value = 0.025; lfo.connect(lg); lg.connect(g.gain);
      o.connect(g); g.connect(lp); o.start(); lfo.start();
    });
    // filtered brown noise = distant city
    const len = ctx.sampleRate * 3, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    let last = 0; for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; }
    const n = ctx.createBufferSource(); n.buffer = buf; n.loop = true;
    const nf = ctx.createBiquadFilter(); nf.type = "bandpass"; nf.frequency.value = 380; nf.Q.value = 0.6;
    const ng = ctx.createGain(); ng.gain.value = 0.35;
    n.connect(nf); nf.connect(ng); ng.connect(amb); n.start();
  }

  function env(g, t, a, peak, r) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + r); }

  const api = {
    get enabled() { return enabled; },
    async set(on) {
      enabled = on;
      if (on) { init(); if (!ctx) return; if (ctx.state === "suspended") await ctx.resume(); master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setTargetAtTime(0.5, ctx.currentTime, 0.6); }
      else if (ctx) { master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setTargetAtTime(0, ctx.currentTime, 0.25); }
    },
    tick() {
      if (!enabled || !ctx) return;
      const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine"; o.frequency.setValueAtTime(1400, t); o.frequency.exponentialRampToValueAtTime(900, t + 0.06);
      env(g, t, 0.004, 0.06, 0.07); o.connect(g); g.connect(master.input); o.start(t); o.stop(t + 0.12);
    },
    hover() {
      if (!enabled || !ctx) return;
      const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
      o.type = "sawtooth"; o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(220, t + 0.5);
      f.type = "lowpass"; f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(1800, t + 0.5);
      env(g, t, 0.1, 0.07, 0.6); o.connect(f); f.connect(g); g.connect(master.input); o.start(t); o.stop(t + 0.8);
    },
    portal() {
      if (!enabled || !ctx) return;
      const t = ctx.currentTime;
      // rising energy
      const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
      o.type = "sawtooth"; o.frequency.setValueAtTime(60, t); o.frequency.exponentialRampToValueAtTime(880, t + 1.6);
      f.type = "lowpass"; f.Q.value = 8; f.frequency.setValueAtTime(200, t); f.frequency.exponentialRampToValueAtTime(5000, t + 1.6);
      env(g, t, 0.8, 0.18, 1.4); o.connect(f); f.connect(g); g.connect(master.input); o.start(t); o.stop(t + 2.4);
      // whoosh
      api.whoosh(0.4, 2.6);
      // shimmer chord
      [523.25, 659.25, 783.99, 1046.5].forEach((fr, i) => {
        const s = ctx.createOscillator(), sg = ctx.createGain(); s.type = "sine"; s.frequency.value = fr;
        env(sg, t + 1.2 + i * 0.08, 0.05, 0.05, 2.2); s.connect(sg); sg.connect(master.input); s.start(t + 1.2); s.stop(t + 4);
      });
    },
    whoosh(delay = 0, dur = 1.6) {
      if (!enabled || !ctx) return;
      const t = ctx.currentTime + delay, len = ctx.sampleRate * dur, b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const s = ctx.createBufferSource(); s.buffer = b;
      const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.Q.value = 1.2;
      f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(2400, t + dur * 0.5); f.frequency.exponentialRampToValueAtTime(400, t + dur);
      const g = ctx.createGain(); env(g, t, dur * 0.45, 0.12, dur * 0.55);
      s.connect(f); f.connect(g); g.connect(master.input); s.start(t);
    },
    emerge() {
      if (!enabled || !ctx) return;
      const t = ctx.currentTime;
      [392, 523.25, 659.25, 783.99, 987.77].forEach((fr, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain(); o.type = "triangle"; o.frequency.value = fr;
        env(g, t + i * 0.07, 0.02, 0.05, 0.9); o.connect(g); g.connect(master.input); o.start(t + i * 0.07); o.stop(t + i * 0.07 + 1.2);
      });
      api.whoosh(0, 1.2);
    }
  };
  return api;
}
