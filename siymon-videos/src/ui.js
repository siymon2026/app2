"use strict";
/**
 * SIYMON app screens, drawn as vector mockups with NO text (bars instead of words),
 * following the real structure of public/index.html, restaurant/, store/, driver/, wallet/.
 */
const { rgba, mix, C, clamp, lerp, easeOut, easeInOut } = require("./engine");

const P = {
  bg: "#0B0C0B",
  surface: "#1D1F1D",
  surface2: "#252825",
  el: "#2F2F2F",
  green: "#5DD62C",
  greenDark: "#337418",
  white: "#F8F8F8",
  muted: "#A8A8A8",
  line: "rgba(248,248,248,0.10)",
};

/* ---------- primitives ---------- */
function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function fillRR(ctx, x, y, w, h, r, fill) {
  rr(ctx, x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
}
function card(ctx, x, y, w, h, r = 18, fill = P.surface, stroke = P.line) {
  fillRR(ctx, x, y, w, h, r, fill);
  if (stroke) {
    rr(ctx, x + 0.5, y + 0.5, w - 1, h - 1, r);
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}
/* text placeholder: rounded bar */
function bar(ctx, x, y, w, h, alpha = 0.75) {
  fillRR(ctx, x, y, w, h, h / 2, `rgba(248,248,248,${alpha})`);
}
function barG(ctx, x, y, w, h, alpha = 0.8) {
  fillRR(ctx, x, y, w, h, h / 2, `rgba(93,214,44,${alpha})`);
}
function pill(ctx, x, y, w, h, fill, stroke) {
  fillRR(ctx, x, y, w, h, h / 2, fill);
  if (stroke) {
    rr(ctx, x + 0.5, y + 0.5, w - 1, h - 1, h / 2);
    ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke();
  }
}
function ripple(ctx, x, y, r, a) {
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.strokeStyle = P.green;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

/* ---------- icons (stroke paths) ---------- */
function icon(ctx, name, x, y, s, color = P.white, lw = 1.9) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = lw;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const k = s / 24;
  ctx.scale(k, k);
  const p = (d) => { ctx.beginPath(); for (const cmd of d) { /* built inline below */ } };
  switch (name) {
    case "home":
      ctx.beginPath(); ctx.moveTo(3, 11); ctx.lineTo(12, 3.5); ctx.lineTo(21, 11); ctx.lineTo(21, 20.5); ctx.lineTo(14, 20.5); ctx.lineTo(14, 14); ctx.lineTo(10, 14); ctx.lineTo(10, 20.5); ctx.lineTo(3, 20.5); ctx.closePath(); ctx.stroke(); break;
    case "bag":
      ctx.beginPath(); ctx.moveTo(5, 8); ctx.lineTo(19, 8); ctx.lineTo(18, 21); ctx.lineTo(6, 21); ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(9, 8); ctx.lineTo(9, 6.2); ctx.arc(12, 6.2, 3, Math.PI, 0); ctx.lineTo(15, 8); ctx.stroke(); break;
    case "wallet":
      ctx.beginPath(); ctx.roundRect(3, 6, 18, 13, 3); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(3, 10.5); ctx.lineTo(21, 10.5); ctx.stroke();
      ctx.beginPath(); ctx.arc(17, 15.5, 1.6, 0, Math.PI * 2); ctx.fill(); break;
    case "user":
      ctx.beginPath(); ctx.arc(12, 8.5, 3.6, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(12, 21, 7.4, Math.PI, 0); ctx.stroke(); break;
    case "search":
      ctx.beginPath(); ctx.arc(11, 11, 6.2, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(15.8, 15.8); ctx.lineTo(21, 21); ctx.stroke(); break;
    case "star":
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 4.2 : 9;
        const px = 12 + Math.cos(a) * r, py = 12 + Math.sin(a) * r;
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.closePath(); ctx.fill(); break;
    case "pin":
      ctx.beginPath(); ctx.moveTo(12, 21.5); ctx.bezierCurveTo(12, 21.5, 19, 14.4, 19, 9.6); ctx.arc(12, 9.6, 7, 0, Math.PI * 2); ctx.bezierCurveTo(5, 14.4, 12, 21.5, 12, 21.5); ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.arc(12, 9.8, 2.4, 0, Math.PI * 2); ctx.stroke(); break;
    case "clock":
      ctx.beginPath(); ctx.arc(12, 12, 8.4, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(12, 7.4); ctx.lineTo(12, 12.4); ctx.lineTo(16, 14.4); ctx.stroke(); break;
    case "check":
      ctx.beginPath(); ctx.moveTo(5, 12.6); ctx.lineTo(10, 17.4); ctx.lineTo(19.4, 6.8); ctx.stroke(); break;
    case "plus":
      ctx.beginPath(); ctx.moveTo(12, 5); ctx.lineTo(12, 19); ctx.moveTo(5, 12); ctx.lineTo(19, 12); ctx.stroke(); break;
    case "minus":
      ctx.beginPath(); ctx.moveTo(5, 12); ctx.lineTo(19, 12); ctx.stroke(); break;
    case "bell":
      ctx.beginPath(); ctx.moveTo(6, 17); ctx.lineTo(6, 11); ctx.arc(12, 11, 6, Math.PI, 0); ctx.lineTo(18, 17); ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(10.4, 20.4); ctx.arc(12, 20.4, 1.7, Math.PI, 0); ctx.stroke(); break;
    case "chevron":
      ctx.beginPath(); ctx.moveTo(15, 5); ctx.lineTo(8.5, 12); ctx.lineTo(15, 19); ctx.stroke(); break;
    case "bike":
      ctx.beginPath(); ctx.arc(5.6, 17, 3.6, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(18.4, 17, 3.6, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(5.6, 17); ctx.lineTo(10, 10.5); ctx.lineTo(14.5, 10.5); ctx.lineTo(18.4, 17); ctx.lineTo(12, 17); ctx.lineTo(10, 10.5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(13, 7.4); ctx.lineTo(16.4, 7.4); ctx.stroke(); break;
    case "cash":
      ctx.beginPath(); ctx.roundRect(2.5, 6.5, 19, 11, 2.5); ctx.stroke();
      ctx.beginPath(); ctx.arc(12, 12, 2.8, 0, Math.PI * 2); ctx.stroke(); break;
    case "terminal":
      ctx.beginPath(); ctx.roundRect(5, 2.5, 14, 19, 3); ctx.stroke();
      fillRR(ctx, 8, 6, 8, 5, 1.4, color);
      ctx.beginPath(); ctx.arc(12, 16.5, 1.5, 0, Math.PI * 2); ctx.fill(); break;
    case "chart":
      ctx.beginPath(); ctx.moveTo(4, 20); ctx.lineTo(4, 4); ctx.moveTo(4, 20); ctx.lineTo(20, 20); ctx.stroke();
      fillRR(ctx, 7, 13, 3, 7, 1.2, color);
      fillRR(ctx, 12, 9, 3, 11, 1.2, color);
      fillRR(ctx, 17, 5, 3, 15, 1.2, color); break;
    case "trend":
      ctx.beginPath(); ctx.moveTo(4, 17); ctx.lineTo(10, 10.5); ctx.lineTo(14, 14); ctx.lineTo(20, 6.5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(15, 6.5); ctx.lineTo(20, 6.5); ctx.lineTo(20, 11.5); ctx.stroke(); break;
    case "store":
      ctx.beginPath(); ctx.moveTo(4, 9.5); ctx.lineTo(4, 20.5); ctx.lineTo(20, 20.5); ctx.lineTo(20, 9.5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(2.6, 9.5); ctx.lineTo(4.6, 4); ctx.lineTo(19.4, 4); ctx.lineTo(21.4, 9.5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(9, 20.5); ctx.lineTo(9, 14.5); ctx.lineTo(15, 14.5); ctx.lineTo(15, 20.5); ctx.stroke(); break;
    case "food":
      ctx.beginPath(); ctx.arc(12, 13, 6.5, Math.PI * 0.15, Math.PI * 0.85, true); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(4, 17.5); ctx.lineTo(20, 17.5); ctx.stroke(); break;
    case "pill":
      ctx.save(); ctx.rotate(-0.7);
      ctx.beginPath(); ctx.roundRect(-8, -3.6, 16, 7.2, 3.6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -3.6); ctx.lineTo(0, 3.6); ctx.stroke();
      ctx.restore(); break;
    case "flame":
      ctx.beginPath(); ctx.moveTo(12, 3.5); ctx.bezierCurveTo(16, 8, 18.5, 10, 18.5, 14); ctx.arc(12, 14, 6.5, 0, Math.PI, false); ctx.bezierCurveTo(5.5, 10, 8, 8, 12, 3.5); ctx.closePath(); ctx.stroke(); break;
    case "power":
      ctx.beginPath(); ctx.arc(12, 12, 8.2, Math.PI * 0.72, Math.PI * 0.28); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(12, 3); ctx.lineTo(12, 12); ctx.stroke(); break;
    case "refresh":
      ctx.beginPath(); ctx.arc(12, 12, 7.6, -0.4, Math.PI * 1.25); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(19.4, 4.2); ctx.lineTo(19.4, 10.4); ctx.lineTo(13.4, 10.4); ctx.stroke(); break;
    case "phone":
      ctx.beginPath(); ctx.roundRect(7.5, 2.5, 9, 19, 2.4); ctx.stroke(); break;
    case "chat":
      ctx.beginPath(); ctx.roundRect(3, 4.5, 18, 13, 3.4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(8, 17.5); ctx.lineTo(8, 21); ctx.lineTo(12.6, 17.5); ctx.stroke(); break;
    case "eye":
      ctx.beginPath(); ctx.moveTo(2.5, 12); ctx.bezierCurveTo(7, 5.5, 17, 5.5, 21.5, 12); ctx.bezierCurveTo(17, 18.5, 7, 18.5, 2.5, 12); ctx.stroke();
      ctx.beginPath(); ctx.arc(12, 12, 2.8, 0, Math.PI * 2); ctx.stroke(); break;
    case "list":
      ctx.beginPath(); for (let i = 0; i < 3; i++) { ctx.moveTo(8.5, 6 + i * 6); ctx.lineTo(20, 6 + i * 6); } ctx.stroke();
      ctx.beginPath(); for (let i = 0; i < 3; i++) { ctx.arc(4.6, 6 + i * 6, 1.5, 0, Math.PI * 2); } ctx.fillStyle = color; ctx.fill(); break;
    case "gear":
      ctx.beginPath(); ctx.arc(12, 12, 3.4, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(12, 12, 8, 0, Math.PI * 2); ctx.setLineDash([2.6, 3.6]); ctx.stroke(); ctx.setLineDash([]); break;
    case "arrowUp":
      ctx.beginPath(); ctx.moveTo(12, 20); ctx.lineTo(12, 5); ctx.moveTo(6, 11); ctx.lineTo(12, 5); ctx.lineTo(18, 11); ctx.stroke(); break;
    case "grid":
      ctx.beginPath(); ctx.roundRect(3.5, 3.5, 7, 7, 1.6); ctx.stroke();
      ctx.beginPath(); ctx.roundRect(13.5, 3.5, 7, 7, 1.6); ctx.stroke();
      ctx.beginPath(); ctx.roundRect(3.5, 13.5, 7, 7, 1.6); ctx.stroke();
      ctx.beginPath(); ctx.roundRect(13.5, 13.5, 7, 7, 1.6); ctx.stroke(); break;
    case "receipt":
      ctx.beginPath(); ctx.moveTo(5.5, 3); ctx.lineTo(18.5, 3); ctx.lineTo(18.5, 21); ctx.lineTo(15.5, 18.6); ctx.lineTo(12, 21); ctx.lineTo(8.5, 18.6); ctx.lineTo(5.5, 21); ctx.closePath(); ctx.stroke();
      ctx.beginPath(); for (let i = 0; i < 3; i++) { ctx.moveTo(8.5, 8 + i * 3.4); ctx.lineTo(15.5, 8 + i * 3.4); } ctx.stroke(); break;
    case "box":
      ctx.beginPath(); ctx.moveTo(12, 2.6); ctx.lineTo(21, 7.6); ctx.lineTo(21, 16.8); ctx.lineTo(12, 21.6); ctx.lineTo(3, 16.8); ctx.lineTo(3, 7.6); ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(3, 7.6); ctx.lineTo(12, 12.4); ctx.lineTo(21, 7.6); ctx.moveTo(12, 12.4); ctx.lineTo(12, 21.6); ctx.stroke(); break;
    default: break;
  }
  ctx.restore();
}

/* ---------- images ---------- */
const IMG = {};
function setImages(map) { Object.assign(IMG, map); }
function thumb(ctx, key, x, y, w, h, r = 14, fallback = "#2B2B2B") {
  ctx.save();
  rr(ctx, x, y, w, h, r);
  ctx.clip();
  const img = IMG[key];
  if (img) {
    const ar = img.width / img.height;
    const tr = w / h;
    let dw = w, dh = h, dx = x, dy = y;
    if (ar > tr) { dw = h * ar; dx = x - (dw - w) / 2; } else { dh = w / ar; dy = y - (dh - h) / 2; }
    ctx.drawImage(img, dx, dy, dw, dh);
  } else {
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, fallback);
    g.addColorStop(1, mix(fallback, P.green, 0.25));
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    icon(ctx, "food", x + w / 2 - 12, y + h / 2 - 12, 24, "rgba(248,248,248,0.35)");
  }
  ctx.restore();
}

/* ---------- shared chrome ---------- */
function statusBar(ctx, w, color = P.white) {
  const a = 0.55;
  fillRR(ctx, w - 58, 16, 26, 11, 3, rgba(color, a));
  fillRR(ctx, w - 26, 14, 18, 13, 4, rgba(color, a * 0.8));
  for (let i = 0; i < 3; i++) fillRR(ctx, 24 + i * 7, 20 - i * 3, 4, 7 + i * 3, 1.5, rgba(color, a * 0.85));
}
function bottomNav(ctx, w, h, active = 0, accent = P.green) {
  const items = ["home", "list", "wallet", "chat", "user"];
  const H0 = 92;
  ctx.save();
  const g = ctx.createLinearGradient(0, h - H0 - 30, 0, h);
  g.addColorStop(0, "rgba(15,15,15,0)");
  g.addColorStop(0.35, "rgba(15,15,15,0.92)");
  g.addColorStop(1, "#0F0F0F");
  ctx.fillStyle = g;
  ctx.fillRect(0, h - H0 - 30, w, H0 + 30);
  ctx.fillStyle = "rgba(248,248,248,0.07)";
  ctx.fillRect(0, h - H0, w, 1);
  const step = w / items.length;
  items.forEach((n, i) => {
    const cx = w - (step * i + step / 2);
    const on = i === active;
    icon(ctx, n, cx - 12, h - H0 + 24, 24, on ? accent : "rgba(248,248,248,0.45)");
    if (on) fillRR(ctx, cx - 10, h - 16, 20, 3, 2, accent);
  });
  ctx.restore();
}

function mapBase(ctx, x, y, w, h, t, opt = {}) {
  ctx.save();
  rr(ctx, x, y, w, h, opt.r === undefined ? 0 : opt.r);
  ctx.clip();
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, "#11170F");
  g.addColorStop(0.5, "#0D120C");
  g.addColorStop(1, "#0A0D0A");
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  // street network (isometric-ish)
  ctx.strokeStyle = "rgba(248,248,248,0.075)";
  ctx.lineWidth = 2;
  for (let i = -6; i < 14; i++) {
    ctx.beginPath();
    ctx.moveTo(x + i * 54, y - 20);
    ctx.lineTo(x + i * 54 + 160, y + h + 20);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + i * 54, y + h + 20);
    ctx.lineTo(x + i * 54 + 160, y - 20);
    ctx.stroke();
  }
  // blocks
  ctx.fillStyle = "rgba(93,214,44,0.045)";
  const rnd = (i) => (Math.sin(i * 12.9898) * 43758.5453) % 1;
  for (let i = 0; i < 26; i++) {
    const bx = x + ((rnd(i) + 1) / 2) * w, by = y + ((rnd(i + 40) + 1) / 2) * h;
    ctx.fillRect(bx, by, 18 + Math.abs(rnd(i + 9)) * 26, 12 + Math.abs(rnd(i + 3)) * 18);
  }
  if (opt.route) {
    ctx.strokeStyle = rgba(P.green, 0.92);
    ctx.lineWidth = opt.routeW || 7;
    ctx.lineCap = "round";
    ctx.shadowColor = rgba(P.green, 0.85);
    ctx.shadowBlur = 18;
    ctx.beginPath();
    opt.route.forEach((p, i) => (i ? ctx.lineTo(x + p[0] * w, y + p[1] * h) : ctx.moveTo(x + p[0] * w, y + p[1] * h)));
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
  ctx.restore();
  return { x, y, w, h };
}

module.exports = { P, rr, fillRR, card, bar, barG, pill, ripple, icon, thumb, IMG, setImages, statusBar, bottomNav, mapBase };
