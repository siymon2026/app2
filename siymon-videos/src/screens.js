"use strict";
const { rgba, mix, C, clamp, lerp, easeOut, easeInOut, easeOutBack, smoothstep } = require("./engine");
const U = require("./ui");
const { P, rr, fillRR, card, bar, barG, pill, ripple, icon, thumb, IMG, statusBar, bottomNav, mapBase, hexGrid } = U;

const RT = (w, pad, width) => w - pad - width;

/* =========================================================
   CUSTOMER — HOME
   ========================================================= */
function home(ctx, w, h, t, o = {}) {
  ctx.fillStyle = P.bg; ctx.fillRect(0, 0, w, h);
  const gl = ctx.createRadialGradient(w * 0.8, 150, 10, w * 0.8, 150, 420);
  gl.addColorStop(0, rgba(P.green, 0.16)); gl.addColorStop(1, rgba(P.green, 0));
  ctx.fillStyle = gl; ctx.fillRect(0, 0, w, 520);
  statusBar(ctx, w);

  /* header */
  const hy = 52;
  if (IMG.logo) {
    const s = 42;
    ctx.save(); rr(ctx, RT(w, 26, s), hy, s, s, 12); ctx.clip();
    ctx.drawImage(IMG.logo, RT(w, 26, s), hy, s, s);
    ctx.restore();
  } else fillRR(ctx, RT(w, 26, 42), hy, 42, 42, 12, P.green);
  bar(ctx, RT(w, 78, 92), hy + 4, 92, 15, 0.9);
  bar(ctx, RT(w, 78, 132), hy + 28, 132, 8, 0.3);
  const bellPulse = o.bell ? 1 : 0.4;
  icon(ctx, "bell", 26, hy + 6, 26, "rgba(248,248,248,0.85)");
  ctx.fillStyle = rgba(P.green, 0.55 + bellPulse * 0.45);
  ctx.beginPath(); ctx.arc(44, hy + 8, 4.2, 0, Math.PI * 2); ctx.fill();

  /* search */
  const sy = 118;
  card(ctx, 26, sy, w - 52, 58, 18, P.surface, "rgba(248,248,248,0.07)");
  icon(ctx, "search", RT(w - 26, 18, 22), sy + 18, 22, "rgba(248,248,248,0.5)");
  bar(ctx, RT(w - 74, 150), sy + 24, 150, 10, 0.22);
  fillRR(ctx, 36, sy + 12, 38, 34, 12, rgba(P.green, 0.18));
  icon(ctx, "list", 46, sy + 21, 18, P.green);

  /* category chips */
  const cy = 194;
  const cats = [
    { n: "food", w: 100, on: true },
    { n: "store", w: 96 },
    { n: "pill", w: 100 },
    { n: "box", w: 92 },
  ];
  let cx = w - 26 - cats.reduce((a, c) => a + c.w + 12, 0) + 12 + (o.chipShift || 0);
  const catsR = cats.slice().reverse();
  catsR.forEach((c, i) => {
    const y = cy + Math.sin(t * 1.4 + i) * 0.8;
    pill(ctx, cx, y, c.w, 56, c.on ? P.green : P.surface, c.on ? null : "rgba(248,248,248,0.08)");
    icon(ctx, c.n, cx + c.w - 42, y + 16, 24, c.on ? "#0F0F0F" : "rgba(248,248,248,0.8)");
    bar(ctx, cx + 16, y + 23, c.w - 64, 10, c.on ? 0.7 : 0.32);
    if (c.on) bar(ctx, cx + 16, y + 23, c.w - 64, 10, 0.85);
    cx += c.w + 12;
  });

  /* hero card */
  const hy2 = 268;
  const hg = ctx.createLinearGradient(26, hy2, w - 26, hy2 + 168);
  hg.addColorStop(0, "#2C6413"); hg.addColorStop(0.5, "#3E9A1B"); hg.addColorStop(1, "#5DD62C");
  fillRR(ctx, 26, hy2, w - 52, 168, 24, hg);
  ctx.save();
  rr(ctx, 26, hy2, w - 52, 168, 24); ctx.clip();
  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = "#0F0F0F"; ctx.lineWidth = 2;
  for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(w - 40, hy2 + 150, 40 + i * 26, Math.PI, Math.PI * 1.6); ctx.stroke(); }
  ctx.restore();
  bar(ctx, RT(w - 52, 24, 150), hy2 + 30, 150, 16, 0.9);
  bar(ctx, RT(w - 52, 24, 200), hy2 + 58, 200, 10, 0.55);
  fillRR(ctx, RT(w - 52, 30, 96), hy2 + 100, 96, 34, 17, "rgba(15,15,15,0.85)");
  barG(ctx, RT(w - 52, 30, 96) + 18, hy2 + 113, 60, 9, 0.9);
  // courier glyph inside the hero card
  ctx.save(); ctx.translate(126, hy2 + 96); ctx.scale(3.2, 3.2);
  ctx.strokeStyle = "rgba(10,16,8,0.62)"; ctx.lineWidth = 1.5; ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.beginPath(); ctx.arc(-8, 6, 3.4, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(8, 6, 3.4, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-8, 6); ctx.lineTo(-3, -1); ctx.lineTo(3, -1); ctx.lineTo(8, 6); ctx.lineTo(1, 6); ctx.lineTo(-3, -1); ctx.stroke();
  ctx.restore();

  /* section 1 : store cards */
  const sy2 = 462;
  bar(ctx, RT(w, 26, 132), sy2, 132, 14, 0.85);
  pill(ctx, 26, sy2 - 6, 84, 30, "rgba(248,248,248,0.07)");
  bar(ctx, 26 + 22, sy2 + 4, 40, 8, 0.3);
  const cards = [
    { img: "burger", wide: 226 },
    { img: "pizza", wide: 226 },
    { img: "grocery", wide: 226 },
  ];
  let kx = w - 26 - (o.hScroll || 0);
  cards.forEach((c, i) => {
    const x = kx - c.wide;
    const y = sy2 + 40;
    const app = easeOut(clamp((t - 0.15 - i * 0.12) / 0.7));
    ctx.save();
    ctx.globalAlpha = app;
    ctx.translate(0, (1 - app) * 40);
    card(ctx, x, y, c.wide, 214, 20, P.surface, "rgba(248,248,248,0.07)");
    thumb(ctx, c.img, x + 8, y + 8, c.wide - 16, 118, 15);
    bar(ctx, x + 18, y + 140, 120, 12, 0.8);
    bar(ctx, x + 18, y + 162, 78, 8, 0.28);
    icon(ctx, "star", x + c.wide - 74, y + 162, 13, P.green);
    bar(ctx, x + c.wide - 56, y + 163, 24, 7, 0.5);
    pill(ctx, x + 18, y + 182, 72, 22, rgba(P.green, 0.14));
    icon(ctx, "clock", x + 52, y + 187, 11, P.green);
    barG(ctx, x + 24, y + 190, 34, 6, 0.75);
    ctx.restore();
    kx -= c.wide + 14;
  });

  /* section 2 rows */
  const ry = 756;
  bar(ctx, RT(w, 26, 108), ry, 108, 14, 0.85);
  for (let i = 0; i < 2; i++) {
    const y = ry + 34 + i * 96;
    card(ctx, 26, y, w - 52, 84, 18, i === 0 ? "#242922" : P.surface, "rgba(248,248,248,0.06)");
    thumb(ctx, i === 0 ? "pharmacy" : "drinks", RT(w - 26, 12, 64), y + 10, 64, 64, 14);
    bar(ctx, RT(w - 26, 88, 150), y + 22, 150, 12, 0.78);
    bar(ctx, RT(w - 26, 88, 96), y + 46, 96, 8, 0.26);
    icon(ctx, "chevron", 40, y + 32, 20, "rgba(248,248,248,0.35)");
  }
  if (o.tap) {
    const tp = clamp(o.tap.p);
    ripple(ctx, o.tap.x, o.tap.y, 18 + tp * 60, (1 - tp) * 0.9);
    glowLocal(ctx, o.tap.x, o.tap.y, 46, P.green, 0.28 * (1 - tp));
  }
  bottomNav(ctx, w, h, 0);
}

/* =========================================================
   CUSTOMER — STORE MENU
   ========================================================= */
