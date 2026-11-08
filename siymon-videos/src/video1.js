"use strict";
/** VIDEO 1 — CUSTOMER EXPERIENCE (silent, 9:16, ~46s) */
const E = require("./engine");
const SET = require("./set");
const S = require("./screens");
const CM = require("./common");
const UI = require("./ui");
const { W, H, C, clamp, lerp, smooth, smoothstep, easeOut, easeInOut, rgba, glow } = E;
const { screen, markBehind, beams, endCard, tickBurst } = CM;
const { renderDevice } = require("./phone");

const cam = (pos, target, fov = 40, extra = {}) => E.makeCam({ pos, target, fov, ...extra });
const LOGO = () => UI.IMG.logo;

function warm(ctx, x, y, r, a = 0.25, col = "#FFC98A") {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(col, a));
  g.addColorStop(1, rgba(col, 0));
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
}

/* ---------- 1. brand intro ---------- */
const sIntro = {
  t0: 0, t1: 5.2, bloom: 0.35,
  draw(ctx, u, t) {
    const k = easeInOut(clamp(u / 4.6));
    const c = cam([lerp(0.16, 0.05, k), lerp(0.09, 0.02, k), lerp(6.9, 3.45, k)], [0, 0.02, 0], 40);
    SET.studio(ctx, c, t, { spotA: 0.34, floorY: -1.05 });
    markBehind(ctx, c, [0, 0.06, -2.4], 760, LOGO(), { p: clamp(u / 0.8) * (1 - smoothstep(2.3, 3.3, u)), glowA: 0.32, sweep: clamp((u - 1.1) / 1.6) });
    beams(ctx, W / 2, H * 0.46, t, 0.055);
    const on = smoothstep(2.05, 2.85, u);
    const scr = screen("v1intro", (x, w, h) => {
      S.home(x, w, h, t, { bell: on });
      if (on < 1) { x.fillStyle = `rgba(0,0,0,${1 - on})`; x.fillRect(0, 0, w, h); }
    });
    renderDevice(ctx, c, { p: [0, 0, 0], ry: lerp(0.62, 0.05, easeOut(k)), rx: 0.01 }, scr, { edgeGlow: 0.42 * on, edgeGlowR: 660 });
  },
};

/* ---------- 2. discovering stores ---------- */
const sDiscover = {
  t0: 5.2, t1: 10.8, bloom: 0.3,
  draw(ctx, u, t) {
    const k = easeInOut(clamp(u / 5.6));
    const c = cam([lerp(0.92, 0.34, k), lerp(0.42, 0.12, k), lerp(3.75, 2.45, k)], [0, 0, 0], 36);
    SET.studio(ctx, c, t, { spotA: 0.16, floorY: -1.9, parts: true });
    const tapP = clamp((u - 2.3) / 0.7);
    const scr = screen("v1discover", (x, w, h) => {
      S.home(x, w, h, t, { hScroll: (u * 26) % 240, bell: 1, tap: { x: w - 150, y: 580, p: tapP } });
    });
    renderDevice(ctx, c, { p: [0, 0, 0], ry: lerp(-0.38, -0.12, easeOut(k)), rx: 0.02 }, scr, { edgeGlow: 0.28, edgeGlowR: 760 });
  },
};

