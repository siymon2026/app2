"use strict";
/** VIDEO 2 — RESTAURANTS & STORES EXPERIENCE (silent, 9:16, ~44s) */
const E = require("./engine");
const SET = require("./set");
const S = require("./screens");
const CM = require("./common");
const UI = require("./ui");
const { W, H, C, clamp, lerp, smoothstep, easeOut, easeInOut, rgba, glow } = E;
const { screen, markBehind, endCard, tickBurst, camAt } = CM;
const { renderDevice } = require("./phone");

const LOGO = () => UI.IMG.logo;

function warm(ctx, x, y, r, a = 0.2, col = "#FFC98A") {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(col, a));
  g.addColorStop(1, rgba(col, 0));
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
}
function tablet(ctx, c, m, scr, opts = {}) {
  return renderDevice(ctx, c, m, scr, Object.assign({ w: 1.5, h: 1.06, r: 0.05, bezel: 0.032, notch: false, body: "#2C302B" }, opts));
}

/* ---------- 1. the merchant ---------- */
const s1 = {
  t0: 0, t1: 4.8, bloom: 0.42,
  draw(ctx, u, t) {
    const k = easeInOut(clamp(u / 4.8));
    const c = camAt([0, 1.3, -2.4], lerp(4.7, 4.05, k), lerp(7, 3, k), 5, 42);
    SET.studio(ctx, c, t, { spotA: 0.12, floorY: 0, parts: true });
    SET.storefront(ctx, c, t, {});
    warm(ctx, W * 0.5, H * 0.4, 760, 0.10);
    const scr = screen("v2dash1", (x, w0, h0) => S.dashOrders(x, w0, h0, t, { hl: true, press: 0 }), 900, 640);
    const rise = easeOut(clamp((u - 0.4) / 1.5));
    tablet(ctx, c, { p: [0, lerp(0.7, 1.26, rise), -1.6], ry: lerp(0.5, 0.16, rise), rx: -0.05 }, scr, { edgeGlow: 0.4, edgeGlowR: 520 });
    markBehind(ctx, c, [0, 2.75, -3.6], 300, LOGO(), { p: clamp((u - 2.2) / 0.9), glowA: 0.4, sweep: clamp((u - 2.8) / 1.2) });
  },
};

/* ---------- 2. manage products ---------- */
const s2 = {
  t0: 4.8, t1: 11.4, bloom: 0.34,
  draw(ctx, u, t) {
    const c = camAt([0, 1.2, -1.6], 4.0, 6, 4, 40);
    SET.studio(ctx, c, t, { spotA: 0.12, floorY: 0, parts: false });
    SET.counter(ctx, c, {});
    warm(ctx, W * 0.5, H * 0.22, 620, 0.11);
    const sheet = easeInOut(clamp((u - 0.9) / 1.1)) * (1 - clamp((u - 4.6) / 0.7));
    const saved = u > 3.9 && u < 5.2;
    const tg = [0, 0, 0, 0, 0, 0];
    tg[2] = clamp((u - 5.7) / 0.6);
    tg[5] = clamp((u - 6.2) / 0.6);
    const scr = screen("v2dash2", (x, w0, h0) => S.dashProducts(x, w0, h0, t, {
      sheet, saved, toggles: tg, img: clamp((u - 2.2) / 1.0),
    }), 900, 640);
    tablet(ctx, c, { p: [0, 1.2, -1.6], ry: 0.08, rx: -0.04 }, scr, { edgeGlow: 0.32, edgeGlowR: 560 });
    if (u > 3.85 && u < 4.7) {
      const p = c.project([0, 1.2, -1.6]);
      if (p) tickBurst(ctx, p.x, p.y, clamp((u - 3.85) / 0.9), 70);
    }
    if (u > 5.6) {
      const p = c.project([0.55, 1.05, -0.9]);
      if (p) glow(ctx, p.x, p.y, 120, C.green, 0.16);
    }
  },
};