function store(ctx, w, h, t, o = {}) {
  ctx.fillStyle = P.bg; ctx.fillRect(0, 0, w, h);
  /* cover */
  ctx.save();
  rr(ctx, 0, 0, w, 300, 0); ctx.clip();
  thumb(ctx, "restaurant", -30, -40, w + 60, 340, 0, "#1E241D");
  const cg = ctx.createLinearGradient(0, 120, 0, 300);
  cg.addColorStop(0, "rgba(15,15,15,0)"); cg.addColorStop(0.6, "rgba(15,15,15,0.75)"); cg.addColorStop(1, P.bg);
  ctx.fillStyle = cg; ctx.fillRect(0, 0, w, 300);
  ctx.restore();
  statusBar(ctx, w);
  pill(ctx, RT(w, 20, 42), 44, 42, 42, "rgba(15,15,15,0.6)", "rgba(248,248,248,0.16)");
  icon(ctx, "chevron", RT(w, 20, 42) + 13, 55, 18, P.white);
  pill(ctx, 20, 44, 42, 42, "rgba(15,15,15,0.6)", "rgba(248,248,248,0.16)");
  icon(ctx, "star", 31, 55, 19, P.green);
  /* title block */
  bar(ctx, RT(w, 26, 210), 196, 210, 20, 0.92);
  bar(ctx, RT(w, 26, 140), 226, 140, 10, 0.3);
  const pills = [[86, "clock", "12"], [96, "bike", "9"], [78, "star", "7"]];
  let px = w - 26;
  pills.forEach(([pw, ic, ww]) => {
    pill(ctx, px - pw, 252, pw, 32, "rgba(248,248,248,0.08)");
    icon(ctx, ic, px - 22, 259, 17, P.green);
    bar(ctx, px - 20 - ww, 264, ww, 8, 0.55);
    px -= pw + 10;
  });
  /* tabs */
  const ty = 306;
  ctx.fillStyle = "rgba(248,248,248,0.08)"; ctx.fillRect(0, ty + 44, w, 1);
  let tx = w - 26;
  [110, 88, 96].forEach((tw, i) => {
    bar(ctx, tx - tw, ty + 14, tw, 11, i === 0 ? 0.85 : 0.25);
    if (i === 0) fillRR(ctx, tx - tw, ty + 40, tw, 4, 2, P.green);
    tx -= tw + 26;
  });
  /* product grid */
  const gx = 26, gy = 372;
  const cw = (w - 26 * 2 - 14) / 2, chh = 236;
  const items = [
    { img: "burger", sel: o.sel1 },
    { img: "pizza", sel: o.sel2 },
    { img: "salad", sel: o.sel3 },
    { img: "drinks", sel: o.sel4 },
  ];
  items.forEach((it, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = col === 0 ? w - 26 - cw : 26;
    const y = gy + row * (chh + 14) - (o.scroll || 0);
    if (y > h - 60 || y < 300) return;
    const pressed = it.sel ? 1 : 0;
    card(ctx, x, y, cw, chh, 20, pressed ? "#26301F" : P.surface, pressed ? rgba(P.green, 0.55) : "rgba(248,248,248,0.06)");
    thumb(ctx, it.img, x + 8, y + 8, cw - 16, 124, 15);
    bar(ctx, x + 14, y + 146, cw - 60, 12, 0.8);
    bar(ctx, x + 14, y + 168, cw - 96, 8, 0.25);
    barG(ctx, x + 14, y + 196, 46, 11, 0.85);
    /* add button */
    const bx = x + cw - 52, by = y + 184;
    fillRR(ctx, bx, by, 38, 38, 13, pressed ? P.green : "rgba(93,214,44,0.16)");
    icon(ctx, pressed ? "check" : "plus", bx + 9, by + 9, 20, pressed ? "#0F0F0F" : P.green, 2.4);
    if (pressed && o.press) ripple(ctx, bx + 19, by + 19, 20 + o.press * 26, (1 - o.press) * 0.8);
  });
  /* cart bar */
  const cby = h - 118;
  const cbg = ctx.createLinearGradient(26, cby, w - 26, cby);
  cbg.addColorStop(0, "#4CB822"); cbg.addColorStop(1, P.green);
  fillRR(ctx, 26, cby, w - 52, 66, 20, cbg);
  ctx.save();
  ctx.shadowColor = rgba(P.green, 0.55); ctx.shadowBlur = 26;
  fillRR(ctx, 26, cby, w - 52, 66, 20, "rgba(0,0,0,0.001)");
  ctx.restore();
  icon(ctx, "bag", 44, cby + 20, 26, "#0F0F0F");
  bar(ctx, RT(w - 26, 96, 96), cby + 20, 96, 11, 0.75);
  bar(ctx, RT(w - 26, 96, 60), cby + 40, 60, 8, 0.45);
  if (o.fly) {
    for (const f of o.fly) {
      const p = clamp(f.p);
      const x0 = w - 26 - 52, y0 = cby + 33;
      const t2 = clamp(p);
      const x = lerp(f.x, x0, easeInOut(t2));
      const y = lerp(f.y, y0, easeInOut(t2)) - Math.sin(Math.PI * t2) * 70;
      if (p > 0 && p < 1) {
        glowLocal(ctx, x, y, 40, P.green, 0.5 * (1 - p * 0.5));
        ctx.save();
        ctx.globalAlpha = p > 0.85 ? (1 - p) / 0.15 : 1;
        fillRR(ctx, x - 16, y - 16, 32, 32, 10, P.green);
        icon(ctx, "check", x - 10, y - 10, 20, "#0F0F0F", 2.6);
        ctx.restore();
      }
    }
  }
  /* count badge */
  const cnt = o.count === undefined ? 3 : o.count;
  fillRR(ctx, 40, cby - 10, 30, 26, 13, "#0F0F0F");
  if (cnt > 0) {
    for (let i = 0; i < Math.min(3, cnt); i++) fillRR(ctx, 47 + i * 7, cby + 3, 5, 10, 2.5, P.green);
  }
}

/* =========================================================
   CUSTOMER — CART / CHECKOUT
   ========================================================= */
function cart(ctx, w, h, t, o = {}) {
  ctx.fillStyle = P.bg; ctx.fillRect(0, 0, w, h);
  statusBar(ctx, w);
  pill(ctx, RT(w, 20, 42), 48, 42, 42, P.surface); icon(ctx, "chevron", RT(w, 20, 42) + 13, 59, 18);
  bar(ctx, RT(w, 76, 120), 62, 120, 15, 0.85);

  const items = [
    { img: "burger", q: 2 },
    { img: "salad", q: 1 },
    { img: "drinks", q: 3 },
  ];
  items.forEach((it, i) => {
    const y = 126 + i * 108;
    card(ctx, 26, y, w - 52, 94, 18, P.surface, "rgba(248,248,248,0.06)");
    thumb(ctx, it.img, RT(w - 26, 8, 78), y + 8, 78, 78, 14);
    bar(ctx, RT(w - 26, 96, 128), y + 22, 128, 11, 0.78);
    bar(ctx, RT(w - 26, 96, 74), y + 44, 74, 8, 0.24);
    barG(ctx, RT(w - 26, 96, 44), y + 64, 44, 10, 0.8);
    /* stepper */
    pill(ctx, 42, y + 54, 92, 30, "rgba(248,248,248,0.07)");
    icon(ctx, "minus", 50, y + 62, 15, "rgba(248,248,248,0.65)");
    icon(ctx, "plus", 112, y + 62, 15, P.green);
    for (let k = 0; k < it.q; k++) fillRR(ctx, 78 + k * 0, y + 66, 5, 7, 2, P.white);
    fillRR(ctx, 74, y + 64, 22, 11, 5, "rgba(248,248,248,0.12)");
    bar(ctx, 80, y + 66, 10, 7, 0.8);
  });

  /* summary */
  const sy = 462;
  card(ctx, 26, sy, w - 52, 196, 18, P.surface, "rgba(248,248,248,0.06)");
  for (let i = 0; i < 3; i++) {
    const y = sy + 22 + i * 42;
    bar(ctx, RT(w - 42, 0, 92), y, 92, 9, 0.32);
    bar(ctx, 42, y, 62, 9, 0.5);
    if (i < 2) { ctx.fillStyle = "rgba(248,248,248,0.06)"; ctx.fillRect(42, y + 26, w - 84, 1); }
  }
  ctx.fillStyle = "rgba(248,248,248,0.10)"; ctx.fillRect(42, sy + 148, w - 84, 1);
  bar(ctx, RT(w - 42, 0, 110), sy + 162, 110, 12, 0.8);
  barG(ctx, 42, sy + 164, 84, 11, 0.95);

  /* payment row */
  const py = 678;
  bar(ctx, RT(w, 26, 118), py, 118, 13, 0.8);
  const methods = ["cash", "terminal", "wallet"];
  methods.forEach((m, i) => {
    const x = i === 0 ? w - 26 - 158 : i === 1 ? 26 + 168 - 158 : 0;
    const bx = w - 26 - 158 - i * 168;
    const sel = (o.pay || 0) === i;
    card(ctx, bx, py + 30, 158, 92, 18, sel ? "#26301F" : P.surface, sel ? P.green : "rgba(248,248,248,0.07)");
    icon(ctx, m, bx + 62, py + 46, 26, sel ? P.green : "rgba(248,248,248,0.6)");
    bar(ctx, bx + 30, py + 90, 98, 9, sel ? 0.8 : 0.3);
    if (sel) fillRR(ctx, bx + 12, py + 44, 22, 22, 11, P.green), icon(ctx, "check", bx + 17, py + 49, 12, "#0F0F0F", 2.6);
  });
  /* CTA */
  const cby = h - 132;
  const cbg = ctx.createLinearGradient(26, cby, w - 26, cby + 70);
  cbg.addColorStop(0, "#57C926"); cbg.addColorStop(1, P.green);
  ctx.save(); ctx.shadowColor = rgba(P.green, 0.4); ctx.shadowBlur = 28;
  fillRR(ctx, 26, cby, w - 52, 70, 22, cbg); ctx.restore();
  bar(ctx, RT(w - 26, 0, 150), cby + 30, 150, 12, 0.8);
  icon(ctx, "check", 52, cby + 22, 26, "rgba(15,15,15,0.85)", 2.6);
}

