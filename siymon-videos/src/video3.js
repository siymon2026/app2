"use strict";
/** VIDEO 3 — DRIVER EXPERIENCE (silent, 9:16, ~49s) */
const E = require("./engine");
const SET = require("./set");
const S = require("./screens");
const CM = require("./common");
const UI = require("./ui");
const { W, H, C, clamp, lerp, smoothstep, easeOut, easeInOut, rgba, glow } = E;
const { screen, endCard, tickBurst, camAt } = CM;
const { renderDevice } = require("./phone");

const LOGO = () => UI.IMG.logo;

function warm(ctx, x, y, r, a = 0.18, col = "#FFC98A") {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(col, a));
  g.addColorStop(1, rgba(col, 0));
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
}

/* ---------- 1. starting the shift ---------- */
const s1 = {
  t0: 0, t1: 5.2, bloom: 0.46,
  draw(ctx, u, t) {
    const k = easeInOut(clamp(u / 5.2));
    const c = camAt([-0.12, 1.02, -3.45], lerp(5.9, 5.2, k), lerp(-7, -2, k), 6, 42);
    SET.avenue(ctx, c, t, {});
    E.figure(ctx, c, { p: [-0.62, 0, -3.55], ry: 0.55, scale: 1.0 }, { color: "#12160F", helmet: "#1E241C" });
    const on = clamp((u - 2.0) / 0.8);
    const scr = screen("v3home", (x, w, h) => S.driverHome(x, w, h, t, { online: on, drive: 0.2 }), 520, 1134);
    renderDevice(ctx, c, { p: [0.58, 1.18, -3.15], ry: -0.34, rx: 0.03, scale: 0.82 }, scr, { edgeGlow: 0.3 + on * 0.35, edgeGlowR: 560 });
    const pp = c.project([0.58, 1.18, -3.15]);
    if (pp && on > 0) glow(ctx, pp.x, pp.y + 60, 300, C.green, 0.10 * on);
  },
};

