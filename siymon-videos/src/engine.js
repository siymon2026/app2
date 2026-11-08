"use strict";
/**
 * SIYMON cinematic video engine — software 3D renderer on Skia (@napi-rs/canvas).
 * No text is ever drawn except the official logo asset.
 */
const { createCanvas, loadImage } = require("@napi-rs/canvas");
const path = require("path");

const W = 1080;
const H = 1920;
const FPS = 30;

const C = {
  black: "#0F0F0F",
  ink: "#070707",
  surface: "#202020",
  surface2: "#2A2A2A",
  green: "#5DD62C",
  greenDark: "#337418",
  greenDeep: "#1B3F0D",
  white: "#F8F8F8",
  muted: "#A8A8A8",
  line: "#333333",
};

/* ---------- math ---------- */
const V = {
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: (a) => Math.hypot(a[0], a[1], a[2]),
  norm: (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
  lerp: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
};

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
const smoothstep = (a, b, t) => smooth((t - a) / (b - a));
const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3);
const easeInOut = (t) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const easeOutBack = (t) => { t = clamp(t); const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const easeOutElastic = (t) => { t = clamp(t); if (t === 0 || t === 1) return t; return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1; };

function mulberry(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- colour ---------- */
function hexToRgb(h) {
  h = h.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function mix(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  const r = Math.round(lerp(A[0], B[0], t)), g = Math.round(lerp(A[1], B[1], t)), bl = Math.round(lerp(A[2], B[2], t));
  return "#" + [r, g, bl].map((v) => clamp(v, 0, 255).toString(16).padStart(2, "0")).join("");
}
function shade(hex, k) { return mix("#000000", hex, clamp(k)); }
function rgba(hex, a) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

/* ---------- camera ---------- */
function makeCam(o) {
  const pos = o.pos;
  const target = o.target || [0, 0, 0];
  const f = V.norm(V.sub(target, pos));
  const upHint = o.up || [0, 1, 0];
  const r = V.norm(V.cross(f, upHint));
  const u = V.cross(r, f);
  const fov = o.fov === undefined ? 50 : o.fov;
  const fl = (H / 2) / Math.tan((fov * Math.PI) / 360);
  const roll = o.roll || 0;
  const cr = Math.cos(roll), sr = Math.sin(roll);
  const cx0 = o.cx === undefined ? W / 2 : o.cx;
  const cy0 = o.cy === undefined ? H / 2 : o.cy;
  const cam = {
    pos, f, r, u, fl, roll,
    project(p) {
      const d = V.sub(p, pos);
      const cz = V.dot(d, f);
      if (cz < 0.04) return null;
      const px = V.dot(d, r), py = V.dot(d, u);
      let sx = (px / cz) * fl, sy = -(py / cz) * fl;
      const rx = sx * cr - sy * sr, ry = sx * sr + sy * cr;
      return { x: cx0 + rx, y: cy0 + ry, z: cz, s: fl / cz };
    },
    depth(p) { return V.dot(V.sub(p, pos), f); },
  };
  return cam;
}

/* ---------- homography / perspective texture ---------- */
function homography(src, dst) {
  // maps src[i] -> dst[i] for 4 points, returns function
  const A = [], b = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i], X = dst[i].x, Y = dst[i].y;
    A.push([x, y, 1, 0, 0, 0, -x * X, -y * X]); b.push(X);
    A.push([0, 0, 0, x, y, 1, -x * Y, -y * Y]); b.push(Y);
  }
  // gaussian elimination
  const n = 8;
  for (let i = 0; i < n; i++) {
    let piv = i;
    for (let k = i + 1; k < n; k++) if (Math.abs(A[k][i]) > Math.abs(A[piv][i])) piv = k;
    if (piv !== i) { [A[i], A[piv]] = [A[piv], A[i]]; [b[i], b[piv]] = [b[piv], b[i]]; }
    const p = A[i][i] || 1e-9;
    for (let k = i + 1; k < n; k++) {
      const f = A[k][i] / p;
      if (!f) continue;
      for (let j = i; j < n; j++) A[k][j] -= f * A[i][j];
      b[k] -= f * b[i];
    }
  }
  const h = new Array(8).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = b[i];
    for (let j = i + 1; j < n; j++) s -= A[i][j] * h[j];
    h[i] = s / (A[i][i] || 1e-9);
  }
  return (x, y) => {
    const d = h[6] * x + h[7] * y + 1 || 1e-9;
    return { x: (h[0] * x + h[1] * y + h[2]) / d, y: (h[3] * x + h[4] * y + h[5]) / d };
  };
}