/* =========================================================
   CUSTOMER — ADDRESS / MAP
   ========================================================= */
function address(ctx, w, h, t, o = {}) {
  ctx.fillStyle = P.bg; ctx.fillRect(0, 0, w, h);
  mapBase(ctx, 0, 0, w, 640, t, {
    route: [[0.18, 0.86], [0.34, 0.66], [0.52, 0.7], [0.62, 0.46], [0.78, 0.36], [0.86, 0.2]],
    routeW: 8,
  });
  statusBar(ctx, w);
  pill(ctx, RT(w, 20, 42), 48, 42, 42, "rgba(15,15,15,0.72)", "rgba(248,248,248,0.14)");
  icon(ctx, "chevron", RT(w, 20, 42) + 13, 59, 18);
  /* pin */
  const pinX = w * 0.62, pinY = 300;
  const bob = Math.sin(t * 2.4) * 4;
  glowLocal(ctx, pinX, pinY - 44 + bob, 90, P.green, 0.4);
  ctx.save();
  ctx.translate(pinX, pinY - 10 + bob);
  ctx.fillStyle = P.green;
  ctx.beginPath(); ctx.moveTo(0, 24); ctx.bezierCurveTo(0, 24, 22, 0, 22, -14); ctx.arc(0, -14, 22, 0, Math.PI * 2); ctx.bezierCurveTo(-22, 0, 0, 24, 0, 24); ctx.closePath();
  ctx.shadowColor = rgba(P.green, 0.85); ctx.shadowBlur = 28; ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#0F0F0F";
  ctx.beginPath(); ctx.arc(0, -14, 8, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = rgba(P.green, 0.5 * (1 - ((t * 0.7) % 1)));
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(pinX, pinY + 14, 30 + ((t * 0.7) % 1) * 80, 12 + ((t * 0.7) % 1) * 30, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();

  /* sheet */
  const sy = 600;
  const sg = ctx.createLinearGradient(0, sy - 40, 0, sy + 60);
  sg.addColorStop(0, "rgba(15,15,15,0)"); sg.addColorStop(1, P.bg);
  ctx.fillStyle = sg; ctx.fillRect(0, sy - 40, w, 100);
  ctx.fillStyle = P.bg; ctx.fillRect(0, sy + 30, w, h - sy);
  fillRR(ctx, w / 2 - 40, sy + 4, 80, 5, 3, "rgba(248,248,248,0.18)");
  bar(ctx, RT(w, 26, 150), sy + 34, 150, 15, 0.85);
  card(ctx, 26, sy + 70, w - 52, 86, 18, "#242922", rgba(P.green, 0.45));
  fillRR(ctx, RT(w - 26, 12, 44), sy + 88, 44, 44, 14, rgba(P.green, 0.18));
  icon(ctx, "pin", RT(w - 26, 12, 44) + 11, sy + 99, 22, P.green);
  bar(ctx, RT(w - 26, 70, 150), sy + 92, 150, 11, 0.8);
  bar(ctx, RT(w - 26, 70, 190), sy + 114, 190, 8, 0.3);
  icon(ctx, "check", RT(w - 26, 70, 190) + 0, sy + 112, 0);
  card(ctx, 26, sy + 168, w - 52, 74, 18, P.surface, "rgba(248,248,248,0.06)");
  fillRR(ctx, RT(w - 26, 12, 40), sy + 185, 40, 40, 13, "rgba(248,248,248,0.07)");
  icon(ctx, "home", RT(w - 26, 12, 40) + 10, sy + 194, 20, "rgba(248,248,248,0.65)");
  bar(ctx, RT(w - 26, 64, 120), sy + 190, 120, 10, 0.6);
  bar(ctx, RT(w - 26, 64, 160), sy + 210, 160, 8, 0.24);
  fillRR(ctx, w - 26 - 40, sy + 189, 40, 32, 12, "rgba(248,248,248,0.05)");
  icon(ctx, "plus", w - 26 - 31, sy + 195, 16, P.green);
  const cby = h - 118;
  const cbg = ctx.createLinearGradient(26, cby, w - 26, cby + 68);
  cbg.addColorStop(0, "#57C926"); cbg.addColorStop(1, P.green);
  ctx.save(); ctx.shadowColor = rgba(P.green, 0.45); ctx.shadowBlur = 26;
  fillRR(ctx, 26, cby, w - 52, 68, 22, cbg); ctx.restore();
  bar(ctx, RT(w - 26, 0, 160), cby + 29, 160, 12, 0.8);
}
function glowLocal(ctx, x, y, r, color, a) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, a)); g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}

/* =========================================================
   CUSTOMER — LIVE TRACKING
   ========================================================= */
function track(ctx, w, h, t, o = {}) {
  ctx.fillStyle = P.bg; ctx.fillRect(0, 0, w, h);
  const mh = 620;
  mapBase(ctx, 0, 0, w, mh, t, {
    route: [[0.16, 0.2], [0.3, 0.4], [0.46, 0.42], [0.56, 0.62], [0.74, 0.66], [0.82, 0.86]],
    routeW: 8,
  });
  const prog = clamp(o.progress === undefined ? 0.4 : o.progress);
  // scooter marker along route
  const pts = [[0.16, 0.2], [0.3, 0.4], [0.46, 0.42], [0.56, 0.62], [0.74, 0.66], [0.82, 0.86]];
  const rp = samplePath(pts, 1 - prog); // RTL: start at restaurant (top) → customer
  const mx = rp[0] * w, my = rp[1] * mh;
  glowLocal(ctx, mx, my, 54, P.green, 0.45);
  fillRR(ctx, mx - 21, my - 21, 42, 42, 21, P.green);
  icon(ctx, "bike", mx - 13, my - 13, 26, "#0F0F0F", 2.2);
  const hp = pts[pts.length - 1], hp2 = pts[0];
  glowLocal(ctx, hp2[0] * w, hp2[1] * mh, 34, P.green, 0.5);
  fillRR(ctx, hp2[0] * w - 9, hp2[1] * mh - 9, 18, 18, 9, P.green);
  glowLocal(ctx, hp[0] * w, hp[1] * mh, 34, P.white, 0.45);
  fillRR(ctx, hp[0] * w - 9, hp[1] * mh - 9, 18, 18, 9, P.white);

  statusBar(ctx, w);
  pill(ctx, 20, 48, 46, 46, "rgba(15,15,15,0.7)", "rgba(248,248,248,0.14)");
  icon(ctx, "list", 30, 58, 26, P.white);
  pill(ctx, RT(w, 20, 190), 48, 190, 46, "rgba(15,15,15,0.72)", "rgba(248,248,248,0.14)");
  icon(ctx, "clock", RT(w, 20, 190) + 16, 61, 20, P.green);
  bar(ctx, RT(w, 20, 190) + 46, 66, 92, 10, 0.7);
  bar(ctx, RT(w, 20, 190) + 46, 80, 54, 7, 0.28);

  /* sheet */
  const sy = 560;
  const sg = ctx.createLinearGradient(0, sy - 60, 0, sy + 90);
  sg.addColorStop(0, "rgba(15,15,15,0)"); sg.addColorStop(1, P.bg);
  ctx.fillStyle = sg; ctx.fillRect(0, sy - 60, w, 150);
  ctx.fillStyle = P.bg; ctx.fillRect(0, sy + 60, w, h - sy);
  fillRR(ctx, w / 2 - 40, sy + 34, 80, 5, 3, "rgba(248,248,248,0.18)");

  const steps = ["restaurant", "bag", "bike", "pin", "check"];
  const stepI = o.step === undefined ? 2 : o.step;
  const sy2 = sy + 66;
  ctx.fillStyle = "rgba(248,248,248,0.10)";
  ctx.fillRect(w - 26 - 5, sy2 + 18, 2, 4 * 44);
  steps.forEach((s, i) => {
    const y = sy2 + 18 + i * 44;
    const done = i < stepI, cur = i === stepI;
    ctx.fillStyle = done || cur ? P.green : "rgba(248,248,248,0.16)";
    ctx.beginPath(); ctx.arc(w - 26 - 4, y, cur ? 7 : 4.5, 0, Math.PI * 2); ctx.fill();
    if (cur) { ctx.strokeStyle = rgba(P.green, 0.35); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(w - 26 - 4, y, 13, 0, Math.PI * 2); ctx.stroke(); }
    bar(ctx, RT(w - 26, 24, 150), y - 6, 150, 10, cur ? 0.85 : done ? 0.4 : 0.2);
    if (cur) {
      pill(ctx, w - 26 - 190, y - 16, 62, 24, rgba(P.green, 0.16));
      barG(ctx, w - 26 - 178, y - 9, 38, 9, 0.85);
    }
  });

  /* driver card */
  const dy = sy + 66 + 4 * 44 + 26;
  card(ctx, 26, dy, w - 52, 96, 20, P.surface, "rgba(248,248,248,0.07)");
  ctx.save();
  ctx.beginPath(); ctx.arc(RT(w - 26, 14, 68), dy + 48, 34, 0, Math.PI * 2); ctx.clip();
  thumb(ctx, "driver", RT(w - 26, 14, 68), dy + 14, 68, 68, 34, "#2A332A");
  ctx.restore();
  ctx.strokeStyle = rgba(P.green, 0.6); ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(RT(w - 26, 14, 68), dy + 48, 34, 0, Math.PI * 2); ctx.stroke();
  bar(ctx, RT(w - 26, 96, 130), dy + 28, 130, 11, 0.8);
  bar(ctx, RT(w - 26, 96, 84), dy + 50, 84, 8, 0.28);
  icon(ctx, "star", RT(w - 26, 96, 200), dy + 49, 13, P.green);
  bar(ctx, RT(w - 26, 96, 214), dy + 50, 30, 7, 0.5);
  for (let i = 0; i < 2; i++) {
    const bx = 40 + i * 52;
    fillRR(ctx, bx, dy + 32, 42, 42, 14, i === 0 ? rgba(P.green, 0.18) : "rgba(248,248,248,0.07)");
    icon(ctx, i === 0 ? "chat" : "phone", bx + 10, dy + 42, 22, i === 0 ? P.green : "rgba(248,248,248,0.7)");
  }
}

