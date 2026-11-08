"use strict";
const E = require("./engine");
const { W, H, C, V, clamp, lerp, mix, rgba, shade, place, rot3, texQuad, createCanvas, glow } = E;

/* ---------- rounded-rect ring in local phone space ---------- */
function ring(w, h, r, inset, z, seg = 5) {
  const pts = [];
  const hw = w / 2 - inset, hh = h / 2 - inset;
  const rr = Math.max(0.001, r - inset);
  const corners = [
    [hw - rr, hh - rr, 0],
    [-hw + rr, hh - rr, Math.PI / 2],
    [-hw + rr, -hh + rr, Math.PI],
    [hw - rr, -hh + rr, (3 * Math.PI) / 2],
  ];
  for (const [cx, cy, a0] of corners) {
    for (let i = 0; i <= seg; i++) {
      const a = a0 + (i / seg) * (Math.PI / 2);
      pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, z]);
    }
  }
  return pts;
}

function pathOf(ctx, cam, pts) {
  const p2 = pts.map((p) => cam.project(p));
  if (p2.some((p) => !p)) return false;
  ctx.beginPath();
  ctx.moveTo(p2[0].x, p2[0].y);
  for (let i = 1; i < p2.length; i++) ctx.lineTo(p2[i].x, p2[i].y);
  ctx.closePath();
  return true;
}

function strip(ctx, cam, a, b, fill, lw) {
  const pa = a.map((p) => cam.project(p));
  const pb = b.map((p) => cam.project(p));
  if (pa.some((p) => !p) || pb.some((p) => !p)) return;
  ctx.beginPath();
  ctx.moveTo(pa[0].x, pa[0].y);
  for (let i = 1; i < pa.length; i++) ctx.lineTo(pa[i].x, pa[i].y);
  for (let i = pb.length - 1; i >= 0; i--) ctx.lineTo(pb[i].x, pb[i].y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

/**
 * Render a phone/tablet in 3D.
 * m: {p:[x,y,z], ry, rx, rz, scale}
 */
function renderDevice(ctx, cam, m, screenImg, opts = {}) {
  const w = opts.w || 1.0, h = opts.h || 2.05, t = opts.t || 0.082;
  const R = opts.r || 0.17;
  const bezel = opts.bezel === undefined ? 0.045 : opts.bezel;
  const rim = opts.rimColor || C.green;
  const bodyCol = opts.body || "#2B302B";
  const sc = m.scale === undefined ? 1 : m.scale;
  const M = (p) => place([p[0] * sc, p[1] * sc, p[2] * sc], { p: m.p, rot: [m.rx || 0, m.ry || 0, m.rz || 0] });

  const A = ring(w, h, R, 0, t / 2).map(M);
  const B = ring(w, h, R, 0.014, t / 2 - 0.022).map(M);
  const Cc = ring(w, h, R, 0.014, -t / 2 + 0.022).map(M);
  const D = ring(w, h, R, 0, -t / 2).map(M);

  // back plate
  if (pathOf(ctx, cam, D)) {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, shade(bodyCol, 0.26));
    g.addColorStop(1, shade(bodyCol, 0.14));
    ctx.fillStyle = g;
    ctx.fill();
  }
  // sides
  strip(ctx, cam, Cc, D, shade(bodyCol, 0.28));
  strip(ctx, cam, B, Cc, mix(shade(bodyCol, 0.9), "#4C524C", 0.35));
  strip(ctx, cam, A, B, shade(bodyCol, 1.15));

  // rim light on the frame
  if (opts.rim !== false) {
    const pa = A.map((p) => cam.project(p));
    const pb = B.map((p) => cam.project(p));
    if (!pa.some((p) => !p) && !pb.some((p) => !p)) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const lg = ctx.createLinearGradient(pa[0].x, pa[0].y, pa[8].x, pa[8].y);
      lg.addColorStop(0, rgba(rim, 0.0));
      lg.addColorStop(0.35, rgba(rim, 0.5));
      lg.addColorStop(0.6, rgba(rim, 0.1));
      lg.addColorStop(1, rgba(rim, 0.42));
      ctx.strokeStyle = lg;
      ctx.lineWidth = 2.4 * (pa[0].s / 700 || 1);
      ctx.beginPath();
      ctx.moveTo(pa[0].x, pa[0].y);
      for (let i = 1; i < pa.length; i++) ctx.lineTo(pa[i].x, pa[i].y);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }
  }

  // screen
  if (screenImg) {
    const scr = ring(w, h, R + 0.001, bezel, t / 2 + 0.002).map(M);
    ctx.save();
    if (pathOf(ctx, cam, scr)) {
      ctx.save();
      ctx.clip();
      const p2 = scr.map((p) => cam.project(p));
      const corners = [p2[8], p2[2], p2[20], p2[14]];
      const nx = opts.nx || 9, ny = opts.ny || 16;
      texQuad(ctx, screenImg, corners, nx, ny);
      // glass reflection
      if (opts.reflect !== false) {
        const g = ctx.createLinearGradient(corners[0].x, corners[0].y, corners[2].x, corners[2].y);
        g.addColorStop(0, "rgba(255,255,255,0.055)");
        g.addColorStop(0.35, "rgba(255,255,255,0.012)");
        g.addColorStop(0.55, "rgba(255,255,255,0.0)");
        g.addColorStop(1, "rgba(255,255,255,0.03)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }
      ctx.restore();
    }
    ctx.restore();
  }

  // camera notch/punch hole
  if (opts.notch !== false) {
    const nh = M([0, h / 2 - 0.055, t / 2 + 0.003]);
    const p = cam.project(nh);
    if (p) {
      const r = 0.016 * sc * p.s;
      ctx.fillStyle = "#070907";
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(70,120,220,0.22)";
      ctx.beginPath(); ctx.arc(p.x, p.y, r * 0.55, 0, Math.PI * 2); ctx.fill();
    }
  }

  if (opts.edgeGlow) {
    const c = cam.project(M([0, 0, 0]));
    if (c) glow(ctx, c.x, c.y, (opts.edgeGlowR || 520) * (c.s / 620), opts.edgeGlowColor || C.green, opts.edgeGlow);
  }
  return { corners: (() => { const scr = ring(w, h, R + 0.001, bezel, t / 2 + 0.002).map(M); const p2 = scr.map((p) => cam.project(p)); return [p2[0], p2[7], p2[14], p2[21]]; })() };
}

/* screen canvas cache */
const cache = new Map();
function screenCanvas(key, w, h, draw) {
  let cv = cache.get(key);
  if (!cv || cv.width !== w || cv.height !== h) {
    cv = createCanvas(w, h);
    cache.set(key, cv);
  }
  const x = cv.getContext("2d");
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.clearRect(0, 0, w, h);
  draw(x, w, h);
  return cv;
}

module.exports = { renderDevice, screenCanvas, ring };