/* ---------- 3. a new order arrives ---------- */
const s3 = {
  t0: 11.4, t1: 16.4, bloom: 0.4,
  draw(ctx, u, t) {
    const k = easeInOut(clamp(u / 5.0));
    const c = camAt([0, 1.2, -1.2], lerp(4.6, 4.0, k), lerp(-8, 2, k), 5, 42);
    SET.studio(ctx, c, t, { spotA: 0.12, floorY: 0, parts: true });
    SET.storefront(ctx, c, t, {});
    const notifP = clamp(u / 0.8);
    const pscr = screen("v2notif", (x, w, h) => S.notif(x, w, h, t, { p: notifP }), 520, 1134);
    renderDevice(ctx, c, { p: [-0.78, 1.12, -0.5], ry: -0.28, rx: 0.02, scale: 0.58 }, pscr, { edgeGlow: 0.4, edgeGlowR: 460 });
    const dscr = screen("v2dash3", (x, w0, h0) => S.dashOrders(x, w0, h0, t, { hl: u > 2.2, press: 0 }), 900, 640);
    tablet(ctx, c, { p: [0.74, 1.22, -1.9], ry: 0.4, rx: -0.05 }, dscr, { edgeGlow: 0.3, edgeGlowR: 480 });
    if (u > 1.3 && u < 3.3) {
      const a = c.project([-0.78, 1.36, -0.5]);
      const b = c.project([0.74, 1.28, -1.9]);
      if (a && b) SET.packet(ctx, a, b, (u - 1.3) / 1.5, { size: 15, arc: 120 });
    }
    if (u > 2.6) {
      const bp = c.project([0.74, 1.2, -1.9]);
      if (bp) tickBurst(ctx, bp.x, bp.y - 30, clamp((u - 2.6) / 1.1), 56);
    }
  },
};