/* ---------- 2. dispatch: hex cells around the store ---------- */
const s2 = {
  t0: 5.2, t1: 10.4, bloom: 0.5,
  draw(ctx, u, t) {
    const k = easeInOut(clamp(u / 5.2));
    const c = E.makeCam({ pos: [lerp(0.4, -0.2, k), lerp(10.6, 9.4, k), lerp(11.4, 10.2, k)], target: [0, 0, -1.6], fov: 44 });
    SET.mapWorld(ctx, c, t, { rings: 2, seed: 7, maxH: 2.0 });
    SET.hexRing(ctx, c, [1.75, 0, -1.75], t, { radius: 1.45, size: 1.25, rings: 2, appear: clamp((u - 0.2) / 3.2) });
    SET.pin(ctx, c, [1.75, 0, -1.75], t);
    const mv = easeInOut(clamp((u - 0.4) / 4.4));
    const px = lerp(-5.25, -1.9, mv), pz = lerp(5.25, 3.2, mv);
    const dot = c.project([px, 0.12, pz]);
    if (dot) {
      glow(ctx, dot.x, dot.y, 110, C.green, 0.55);
      ctx.fillStyle = C.green;
      ctx.beginPath(); ctx.arc(dot.x, dot.y, 16, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#0F0F0F";
      ctx.beginPath(); ctx.arc(dot.x, dot.y, 7, 0, Math.PI * 2); ctx.fill();
      // search sweep
      const sw = (t * 1.2) % 1;
      ctx.strokeStyle = rgba(C.green, (1 - sw) * 0.4); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(dot.x, dot.y, 40 + sw * 180, 16 + sw * 66, 0, 0, Math.PI * 2); ctx.stroke();
    }
    const scr = screen("v3map", (x, w, h) => S.driverHome(x, w, h, t, { online: 1, drive: mv * 0.6 }), 520, 1134);
    renderDevice(ctx, c, { p: [-5.6, 2.4, 2.2], ry: 0.55, rx: 0.05, scale: 0.62 }, scr, { edgeGlow: 0.3, edgeGlowR: 400 });
  },
};

/* ---------- 3. the offer ---------- */
const s3 = {
  t0: 10.4, t1: 15.2, bloom: 0.36,
  draw(ctx, u, t) {
    const c = camAt([0, 1.05, -1.6], 3.9, 4, 3, 40);
    SET.studio(ctx, c, t, { spotA: 0.14, floorY: 0, parts: false });
    warm(ctx, W * 0.5, H * 0.24, 700, 0.08);
    const scr = screen("v3offer", (x, w, h) => S.driverOffer(x, w, h, t, { p: clamp(u / 0.7), accept: 0 }), 520, 1134);
    renderDevice(ctx, c, { p: [0, 1.2, -1.6], ry: 0.06, rx: 0.02 }, scr, { edgeGlow: 0.3, edgeGlowR: 620 });
    const p = c.project([0, 1.2, -1.6]);
    if (p && u > 0.6) glow(ctx, p.x, p.y + 120, 420, C.green, 0.10);
  },
};

/* ---------- 4. accept the mission ---------- */
const s4 = {
  t0: 15.2, t1: 19.8, bloom: 0.4,
  draw(ctx, u, t) {
    const k = easeInOut(clamp((u - 1.6) / 2.6));
    const c = camAt([0, 1.15, -1.8], lerp(4.6, 3.9, k), lerp(0, 3, k), 3, 40);
    SET.studio(ctx, c, t, { spotA: 0.14, floorY: 0, parts: false });
    const acc = clamp((u - 0.9) / 0.6);
    // other drivers' phones fade out
    const fade = 1 - clamp((u - 1.1) / 1.2);
    if (fade > 0.02) {
      ctx.save();
      ctx.globalAlpha = fade * 0.85;
      const oscr = screen("v3other", (x, w, h) => S.driverOffer(x, w, h, t, { p: 1, accept: 0 }), 520, 1134);
      renderDevice(ctx, c, { p: [-2.5, 1.35, -2.6], ry: 0.42, rx: 0.02, scale: 0.5 }, oscr, { edgeGlow: 0.12, edgeGlowR: 300 });
      renderDevice(ctx, c, { p: [2.45, 1.3, -2.4], ry: -0.44, rx: 0.02, scale: 0.5 }, oscr, { edgeGlow: 0.12, edgeGlowR: 300 });
      ctx.restore();
    }
    const scr = screen("v3accept", (x, w, h) => S.driverOffer(x, w, h, t, { p: 1, accept: acc < 1 ? acc : 0 }), 520, 1134);
    renderDevice(ctx, c, { p: [0, 1.2, -1.8], ry: 0.05, rx: 0.02 }, scr, { edgeGlow: 0.3 + acc * 0.4, edgeGlowR: 640 });
    if (acc > 0.85) {
      const p = c.project([0, 1.2, -1.8]);
      const cp = clamp((u - 1.4) / 1.6);
      if (p) {
        ctx.save();
        ctx.strokeStyle = rgba(C.green, (1 - cp) * 0.5); ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(p.x, p.y, 70 + cp * 620, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
    }
  },
};

/* ---------- 5. riding to the restaurant ---------- */
const s5 = {
  t0: 19.8, t1: 25.8, bloom: 0.5,
  draw(ctx, u, t) {
    const k = easeInOut(clamp((u - 2.6) / 3.4));
    const c = E.makeCam({
      pos: [lerp(1.6, 0.6, k), lerp(1.55, 1.25, k), lerp(7.2, 6.4, k)],
      target: [lerp(-0.6, -0.2, k), 0.9, -10], fov: 44,
    });
    SET.avenue(ctx, c, t, {});
    const pts = [[-0.5, 4], [-0.5, -1], [-0.1, -7], [-0.1, -15], [1.8, -24]];
    const pr = clamp(u / 5.8);
    E.route(ctx, c, pts, { progress: 0.1 + pr * 0.6, width: 7, y: 0.07, flowT: t });
    SET.pin(ctx, c, [1.8, 0, -24], t);
    const pos = E.routePoint(pts, 0.1 + pr * 0.6);
    SET.scooter(ctx, c, { p: [pos[0], 0, pos[1]], ry: -0.16, scale: 1.0 }, { rider: true });
    // phone on the handlebar mount
    if (u > 2.3) {
      const p = c.project([pos[0], 1.2, pos[1] + 0.1]);
      if (p) {
        const scr = screen("v3mount", (x, w, h) => S.driverTrip(x, w, h, t, { progress: 0.2 + pr * 0.5, step: 1 }), 520, 1134);
        renderDevice(ctx, c, { p: [pos[0] - 0.18, 1.28, pos[1] + 0.02], ry: -0.2, rx: 0.28, scale: 0.13 }, scr, { edgeGlow: 0.5, edgeGlowR: 220, notch: false });
      }
    }
  },
};

/* ---------- 6. pickup at the store ---------- */
const s6 = {
  t0: 25.8, t1: 31.8, bloom: 0.4,
  draw(ctx, u, t) {
    if (u < 3.4) {
      const c = camAt([0, 1.05, -1.1], 3.7, 6, 7, 42);
      SET.studio(ctx, c, t, { spotA: 0.1, floorY: 0, parts: true });
      warm(ctx, W * 0.35, H * 0.2, 600, 0.12);
      const pass = easeInOut(clamp((u - 1.0) / 1.6));
      const bx = lerp(0.34, -0.28, pass);
      const bagC = [bx, 1.0, -1.25];
      E.figure(ctx, c, { p: [0.8, 0, -1.7], ry: -0.5, scale: 1.0 }, { color: "#12160F", reachL: [bagC[0] + 0.22, bagC[1] - 0.05, bagC[2] + 0.02] });
      E.figure(ctx, c, { p: [-0.82, 0, -1.62], ry: 0.5, scale: 1.0 }, { color: "#12160F", reachR: [bagC[0] - 0.22, bagC[1] - 0.05, bagC[2] + 0.02] });
      SET.bag(ctx, c, { p: [bx, 0.78, -1.25], ry: 0.12, scale: 0.74 }, { logoImg: LOGO() });
      if (u > 2.7) {
        const bp = c.project([-0.28, 1.18, -1.25]);
        if (bp) tickBurst(ctx, bp.x, bp.y, clamp((u - 2.7) / 1.0), 80);
      }
      return;
    }
    const c = camAt([0, 1.1, -1.5], 3.8, 3, 3, 40);
    SET.studio(ctx, c, t, { spotA: 0.12, floorY: 0, parts: false });
    const digits = clamp((u - 3.8) * 2.2, 0, 6);
    const ok = clamp((u - 6.4) / 0.8);
    const scr = screen("v3verify", (x, w, h) => S.verify(x, w, h, t, { digits, show: 1, who: "store", ok }), 520, 1134);
    renderDevice(ctx, c, { p: [0, 1.2, -1.5], ry: 0.05, rx: 0.02 }, scr, { edgeGlow: 0.3 + ok * 0.4, edgeGlowR: 620 });
  },
};

/* ---------- 7. delivering ---------- */
const s7 = {
  t0: 31.8, t1: 37.8, bloom: 0.5,
  draw(ctx, u, t) {
    const k = easeInOut(clamp(u / 6.0));
    const c = E.makeCam({
      pos: [lerp(1.9, -0.9, k), lerp(1.5, 1.15, k), lerp(7.6, 6.2, k)],
      target: [lerp(-0.4, 0.2, k), 0.9, -11], fov: 44,
    });
    SET.avenue(ctx, c, t, {});
    const pts = [[-0.5, 3], [-0.5, -2], [0.2, -8], [0.2, -16], [1.9, -25]];
    const pr = clamp(u / 6.0);
    E.route(ctx, c, pts, { progress: 0.08 + pr * 0.7, width: 7, y: 0.07, flowT: t });
    SET.pin(ctx, c, [1.9, 0, -25], t);
    const pos = E.routePoint(pts, 0.08 + pr * 0.7);
    SET.scooter(ctx, c, { p: [pos[0], 0, pos[1]], ry: -0.1, scale: 1.0 }, { rider: true, beam: true });
    if (u > 1.4 && u < 3.6) {
      // low cinematic angle cut
      const cc = E.makeCam({ pos: [pos[0] + 1.5, 0.55, pos[1] + 1.9], target: [pos[0], 0.75, pos[1]], fov: 48 });
      SET.scooter(ctx, cc, { p: [pos[0], 0, pos[1]], ry: -0.1, scale: 1.0 }, { rider: true });
      ctx.fillStyle = "rgba(6,8,6,0.25)";
      ctx.fillRect(0, 0, W, H * 0.18);
    }
  },
};

/* ---------- 8. delivery confirmation ---------- */
const s8 = {
  t0: 37.8, t1: 42.2, bloom: 0.42,
  draw(ctx, u, t) {
    const k = easeInOut(clamp(u / 4.4));
    const c = camAt([0, 1.15, -1.6], lerp(4.3, 3.85, k), lerp(-3, 3, k), 3, 40);
    SET.studio(ctx, c, t, { spotA: 0.12, floorY: 0, parts: false });
    const digits = clamp((u - 1.0) * 2.0, 0, 6);
    const ok = clamp((u - 2.4) / 0.7);
    const scr = screen("v3verify2", (x, w, h) => S.verify(x, w, h, t, { digits, show: 1, who: "customer", ok }), 520, 1134);
    renderDevice(ctx, c, { p: [0, 1.2, -1.6], ry: 0.05, rx: 0.02 }, scr, { edgeGlow: 0.3 + ok * 0.5, edgeGlowR: 680 });
    if (ok > 0.2) {
      const p = c.project([0, 1.2, -1.6]);
      if (p) tickBurst(ctx, p.x, p.y - 40, clamp((u - 2.6) / 1.1), 120);
    }
  },
};

/* ---------- 9. earnings ---------- */
const s9 = {
  t0: 42.2, t1: 46.2, bloom: 0.36,
  draw(ctx, u, t) {
    const c = camAt([0, 1.05, -1.55], 3.9, 4, 3, 40);
    SET.studio(ctx, c, t, { spotA: 0.14, floorY: 0, parts: false });
    warm(ctx, W * 0.5, H * 0.2, 700, 0.08);
    const grow = clamp((u - 0.5) / 1.9);
    const scr = screen("v3earn", (x, w, h) => S.earnings(x, w, h, t, {
      grow, chart: clamp((u - 0.4) / 1.8), plus: clamp((u - 1.5) / 0.8),
    }), 520, 1134);
    renderDevice(ctx, c, { p: [0, 1.2, -1.55], ry: 0.05, rx: 0.02 }, scr, { edgeGlow: 0.3 + grow * 0.3, edgeGlowR: 640 });
    if (u > 1.6) {
      const p = c.project([0, 1.2, -1.55]);
      if (p) glow(ctx, p.x, p.y + 90, 380, C.green, 0.10 * grow);
    }
  },
};

/* ---------- 10. ride on + logo ---------- */
const s10 = {
  t0: 46.2, t1: 49.8, bloom: 0.46,
  draw(ctx, u, t) {
    if (u > 2.9) { endCard(ctx, u - 2.9, LOGO(), {}); return; }
    const k = easeInOut(clamp(u / 2.9));
    const c = E.makeCam({ pos: [lerp(2.2, 1.2, k), lerp(1.5, 1.35, k), lerp(8.4, 7.4, k)], target: [0.2, 0.9, -12], fov: 44 });
    SET.avenue(ctx, c, t, {});
    const p = [0.1 + u * 0.1, 0, lerp(1.0, -6.0, easeInOut(clamp(u / 2.9)))];
    SET.scooter(ctx, c, { p, ry: -0.12, scale: 0.95 }, { rider: true });
    E.route(ctx, c, [[p[0], p[2] + 2], [p[0], p[2] - 3], [p[0] + 0.3, p[2] - 12]], { progress: 1, width: 6, y: 0.06, flowT: t, head: false });
  },
};

module.exports = {
  name: "SIYMON-03-DRIVER",
  file: "SIYMON-03-DRIVER-EXPERIENCE.mp4",
  duration: 49.8,
  bpm: 112,
  energy: 1.05,
  scenes: [s1, s2, s3, s4, s5, s6, s7, s8, s9, s10],
  cues: [
    { t: 0.15, type: "impact" },
    { t: 2.2, type: "chime", freq: 880 }, { t: 2.6, type: "success" },
    { t: 5.2, type: "whoosh" }, { t: 5.5, type: "impact" },
    { t: 10.4, type: "whoosh" }, { t: 11.0, type: "chime", freq: 990 },
    { t: 15.2, type: "whoosh" }, { t: 16.1, type: "click" }, { t: 16.5, type: "success" },
    { t: 19.8, type: "whoosh" }, { t: 20.0, type: "engine", dur: 5.2, freq: 72 },
    { t: 25.8, type: "whoosh" }, { t: 28.4, type: "success" },
    { t: 29.2, type: "pop" }, { t: 30.2, type: "pop" }, { t: 31.1, type: "pop" },
    { t: 31.8, type: "whoosh" }, { t: 31.9, type: "engine", dur: 5.4, freq: 76 },
    { t: 37.8, type: "whoosh" }, { t: 39.2, type: "pop" }, { t: 40.4, type: "success" },
    { t: 42.2, type: "whoosh" }, { t: 44.0, type: "chime", freq: 1320 },
    { t: 46.2, type: "whoosh" }, { t: 47.4, type: "engine", dur: 2.2, freq: 68 },
    { t: 48.4, type: "impact" },
  ],
};