/* ---------- 3. products & cart ---------- */
const sSelect = {
  t0: 10.8, t1: 16.4, bloom: 0.3,
  draw(ctx, u, t) {
    const c = cam([0.95, 0.38, 3.5], [0, 0, 0], 36);
    SET.studio(ctx, c, t, { spotA: 0.14, floorY: -1.9, parts: false });
    const s1 = u > 0.9, s2 = u > 1.9, s3 = u > 2.9;
    const press = clamp((u - 0.9) / 0.5);
    const fly = [];
    if (u > 1.0) fly.push({ x: 520 - 150, y: 520, p: clamp((u - 1.0) / 0.9) });
    if (u > 2.0) fly.push({ x: 150, y: 520, p: clamp((u - 2.0) / 0.9) });
    if (u > 3.0) fly.push({ x: 520 - 150, y: 780, p: clamp((u - 3.0) / 0.9) });
    const scr = screen("v1select", (x, w, h) => {
      S.store(x, w, h, t, {
        sel1: s1, sel2: s2, sel3: s3, count: (s1 ? 1 : 0) + (s2 ? 1 : 0) + (s3 ? 1 : 0),
        press: press < 1 ? press : 0, fly,
      });
    });
    renderDevice(ctx, c, { p: [0, 0, 0], ry: -0.22 + Math.sin(u * 0.4) * 0.03, rx: 0.02 }, scr, { edgeGlow: 0.26, edgeGlowR: 760 });
  },
};

/* ---------- 4. address on a 3D city map ---------- */
const sAddress = {
  t0: 16.4, t1: 21.6, bloom: 0.42,
  draw(ctx, u, t) {
    const k = easeInOut(clamp(u / 5.2));
    const c = cam([lerp(0.6, 0.2, k), lerp(15.5, 13.4, k), lerp(16.6, 14.8, k)], [0, 0, -1.4], 46);
    SET.mapWorld(ctx, c, t, { rings: 2, seed: 9, maxH: 2.4 });
    const drop = easeOut(clamp((u - 0.4) / 1.1));
    SET.pin(ctx, c, [-3.5, lerp(7.5, 0, drop), -3.5], t);
    E.route(ctx, c, [[3.5, 5.2], [3.5, 1.75], [0, 1.75], [-1.75, 1.75], [-3.5, 0], [-3.5, -3.5]], {
      progress: clamp((u - 1.5) / 2.7), width: 9, y: 0.09, flowT: t,
    });
    addrOverlay(ctx, t, u);
  },
};

/* 2D app chrome over the 3D map (address step) */
function addrOverlay(ctx, t, u) {
  const U = UI.P;
  const p = easeOut(clamp((u - 1.0) / 0.8));
  if (p <= 0) return;
  ctx.save();
  ctx.globalAlpha = p;
  const x0 = 54, w0 = W - 108;
  // top bar
  UI.fillRR(ctx, x0, 70, 96, 96, 30, "rgba(12,14,12,0.82)");
  UI.icon(ctx, "chevron", x0 + 34, 102, 34, U.white);
  UI.fillRR(ctx, W - 54 - 300, 70, 300, 96, 30, "rgba(12,14,12,0.82)");
  UI.icon(ctx, "pin", W - 54 - 300 + 26, 100, 34, U.green);
  UI.bar(ctx, W - 54 - 300 + 78, 96, 150, 18, 0.8);
  UI.bar(ctx, W - 54 - 300 + 78, 126, 100, 11, 0.3);
  // sheet
  const sy = H - 620;
  const g = ctx.createLinearGradient(0, sy - 120, 0, sy + 240);
  g.addColorStop(0, "rgba(8,10,8,0)"); g.addColorStop(0.55, "rgba(8,10,8,0.9)"); g.addColorStop(1, "#080A08");
  ctx.fillStyle = g;
  ctx.fillRect(0, sy - 120, W, H - sy + 120);
  UI.fillRR(ctx, W / 2 - 60, sy + 36, 120, 8, 4, "rgba(248,248,248,0.18)");
  UI.bar(ctx, W - 54 - 220, sy + 74, 220, 22, 0.85);
  // address card
  UI.card(ctx, 54, sy + 124, W - 108, 124, 30, "#242922", rgba(U.green, 0.45));
  UI.fillRR(ctx, W - 54 - 20 - 64, sy + 152, 64, 64, 20, rgba(U.green, 0.18));
  UI.icon(ctx, "pin", W - 54 - 20 - 64 + 16, sy + 168, 32, U.green);
  UI.bar(ctx, W - 54 - 104 - 220, sy + 156, 220, 18, 0.8);
  UI.bar(ctx, W - 54 - 104 - 290, sy + 190, 290, 13, 0.3);
  UI.icon(ctx, "check", 54 + 40, sy + 172, 32, U.green, 3);
  // second row
  UI.card(ctx, 54, sy + 264, W - 108, 104, 28, "#191C19", "rgba(248,248,248,0.07)");
  UI.fillRR(ctx, W - 54 - 20 - 56, sy + 288, 56, 56, 18, "rgba(248,248,248,0.07)");
  UI.icon(ctx, "home", W - 54 - 20 - 56 + 14, sy + 302, 28, "rgba(248,248,248,0.6)");
  UI.bar(ctx, W - 54 - 96 - 180, sy + 292, 180, 15, 0.55);
  UI.bar(ctx, W - 54 - 96 - 240, sy + 320, 240, 11, 0.22);
  UI.fillRR(ctx, 74, sy + 288, 56, 44, 16, "rgba(248,248,248,0.05)");
  UI.icon(ctx, "plus", 74 + 14, sy + 298, 28, U.green);
  // CTA
  const by = H - 200;
  const cg = ctx.createLinearGradient(54, by, W - 54, by + 100);
  cg.addColorStop(0, "#57C926"); cg.addColorStop(1, U.green);
  ctx.save();
  ctx.shadowColor = rgba(U.green, 0.45); ctx.shadowBlur = 40;
  UI.fillRR(ctx, 54, by, W - 108, 104, 32, cg);
  ctx.restore();
  UI.bar(ctx, W - 54 - 96 - 240, by + 40, 240, 20, 0.8);
  UI.icon(ctx, "check", 54 + 44, by + 30, 42, "rgba(15,15,15,0.85)", 3);
  ctx.restore();
}