function samplePath(pts, t) {
  const n = pts.length - 1;
  const x = clamp(t) * n, i = Math.min(n - 1, Math.floor(x)), f = x - i;
  return [lerp(pts[i][0], pts[i + 1][0], f), lerp(pts[i][1], pts[i + 1][1], f)];
}

/* =========================================================
   CUSTOMER — ORDER CONFIRMED overlay screen
   ========================================================= */
function confirmed(ctx, w, h, t, o = {}) {
  ctx.fillStyle = P.bg; ctx.fillRect(0, 0, w, h);
  const p = clamp(o.p === undefined ? 1 : o.p);
  const cx = w / 2, cy = h * 0.34;
  glowLocal(ctx, cx, cy, 150 * p, P.green, 0.28 * p);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((1 - easeOut(p)) * -0.5);
  ctx.scale(lerp(0.4, 1, easeOut(p)), lerp(0.4, 1, easeOut(p)));
  ctx.fillStyle = P.green;
  ctx.beginPath(); ctx.arc(0, 0, 86, 0, Math.PI * 2); ctx.fill();
  icon(ctx, "check", -44, -44, 88 * 1, "#0F0F0F", 3.2);
  ctx.restore();
  bar(ctx, cx - 110, cy + 150, 220, 16, 0.85 * p);
  bar(ctx, cx - 70, cy + 182, 140, 10, 0.3 * p);
  /* steps lit */
  const sy = cy + 260;
  ["check", "bag", "bike"].forEach((n, i) => {
    const a = clamp((p - i * 0.18) / 0.3);
    const x = cx - 90 + i * 90;
    fillRR(ctx, x - 26, sy - 26, 52, 52, 18, rgba(P.green, 0.1 + 0.18 * a));
    icon(ctx, n, x - 13, sy - 13, 26, rgba(P.green, 0.3 + 0.7 * a));
    if (i < 2) { ctx.fillStyle = rgba(P.green, 0.25 * a); ctx.fillRect(x + 30, sy - 1, 30, 2); }
  });
}

/* =========================================================
   MERCHANT — TABLET DASHBOARD (orders)
   ========================================================= */
function dashOrders(ctx, w, h, t, o = {}) {
  ctx.fillStyle = "#0C0D0C"; ctx.fillRect(0, 0, w, h);
  const RAIL = 74, PANEL = 268;
  fillRR(ctx, w - RAIL, 0, RAIL, h, 0, "#131513");
  if (IMG.logo) { ctx.save(); rr(ctx, w - RAIL + 14, 24, 46, 46, 13); ctx.clip(); ctx.drawImage(IMG.logo, w - RAIL + 14, 24, 46, 46); ctx.restore(); }
  ["list", "grid", "chart", "wallet", "gear"].forEach((n, i) => {
    const y = 120 + i * 62;
    if (i === 0) fillRR(ctx, w - RAIL + 8, y - 12, 58, 48, 14, rgba(P.green, 0.16));
    icon(ctx, n, w - RAIL + 22, y, 26, i === 0 ? P.green : "rgba(248,248,248,0.4)");
  });
  const cw = w - RAIL;
  fillRR(ctx, 0, 0, cw, 92, 0, "#111312");
  bar(ctx, RT(cw, 24, 168), 26, 168, 16, 0.9);
  bar(ctx, RT(cw, 24, 108), 52, 108, 8, 0.28);
  pill(ctx, 24, 30, 128, 34, rgba(P.green, 0.14), rgba(P.green, 0.4));
  icon(ctx, "store", 34, 38, 18, P.green);
  barG(ctx, 60, 44, 66, 8, 0.85);
  /* tabs */
  const ty = 92;
  let tx = cw - 300;
  [[112, true], [96, false]].forEach(([tw, on], i) => {
    if (on) fillRR(ctx, tx - tw - 10, ty + 16, tw + 10, 44, 14, P.surface);
    bar(ctx, tx - tw, ty + 32, tw, 11, on ? 0.85 : 0.25);
    tx -= tw + 30;
  });
  /* table region */
  const rx0 = PANEL + 34, rW = cw - rx0 - 20;
  const rows = [{ hi: true, done: false }, { hi: false, done: false }, { hi: false, done: true }, { hi: false, done: true }];
  rows.forEach((r, i) => {
    const y = 160 + i * 96;
    const active = r.hi && o.hl !== false;
    card(ctx, rx0, y, rW, 84, 16, active ? "#1D2A17" : "#151715", active ? rgba(P.green, 0.5) : "rgba(248,248,248,0.05)");
    if (active) {
      const sg = ctx.createLinearGradient(rx0, y, rx0 + 24, y);
      sg.addColorStop(0, rgba(P.green, 0)); sg.addColorStop(1, rgba(P.green, 0.85));
      ctx.fillStyle = sg; ctx.fillRect(rx0 + rW - 26, y + 8, 26, 68);
    }
    // right: code + time
    bar(ctx, rx0 + rW - 92, y + 20, 62, 11, 0.75);
    bar(ctx, rx0 + rW - 92, y + 50, 44, 8, 0.25);
    // customer / total
    bar(ctx, rx0 + rW - 210, y + 20, 94, 10, 0.5);
    bar(ctx, rx0 + rW - 210, y + 50, 62, 8, 0.22);
    barG(ctx, rx0 + rW - 300, y + 28, 56, 12, 0.55);
    // status pill (left)
    pill(ctx, rx0 + 16, y + 26, 100, 32, r.done ? "rgba(248,248,248,0.07)" : rgba(P.green, 0.18));
    fillRR(ctx, rx0 + 26, y + 37, 10, 10, 5, r.done ? "rgba(248,248,248,0.4)" : P.green);
    bar(ctx, rx0 + 44, y + 37, 54, 9, r.done ? 0.28 : 0.75);
    if (active) {
      const bx = rx0 + 128, press = o.press || 0;
      const g = ctx.createLinearGradient(bx, y + 24, bx + 104, y + 24);
      g.addColorStop(0, "#57C926"); g.addColorStop(1, P.green);
      ctx.save();
      ctx.shadowColor = rgba(P.green, 0.45 + press * 0.4); ctx.shadowBlur = 14 + press * 20;
      fillRR(ctx, bx, y + 24, 104, 36, 13, g);
      ctx.restore();
      if (press > 0) { ctx.save(); ctx.globalAlpha = press * 0.9; fillRR(ctx, bx, y + 24, 104, 36, 13, "#E4FFD6"); ctx.restore(); }
      icon(ctx, "check", bx + 41, y + 32, 20, "#0F0F0F", 2.6);
      if (press > 0.85) ripple(ctx, bx + 52, y + 42, 26 + press * 34, (1 - press));
    }
  });
  /* details panel (left) */
  const dx = 20;
  card(ctx, dx, 160, PANEL, h - 200, 18, "#141614", "rgba(248,248,248,0.06)");
  bar(ctx, dx + 24, 186, 120, 13, 0.8);
  bar(ctx, dx + 24, 210, 78, 8, 0.25);
  for (let i = 0; i < 3; i++) {
    const y = 250 + i * 62;
    thumb(ctx, ["burger", "salad", "drinks"][i], dx + PANEL - 74, y, 54, 54, 10);
    bar(ctx, dx + 40, y + 12, 96, 9, 0.6);
    bar(ctx, dx + 40, y + 30, 52, 7, 0.24);
    fillRR(ctx, dx + 20, y + 12, 12, 30, 6, "rgba(248,248,248,0.07)");
    bar(ctx, dx + PANEL - 96, y + 20, 16, 8, 0.35);
  }
  ctx.fillStyle = "rgba(248,248,248,0.08)";
  ctx.fillRect(dx + 20, h - 190, PANEL - 40, 1);
  bar(ctx, dx + 24, h - 172, 90, 9, 0.35);
  bar(ctx, dx + PANEL - 84, h - 176, 60, 12, 0.85);
}