/**
 * Draw `img` mapped onto a projected quad (corners: TL,TR,BR,BL).
 * Subdivided affine mapping = true perspective warp on a 2D canvas.
 */
function texQuad(ctx, img, corners, nx = 10, ny = 16) {
  if (corners.some((c) => !c)) return;
  const iw = img.width, ih = img.height;
  const map = homography(
    [{ x: 0, y: 0 }, { x: iw, y: 0 }, { x: iw, y: ih }, { x: 0, y: ih }],
    corners
  );
  const pad = 0.75;
  const cw = iw / nx, ch = ih / ny;
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const x0 = i * cw, y0 = j * ch;
      const px0 = Math.max(0, x0 - pad), py0 = Math.max(0, y0 - pad);
      const px1 = Math.min(iw, x0 + cw + pad), py1 = Math.min(ih, y0 + ch + pad);
      const q00 = map(px0, py0), q10 = map(px1, py0), q01 = map(px0, py1);
      const sx = px1 - px0, sy = py1 - py0;
      if (sx <= 0 || sy <= 0) continue;
      ctx.save();
      ctx.beginPath();
      // clip cell to avoid overdraw haze on edges
      ctx.setTransform((q10.x - q00.x) / sx, (q10.y - q00.y) / sx, (q01.x - q00.x) / sy, (q01.y - q00.y) / sy, q00.x, q00.y);
      ctx.drawImage(img, px0, py0, sx, sy, 0, 0, sx, sy);
      ctx.restore();
    }
  }
}

/* ---------- lighting ---------- */
const LIGHT = V.norm([-0.55, 0.78, 0.62]);
const LIGHT2 = V.norm([0.75, 0.25, -0.6]);

function faceColor(base, normal, camPos, center, opts = {}) {
  const n = V.norm(normal);
  const view = V.norm(V.sub(camPos, center));
  const d1 = Math.max(0, V.dot(n, LIGHT));
  const d2 = Math.max(0, V.dot(n, LIGHT2));
  const rim = Math.pow(1 - Math.max(0, Math.abs(V.dot(n, view))), 3);
  const amb = opts.amb === undefined ? 0.52 : opts.amb;
  const k = amb + d1 * (opts.key === undefined ? 0.95 : opts.key) + d2 * 0.30;
  let col = mix("#000000", base, clamp(k, 0, 1.35));
  if (rim > 0.78 && opts.rim !== false) col = mix(col, C.green, Math.min(0.5, (rim - 0.78) * 1.1 * (opts.rimK || 1)));
  return col;
}

/* ---------- 3D primitives ---------- */
function projectAll(cam, pts) { return pts.map((p) => cam.project(p)); }

function fillPoly(ctx, pts2, fill, stroke, lw) {
  if (pts2.some((p) => !p)) return;
  ctx.beginPath();
  ctx.moveTo(pts2[0].x, pts2[0].y);
  for (let i = 1; i < pts2.length; i++) ctx.lineTo(pts2[i].x, pts2[i].y);
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
}

function rot3(p, rot) {
  const [rx, ry, rz] = rot || [0, 0, 0];
  let [x, y, z] = p;
  if (rz) { const c = Math.cos(rz), s = Math.sin(rz); [x, y] = [x * c - y * s, x * s + y * c]; }
  if (rx) { const c = Math.cos(rx), s = Math.sin(rx); [y, z] = [y * c - z * s, y * s + z * c]; }
  if (ry) { const c = Math.cos(ry), s = Math.sin(ry); [x, z] = [x * c + z * s, -x * s + z * c]; }
  return [x, y, z];
}
function place(local, m) {
  const p = rot3(local, m.rot || [0, m.ry || 0, 0]);
  const s = m.scale === undefined ? 1 : m.scale;
  const sc = Array.isArray(s) ? s : [s, s, s];
  return [p[0] * sc[0] + m.p[0], p[1] * sc[1] + m.p[1], p[2] * sc[2] + m.p[2]];
}

