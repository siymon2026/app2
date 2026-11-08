"use strict";
/**
 * Procedural score for the SIYMON campaign: modern electronic bed + light SFX.
 * No voice, no speech. Pure synthesis -> 44.1 kHz stereo WAV.
 */
const fs = require("fs");

const SR = 44100;

function buf(seconds) {
  const n = Math.ceil(seconds * SR);
  return { L: new Float32Array(n), R: new Float32Array(n), n };
}
function add(b, at, sig, gain = 1, pan = 0) {
  const i0 = Math.floor(at * SR);
  const gl = gain * (pan <= 0 ? 1 : 1 - pan * 0.7);
  const gr = gain * (pan >= 0 ? 1 : 1 + pan * 0.7);
  for (let i = 0; i < sig.length; i++) {
    const j = i0 + i;
    if (j < 0 || j >= b.n) continue;
    b.L[j] += sig[i] * gl;
    b.R[j] += sig[i] * gr;
  }
}
const TAU = Math.PI * 2;
const env = (t, a, d, s, r, len) => {
  if (t < a) return t / a;
  if (t < a + d) return 1 - (1 - s) * ((t - a) / d);
  if (t < len - r) return s;
  return Math.max(0, s * (1 - (t - (len - r)) / r));
};

/* ---------------- instruments ---------------- */
function kick(dur = 0.5) {
  const n = Math.floor(dur * SR), out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = 118 * Math.exp(-t * 26) + 44;
    const e = Math.exp(-t * 7.5);
    const click = Math.exp(-t * 160) * 0.5;
    out[i] = Math.sin(TAU * f * t) * e + (Math.random() * 2 - 1) * click * 0.25;
  }
  return out;
}
function hat(dur = 0.09, open = false) {
  const n = Math.floor(dur * SR), out = new Float32Array(n);
  let hp = 0, prev = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const w = Math.random() * 2 - 1;
    hp = 0.86 * (hp + w - prev);
    prev = w;
    out[i] = hp * Math.exp(-t * (open ? 22 : 60)) * 0.55;
  }
  return out;
}
function noiseSweep(dur, f0, f1, gain = 1) {
  const n = Math.floor(dur * SR), out = new Float32Array(n);
  let lp = 0, bp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR, k = t / dur;
    const f = f0 * Math.pow(f1 / f0, k);
    const w = Math.random() * 2 - 1;
    const a = Math.min(0.99, (TAU * f) / SR);
    lp = lp + a * (w - lp);
    bp = bp + a * (lp - bp);
    const e = Math.sin(Math.PI * Math.min(1, k * 1.05)) ** 2;
    out[i] = bp * e * gain;
  }
  return out;
}
function pad(dur, freqs, gain = 1, attack = 0.6) {
  const n = Math.floor(dur * SR), out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let v = 0;
    for (let k = 0; k < freqs.length; k++) {
      const f = freqs[k];
      v += Math.sin(TAU * f * t + Math.sin(t * 0.7 + k) * 0.6) * 0.5;
      v += Math.sin(TAU * f * 2.005 * t) * 0.16;
      v += Math.sin(TAU * f * 0.5 * t) * 0.22;
    }
    const e = t < attack ? t / attack : 1;
    const rel = Math.min(1, (dur - t) / 0.7);
    const dwell = 0.5 + 0.5 * Math.sin(t * 0.35);
    out[i] = (v / freqs.length) * e * Math.max(0, rel) * (0.7 + 0.3 * dwell) * gain;
  }
  return out;
}
function pluck(freq, dur = 0.45, gain = 1) {
  const n = Math.floor(dur * SR), out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const e = Math.exp(-t * 9);
    const v = Math.sin(TAU * freq * t) * 0.6 + Math.sin(TAU * freq * 2 * t) * 0.22 + Math.sin(TAU * freq * 3 * t) * 0.08;
    out[i] = v * e * gain;
  }
  return out;
}
function bass(freq, dur, gain = 1) {
  const n = Math.floor(dur * SR), out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const e = Math.min(1, t / 0.012) * Math.exp(-t * 2.2) * Math.min(1, (dur - t) / 0.05);
    const v = Math.sin(TAU * freq * t) * 0.8 + Math.sin(TAU * freq * 2 * t) * 0.18;
    out[i] = v * e * gain;
  }
  return out;
}
function chime(dur = 1.2, base = 880, gain = 1) {
  const n = Math.floor(dur * SR), out = new Float32Array(n);
  const parts = [1, 1.5, 2, 3];
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let v = 0;
    parts.forEach((p, k) => { v += Math.sin(TAU * base * p * t) * Math.exp(-t * (5 + k * 3)) / (k + 1.6); });
    out[i] = v * gain;
  }
  return out;
}
function riser(dur, gain = 1) {
  const n = Math.floor(dur * SR), out = new Float32Array(n);
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR, k = t / dur;
    const w = Math.random() * 2 - 1;
    const a = Math.min(0.98, 0.02 + k * 0.5);
    lp = lp + a * (w - lp);
    out[i] = lp * Math.pow(k, 1.6) * gain;
  }
  return out;
}
function impact(gain = 1) {
  const n = Math.floor(0.9 * SR), out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = 90 * Math.exp(-t * 9) + 32;
    out[i] = (Math.sin(TAU * f * t) * Math.exp(-t * 5) + (Math.random() * 2 - 1) * Math.exp(-t * 40) * 0.4) * gain;
  }
  return out;
}