function dashProducts(ctx, w, h, t, o = {}) {
  ctx.fillStyle = "#0C0D0C"; ctx.fillRect(0, 0, w, h);
  fillRR(ctx, w - 74, 0, 74, h, 0, "#131513");
  if (IMG.logo) { ctx.save(); rr(ctx, w - 62, 24, 46, 46, 13); ctx.clip(); ctx.drawImage(IMG.logo, w - 62, 24, 46, 46); ctx.restore(); }
  ["list", "grid", "chart", "wallet", "gear"].forEach((n, i) => {
    const y = 120 + i * 62;
    if (i === 1) fillRR(ctx, w - 68, y - 12, 58, 48, 14, rgba(P.green, 0.16));
    icon(ctx, n, w - 54, y, 26, i === 1 ? P.green : "rgba(248,248,248,0.4)");
  });
  const cw = w - 74;
  fillRR(ctx, 0, 0, cw, 92, 0, "#111312");
  bar(ctx, RT(cw, 24, 152), 26, 152, 16, 0.9);
  bar(ctx, RT(cw, 24, 96), 52, 96, 8, 0.28);
  /* add product button */
  const bx = 24;
  ctx.save(); ctx.shadowColor = rgba(P.green, 0.45); ctx.shadowBlur = 16;
  fillRR(ctx, bx, 28, 148, 40, 14, P.green); ctx.restore();
  icon(ctx, "plus", bx + 100, 38, 20, "#0F0F0F", 2.6);
  bar(ctx, bx + 22, 44, 66, 9, 0.75);
  /* product grid */
  const items = [
    { img: "burger", on: true },
    { img: "pizza", on: true },
    { img: "salad", on: false },
    { img: "drinks", on: true },
    { img: "grocery", on: true },
    { img: "pharmacy", on: false },
  ];
  const gw = 162, gh = 176, gap = 16;
  items.forEach((it, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const x = cw - 24 - gw - col * (gw + gap);
    const y = 122 + row * (gh + gap);
    const toggle = (o.toggles && o.toggles[i]) || 0;
    const on = it.on ? true : toggle > 0.5;
    card(ctx, x, y, gw, gh, 16, "#151715", "rgba(248,248,248,0.06)");
    thumb(ctx, it.img, x + 8, y + 8, gw - 16, 84, 12, "#222");
    bar(ctx, x + 12, y + 102, gw - 48, 10, 0.75);
    barG(ctx, x + 12, y + 122, 40, 9, 0.7);
    /* availability switch */
    const sw = x + gw - 52, sy = y + 116;
    pill(ctx, sw, sy, 40, 22, on ? P.green : "rgba(248,248,248,0.16)");
    const knobX = on ? sw + 20 : sw + 2;
    ctx.fillStyle = "#0F0F0F";
    ctx.beginPath(); ctx.arc(knobX + 9, sy + 11, 8, 0, Math.PI * 2); ctx.fill();
    if (toggle > 0 && toggle < 1) glowLocal(ctx, sw + 20, sy + 11, 26, P.green, (1 - toggle) * 0.5);
  });
  /* add-product sheet */
  if (o.sheet) {
    const p = clamp(o.sheet);
    ctx.fillStyle = `rgba(0,0,0,${0.55 * p})`;
    ctx.fillRect(0, 0, cw, h);
    const sh = h * 0.9;
    const y0 = h - sh * easeOut(p);
    fillRR(ctx, 0, y0, cw, sh + 20, 26, "#17191700");
    fillRR(ctx, 0, y0, cw, sh + 20, 26, "#171917");
    fillRR(ctx, cw / 2 - 34, y0 + 14, 68, 5, 3, "rgba(248,248,248,0.2)");
    bar(ctx, RT(cw, 26, 130), y0 + 40, 130, 14, 0.85);
    /* image drop zone */
    const iz = 90;
    card(ctx, 26, y0 + 74, cw - 52, 150, 16, "#1D1F1D", "rgba(248,248,248,0.10)");
    if (IMG.salad) { ctx.save(); rr(ctx, 26 + 8, y0 + 82, 190, 134, 12); ctx.clip(); ctx.drawImage(IMG.salad, 34, y0 + 82, 190, 134); ctx.restore(); }
    ctx.save(); ctx.globalAlpha = 0.35 * (1 - clamp((o.img || 0)));
    icon(ctx, "eye", 250, y0 + 130, 34, P.green); ctx.restore();
    bar(ctx, 268, y0 + 108, 96, 10, 0.5);
    bar(ctx, 268, y0 + 130, 66, 8, 0.24);
    /* fields */
    for (let i = 0; i < 3; i++) {
      const y = y0 + 244 + i * 74;
      bar(ctx, RT(cw, 26, 84), y, 84, 9, 0.35);
      card(ctx, 26, y + 20, cw - 52, 46, 12, "#1D1F1D", "rgba(248,248,248,0.08)");
      bar(ctx, RT(cw, 40, 120 + i * 26), y + 38, 120 + i * 26, 9, 0.55);
    }
    /* save */
    const sy2 = y0 + sh - 86;
    ctx.save(); ctx.shadowColor = rgba(P.green, 0.4); ctx.shadowBlur = 18;
    fillRR(ctx, 26, sy2, cw - 52, 58, 18, P.green); ctx.restore();
    bar(ctx, cw / 2 - 50, sy2 + 24, 100, 11, 0.8);
    if (o.saved) {
      fillRR(ctx, 26, sy2, cw - 52, 58, 18, "#DFFFD0");
      icon(ctx, "check", cw / 2 - 15, sy2 + 14, 30, "#0F0F0F", 2.8);
    }
  }
}

/* =========================================================
   DRIVER — HOME / ONLINE
   ========================================================= */