const BOX_FACES = [
  { idx: [0, 1, 2, 3], n: [0, 0, 1] },   // front  z+
  { idx: [5, 4, 7, 6], n: [0, 0, -1] },  // back
  { idx: [4, 5, 1, 0], n: [0, 1, 0] },   // top
  { idx: [3, 2, 6, 7], n: [0, -1, 0] },  // bottom
  { idx: [1, 5, 6, 2], n: [1, 0, 0] },   // right
  { idx: [4, 0, 3, 7], n: [-1, 0, 0] },  // left
];

function boxVerts(m, size) {
  const [w, h, d] = size.map((v) => v / 2);
  const L = {
    0: [-w, -h, d], 1: [w, -h, d], 2: [w, h, d], 3: [-w, h, d],
    4: [-w, -h, -d], 5: [w, -h, -d], 6: [w, h, -d], 7: [-w, h, -d],
  };
  return Object.keys(L).map((k) => place(L[k], m));
}

function drawBox(ctx, cam, m, size, color, opts = {}) {
  const verts = boxVerts(m, size);
  const center = place([0, 0, 0], m);
  const faces = BOX_FACES.map((f) => {
    const pts = f.idx.map((i) => verts[i]);
    const nWorld = rot3(f.n, m.rot || [0, m.ry || 0, 0]);
    const depth = pts.reduce((s, p) => s + cam.depth(p), 0) / 4;
    // face centre
    const fc = pts.reduce((s, p) => V.add(s, p), [0, 0, 0]).map((v) => v / 4);
    const view = V.norm(V.sub(cam.pos, fc));
    const facing = V.dot(V.norm(nWorld), view) > 0;
    return { pts, nWorld, depth, fc, facing };
  }).filter((f) => f.facing).sort((a, b) => b.depth - a.depth);

  for (const f of faces) {
    const p2 = projectAll(cam, f.pts);
    if (p2.some((p) => !p)) continue;
    const col = faceColor(color, f.nWorld, cam.pos, f.fc, opts);
    fillPoly(ctx, p2, col);
    if (opts.edge) {
      ctx.save();
      ctx.globalAlpha = opts.edgeAlpha === undefined ? 0.5 : opts.edgeAlpha;
      fillPoly(ctx, p2, null, opts.edge, opts.edgeW || 1.2);
      ctx.restore();
    }
  }
  return verts;
}

function drawQuad(ctx, cam, pts, fill, opts = {}) {
  const p2 = projectAll(cam, pts);
  if (p2.some((p) => !p)) return;
  if (opts.gradient) {
    const g = ctx.createLinearGradient(p2[0].x, p2[0].y, p2[2].x, p2[2].y);
    opts.gradient.forEach((s) => g.addColorStop(s[0], s[1]));
    fillPoly(ctx, p2, g, opts.stroke, opts.lw);
    return;
  }
  fillPoly(ctx, p2, fill, opts.stroke, opts.lw);
}

function glow(ctx, x, y, r, color, a = 1) {
  if (!(r > 0) || !isFinite(x) || !isFinite(y)) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, clamp(a, 0, 1)));
  g.addColorStop(0.35, rgba(color, clamp(a, 0, 1) * 0.35));
  g.addColorStop(1, rgba(color, 0));
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function sphere(ctx, cam, p, r, color, opts = {}) {
  const s = cam.project(p);
  if (!s) return;
  const rr = r * s.s;
  const g = ctx.createRadialGradient(s.x - rr * 0.35, s.y - rr * 0.4, rr * 0.05, s.x, s.y, rr);
  g.addColorStop(0, mix(color, "#FFFFFF", 0.55));
  g.addColorStop(0.55, color);
  g.addColorStop(1, shade(color, 0.35));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(s.x, s.y, rr, 0, Math.PI * 2); ctx.fill();
  if (opts.glow) glow(ctx, s.x, s.y, rr * (opts.glowR || 3.2), opts.glowColor || C.green, opts.glow);
}