/* ---------- 4. review & accept ---------- */
const s4 = {
  t0: 16.4, t1: 21.6, bloom: 0.32,
  draw(ctx, u, t) {
    const c = camAt([0, 1.2, -1.6], 3.9, 5, 4, 40);
    SET.studio(ctx, c, t, { spotA: 0.1, floorY: 0, parts: false });
    SET.counter(ctx, c, {});
    warm(ctx, W * 0.45, H * 0.22, 640, 0.10);
    const press = clamp((u - 1.5) / 0.6);
    const scr = screen("v2dash4", (x, w0, h0) => S.dashOrders(x, w0, h0, t, { press: press < 1 ? press : 0, hl: true }), 900, 640);
    tablet(ctx, c, { p: [0, 1.2, -1.6], ry: 0.06, rx: -0.04 }, scr, { edgeGlow: 0.34 + press * 0.4, edgeGlowR: 600 });
    if (press > 0.9) {
      const p = c.project([0, 1.2, -1.6]);
      const cp = clamp((u - 2.2) / 1.6);
      if (p) {
        ctx.save();
        ctx.strokeStyle = rgba(C.green, (1 - cp) * 0.5); ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(p.x, p.y, 80 + cp * 560, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
    }
  },
};

/* ---------- 5. preparing the order ---------- */
const s5 = {
  t0: 21.6, t1: 28.0, bloom: 0.4,
  draw(ctx, u, t) {
    const k = easeInOut(clamp(u / 6.4));
    const c = camAt([lerp(0.35, 0.15, k), 1.02, -1.45], lerp(4.3, 3.7, k), lerp(-14, -4, k), lerp(10, 7, k), 42);
    SET.studio(ctx, c, t, { spotA: 0.10, floorY: 0, parts: true });
    SET.counter(ctx, c, {});
    warm(ctx, W * 0.55, H * 0.18, 700, 0.13);
    E.figure(ctx, c, { p: [-0.75, 0, -2.3], ry: 0.35, scale: 1.0 }, { color: "#12160F", helmet: "#171C15" });
    const close = easeInOut(clamp((u - 0.8) / 1.2));
    SET.foodBox(ctx, c, { p: [0.05, 0.96, -1.5], ry: 0.22, scale: 1.0 }, {});
    drawLid(ctx, c, { p: [0.05, 1.055 - close * 0.075, -1.5], ry: 0.22 }, close);
    const intoBag = easeInOut(clamp((u - 2.6) / 1.6));
    SET.bag(ctx, c, { p: [lerp(0.5, 0.55, intoBag), 0.95, -1.15], ry: 0.4, scale: 0.85 }, { logoImg: LOGO() });
    if (u > 3.2) {
      const bp = c.project([0.55, 1.35, -1.15]);
      if (bp) {
        glow(ctx, bp.x, bp.y, 200, C.green, 0.12 + 0.03 * Math.sin(t * 3));
        if (u > 4.4) tickBurst(ctx, bp.x, bp.y - 40, clamp((u - 4.4) / 1.2), 58);
      }
    }
    E.particles(ctx, c, t, { n: 20, spread: 1.6, height: 0.9, depth: 1.2, base: 1.05, size: 2.0, seed: 4 });
  },
};

function drawLid(ctx, c, m, close) {
  if (close < 0.02) return;
  const P = (p) => E.place([p[0], p[1], p[2]], { p: m.p, rot: [0, m.ry || 0, 0] });
  E.drawQuad(ctx, c, [P([-0.26, 0, -0.21]), P([0.26, 0, -0.21]), P([0.26, 0, 0.21]), P([-0.26, 0, 0.21])], "#2C3226");
}

/* ---------- 6. ready for the driver ---------- */
const s6 = {
  t0: 28.0, t1: 33.8, bloom: 0.46,
  draw(ctx, u, t) {
    if (u < 2.5) {
      const c = camAt([0.2, 1.05, -1.4], 3.4, 8, 8, 42);
      SET.studio(ctx, c, t, { spotA: 0.10, floorY: 0, parts: true });
      SET.counter(ctx, c, {});
      warm(ctx, W * 0.5, H * 0.2, 620, 0.12);
      SET.bag(ctx, c, { p: [0.2, 0.95, -1.4], ry: 0.35, scale: 0.95 }, { logoImg: LOGO() });
      const bp = c.project([0.2, 1.4, -1.4]);
      if (bp) glow(ctx, bp.x, bp.y, 230, C.green, 0.14 + 0.04 * Math.sin(t * 3));
      const base = c.project([0.2, 0.94, -1.4]);
      const rp = (t * 0.9) % 1;
      if (base) {
        ctx.strokeStyle = rgba(C.green, (1 - rp) * 0.45); ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(base.x, base.y, 50 + rp * 120, 18 + rp * 42, 0, 0, Math.PI * 2); ctx.stroke();
      }
      return;
    }
    const k = easeInOut(clamp((u - 2.5) / 2.6));
    const c = E.makeCam({ pos: [lerp(0.3, 0.0, k), lerp(10.5, 9.2, k), lerp(12.5, 11.2, k)], target: [0, 0, -2.0], fov: 44 });
    SET.mapWorld(ctx, c, t, { rings: 2, seed: 14, maxH: 2.2 });
    SET.pin(ctx, c, [1.75, 0, -1.75], t);
    const drv = clamp((u - 2.8) / 2.6);
    const pts = [[-5.25, 5.25], [-5.25, 1.75], [-1.75, 1.75], [1.75, 1.75]];
    E.route(ctx, c, pts, { progress: 0.25 + drv * 0.75, width: 8, y: 0.08, flowT: t });
    const pos = E.routePoint(pts, 0.25 + drv * 0.75);
    SET.scooter(ctx, c, { p: [pos[0], 0, pos[1]], ry: 0.9, scale: 0.8 }, { rider: true });
  },
};

/* ---------- 7. handover to the driver ---------- */
const s7 = {
  t0: 33.8, t1: 39.4, bloom: 0.4,
  draw(ctx, u, t) {
    const k = easeInOut(clamp(u / 5.6));
    const c = camAt([0, 1.02, -1.1], lerp(3.6, 3.2, k), lerp(6, 2, k), 8, 42);
    SET.studio(ctx, c, t, { spotA: 0.10, floorY: 0, parts: true });
    warm(ctx, W * 0.3, H * 0.2, 560, 0.12);
    const pass = easeInOut(clamp((u - 1.2) / 1.8));
    const bx = lerp(-0.34, 0.3, pass);
    const bagC = [bx, 1.0, -1.25];
    E.figure(ctx, c, { p: [0.78, 0, -1.6], ry: -0.5, scale: 1.0 }, { color: "#12160F", reachL: [bagC[0] + 0.22, bagC[1] - 0.05, bagC[2] + 0.02] });
    E.figure(ctx, c, { p: [-0.78, 0, -1.55], ry: 0.5, scale: 1.0 }, { color: "#12160F", helmet: "#161B14", reachR: [bagC[0] - 0.22, bagC[1] - 0.05, bagC[2] + 0.02] });
    SET.bag(ctx, c, { p: [bx, 0.78, -1.25], ry: 0.14, scale: 0.74 }, { logoImg: LOGO() });
    if (u > 3.0) {
      const bp = c.project([0.3, 1.2, -1.25]);
      if (bp) tickBurst(ctx, bp.x, bp.y, clamp((u - 3.0) / 1.1), 86);
    }
    E.particles(ctx, c, t, { n: 22, spread: 5, height: 3, depth: 3, base: 0.1, size: 2 });
  },
};

/* ---------- 8. finale ---------- */
const s8 = {
  t0: 39.4, t1: 44.6, bloom: 0.4,
  draw(ctx, u, t) {
    if (u > 3.4) { endCard(ctx, u - 3.4, LOGO(), {}); return; }
    const k = easeInOut(clamp(u / 3.4));
    const c = camAt([0, 1.3, -2.6], lerp(4.8, 4.3, k), lerp(9, 4, k), 6, 42);
    SET.studio(ctx, c, t, { spotA: 0.12, floorY: 0, parts: true });
    SET.storefront(ctx, c, t, {});
    warm(ctx, W * 0.5, H * 0.4, 640, 0.1);
    const scr = screen("v2dash5", (x, w0, h0) => S.dashOrders(x, w0, h0, t, { hl: true, press: 0 }), 900, 640);
    tablet(ctx, c, { p: [0.02, 1.26, -1.7], ry: 0.14, rx: -0.05 }, scr, { edgeGlow: 0.38, edgeGlowR: 560 });
  },
};

module.exports = {
  name: "SIYMON-02-MERCHANT",
  file: "SIYMON-02-MERCHANTS.mp4",
  duration: 44.6,
  bpm: 108,
  energy: 1,
  scenes: [s1, s2, s3, s4, s5, s6, s7, s8],
  cues: [
    { t: 0.15, type: "impact" },
    { t: 1.0, type: "whoosh" },
    { t: 2.6, type: "chime", freq: 660 },
    { t: 4.8, type: "whoosh" },
    { t: 6.0, type: "whoosh2" }, { t: 9.0, type: "success" }, { t: 10.6, type: "pop" }, { t: 11.1, type: "pop" },
    { t: 11.4, type: "whoosh" }, { t: 12.2, type: "chime", freq: 990 }, { t: 14.2, type: "success" },
    { t: 16.4, type: "whoosh" }, { t: 18.1, type: "click" }, { t: 18.5, type: "success" },
    { t: 21.6, type: "whoosh" }, { t: 23.2, type: "pop" }, { t: 26.6, type: "success" },
    { t: 28.0, type: "whoosh" }, { t: 31.0, type: "engine", dur: 2.4, freq: 74 },
    { t: 33.8, type: "whoosh" }, { t: 37.2, type: "success" },
    { t: 39.4, type: "whoosh" }, { t: 42.9, type: "impact" },
  ],
};