function driverHome(ctx, w, h, t, o = {}) {
  ctx.fillStyle = P.bg; ctx.fillRect(0, 0, w, h);
  statusBar(ctx, w);
  const on = clamp(o.online === undefined ? 1 : o.online);
  /* header */
  ctx.save();
  ctx.beginPath(); ctx.arc(RT(w, 26, 54), 66, 27, 0, Math.PI * 2); ctx.clip();
  thumb(ctx, "driver", RT(w, 26, 54), 39, 54, 54, 27, "#2A332A");
  ctx.restore();
  ctx.strokeStyle = rgba(P.green, 0.5 + on * 0.4); ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(RT(w, 26, 54), 66, 27, 0, Math.PI * 2); ctx.stroke();
  bar(ctx, RT(w, 94, 120), 52, 120, 12, 0.85);
  bar(ctx, RT(w, 94, 78), 74, 78, 8, 0.3);
  icon(ctx, "bell", 26, 54, 26, "rgba(248,248,248,0.8)");

  /* online card */
  const cy = 112;
  const g = ctx.createLinearGradient(26, cy, w - 26, cy + 210);
  if (on > 0.5) { g.addColorStop(0, "#2E6A16"); g.addColorStop(1, "#5DD62C"); }
  else { g.addColorStop(0, "#262826"); g.addColorStop(1, "#323532"); }
  fillRR(ctx, 26, cy, w - 52, 210, 26, g);
  if (on > 0.5) {
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    glowLocal(ctx, 26 + 100, cy + 105, 120 * (0.9 + Math.sin(t * 2) * 0.1), "#DFFFD0", 0.22 * on);
    ctx.restore();
  }
  const pcx = 26 + 96, pcy = cy + 105;
  ctx.fillStyle = on > 0.5 ? "rgba(15,15,15,0.22)" : "rgba(248,248,248,0.10)";
  ctx.beginPath(); ctx.arc(pcx, pcy, 56, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = on > 0.5 ? "#0F0F0F" : "rgba(248,248,248,0.35)";
  ctx.beginPath(); ctx.arc(pcx, pcy, 44, 0, Math.PI * 2); ctx.fill();
  icon(ctx, "power", pcx - 18, pcy - 18, 36, on > 0.5 ? P.green : "#0F0F0F", 2.6);
  if (on > 0.5) {
    const ringP = (t * 0.6) % 1;
    ctx.strokeStyle = rgba("#DFFFD0", (1 - ringP) * 0.5); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(pcx, pcy, 56 + ringP * 30, 0, Math.PI * 2); ctx.stroke();
  }
  bar(ctx, RT(w - 26, 150, 148), cy + 74, 148, 15, on > 0.5 ? 0.85 : 0.4);
  bar(ctx, RT(w - 26, 150, 108), cy + 104, 108, 9, on > 0.5 ? 0.45 : 0.22);
  pill(ctx, RT(w - 26, 150, 118), cy + 132, 118, 30, on > 0.5 ? "rgba(15,15,15,0.28)" : "rgba(248,248,248,0.08)");
  fillRR(ctx, RT(w - 26, 150, 118) + 12, cy + 141, 12, 12, 6, on > 0.5 ? "#0F0F0F" : "rgba(248,248,248,0.4)");
  bar(ctx, RT(w - 26, 150, 118) + 32, cy + 144, 66, 8, on > 0.5 ? 0.6 : 0.25);

  /* mini map */
  mapBase(ctx, 26, cy + 232, w - 52, 190, t, { r: 22, route: [[0.2, 0.8], [0.4, 0.6], [0.6, 0.65], [0.8, 0.3]], routeW: 6 });
  const mp = samplePath([[0.2, 0.8], [0.4, 0.6], [0.6, 0.65], [0.8, 0.3]], clamp(o.drive || 0.35));
  glowLocal(ctx, 26 + mp[0] * (w - 52), cy + 232 + mp[1] * 190, 34, P.green, 0.45);
  fillRR(ctx, 26 + mp[0] * (w - 52) - 13, cy + 232 + mp[1] * 190 - 13, 26, 26, 13, P.green);
  icon(ctx, "bike", 26 + mp[0] * (w - 52) - 9, cy + 232 + mp[1] * 190 - 9, 18, "#0F0F0F", 2);

  /* stats */
  const stY = cy + 444;
  [["wallet", 0], ["bag", 1]].forEach(([ic, i]) => {
    const x = i === 0 ? 26 : w / 2 + 7;
    card(ctx, x, stY, w / 2 - 33, 112, 20, P.surface, "rgba(248,248,248,0.07)");
    fillRR(ctx, x + 18, stY + 16, 36, 36, 12, rgba(P.green, 0.16));
    icon(ctx, ic, x + 26, stY + 24, 20, P.green);
    bar(ctx, x + 18, stY + 64, 84, 13, 0.8);
    bar(ctx, x + 18, stY + 86, 56, 8, 0.26);
  });

  /* active order card */
  const ay = stY + 132;
  card(ctx, 26, ay, w - 52, 104, 20, "#22261F", rgba(P.green, 0.35));
  fillRR(ctx, RT(w - 26, 12, 46), ay + 16, 46, 46, 14, rgba(P.green, 0.18));
  icon(ctx, "bag", RT(w - 26, 12, 46) + 11, ay + 27, 24, P.green);
  bar(ctx, RT(w - 26, 70, 140), ay + 22, 140, 11, 0.8);
  bar(ctx, RT(w - 26, 70, 90), ay + 44, 90, 8, 0.28);
  fillRR(ctx, 40, ay + 58, 110, 30, 12, rgba(P.green, 0.2));
  icon(ctx, "chevron", 44, ay + 64, 16, P.green);
  bar(ctx, 66, ay + 69, 62, 8, 0.5);
  /* notification badge */
  ctx.fillStyle = P.green;
  ctx.beginPath(); ctx.arc(RT(w - 26, 12, 46) + 40, ay + 20, 9, 0, Math.PI * 2); ctx.fill();
  bottomNav(ctx, w, h, 0);
}

/* =========================================================
   DRIVER — OFFER SHEET
   ========================================================= */
function driverOffer(ctx, w, h, t, o = {}) {
  ctx.fillStyle = P.bg; ctx.fillRect(0, 0, w, h);
  mapBase(ctx, 0, 0, w, h, t, {});
  ctx.fillStyle = "rgba(9,10,9,0.62)"; ctx.fillRect(0, 0, w, h);
  hexGrid(ctx, 0, 0, w, h, t, { R: h * 0.040, cx: 0.62, cy: 0.42 });
  {
    const rt = [[0.16, 0.41], [0.34, 0.34], [0.52, 0.35], [0.72, 0.23]];
    ctx.save();
    ctx.strokeStyle = rgba(P.green, 0.95); ctx.lineWidth = 8; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.shadowColor = rgba(P.green, 0.9); ctx.shadowBlur = 18;
    ctx.beginPath();
    rt.forEach((p, i) => (i ? ctx.lineTo(p[0] * w, p[1] * h) : ctx.moveTo(p[0] * w, p[1] * h)));
    ctx.stroke();
    ctx.restore();
    // store pin + rider dot
    const sp = { x: rt[3][0] * w, y: rt[3][1] * h };
    glowLocal(ctx, sp.x, sp.y, 46, P.green, 0.5);
    fillRR(ctx, sp.x - 15, sp.y - 15, 30, 30, 10, P.green);
    icon(ctx, "store", sp.x - 9, sp.y - 9, 18, "#0F0F0F");
    const rp = { x: rt[0][0] * w, y: rt[0][1] * h };
    glowLocal(ctx, rp.x, rp.y, 40, P.green, 0.6);
    ctx.fillStyle = P.white; ctx.beginPath(); ctx.arc(rp.x, rp.y, 9, 0, Math.PI * 2); ctx.fill();
  }
  statusBar(ctx, w);
  const p = clamp(o.p === undefined ? 1 : o.p);
  const sh = 620;
  const y0 = h - sh * easeOutBack(p) * 0.98;
  ctx.save(); ctx.shadowColor = "rgba(0,0,0,0.7)"; ctx.shadowBlur = 40;
  fillRR(ctx, 0, y0, w, sh + 40, 30, "#171917"); ctx.restore();
  fillRR(ctx, w / 2 - 36, y0 + 14, 72, 5, 3, "rgba(248,248,248,0.2)");
  /* new order pill */
  pill(ctx, w / 2 - 78, y0 + 34, 156, 34, rgba(P.green, 0.16), rgba(P.green, 0.45));
  fillRR(ctx, w / 2 + 44, y0 + 46, 9, 9, 5, P.green);
  bar(ctx, w / 2 - 26, y0 + 47, 62, 9, 0.75);
  /* pickup -> dropoff */
  const rx = w - 54;
  const p1 = { x: rx, y: y0 + 100 }, p2 = { x: rx, y: y0 + 214 };
  ctx.strokeStyle = "rgba(248,248,248,0.18)"; ctx.lineWidth = 2; ctx.setLineDash([4, 6]);
  ctx.beginPath(); ctx.moveTo(p1.x, p1.y + 14); ctx.lineTo(p2.x, p2.y - 14); ctx.stroke(); ctx.setLineDash([]);
  glowLocal(ctx, p1.x, p1.y, 26, P.green, 0.4);
  fillRR(ctx, p1.x - 9, p1.y - 9, 18, 18, 9, P.green);
  ctx.strokeStyle = rgba(P.white, 0.5); ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(p2.x, p2.y, 8, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = P.white; ctx.beginPath(); ctx.arc(p2.x, p2.y, 3.4, 0, Math.PI * 2); ctx.fill();
  bar(ctx, RT(w - 70, 0, 168), y0 + 88, 168, 12, 0.8);
  bar(ctx, RT(w - 70, 0, 108), y0 + 110, 108, 8, 0.28);
  bar(ctx, RT(w - 70, 0, 150), y0 + 202, 150, 12, 0.8);
  bar(ctx, RT(w - 70, 0, 120), y0 + 224, 120, 8, 0.28);
  /* distance + earnings */
  const dy = y0 + 262;
  card(ctx, 26, dy, w - 52, 116, 20, "#1E211D", "rgba(248,248,248,0.07)");
  fillRR(ctx, RT(w - 26, 12, 44), dy + 18, 44, 44, 14, rgba(P.green, 0.14));
  icon(ctx, "bike", RT(w - 26, 12, 44) + 10, dy + 28, 24, P.green);
  bar(ctx, RT(w - 26, 68, 96), dy + 24, 96, 11, 0.7);
  bar(ctx, RT(w - 26, 68, 62), dy + 46, 62, 8, 0.26);
  ctx.fillStyle = "rgba(248,248,248,0.08)"; ctx.fillRect(w / 2 - 1, dy + 20, 1, 76);
  fillRR(ctx, 42, dy + 18, 40, 40, 13, rgba(P.green, 0.16));
  icon(ctx, "cash", 50, dy + 26, 24, P.green);
  barG(ctx, 42, dy + 70, 96, 16, 0.9);
  bar(ctx, 42, dy + 94, 58, 8, 0.3);
  /* accept / reject */
  const by = y0 + 404;
  card(ctx, 26, by, (w - 52) / 2 - 8, 66, 20, "rgba(248,248,248,0.07)", "rgba(248,248,248,0.10)");
  icon(ctx, "x", 0, 0, 0);
  bar(ctx, 26 + (w - 52) / 4 - 22, by + 29, 44, 10, 0.4);
  const ax = 26 + (w - 52) / 2 + 8;
  const press = clamp(o.accept || 0);
  const g2 = ctx.createLinearGradient(ax, by, ax + (w - 52) / 2 - 8, by);
  g2.addColorStop(0, "#57C926"); g2.addColorStop(1, P.green);
  ctx.save(); ctx.shadowColor = rgba(P.green, 0.45 + press * 0.5); ctx.shadowBlur = 20 + press * 26;
  fillRR(ctx, ax, by, (w - 52) / 2 - 8, 66, 20, g2); ctx.restore();
  if (press > 0) { ctx.save(); ctx.globalAlpha = press * 0.85; fillRR(ctx, ax, by, (w - 52) / 2 - 8, 66, 20, "#E6FFD8"); ctx.restore(); }
  bar(ctx, ax + ((w - 52) / 2 - 8) / 2 - 26, by + 28, 52, 11, 0.8);
  if (press > 0.85) ripple(ctx, ax + ((w - 52) / 2 - 8) / 2, by + 33, 24 + press * 50, (1 - press) * 0.9);
  bar(ctx, w / 2 - 46, y0 + 500, 92, 8, 0.18);
}

/* =========================================================
   DRIVER — ACTIVE TRIP
   ========================================================= */
function driverTrip(ctx, w, h, t, o = {}) {
  ctx.fillStyle = P.bg; ctx.fillRect(0, 0, w, h);
  mapBase(ctx, 0, 0, w, 760, t, { route: [[0.24, 0.82], [0.38, 0.62], [0.56, 0.58], [0.66, 0.34], [0.82, 0.2]], routeW: 9 });
  const prog = clamp(o.progress || 0.5);
  const pts = [[0.24, 0.82], [0.38, 0.62], [0.56, 0.58], [0.66, 0.34], [0.82, 0.2]];
  const mp = samplePath(pts, prog);
  glowLocal(ctx, mp[0] * w, mp[1] * 760, 46, P.green, 0.45);
  fillRR(ctx, mp[0] * w - 17, mp[1] * 760 - 17, 34, 34, 17, P.green);
  icon(ctx, "bike", mp[0] * w - 11, mp[1] * 760 - 11, 22, "#0F0F0F", 2.2);
  statusBar(ctx, w);
  pill(ctx, RT(w, 20, 46), 46, 46, 46, "rgba(15,15,15,0.7)", "rgba(248,248,248,0.14)");
  icon(ctx, "chevron", RT(w, 20, 46) + 14, 59, 20, P.white);
  pill(ctx, 20, 46, 168, 46, "rgba(15,15,15,0.72)", "rgba(248,248,248,0.14)");
  icon(ctx, "navigation", 0, 0, 0);
  fillRR(ctx, 32, 58, 10, 10, 5, P.green);
  bar(ctx, 52, 59, 96, 10, 0.7);
  /* sheet */
  const sy = 700;
  const sg = ctx.createLinearGradient(0, sy - 60, 0, sy + 80);
  sg.addColorStop(0, "rgba(15,15,15,0)"); sg.addColorStop(1, P.bg);
  ctx.fillStyle = sg; ctx.fillRect(0, sy - 60, w, 140);
  ctx.fillStyle = P.bg; ctx.fillRect(0, sy + 50, w, h - sy);
  const y0 = sy + 40;
  card(ctx, 26, y0, w - 52, 96, 20, "#22261F", rgba(P.green, 0.35));
  fillRR(ctx, RT(w - 26, 12, 50), y0 + 22, 50, 50, 15, rgba(P.green, 0.18));
  icon(ctx, "store", RT(w - 26, 12, 50) + 12, y0 + 34, 26, P.green);
  bar(ctx, RT(w - 26, 74, 148), y0 + 30, 148, 12, 0.85);
  bar(ctx, RT(w - 26, 74, 100), y0 + 54, 100, 8, 0.3);
  pill(ctx, 40, y0 + 36, 76, 26, rgba(P.green, 0.18));
  barG(ctx, 52, y0 + 45, 52, 8, 0.85);
  /* steps */
  const stp = y0 + 118;
  ["check", "bag", "bike"].forEach((n, i) => {
    const on = i <= (o.step === undefined ? 1 : o.step);
    fillRR(ctx, 26 + i * 64, stp, 48, 6, 3, on ? P.green : "rgba(248,248,248,0.12)");
  });
  /* primary action */
  const by = h - 128;
  const g = ctx.createLinearGradient(26, by, w - 26, by + 70);
  g.addColorStop(0, "#57C926"); g.addColorStop(1, P.green);
  ctx.save(); ctx.shadowColor = rgba(P.green, 0.45); ctx.shadowBlur = 26;
  fillRR(ctx, 26, by, w - 52, 70, 22, g); ctx.restore();
  icon(ctx, "check", 48, by + 22, 26, "rgba(15,15,15,0.85)", 2.8);
  bar(ctx, RT(w - 26, 0, 170), by + 30, 170, 12, 0.8);
}

/* =========================================================
   VERIFY CODE (driver enters code shown by store / customer)
   ========================================================= */
function verify(ctx, w, h, t, o = {}) {
  ctx.fillStyle = P.bg; ctx.fillRect(0, 0, w, h);
  const gl = ctx.createRadialGradient(w / 2, 300, 20, w / 2, 300, 420);
  gl.addColorStop(0, rgba(P.green, 0.14)); gl.addColorStop(1, rgba(P.green, 0));
  ctx.fillStyle = gl; ctx.fillRect(0, 0, w, 700);
  statusBar(ctx, w);
  pill(ctx, RT(w, 20, 46), 46, 46, 46, P.surface);
  icon(ctx, "chevron", RT(w, 20, 46) + 14, 59, 20);
  /* counterpart device card: code shown by the other party */
  const cp = clamp(o.show || 1);
  const cy = 150;
  ctx.save(); ctx.globalAlpha = 0.35 + 0.65 * cp;
  card(ctx, 60, cy, w - 120, 104, 20, "#1B1D1B", "rgba(248,248,248,0.10)");
  ctx.save();
  ctx.beginPath(); ctx.arc(60 + 52, cy + 52, 30, 0, Math.PI * 2); ctx.clip();
  thumb(ctx, o.who === "customer" ? "customer" : "storefront", 60 + 22, cy + 22, 60, 60, 30, "#222222");
  ctx.restore();
  bar(ctx, RT(w - 60, 96, 130), cy + 28, 130, 11, 0.7);
  bar(ctx, RT(w - 60, 96, 88), cy + 50, 88, 8, 0.28);
  /* 6 code digits as abstract filled blocks (no numerals) */
  for (let i = 0; i < 6; i++) {
    const filled = i < Math.round((o.digits || 0));
    fillRR(ctx, w - 60 - 20 - i * 26, cy + 68, 18, 6, 3, filled ? P.green : "rgba(248,248,248,0.16)");
  }
  ctx.restore();
  /* entry boxes */
  const by = 320;
  for (let i = 0; i < 6; i++) {
    const filled = i < Math.round((o.digits || 0));
    const x = w - 66 - i * 72;
    card(ctx, x, by, 60, 76, 16, filled ? "#26301F" : P.surface, filled ? P.green : "rgba(248,248,248,0.10)");
    if (filled) fillRR(ctx, x + 20, by + 33, 20, 10, 5, P.green);
    else fillRR(ctx, x + 28, by + 38, 4, 4, 2, "rgba(248,248,248,0.25)");
    if (filled && i === Math.round(o.digits) - 1 && o.digits % 1 > 0) glowLocal(ctx, x + 30, by + 38, 30, P.green, 0.5);
  }
  /* keypad (no numerals: abstract keys) */
  const kp = 460;
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 3; c++) {
      const x = 26 + c * 156, y = kp + r * 84;
      const pressKey = o.key === r * 3 + c ? o.keyP : 0;
      fillRR(ctx, x, y, 144, 68, 20, pressKey > 0.3 ? rgba(P.green, 0.22) : "rgba(248,248,248,0.055)");
      if (r === 3 && c === 2) { icon(ctx, "check", x + 58, y + 20, 28, P.green, 2.6); continue; }
      if (r === 3 && c === 0) { fillRR(ctx, x + 62, y + 32, 20, 4, 2, "rgba(248,248,248,0.35)"); continue; }
      if (r === 3 && c === 1) { fillRR(ctx, x + 62, y + 32, 20, 4, 2, "rgba(248,248,248,0.35)"); continue; }
      // digit placeholder: dot cluster
      for (let d = 0; d < 3; d++) fillRR(ctx, x + 58 + d * 12, y + 30, 6, 6, 3, "rgba(248,248,248,0.45)");
    }
  }
  if (o.ok) {
    const p = clamp(o.ok);
    ctx.save();
    ctx.fillStyle = `rgba(15,15,15,${0.55 * p})`; ctx.fillRect(0, 0, w, h);
    glowLocal(ctx, w / 2, h * 0.42, 190 * p, P.green, 0.35 * p);
    ctx.translate(w / 2, h * 0.42);
    ctx.rotate(-0.4 + p * 0.4); ctx.scale(lerp(0.5, 1, easeOut(p)), lerp(0.5, 1, easeOut(p)));
    ctx.fillStyle = P.green; ctx.beginPath(); ctx.arc(0, 0, 84, 0, Math.PI * 2); ctx.fill();
    icon(ctx, "check", -44, -44, 88, "#0F0F0F", 3.2);
    ctx.restore();
  }
}

