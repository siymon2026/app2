"use strict";
const E = require("./engine");
const SET = require("./set");
const { renderDevice, screenCanvas } = require("./phone");
const U = require("./ui");
const { W, H, C, clamp, lerp, smooth, easeOut, easeInOut, rgba, glow, fillPoly } = E;

const SS = 2; // screen supersample
function screen(key, draw, w = 520, h = 1134) {
  return screenCanvas(key, w * SS, h * SS, (x) => {
    x.scale(SS, SS);
    draw(x, w, h);
  });
}

/* phone on a studio backdrop, facing camera */
function heroPhone(ctx, cam, m, scr, opts = {}) {
  if (opts.backGlow !== 0) {
    const c = cam.project([m.p[0], m.p[1], m.p[2] - 0.6]);
    if (c) glow(ctx, c.x, c.y, (opts.backGlowR || 780) * (c.s / 620), opts.glowColor || C.green, opts.backGlow === undefined ? 0.30 : opts.backGlow);
  }
  return renderDevice(ctx, cam, m, scr, opts);
}

/* big official mark behind/above a scene */
function markBehind(ctx, cam, p, size, img, o = {}) {
  const s = cam.project(p);
  if (!s) return;
  SET.logoMark(ctx, s.x, s.y, size * (s.s / 620), img, { p: o.p === undefined ? 1 : o.p, glowA: o.glowA === undefined ? 0.45 : o.glowA, sweep: o.sweep });
}

/* light beams from behind the phone */
function beams(ctx, cx, cy, t, a = 0.16) {
  ctx.save(); ctx.filter = "blur(7px)";
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 7; i++) {
    const ang = -Math.PI / 2 + (i - 3) * 0.16 + Math.sin(t * 0.4 + i) * 0.02;
    const len = H * 1.2;
    const wgt = 26 + (i % 3) * 18;
    const g = ctx.createLinearGradient(cx, cy, cx + Math.cos(ang) * len, cy + Math.sin(ang) * len);
    g.addColorStop(0, rgba(C.green, a));
    g.addColorStop(1, rgba(C.green, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(ang) * len - wgt, cy + Math.sin(ang) * len);
    ctx.lineTo(cx + Math.cos(ang) * len + wgt, cy + Math.sin(ang) * len);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore(); ctx.restore();
}

/* travelling "item" that arcs into the cart */
function arcFly(ctx, from, to, p, size, color = C.green) {
  const t = clamp(p);
  const x = lerp(from[0], to[0], easeInOut(t));
  const y = lerp(from[1], to[1], easeInOut(t)) - Math.sin(Math.PI * t) * 120;
  const s = size * (1 - 0.35 * t);
  const a = t < 0.92 ? 1 : (1 - t) / 0.08;
  ctx.save();
  ctx.globalAlpha = clamp(a);
  glow(ctx, x, y, s * 2.2, color, 0.5);
  ctx.fillStyle = "#0F0F0F";
  ctx.beginPath(); ctx.arc(x, y, s, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = rgba(color, 0.95); ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(x, y, s, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x, y, s * 0.32, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/* green tick burst */
function tickBurst(ctx, x, y, p, r = 90) {
  const t = clamp(p);
  if (t <= 0 || t >= 1) return;
  const e = easeOut(t);
  ctx.save();
  ctx.globalAlpha = 1 - t * 0.9;
  glow(ctx, x, y, r * (1.2 + e * 2.2), C.green, 0.45 * (1 - t));
  ctx.strokeStyle = rgba(C.green, 0.9 * (1 - t));
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(x, y, r * e, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y, r * e * 1.5, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = C.green;
  ctx.beginPath(); ctx.arc(x, y, r * 0.55 * Math.min(1, t * 3), 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#0F0F0F"; ctx.lineWidth = r * 0.12; ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(x - r * 0.22, y);
  ctx.lineTo(x - r * 0.05, y + r * 0.16);
  ctx.lineTo(x + r * 0.22, y - r * 0.16);
  ctx.stroke();
  ctx.restore();
}

/* end card: official mark + light sweep on black */
function endCard(ctx, t, logo, o = {}) {
  const p = clamp(t / 0.9);
  const cx = W / 2, cy = H * 0.47;
  const g = ctx.createRadialGradient(cx, cy, 20, cx, cy, H * 0.6);
  g.addColorStop(0, "#12200D");
  g.addColorStop(0.5, "#080D07");
  g.addColorStop(1, "#040504");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  beams(ctx, cx, cy, t, 0.09);
  const size = 430;
  SET.logoMark(ctx, cx, cy, size * lerp(0.86, 1, easeOut(p)), logo, {
    p,
    glowA: 0.5,
    sweep: o.sweep === undefined ? clamp((t - 0.5) / 1.2) : o.sweep,
  });
  // ground reflection
  ctx.save();
  ctx.globalAlpha = 0.10 * p;
  ctx.translate(cx, cy + size * 0.62);
  ctx.scale(1, -0.32);
  ctx.filter = "blur(3px)";
  ctx.drawImage(logo, -size / 2, 0, size, size);
  ctx.restore();
  glow(ctx, cx, cy, 620 * p, C.green, 0.14 * p);
}

module.exports = { screen, heroPhone, markBehind, beams, arcFly, tickBurst, endCard, SS };

/* camera orbiting a target at a distance (az/el in degrees) */
function camAt(target, dist, azDeg = 0, elDeg = 0, fov = 42, extra = {}) {
  const az = (azDeg * Math.PI) / 180, el = (elDeg * Math.PI) / 180;
  const dir = [Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)];
  const pos = [target[0] + dir[0] * dist, target[1] + dir[1] * dist, target[2] + dir[2] * dist];
  return E.makeCam(Object.assign({ pos, target, fov }, extra));
}
module.exports.camAt = camAt;