/* ---------------- note table ---------------- */
const N = { A2: 110, C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196, A3: 220, B3: 246.94, C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392, A4: 440, B4: 493.88, C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880 };

/**
 * Build the full bed for a video of `duration` seconds.
 * cues: [{ t, type }] with type in kick|chime|whoosh|impact|pop|engine
 */
function score({ duration, bpm = 104, cues = [], energy = 1, key = "A" }) {
  const b = buf(duration);
  const beat = 60 / bpm;
  const bar = beat * 4;
  const chords = [
    [N.A2, N.E3, N.A3, N.C4],
    [N.F3, N.C4, N.F4, N.A4],
    [N.C3, N.G3, N.C4, N.E4],
    [N.G3, N.D4, N.G4, N.B4],
  ];
  const bars = Math.ceil(duration / bar) + 1;
  for (let i = 0; i < bars; i++) {
    const t0 = i * bar;
    if (t0 > duration) break;
    const ch = chords[i % chords.length];
    // pad
    add(b, t0, pad(Math.min(bar + 0.3, duration - t0 + 0.3), ch, 0.16 * energy, 0.5), 1, 0);
    // bass on every beat from bar 1
    if (i >= 1) {
      for (let k = 0; k < 4; k++) {
        const t = t0 + k * beat;
        const f = ch[0] / 2;
        add(b, t, bass(f * (k === 3 ? 2 : 1), beat * 0.9, 0.16 * energy), 1, 0);
      }
    }
    // kick
    if (i >= 1) {
      for (let k = 0; k < 4; k++) add(b, t0 + k * beat, kick(0.45), 0.30 * energy, 0);
      if (i % 2 === 1) add(b, t0 + beat * 3.5, kick(0.3), 0.18 * energy, 0);
    }
    // hats
    if (i >= 2) {
      for (let k = 0; k < 8; k++) add(b, t0 + k * beat * 0.5, hat(0.07), k % 2 ? 0.075 : 0.045, k % 2 ? 0.25 : -0.2);
    }
    // arp plucks
    if (i >= 2) {
      const seq = [ch[1], ch[2], ch[3], ch[2], ch[3] * 2, ch[2], ch[1] * 2, ch[1]];
      seq.forEach((f, k) => add(b, t0 + k * beat * 0.5, pluck(f * 2, 0.4, 0.055 * energy), 1, k % 2 ? -0.35 : 0.35));
    }
  }
  // risers at build points
  const risers = cues.filter((c) => c.type === "riser");
  for (const r of risers) add(b, Math.max(0, r.t - 2.4), riser(2.4, 0.14), 1, 0);

  // SFX
  for (const c of cues) {
    const p = c.t;
    if (p < 0 || p > duration) continue;
    switch (c.type) {
      case "chime": add(b, p, chime(1.4, c.freq || 880, 0.22), 1, 0.1); break;
      case "success":
        add(b, p, chime(1.1, 880, 0.18), 1, 0);
        add(b, p + 0.09, chime(1.2, 1320, 0.13), 1, 0.2);
        break;
      case "whoosh": add(b, p, noiseSweep(0.55, 1800, 260, 0.20), 1, c.pan || 0); break;
      case "whoosh2": add(b, p, noiseSweep(0.7, 320, 2600, 0.16), 1, c.pan || 0); break;
      case "impact": add(b, p, impact(0.28), 1, 0); break;
      case "pop": add(b, p, pluck(c.freq || 1200, 0.16, 0.16), 1, 0.15); break;
      case "click": add(b, p, hat(0.05, false), 0.2, 0); break;
      case "engine": {
        const n = Math.floor((c.dur || 1.5) * SR), e = new Float32Array(n);
        for (let i = 0; i < n; i++) {
          const t = i / SR;
          const f = (c.freq || 78) + Math.sin(t * 9) * 4;
          const amp = Math.min(1, t / 0.2) * Math.min(1, (n / SR - t) / 0.3);
          e[i] = (Math.sin(TAU * f * t) + Math.sin(TAU * f * 2.02 * t) * 0.4 + Math.sin(TAU * f * 3.01 * t) * 0.2) * amp * 0.1;
        }
        add(b, p, e, 1, 0.05);
        break;
      }
      default: break;
    }
  }

  // simple stereo delay for space
  const dly = Math.floor(0.28 * SR);
  for (let i = dly; i < b.n; i++) {
    b.R[i] += b.L[i - dly] * 0.16;
    b.L[i] += b.R[i - dly] * 0.13;
  }
  // gentle high-pass + soft limiting
  let hpL = 0, hpR = 0, prevL = 0, prevR = 0;
  for (let i = 0; i < b.n; i++) {
    hpL = 0.996 * (hpL + b.L[i] - prevL); prevL = b.L[i];
    hpR = 0.996 * (hpR + b.R[i] - prevR); prevR = b.R[i];
    b.L[i] = Math.tanh(hpL * 1.5) * 0.82;
    b.R[i] = Math.tanh(hpR * 1.5) * 0.82;
  }
  // fades
  const fadeIn = Math.floor(0.35 * SR), fadeOut = Math.floor(1.8 * SR);
  for (let i = 0; i < fadeIn; i++) { b.L[i] *= i / fadeIn; b.R[i] *= i / fadeIn; }
  for (let i = 0; i < fadeOut; i++) {
    const k = 1 - i / fadeOut;
    b.L[b.n - 1 - i] *= k; b.R[b.n - 1 - i] *= k;
  }
  return b;
}

function writeWav(path, b) {
  const n = b.n;
  const data = Buffer.alloc(44 + n * 4);
  data.write("RIFF", 0);
  data.writeUInt32LE(36 + n * 4, 4);
  data.write("WAVE", 8);
  data.write("fmt ", 12);
  data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20);
  data.writeUInt16LE(2, 22);
  data.writeUInt32LE(SR, 24);
  data.writeUInt32LE(SR * 4, 28);
  data.writeUInt16LE(4, 32);
  data.writeUInt16LE(16, 34);
  data.write("data", 36);
  data.writeUInt32LE(n * 4, 40);
  let o = 44;
  for (let i = 0; i < n; i++) {
    const l = Math.max(-1, Math.min(1, b.L[i]));
    const r = Math.max(-1, Math.min(1, b.R[i]));
    data.writeInt16LE(Math.round(l * 32000), o); o += 2;
    data.writeInt16LE(Math.round(r * 32000), o); o += 2;
  }
  fs.writeFileSync(path, data);
}

module.exports = { score, writeWav, SR };