/* =========================================================
   DRIVER — EARNINGS / WALLET
   ========================================================= */
function earnings(ctx, w, h, t, o = {}) {
  ctx.fillStyle = P.bg; ctx.fillRect(0, 0, w, h);
  statusBar(ctx, w);
  bar(ctx, RT(w, 26, 110), 52, 110, 15, 0.85);
  pill(ctx, 26, 46, 84, 32, P.surface);
  icon(ctx, "wallet", 36, 54, 18, "rgba(248,248,248,0.7)");
  bar(ctx, 60, 56, 40, 8, 0.35);

  /* balance card */
  const grow = clamp(o.grow || 0);
  const cy = 108;
  const g = ctx.createLinearGradient(26, cy, w - 26, cy + 230);
  g.addColorStop(0, "#2A6014"); g.addColorStop(0.6, "#48B41F"); g.addColorStop(1, "#5DD62C");
  ctx.save(); ctx.shadowColor = rgba(P.green, 0.35); ctx.shadowBlur = 30;
  fillRR(ctx, 26, cy, w - 52, 230, 26, g); ctx.restore();
  ctx.save(); rr(ctx, 26, cy, w - 52, 230, 26); ctx.clip();
  ctx.globalAlpha = 0.12; ctx.strokeStyle = "#0F0F0F"; ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(w - 20, cy + 200, 50 + i * 40, Math.PI, Math.PI * 1.7); ctx.stroke(); }
  ctx.restore();
  bar(ctx, RT(w - 26, 24, 96), cy + 30, 96, 10, 0.6);
  // balance "number" as rising bars (abstract amount)
  const bw = 12, gap = 8;
  const nBars = 6;
  for (let i = 0; i < nBars; i++) {
    const lit = clamp(grow * nBars - i);
    ctx.fillStyle = `rgba(15,15,15,${0.25 + 0.55 * lit})`;
    fillRR(ctx, w - 26 - 30 - i * (bw + gap), cy + 78, bw, 34, 5, `rgba(15,15,15,${0.25 + 0.5 * lit})`);
  }
  pill(ctx, 44, cy + 74, 108, 34, "rgba(15,15,15,0.28)");
  icon(ctx, "trend", 54, cy + 81, 20, "#0F0F0F");
  bar(ctx, 78, cy + 86, 56, 9, 0.7);
  bar(ctx, RT(w - 26, 24, 150), cy + 138, 150, 9, 0.4);
  bar(ctx, RT(w - 26, 24, 100), cy + 158, 100, 8, 0.28);
  /* earning pill appearing */
  if (o.plus) {
    const p = clamp(o.plus);
    const py = cy + 190 - p * 30;
    ctx.save(); ctx.globalAlpha = p;
    fillRR(ctx, 44, py, 150, 34, 17, "rgba(15,15,15,0.55)");
    icon(ctx, "arrowUp", 54, py + 7, 20, P.green);
    barG(ctx, 82, py + 12, 40, 10, 0.9);
    bar(ctx, 130, py + 13, 26, 8, 0.5);
    ctx.restore();
  }
  /* chart */
  const chy = cy + 258;
  card(ctx, 26, chy, w - 52, 210, 22, P.surface, "rgba(248,248,248,0.06)");
  bar(ctx, RT(w - 26, 24, 92), chy + 20, 92, 11, 0.7);
  const bars = [0.35, 0.5, 0.42, 0.66, 0.58, 0.82, 0.95];
  const baseY = chy + 182, maxH = 108;
  bars.forEach((b, i) => {
    const a = clamp((o.chart || 0) * 1.4 - i * 0.06);
    const hgt = maxH * b * a;
    const x = w - 26 - 32 - i * 46;
    fillRR(ctx, x, baseY - hgt, 28, hgt, 8, i === bars.length - 1 ? P.green : rgba(P.green, 0.28 + 0.18 * b));
  });
  /* transaction rows */
  const ty = chy + 234;
  for (let i = 0; i < 2; i++) {
    const y = ty + i * 84;
    card(ctx, 26, y, w - 52, 72, 18, P.surface, "rgba(248,248,248,0.05)");
    fillRR(ctx, RT(w - 26, 10, 44), y + 14, 44, 44, 14, i === 0 ? rgba(P.green, 0.18) : "rgba(248,248,248,0.06)");
    icon(ctx, i === 0 ? "check" : "wallet", RT(w - 26, 10, 44) + 11, y + 25, 22, i === 0 ? P.green : "rgba(248,248,248,0.5)");
    bar(ctx, RT(w - 26, 66, 120), y + 22, 120, 10, 0.7);
    bar(ctx, RT(w - 26, 66, 76), y + 42, 76, 7, 0.24);
    if (i === 0) { barG(ctx, 46, y + 30, 56, 12, 0.85); }
    else bar(ctx, 46, y + 31, 46, 10, 0.3);
  }
  bottomNav(ctx, w, h, 2);
}