/* ground plane with perspective grid + fog */
function ground(ctx, cam, y, opts = {}) {
  const ext = opts.extent || 60;
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, opts.sky || "#080B08");
  bg.addColorStop(0.52, "#0A0C0A");
  bg.addColorStop(1, opts.floor || "#050605");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  if (opts.grid === false) return;
  const step = opts.step || 2;
  const cx = opts.center || [0, 0];
  ctx.save();
  ctx.lineWidth = 1;
  for (let i = -ext; i <= ext; i += step) {
    const alpha = opts.gridAlpha === undefined ? 0.14 : opts.gridAlpha;
    const col = opts.gridColor || C.green;
    for (const axis of [0, 1]) {
      const a = axis ? [cx[0] + i, y, cx[1] - ext] : [cx[0] - ext, y, cx[1] + i];
      const b = axis ? [cx[0] + i, y, cx[1] + ext] : [cx[0] + ext, y, cx[1] + i];
      const pa = cam.project(a), pb = cam.project(b);
      if (!pa || !pb) continue;
      const g = ctx.createLinearGradient(pa.x, pa.y, pb.x, pb.y);
      g.addColorStop(0, rgba(col, 0));
      g.addColorStop(0.5, rgba(col, alpha));
      g.addColorStop(1, rgba(col, 0));
      ctx.strokeStyle = g;
      ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
    }
  }
  ctx.restore();
}

/* road ribbon along polyline (x,z) */
function road(ctx, cam, pts, width, opts = {}) {
  const left = [], right = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[Math.min(pts.length - 1, i + 1)];
    const o = pts[Math.max(0, i - 1)];
    const dir = V.norm([q[0] - o[0], 0, q[1] - o[1]]);
    const nrm = [-dir[2], 0, dir[0]];
    left.push([p[0] + nrm[0] * width / 2, opts.y || 0.02, p[1] + nrm[2] * width / 2]);
    right.push([p[0] - nrm[0] * width / 2, opts.y || 0.02, p[1] - nrm[2] * width / 2]);
  }
  for (let i = 0; i < pts.length - 1; i++) {
    const quad = [left[i], left[i + 1], right[i + 1], right[i]];
    const p2 = projectAll(cam, quad);
    if (p2.some((p) => !p)) continue;
    ctx.fillStyle = opts.fill || "#141614";
    ctx.beginPath();
    ctx.moveTo(p2[0].x, p2[0].y);
    for (let k = 1; k < 4; k++) ctx.lineTo(p2[k].x, p2[k].y);
    ctx.closePath(); ctx.fill();
    if (opts.edge) {
      for (const side of [[left[i], left[i + 1]], [right[i], right[i + 1]]]) {
        const e = projectAll(cam, side);
        if (e.some((p) => !p)) continue;
        ctx.strokeStyle = opts.edge; ctx.lineWidth = opts.edgeW || 2;
        ctx.beginPath(); ctx.moveTo(e[0].x, e[0].y); ctx.lineTo(e[1].x, e[1].y); ctx.stroke();
      }
    }
  }
}