/* ---------- 5. checkout & payment ---------- */
const sPay = {
  t0: 21.6, t1: 27.4, bloom: 0.3,
  draw(ctx, u, t) {
    const c = cam([0.7, 0.24, 3.25], [0, 0, 0], 36);
    SET.studio(ctx, c, t, { spotA: 0.14, floorY: -1.9, parts: false });
    const payIdx = u < 1.5 ? 0 : u < 2.6 ? 1 : 0;
    const confirm = clamp((u - 3.1) / 0.8);
    const scr = screen("v1pay", (x, w, h) => {
      S.cart(x, w, h, t, { pay: payIdx });
      if (confirm > 0) {
        x.fillStyle = `rgba(15,15,15,${0.5 * confirm})`;
        x.fillRect(0, 0, w, h);
        const cp = clamp(confirm * 2.2);
        x.save();
        x.translate(w / 2, h * 0.36);
        x.rotate(-0.4 + cp * 0.4);
        x.scale(lerp(0.5, 1, easeOut(cp)), lerp(0.5, 1, easeOut(cp)));
        x.fillStyle = "#5DD62C";
        x.beginPath(); x.arc(0, 0, 84, 0, Math.PI * 2); x.fill();
        x.strokeStyle = "#0F0F0F"; x.lineWidth = 12; x.lineCap = "round"; x.lineJoin = "round";
        x.beginPath(); x.moveTo(-34, 2); x.lineTo(-10, 26); x.lineTo(36, -26); x.stroke();
        x.restore();
      }
    });
    const tilt = easeInOut(clamp((u - 3.0) / 1.8));
    renderDevice(ctx, c, { p: [0, 0, 0], ry: -0.16 - tilt * 0.1, rx: 0.02 }, scr, { edgeGlow: 0.26 + confirm * 0.4, edgeGlowR: 820 });
    if (confirm > 0.3) {
      const cp = clamp((u - 3.4) / 1.6);
      const cc = c.project([0, 0, 0]);
      if (cc) {
        ctx.save();
        ctx.strokeStyle = rgba(C.green, (1 - cp) * 0.5);
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(cc.x, cc.y, 60 + cp * 640, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
    }
  },
};

/* ---------- 6. merchant receives & prepares ---------- */
const sKitchen = {
  t0: 27.4, t1: 33.8, bloom: 0.38,
  draw(ctx, u, t) {
    const k = smoothstep(2.5, 3.7, u);
    const c = cam(
      [lerp(-0.02, 1.3, k), lerp(1.48, 1.38, k), lerp(1.95, 1.62, k)],
      [lerp(-1.0, 0.68, k), 1.0, lerp(-1.35, -1.1, k)], 42
    );
    SET.studio(ctx, c, t, { spotA: 0.10, floorY: 0, parts: true });
    SET.counter(ctx, c, {});
    warm(ctx, W * 0.42, H * 0.16, 700, 0.13);
    warm(ctx, W * 0.8, H * 0.2, 460, 0.09);
    const press = clamp((u - 1.6) / 0.55);
    const scr = screen("v1dash", (x, w0, h0) => S.dashOrders(x, w0, h0, t, { press: press < 1 ? press : 0, hl: true }), 900, 640);
    renderDevice(ctx, c, { p: [-1.05, 1.33, -1.28], ry: 0.42, rx: -0.1 }, scr, {
      w: 1.2, h: 0.82, r: 0.045, bezel: 0.03, notch: false, edgeGlow: 0.32, edgeGlowR: 480, body: "#2A2E2A",
    });
    SET.foodBox(ctx, c, { p: [0.34, 0.96, -1.3], ry: 0.22, scale: 1.0 }, {});
    SET.foodBox(ctx, c, { p: [0.82, 0.96, -1.06], ry: -0.3, scale: 1.0 }, { lidColor: "#2A3024" });
    SET.bag(ctx, c, { p: [1.2, 0.95, -0.82], ry: 0.3, scale: 1.0 }, { logoImg: LOGO() });
    E.figure(ctx, c, { p: [-0.15, 0, -2.6], ry: 0.35, scale: 1.0 }, { color: "#1B211A" });
    E.particles(ctx, c, t, { n: 18, spread: 6, height: 2, depth: 3, base: 1.0, size: 2 });
  },
};

/* ---------- 7. live tracking ---------- */
const sTrack = {
  t0: 33.8, t1: 40.2, bloom: 0.4,
  draw(ctx, u, t) {
    if (u < 3.1) {
      const c = cam([lerp(0.62, 0.3, easeInOut(u / 3.1)), lerp(0.32, 0.16, u / 3.1), 3.05], [0, 0, 0], 36);
      SET.studio(ctx, c, t, { spotA: 0.15, floorY: -1.9, parts: false });
      const prog = clamp(0.12 + u * 0.24);
      const scr = screen("v1track", (x, w, h) => S.track(x, w, h, t, { progress: prog, step: prog < 0.45 ? 0 : prog < 0.8 ? 1 : 2 }));
      renderDevice(ctx, c, { p: [0, 0, 0], ry: -0.18, rx: 0.02 }, scr, { edgeGlow: 0.26, edgeGlowR: 760 });
      return;
    }
    const prog = clamp((u - 3.1) / 3.0);
    const c = cam([0, 2.2, 9.6], [0, 0.9, -12], 44);
    SET.avenue(ctx, c, t, {});
    const pts = [[-0.6, 6], [-0.6, 0], [0, -6], [0.2, -14], [1.6, -24]];
    E.route(ctx, c, pts, { progress: 0.15 + prog * 0.82, width: 7, y: 0.07, flowT: t });
    SET.pin(ctx, c, [1.6, 0, -24], t);
    const pos = E.routePoint(pts, 0.15 + prog * 0.82);
    SET.scooter(ctx, c, { p: [pos[0], 0, pos[1]], ry: -0.3, scale: 1.0 }, { rider: true });
  },
};

/* ---------- 8. handover + logo ---------- */
const sDeliver = {
  t0: 40.2, t1: 46.6, bloom: 0.35,
  draw(ctx, u, t, frame, dur) {
    if (u > 4.4) {
      endCard(ctx, u - 4.4, LOGO(), {});
      return;
    }
    const k = easeInOut(clamp(u / 4.2));
    const c = cam([lerp(0.42, 0.12, k), lerp(1.34, 1.26, k), lerp(3.5, 3.05, k)], [0, 1.02, -1.0], 42);
    SET.studio(ctx, c, t, { spotA: 0.12, floorY: 0, parts: true });
    warm(ctx, W * 0.22, H * 0.22, 620, 0.14);
    warm(ctx, W * 0.5, H * 0.5, 900, 0.10, "#7CFF4A");
    const c0 = c.project([0, 0, 2.5]);
    if (c0) {
      const fg = ctx.createLinearGradient(0, H * 0.62, 0, H);
      fg.addColorStop(0, "rgba(6,8,6,0)");
      fg.addColorStop(1, "rgba(6,8,6,0.9)");
      ctx.fillStyle = fg; ctx.fillRect(0, H * 0.62, W, H * 0.38);
    }
    const pass = easeInOut(clamp((u - 1.6) / 2.0));
    const bx = lerp(-0.38, 0.44, pass);
    const bagC = [bx, 1.02, -1.28];
    E.figure(ctx, c, { p: [-0.82, 0, -1.55], ry: 0.55, scale: 1.0 }, {
      color: "#12160F", helmet: "#161B14",
      reachR: [bagC[0] - 0.2, bagC[1] - 0.06, bagC[2] + 0.02],
    });
    E.figure(ctx, c, { p: [0.86, 0, -1.7], ry: -0.5, scale: 1.0 }, {
      color: "#12160F",
      reachL: [bagC[0] + 0.2, bagC[1] - 0.06, bagC[2] + 0.02],
    });
    SET.bag(ctx, c, { p: [bx, 0.78, -1.28], ry: 0.12, scale: 0.8 }, { logoImg: LOGO() });
    if (u > 3.4) {
      const bp = c.project([0.44, 1.2, -1.28]);
      if (bp) tickBurst(ctx, bp.x, bp.y, clamp((u - 3.4) / 1.0), 100);
    }
    E.particles(ctx, c, t, { n: 24, spread: 6, height: 3, depth: 3, base: 0.1, size: 2 });
  },
};

module.exports = {
  name: "SIYMON-01-CUSTOMER",
  file: "SIYMON-01-CUSTOMER-EXPERIENCE.mp4",
  duration: 46.6,
  bpm: 104,
  energy: 1,
  scenes: [sIntro, sDiscover, sSelect, sAddress, sPay, sKitchen, sTrack, sDeliver],
  cues: [
    { t: 0.15, type: "impact" },
    { t: 5.2, type: "whoosh" }, { t: 5.4, type: "chime", freq: 660 },
    { t: 7.6, type: "pop" },
    { t: 10.8, type: "whoosh" },
    { t: 11.7, type: "pop" }, { t: 12.7, type: "pop" }, { t: 13.7, type: "pop", freq: 1100 },
    { t: 16.4, type: "whoosh" }, { t: 16.9, type: "impact" },
    { t: 21.6, type: "whoosh" },
    { t: 24.8, type: "click" }, { t: 25.2, type: "success" },
    { t: 27.4, type: "whoosh" }, { t: 29.1, type: "pop" }, { t: 29.4, type: "success" },
    { t: 33.8, type: "whoosh" }, { t: 37.0, type: "engine", dur: 3.0, freq: 70 },
    { t: 40.2, type: "whoosh" }, { t: 43.5, type: "success" },
    { t: 44.6, type: "impact" },
  ],
};