/* =========================================================
   CUSTOMER — NOTIFICATION / LOCK SCREEN (order arrived at store)
   ========================================================= */
function notif(ctx, w, h, t, o = {}) {
  ctx.fillStyle = "#080A08"; ctx.fillRect(0, 0, w, h);
  const gl = ctx.createRadialGradient(w / 2, h * 0.2, 10, w / 2, h * 0.3, 620);
  gl.addColorStop(0, rgba(P.green, 0.16)); gl.addColorStop(1, rgba(P.green, 0));
  ctx.fillStyle = gl; ctx.fillRect(0, 0, w, h);
  statusBar(ctx, w);
  const p = clamp(o.p === undefined ? 1 : o.p);
  const y = 150 + (1 - easeOutBack(p)) * -120;
  ctx.save(); ctx.globalAlpha = clamp(p * 1.4);
  card(ctx, 26, y, w - 52, 168, 26, "rgba(32,32,32,0.92)", rgba(P.green, 0.35));
  ctx.save(); rr(ctx, RT(w - 26, 12, 52), y + 14, 52, 52, 15); ctx.clip();
  if (IMG.logo) ctx.drawImage(IMG.logo, RT(w - 26, 12, 52), y + 14, 52, 52);
  ctx.restore();
  bar(ctx, RT(w - 88, 20, 96), y + 26, 96, 10, 0.6);
  bar(ctx, RT(w - 88, 20, 56), y + 44, 56, 7, 0.22);
  bar(ctx, RT(w - 26, 20, 190), y + 84, 190, 12, 0.85);
  bar(ctx, RT(w - 26, 20, 150), y + 108, 150, 9, 0.3);
  pill(ctx, 44, y + 116, 92, 30, rgba(P.green, 0.16));
  icon(ctx, "bag", 52, y + 122, 18, P.green);
  barG(ctx, 76, y + 128, 48, 8, 0.85);
  ctx.restore();
  /* clock */
  ctx.save();
  ctx.globalAlpha = 0.5;
  const cgp = ctx.createLinearGradient(0, h * 0.5, 0, h * 0.7);
  cgp.addColorStop(0, "rgba(248,248,248,0.5)"); cgp.addColorStop(1, "rgba(248,248,248,0.06)");
  fillRR(ctx, w / 2 - 90, h * 0.55, 180, 34, 8, cgp);
  fillRR(ctx, w / 2 - 46, h * 0.62, 92, 14, 7, "rgba(248,248,248,0.25)");
  ctx.restore();
}

module.exports = {
  home, store, cart, address, track, confirmed, dashOrders, dashProducts,
  driverHome, driverOffer, driverTrip, verify, earnings, notif, samplePath,
};