/* animated route line with travelling pulse */
function route(ctx, cam, pts, opts = {}) {
  const prog = opts.progress === undefined ? 1 : clamp(opts.progress);
  if (prog <= 0) return;
  const y = opts.y || 0.35;
  const n = pts.length - 1;
  const path = [];
  const upto = prog * n;
  for (let i = 0; i <= n; i++) {
    if (i > upto) break;
    path.push(pts[i]);
  }
  const tail = routePoint(pts, prog);
  if (path.length && path[path.length - 1] !== tail) path.push(tail);
  // clip points that fall behind the camera by pulling them toward the last visible point
  const vis = [];
  for (const q of path) {
    const pr = cam.project([q[0], y, q[1]]);
    if (pr) vis.push(pr);
    else if (vis.length) { /* skip behind-camera points */ }
  }
  const p2 = vis;
  if (p2.length < 2) return;
  const drawPath = () => {
    ctx.beginPath();
    ctx.moveTo(p2[0].x, p2[0].y);
    for (let i = 1; i < p2.length; i++) ctx.lineTo(p2[i].x, p2[i].y);
  };
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.globalCompositeOperation = "lighter";
  // outer halo
  drawPath();
  ctx.strokeStyle = rgba(opts.color || C.green, 0.18);
  ctx.lineWidth = (opts.width || 9) * 3.4;
  ctx.stroke();
  drawPath();
  ctx.strokeStyle = rgba(opts.color || C.green, 0.35);
  ctx.lineWidth = (opts.width || 9) * 1.7;
  ctx.stroke();
  // core
  drawPath();
  ctx.strokeStyle = rgba(opts.core || "#DFFFCE", 0.95);
  ctx.lineWidth = opts.width || 9;
  ctx.stroke();
  // travelling highlight
  if (opts.flow !== false) {
    ctx.setLineDash([26, 74]);
    ctx.lineDashOffset = -((opts.flowT || 0) * 190) % 100;
    drawPath();
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = (opts.width || 9) * 0.55;
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();
  if (opts.head !== false) {
    const hp = cam.project([tail[0], y + 0.01, tail[1]]);
    if (hp) glow(ctx, hp.x, hp.y, (opts.width || 9) * 4.6, opts.color || C.green, 0.85);
  }
}

function routePoint(pts, t) {
  const n = pts.length - 1;
  const x = clamp(t) * n;
  const i = Math.min(n - 1, Math.floor(x));
  return V.lerp(pts[i], pts[i + 1], x - i);
}

/* ---------- world props ---------- */
function cityBlock(ctx, cam, x, z, w, h, d, opts = {}) {
  const base = opts.color || "#151815";
  const m = { p: [x, h / 2, z], rot: [0, opts.ry || 0, 0] };
  drawBox(ctx, cam, m, [w, h, d], base, { amb: 0.26, rimK: 0.55, rim: opts.rim !== false });
  // lit window texture on the camera-facing side
  if (opts.windows !== false) {
    const verts = boxVerts(m, [w, h, d]);
    const faces = [
      [[w, 0, d], [0, 1, 2, 3]],  // +z front
      [[0, 0, -d], [5, 4, 7, 6]],
      [[w, 0, 0], [1, 5, 6, 2]],
      [[-w, 0, 0], [4, 0, 3, 7]],
    ];
    let best = null;
    for (const [nLocal, idx] of faces) {
      const nW = rot3(nLocal, m.rot);
      const c = place([0, 0, 0], m);
      if (V.dot(V.norm(nW), V.norm(V.sub(cam.pos, c))) <= 0.05) continue;
      const pts = idx.map((i) => verts[i]);
      const depth = pts.reduce((s, p) => s + cam.depth(p), 0) / 4;
      if (!best || depth < best.depth) best = { pts, depth };
    }
    if (best) {
      const p2 = projectAll(cam, best.pts);
      if (!p2.some((p) => !p)) texQuad(ctx, opts.texture, p2, 3, 6);
    }
  }
}

function makeWindowTexture(seed = 1) {
  const cv = createCanvas(160, 420);
  const x = cv.getContext("2d");
  x.clearRect(0, 0, 160, 420);
  const rnd = mulberry(seed);
  const cols = 5, rows = 14;
  const cw = 160 / cols, ch = 420 / rows;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const lit = rnd() > 0.48;
      if (!lit) continue;
      const warm = rnd() > 0.72;
      x.fillStyle = warm ? rgba("#FFE0A8", 0.16 + rnd() * 0.2) : rgba(C.green, 0.1 + rnd() * 0.16);
      x.fillRect(i * cw + cw * 0.18, j * ch + ch * 0.2, cw * 0.64, ch * 0.5);
    }
  }
  return cv;
}

/* ---------- capsule helper (smooth limbs / bodies) ---------- */
function capsule(ctx, cam, a, b, r, color, opts = {}) {
  const pa = cam.project(a), pb = cam.project(b);
  if (!pa || !pb) return;
  const rr = r * ((pa.s + pb.s) / 2);
  const g = ctx.createLinearGradient(pa.x, pa.y - rr, pa.x, pa.y + rr);
  g.addColorStop(0, mix(color, "#FFFFFF", 0.10));
  g.addColorStop(0.45, color);
  g.addColorStop(1, shade(color, 0.55));
  ctx.save();
  ctx.lineCap = "round";
  ctx.strokeStyle = g;
  ctx.lineWidth = Math.max(0.5, rr * 2);
  ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
  if (opts.rim !== false) {
    ctx.globalCompositeOperation = "lighter";
    const rg = ctx.createLinearGradient(pa.x - rr, pa.y, pa.x + rr, pa.y);
    rg.addColorStop(0, rgba(C.green, opts.rimA === undefined ? 0.10 : opts.rimA));
    rg.addColorStop(0.6, rgba(C.green, 0));
    ctx.strokeStyle = rg;
    ctx.lineWidth = Math.max(0.5, rr * 0.5);
    ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
  }
  ctx.restore();
}

/* ---------- stylised flat silhouette figure with green rim ---------- */
function capsuleFlat(ctx, cam, a, b, r, color, rimA, rimK) {
  const pa = cam.project(a), pb = cam.project(b);
  if (!pa || !pb) return;
  const rr = r * ((pa.s + pb.s) / 2);
  ctx.save();
  ctx.lineCap = "round";
  if (rimA > 0) {
    ctx.strokeStyle = rgba(C.green, rimA);
    ctx.lineWidth = Math.max(0.5, rr * 2 * rimK);
    ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(0.5, rr * 2);
  ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
  ctx.restore();
}

function figure(ctx, cam, m, opts = {}) {
  const sc = m.scale === undefined ? 1 : m.scale;
  const rot = m.rot || [0, m.ry || 0, 0];
  const col = opts.color || "#12160F";
  const P = (p) => place([p[0] * sc, p[1] * sc, p[2] * sc], { p: m.p, rot });
  const rimA = opts.rimA === undefined ? 0 : opts.rimA;
  const rimK = 1.16;
  const hip = P([0, 0.92, 0]), chest = P([0, 1.3, 0.01]), head = P([0, 1.52, 0.02]);
  const hp = cam.project(head);
  if (hp && opts.halo !== false) glow(ctx, hp.x, hp.y + 30, 260 * (hp.s / 900), opts.haloColor || C.green, 0.07);
  capsuleFlat(ctx, cam, hip, chest, 0.11, col, rimA, rimK);
  capsuleFlat(ctx, cam, P([-0.2, 1.28, 0.01]), P([0.2, 1.28, 0.01]), 0.062, col, rimA, rimK);
  if (opts.reachL || opts.reachR) {
    const shoulderL = P([-0.2, 1.26, 0.01]), shoulderR = P([0.2, 1.26, 0.01]);
    if (opts.reachL) {
      const t = opts.reachL;
      const mid = V.lerp(shoulderL, t, 0.5); mid[1] -= 0.06;
      capsuleFlat(ctx, cam, shoulderL, mid, 0.05, col, rimA, rimK);
      capsuleFlat(ctx, cam, mid, t, 0.042, col, rimA, rimK);
    } else {
      capsuleFlat(ctx, cam, shoulderL, P([-0.245, 1.02, 0.05]), 0.05, col, rimA, rimK);
      capsuleFlat(ctx, cam, P([-0.245, 1.02, 0.05]), P([-0.2, 0.78, 0.12]), 0.042, col, rimA, rimK);
    }
    if (opts.reachR) {
      const t = opts.reachR;
      const mid = V.lerp(shoulderR, t, 0.5); mid[1] -= 0.06;
      capsuleFlat(ctx, cam, shoulderR, mid, 0.05, col, rimA, rimK);
      capsuleFlat(ctx, cam, mid, t, 0.042, col, rimA, rimK);
    } else {
      capsuleFlat(ctx, cam, shoulderR, P([0.245, 1.02, 0.06]), 0.05, col, rimA, rimK);
      capsuleFlat(ctx, cam, P([0.245, 1.02, 0.06]), P([0.2, 0.78, 0.13]), 0.042, col, rimA, rimK);
    }
  } else {
    capsuleFlat(ctx, cam, P([-0.2, 1.26, 0.01]), P([-0.245, 1.02, 0.05]), 0.05, col, rimA, rimK);
    capsuleFlat(ctx, cam, P([-0.245, 1.02, 0.05]), P([-0.2, 0.78, 0.12]), 0.042, col, rimA, rimK);
    capsuleFlat(ctx, cam, P([0.2, 1.26, 0.01]), P([0.245, 1.02, 0.06]), 0.05, col, rimA, rimK);
    capsuleFlat(ctx, cam, P([0.245, 1.02, 0.06]), P([0.2, 0.78, 0.13]), 0.042, col, rimA, rimK);
  }
  capsuleFlat(ctx, cam, P([-0.08, 0.92, 0]), P([-0.1, 0.03, 0.03]), 0.065, col, rimA, rimK);
  capsuleFlat(ctx, cam, P([0.08, 0.92, 0]), P([0.1, 0.03, 0.03]), 0.065, col, rimA, rimK);
  // head + helmet as flat discs with rim
  const hs = cam.project(head);
  if (hs) {
    const r1 = 0.098 * hs.s;
    if (rimA > 0) { ctx.fillStyle = rgba(C.green, rimA); ctx.beginPath(); ctx.arc(hs.x, hs.y, r1 * 1.12, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = opts.helmet || "#161B14";
    ctx.beginPath(); ctx.arc(hs.x, hs.y, r1, 0, Math.PI * 2); ctx.fill();

  }
}

/* ---------- particles ---------- */
function particles(ctx, cam, t, opts = {}) {
  const n = opts.n || 46;
  const rnd = mulberry(opts.seed || 7);
  for (let i = 0; i < n; i++) {
    const x = (rnd() - 0.5) * (opts.spread || 14);
    const y0 = rnd() * (opts.height || 7);
    const z = (rnd() - 0.5) * (opts.depth || 10);
    const sp = 0.15 + rnd() * 0.5;
    const y = (y0 + t * sp) % (opts.height || 7);
    const p = cam.project([x + Math.sin(t * 0.4 + i) * 0.3, y + (opts.base || 0), z]);
    if (!p) continue;
    const r = (opts.size || 3) * (0.4 + rnd()) * (p.s / 600);
    ctx.globalAlpha = 0.1 + rnd() * 0.35;
    ctx.fillStyle = rnd() > 0.7 ? C.white : C.green;
    ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0.6, r), 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/* ---------- post processing ---------- */
function makePost() {
  const bloom = createCanvas(W / 4, H / 4);
  const bctx = bloom.getContext("2d");
  const grain = createCanvas(220, 220);
  const gctx = grain.getContext("2d");
  const rnd = mulberry(99);
  const id = gctx.createImageData(220, 220);
  for (let i = 0; i < id.data.length; i += 4) {
    const v = 120 + rnd() * 135;
    id.data[i] = v; id.data[i + 1] = v; id.data[i + 2] = v; id.data[i + 3] = 26;
  }
  gctx.putImageData(id, 0, 0);
  return { bloom, bctx, grain, rnd };
}

function post(ctx, postCtx, frame, opts = {}) {
  const { bloom, bctx, grain } = postCtx;
  // bloom
  if (opts.bloom !== 0) {
    bctx.setTransform(1, 0, 0, 1, 0, 0);
    bctx.clearRect(0, 0, bloom.width, bloom.height);
    bctx.globalCompositeOperation = "source-over";
    bctx.drawImage(ctx.canvas, 0, 0, bloom.width, bloom.height);
    // crush darks so only real highlights bloom
    bctx.globalCompositeOperation = "multiply";
    bctx.drawImage(bloom, 0, 0);
    bctx.drawImage(bloom, 0, 0);
    bctx.globalCompositeOperation = "source-over";
    ctx.save();
    ctx.filter = "blur(13px)";
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = opts.bloom === undefined ? 0.55 : opts.bloom;
    ctx.drawImage(bloom, 0, 0, W, H);
    ctx.restore();
  }
  // vignette
  const vg = ctx.createRadialGradient(W / 2, H * 0.48, H * 0.18, W / 2, H * 0.5, H * 0.78);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.72)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
  // grain
  if (opts.grain !== 0) {
    ctx.save();
    ctx.globalCompositeOperation = "overlay";
    ctx.globalAlpha = 0.5;
    const ox = (frame * 37) % 220, oy = (frame * 71) % 220;
    for (let y = -220; y < H; y += 220) for (let x = -220; x < W; x += 220) ctx.drawImage(grain, x + ox, y + oy);
    ctx.restore();
  }
}

function pxPerUnit(cam, p) {
  const a = cam.project(p), b = cam.project([p[0], p[1] + 1, p[2]]);
  if (!a || !b) return 0;
  return Math.abs(a.y - b.y) + Math.abs(a.x - b.x) * 0.5;
}

function framePx(px, size, fov) {
  const fl = (H / 2) / Math.tan((fov * Math.PI) / 360);
  return (size * fl) / px;
}

module.exports = {
  framePx,
  pxPerUnit,
  capsule,
  W, H, FPS, C, V, clamp, lerp, smooth, smoothstep, easeOut, easeInOut, easeOutBack, easeOutElastic,
  mulberry, mix, shade, rgba, hexToRgb, makeCam, homography, texQuad, faceColor, drawBox, drawQuad,
  glow, sphere, ground, road, route, routePoint, cityBlock, makeWindowTexture, figure, particles,
  makePost, post, createCanvas, loadImage, projectAll, fillPoly, place, rot3,
};
