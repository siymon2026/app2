"use strict";
const E = require("./engine");
const { W, H, C, V, clamp, lerp, mix, rgba, shade, place, rot3, drawBox, drawQuad, glow, sphere, ground, road, route, routePoint, cityBlock, makeWindowTexture, figure, particles, fillPoly, projectAll, mulberry, texQuad } = E;

/* ---------- textures ---------- */
const TEX = { win1: makeWindowTexture(3), win2: makeWindowTexture(11), win3: makeWindowTexture(29) };

/* ---------- studio ---------- */
function studio(ctx, cam, t, o = {}) {
  const g = ctx.createRadialGradient(W * 0.5, H * 0.42, 40, W * 0.5, H * 0.55, H * 0.85);
  g.addColorStop(0, o.core || "#151C11");
  g.addColorStop(0.55, "#0A0D09");
  g.addColorStop(1, "#040504");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // floor
  const fy = o.floorY;
  if (fy !== undefined) {
    const p1 = cam.project([0, fy, 6]), p2 = cam.project([0, fy, -16]);
    if (p1 && p2) {
      const lg = ctx.createLinearGradient(0, p2.y, 0, p1.y);
      lg.addColorStop(0, "rgba(10,14,9,0)");
      lg.addColorStop(0.42, "rgba(9,12,8,0.85)");
      lg.addColorStop(1, "rgba(4,5,4,0.95)");
      ctx.fillStyle = lg;
      ctx.fillRect(0, Math.min(p2.y, p1.y), W, H);
    }
  }
  if (o.spot !== false) {
    glow(ctx, W * 0.5, H * 0.30, W * 0.62, o.spotColor || "#2F6A16", o.spotA === undefined ? 0.5 : o.spotA);
  }
  if (o.parts !== false) particles(ctx, cam, t, { n: 34, spread: 7, height: 4.4, depth: 5, base: (o.floorY || 0) - 0.2, size: 3 });
}

/* ---------- cinematic night avenue ---------- */
function avenue(ctx, cam, t, o = {}) {
  const fogC = o.fog || "#080D07";
  ground(ctx, cam, 0, { extent: 40, step: 2, sky: "#0A1009", floor: "#060806", gridColor: C.green, gridAlpha: 0.06 });
  // horizon glow
  const hz = cam.project([0, 2.0, -40]);
  if (hz) {
    const hg = ctx.createLinearGradient(0, hz.y - 700, 0, hz.y + 220);
    hg.addColorStop(0, rgba("#081006", 0));
    hg.addColorStop(0.72, rgba("#3C7A20", 0.34));
    hg.addColorStop(1, rgba("#14240D", 0));
    ctx.fillStyle = hg;
    ctx.fillRect(0, Math.max(0, hz.y - 700), W, 900);
  }
  // road + sidewalks
  const zN = Math.min(2.2, (cam.pos ? cam.pos[2] : 0) - 0.6);
  const roadPts = zN > -11 ? [[0, zN], [0, -12], [0, -34]] : [[0, zN], [0, -34]];
  road(ctx, cam, [[-4.6, zN], [-4.6, -34]], 1.4, { fill: "#1B201A", y: 0.012 });
  road(ctx, cam, [[4.6, zN], [4.6, -34]], 1.4, { fill: "#1B201A", y: 0.012 });
  road(ctx, cam, roadPts, 6.4, { fill: "#232823", edge: rgba(C.green, 0.6), edgeW: 2.8, y: 0.016 });
  // lane dashes
  for (let z = -32; z < zN + 1; z += 3.2) {
    drawQuad(ctx, cam, [[0.11, 0.04, z], [-0.11, 0.04, z], [-0.11, 0.04, z + 1.5], [0.11, 0.04, z + 1.5]], "rgba(223,255,206,0.18)");
  }
  // kerb glow
  for (const sx of [-3.3, 3.3]) {
    const a = cam.project([sx, 0.05, zN]), b = cam.project([sx, 0.05, -34]);
    if (a && b) {
      const g = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
      g.addColorStop(0, rgba(C.green, 0.5)); g.addColorStop(0.55, rgba(C.green, 0.22)); g.addColorStop(1, rgba(C.green, 0));
      ctx.strokeStyle = g; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
  }
  // buildings framed along both sides
  const layout = o.layout || [
    [-8.5, 2, 5.5, 5, 6, 1], [8.5, -1, 5, 7, 5.5, 2],
    [-7.0, -8, 4.5, 9, 4.5, 0], [7.4, -10, 5, 8, 5, 1],
    [-8.8, -17, 6, 12, 5, 2], [8.6, -19, 5.5, 10, 5, 0],
    [-7.6, -26, 5, 9, 4.5, 1], [7.8, -28, 6, 13, 5, 2],
    [-13, -12, 6, 16, 6, 0], [13, -22, 6, 14, 6, 1],
  ];
  const blocks = layout.map((b, i) => ({ x: b[0], z: b[1], w: b[2], h: b[3], d: b[4], tex: [TEX.win1, TEX.win2, TEX.win3][b[5]] }));
  blocks.sort((a, b) => cam.depth([b.x, 0, b.z]) - cam.depth([a.x, 0, a.z]));
  for (const b of blocks) {
    const dep = cam.depth([b.x, 0, b.z]);
    const fogT = clamp((dep - 10) / 40) * (o.fogK === undefined ? 0.6 : o.fogK);
    cityBlock(ctx, cam, b.x, b.z, b.w, b.h, b.d, {
      texture: b.tex,
      color: mix(o.blockColor || "#242E22", fogC, fogT),
      rimK: 1.2,
      edge: rgba(C.green, 0.14 + (o.edgeBoost || 0)),
      edgeW: 1.2,
    });
  }
  // street lamps
  for (let z = -30; z < 12; z += 7) {
    for (const side of [-1, 1]) {
      const base = cam.project([side * 4.1, 0, z]);
      const top = cam.project([side * 4.1, 3.1, z]);
      if (!base || !top) continue;
      const wpx = Math.max(1, 2.2 * (top.s / 700));
      ctx.strokeStyle = "rgba(248,248,248,0.11)";
      ctx.lineWidth = wpx;
      ctx.beginPath(); ctx.moveTo(base.x, base.y); ctx.lineTo(top.x, top.y); ctx.stroke();
      glow(ctx, top.x, top.y, 120 * (top.s / 700), C.green, 0.16);
      glow(ctx, top.x, top.y, 34 * (top.s / 700), "#E8FFDC", 0.75);
      glow(ctx, base.x, base.y, 90 * (base.s / 700), C.green, 0.10);
    }
  }
  // traffic streaks
  if (o.traffic !== false) {
    for (let i = 0; i < 5; i++) {
      const sp = 7 + i * 1.7;
      const zPos = ((t * sp + i * 9) % 44) - 30;
      const lane = i % 2 ? 1.5 : -1.5;
      const a = cam.project([lane, 0.5, zPos + 1.6]);
      const b = cam.project([lane, 0.5, zPos]);
      if (!a || !b) continue;
      const g = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
      g.addColorStop(0, "rgba(223,255,206,0)");
      g.addColorStop(1, "rgba(223,255,206,0.55)");
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = g; ctx.lineWidth = Math.max(2, 5 * (a.s / 800)); ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.restore();
    }
  }
  // foreground haze
  const fg = ctx.createLinearGradient(0, H * 0.30, 0, H);
  fg.addColorStop(0, rgba(fogC, 0));
  fg.addColorStop(0.55, rgba(fogC, 0.28));
  fg.addColorStop(1, rgba(fogC, 0.78));
  ctx.fillStyle = fg;
  ctx.fillRect(0, H * 0.30, W, H * 0.70);
  particles(ctx, cam, t, { n: 26, spread: 12, height: 6, depth: 16, base: 0.4, size: 2.2, seed: 31 });
}

/* ---------- stylised grid city for map scenes ---------- */
function mapWorld(ctx, cam, t, o = {}) {
  ground(ctx, cam, 0, { extent: 30, step: 1.7, sky: "#090D08", floor: "#060806", gridColor: C.green, gridAlpha: 0.05 });
  const G = 3.5, R = o.rings === undefined ? 2 : o.rings;
  const rnd = mulberry(o.seed || 21);
  const blocks = [];
  for (let i = -R; i <= R; i++) {
    for (let j = -R; j <= R; j++) {
      if (o.skip && o.skip(i, j)) continue;
      const x = i * G, z = j * G;
      const h = 0.45 + rnd() * (o.maxH || 2.2);
      blocks.push({ x, z, h, w: 2.15 + rnd() * 0.3, d: 2.15 + rnd() * 0.3 });
    }
  }
  blocks.sort((a, b) => cam.depth([b.x, 0, b.z]) - cam.depth([a.x, 0, a.z]));
  for (const b of blocks) {
    drawBox(ctx, cam, { p: [b.x, b.h / 2, b.z] }, [b.w, b.h, b.d], o.blockColor || "#181E16", {
      amb: 0.34, key: 0.55, rimK: 0.9, edge: rgba(C.green, 0.34), edgeW: 1.3,
    });
    if (b.h > 1.6) {
      const top = cam.project([b.x, b.h + 0.01, b.z]);
      if (top) glow(ctx, top.x, top.y, 60 * (top.s / 600), C.green, 0.06);
    }
  }
  // road markings in the gaps
  if (o.marks !== false) {
    for (let k = -R; k <= R; k++) {
      for (let m = -R - 1; m <= R; m++) {
        const px = (m + 0.5) * G, pz = k * G;
        drawQuad(ctx, cam, [[px - 0.5, 0.02, pz - 0.06], [px + 0.5, 0.02, pz - 0.06], [px + 0.5, 0.02, pz + 0.06], [px - 0.5, 0.02, pz + 0.06]], "rgba(223,255,206,0.10)");
        drawQuad(ctx, cam, [[pz - 0.06, 0.02, (m + 0.5) * G - 0.5], [pz + 0.06, 0.02, (m + 0.5) * G - 0.5], [pz + 0.06, 0.02, (m + 0.5) * G + 0.5], [pz - 0.06, 0.02, (m + 0.5) * G + 0.5]], "rgba(223,255,206,0.10)");
      }
    }
  }
}

/* ---------- pin marker ---------- */
function pin(ctx, cam, p, t, o = {}) {
  const base = cam.project([p[0], 0.02, p[2]]);
  const top = cam.project([p[0], p[1] + 1.15, p[2]]);
  if (!base || !top) return;
  const u = E.pxPerUnit(cam, [p[0], 0, p[2]]) || 40;
  const r = 0.26 * u;
  glow(ctx, base.x, base.y, 1.5 * u, C.green, 0.42);
  // beam
  const g = ctx.createLinearGradient(top.x, top.y, base.x, base.y);
  g.addColorStop(0, rgba(C.green, 0.5)); g.addColorStop(1, rgba(C.green, 0.04));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(top.x - r * 0.16, top.y);
  ctx.lineTo(top.x + r * 0.16, top.y);
  ctx.lineTo(base.x + r * 0.75, base.y);
  ctx.lineTo(base.x - r * 0.75, base.y);
  ctx.closePath(); ctx.fill();
  // ground rings
  const rp = (t * 0.8) % 1;
  ctx.strokeStyle = rgba(C.green, (1 - rp) * 0.55);
  ctx.lineWidth = Math.max(1.5, u * 0.035);
  ctx.beginPath();
  ctx.ellipse(base.x, base.y, (0.32 + rp * 1.1) * u, (0.12 + rp * 0.4) * u, 0, 0, Math.PI * 2);
  ctx.stroke();
  // head
  ctx.save();
  ctx.shadowColor = rgba(C.green, 0.9); ctx.shadowBlur = 26;
  ctx.fillStyle = C.green;
  ctx.beginPath(); ctx.arc(top.x, top.y, r, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.fillStyle = "#0F0F0F";
  ctx.beginPath(); ctx.arc(top.x, top.y, r * 0.4, 0, Math.PI * 2); ctx.fill();
}

/* ---------- wheel ---------- */
function wheel(ctx, cam, m, r, width, color = "#0C0E0C") {
  const pts = [];
  const N = 22;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    pts.push(place([0, Math.sin(a) * r, Math.cos(a) * r], m));
  }
  const p2 = pts.map((p) => cam.project(p));
  if (p2.some((p) => !p)) return;
  ctx.beginPath();
  ctx.moveTo(p2[0].x, p2[0].y);
  for (let i = 1; i < p2.length; i++) ctx.lineTo(p2[i].x, p2[i].y);
  ctx.closePath();
  ctx.fillStyle = color; ctx.fill();
  ctx.strokeStyle = "rgba(248,248,248,0.14)"; ctx.lineWidth = 1.5; ctx.stroke();
  // hub
  const hub = cam.project(place([0, 0, 0], m));
  if (hub) {
    ctx.fillStyle = "rgba(93,214,44,0.22)";
    ctx.beginPath(); ctx.arc(hub.x, hub.y, r * 0.32 * hub.s, 0, Math.PI * 2); ctx.fill();
  }
}

/* ---------- scooter + rider ---------- */
function scooter(ctx, cam, m, o = {}) {
  const sc = m.scale === undefined ? 1 : m.scale;
  const rot = m.rot || [0, m.ry || 0, 0];
  const P = (p) => place([p[0] * sc, p[1] * sc, p[2] * sc], { p: m.p, rot });
  const body = o.body || "#2C332B";
  const acc = o.accent || C.green;
  // wheels
  wheel(ctx, cam, { p: P([0, 0.32, 0.62]), rot }, 0.32 * sc, 0.1);
  wheel(ctx, cam, { p: P([0, 0.32, -0.62]), rot }, 0.32 * sc, 0.1);
  // deck / body work
  E.capsule(ctx, cam, P([0, 0.42, 0.5]), P([0, 0.5, -0.3]), 0.15 * sc, body, { rimA: 0.3 });
  E.capsule(ctx, cam, P([0, 0.55, -0.35]), P([0, 0.62, -0.72]), 0.12 * sc, shade(body, 0.85), {});
  // seat
  E.capsule(ctx, cam, P([0, 0.66, -0.25]), P([0, 0.68, -0.55]), 0.13 * sc, "#171B16".length ? "#1B211A" : body, {});
  // front leg shield
  E.capsule(ctx, cam, P([0, 0.46, 0.44]), P([0, 0.96, 0.5]), 0.15 * sc, body, { rimA: 0.35 });
  // handlebar
  E.capsule(ctx, cam, P([-0.3, 1.0, 0.46]), P([0.3, 1.0, 0.46]), 0.035 * sc, "#151A14", {});
  // mirrors
  for (const sgn of [-1, 1]) E.capsule(ctx, cam, P([sgn * 0.3, 1.0, 0.46]), P([sgn * 0.34, 1.14, 0.44]), 0.02 * sc, "#12160F", { rim: false });
  // green accent stripe along the body
  E.capsule(ctx, cam, P([0.0, 0.52, 0.42]), P([0.0, 0.56, -0.2]), 0.018 * sc, acc, { rim: false });
  // headlight + beam
  const hl = cam.project(P([0, 0.72, 0.56]));
  if (hl) {
    glow(ctx, hl.x, hl.y, 120 * (hl.s / 620), "#E8FFD8", 0.55);
    ctx.fillStyle = "#F6FFEE"; ctx.beginPath(); ctx.arc(hl.x, hl.y, 8 * (hl.s / 620), 0, Math.PI * 2); ctx.fill();
    if (o.beam !== false) {
      const b1 = cam.project(P([-0.5, 0.2, 4.2])), b2 = cam.project(P([0.5, 0.2, 4.2]));
      if (b1 && b2) {
        const g = ctx.createLinearGradient(hl.x, hl.y, (b1.x + b2.x) / 2, b1.y);
        g.addColorStop(0, "rgba(232,255,216,0.22)"); g.addColorStop(1, "rgba(232,255,216,0)");
        ctx.save(); ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.moveTo(hl.x - 6, hl.y); ctx.lineTo(hl.x + 6, hl.y); ctx.lineTo(b2.x, b2.y); ctx.lineTo(b1.x, b1.y); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    }
  }
  // tail light
  const tl = cam.project(P([0, 0.78, -0.78]));
  if (tl) glow(ctx, tl.x, tl.y, 60 * (tl.s / 620), C.green, 0.5);
  // delivery bag
  if (o.bag !== false) bag(ctx, cam, { p: P([0, 0.72, -0.52]), rot, scale: sc * 0.9 }, { logo: o.bagLogo });
  // seated rider (explicit posture, dark silhouette with green rim)
  if (o.rider !== false) {
    const rc = o.riderColor || "#252D24";
    const hip = P([0, 0.86, -0.18]);
    const shoulder = P([0, 1.34, 0.02]);
    const head = P([0, 1.5, 0.04]);
    const knee = P([0, 0.66, 0.28]);
    const foot = P([0, 0.36, 0.16]);
    E.capsule(ctx, cam, hip, shoulder, 0.085 * sc, rc, { rimA: 0.26 });
    for (const sgn of [-1, 1]) {
      E.capsule(ctx, cam, P([sgn * 0.09, 0.86, -0.18]), P([sgn * 0.12, 0.66, 0.26]), 0.07 * sc, shade(rc, 0.92));
      E.capsule(ctx, cam, P([sgn * 0.12, 0.66, 0.26]), P([sgn * 0.12, 0.36, 0.14]), 0.055 * sc, shade(rc, 0.85));
      E.capsule(ctx, cam, P([sgn * 0.09, 1.3, 0.04]), P([sgn * 0.27, 1.02, 0.44]), 0.045 * sc, shade(rc, 0.95));
    }
    E.capsule(ctx, cam, P([-0.16, 1.36, 0.02]), P([0.16, 1.36, 0.02]), 0.075 * sc, shade(rc, 1.02));
    sphere(ctx, cam, head, 0.088 * sc, o.skin || "#2A312A", {});
    sphere(ctx, cam, head, 0.1 * sc, o.helmet || "#1D241C", { glow: 0.2, glowColor: C.green, glowR: 2.6 });
    E.capsule(ctx, cam, P([0, 1.18, 0.09]), P([0, 0.92, 0.07]), 0.012 * sc, C.green, { rim: false });
  }
}

/* ---------- SIYMON delivery bag ---------- */
function bag(ctx, cam, m, o = {}) {
  const sc = m.scale === undefined ? 1 : m.scale;
  const rot = m.rot || [0, m.ry || 0, 0];
  const P = (p) => place([p[0] * sc, p[1] * sc, p[2] * sc], { p: m.p, rot });
  drawBox(ctx, cam, { p: P([0, 0.3, 0]), rot }, [0.6 * sc, 0.6 * sc, 0.44 * sc], o.color || "#1D2218", { amb: 0.52, key: 1.0, rimK: 1.2, edge: rgba(C.green, 0.22), edgeW: 1 });
  // green band
  drawBox(ctx, cam, { p: P([0, 0.42, 0]), rot }, [0.62 * sc, 0.075 * sc, 0.46 * sc], C.greenDark, { amb: 0.7, edge: rgba(C.green, 0.6), edgeW: 1.2 });
  // handle
  for (const sgn of [-1, 1]) drawBox(ctx, cam, { p: P([sgn * 0.16 * sc, 0.64, 0]), rot }, [0.045 * sc, 0.11 * sc, 0.18 * sc], "#0F120E");
  // official mark printed on the front face
  if (o.logoImg) {
    const quad = [P([-0.15, 0.10, 0.225]), P([0.15, 0.10, 0.225]), P([0.15, 0.36, 0.225]), P([-0.15, 0.36, 0.225])];
    const p2 = quad.map((q) => cam.project(q));
    if (!p2.some((q) => !q)) {
      ctx.save();
      ctx.globalAlpha = 0.62;
      texQuad(ctx, o.logoImg, [p2[0], p2[1], p2[2], p2[3]], 4, 4);
      ctx.restore();
    }
  }
}

/* ---------- food packaging ---------- */
function foodBox(ctx, cam, m, o = {}) {
  const sc = m.scale === undefined ? 1 : m.scale;
  const rot = m.rot || [0, m.ry || 0, 0];
  const P = (p) => place([p[0] * sc, p[1] * sc, p[2] * sc], { p: m.p, rot });
  drawBox(ctx, cam, { p: P([0, 0.1, 0]), rot }, [0.5 * sc, 0.2 * sc, 0.4 * sc], o.color || "#1D211C", { amb: 0.34, rimK: 1.2 });
  if (o.lid !== false) drawBox(ctx, cam, { p: P([0, 0.21, 0]), rot }, [0.52 * sc, 0.05 * sc, 0.42 * sc], o.lidColor || "#23281F", { amb: 0.45, edge: rgba(C.green, 0.35) });
}

function cup(ctx, cam, m, o = {}) {
  const s = cam.project(m.p);
  if (!s) return;
}

/* ---------- counters / shelves ---------- */
function counter(ctx, cam, o = {}) {
  drawBox(ctx, cam, { p: [0, 0.45, -0.2] }, [6, 0.9, 1.5], o.color || "#161A15", { amb: 0.28, rimK: 0.7 });
  drawBox(ctx, cam, { p: [0, 0.93, -0.2] }, [6.1, 0.07, 1.6], "#242A22", { amb: 0.5, edge: rgba(C.green, 0.22) });
  // back shelves
  for (let i = 0; i < 2; i++) {
    drawBox(ctx, cam, { p: [0, 0.9 + i * 0.55, -2.2] }, [5, 0.06, 0.6], "#1B201A", { amb: 0.35 });
    for (let k = 0; k < 7; k++) {
      drawBox(ctx, cam, { p: [-2.2 + k * 0.72, 1.08 + i * 0.55, -2.2] }, [0.28, 0.3, 0.3], ["#233022", "#2A2E22", "#1F2620"][k % 3], { amb: 0.4 });
    }
  }
}

/* ---------- logo reveal (2D, official asset) ---------- */
function logoMark(ctx, cx, cy, size, img, opts = {}) {
  if (!img) return;
  const p = opts.p === undefined ? 1 : opts.p;
  const s = size * lerp(0.8, 1, E.easeOut(p));
  ctx.save();
  ctx.globalAlpha = clamp(p * 1.3);
  if (opts.glow !== false) {
    glow(ctx, cx, cy, s * 1.5, C.green, (opts.glowA === undefined ? 0.5 : opts.glowA) * p);
  }
  ctx.save();
  ctx.translate(cx, cy);
  if (opts.rot) ctx.rotate(opts.rot);
  ctx.shadowColor = rgba(C.green, 0.65 * p);
  ctx.shadowBlur = s * 0.35;
  ctx.beginPath();
  const r = s * 0.235;
  const x = -s / 2, y = -s / 2;
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + s, y, x + s, y + s, r);
  ctx.arcTo(x + s, y + s, x, y + s, r);
  ctx.arcTo(x, y + s, x, y, r);
  ctx.arcTo(x, y, x + s, y, r);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(img, x, y, s, s);
  ctx.restore();
  // light sweep across the mark
  if (opts.sweep) {
    const sy = opts.sweep;
    ctx.save();
    ctx.beginPath();
    const rr2 = s * 0.235;
    ctx.moveTo(x + rr2, y);
    ctx.arcTo(x + s, y, x + s, y + s, rr2);
    ctx.arcTo(x + s, y + s, x, y + s, rr2);
    ctx.arcTo(x, y + s, x, y, rr2);
    ctx.arcTo(x, y, x + s, y, rr2);
    ctx.closePath();
    ctx.clip();
    const lx = x - s * 0.6 + sy * s * 2.2;
    const g = ctx.createLinearGradient(lx, y, lx + s * 0.5, y + s);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.5, "rgba(255,255,255,0.55)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = g;
    ctx.fillRect(x, y, s, s);
    ctx.restore();
  }
  ctx.restore();
}

/* ---------- transitions ---------- */
function sweepWipe(ctx, p, color = C.green) {
  if (p <= 0 || p >= 1) return;
  const y = lerp(H * 1.1, -H * 0.1, E.easeInOut(p));
  const g = ctx.createLinearGradient(0, y - 300, 0, y + 300);
  g.addColorStop(0, rgba(color, 0));
  g.addColorStop(0.5, rgba(color, 0.85));
  g.addColorStop(1, rgba(color, 0));
  ctx.save();
  ctx.filter = "blur(24px)";
  ctx.fillStyle = g;
  ctx.fillRect(0, y - 300, W, 600);
  ctx.restore();
}

function fadeTo(ctx, a) {
  if (a <= 0) return;
  ctx.fillStyle = `rgba(4,5,4,${clamp(a)})`;
  ctx.fillRect(0, 0, W, H);
}

module.exports = {
  TEX, studio, avenue, mapWorld, pin, scooter, wheel, bag, foodBox, counter, logoMark, sweepWipe, fadeTo,
};

/* place a point a given distance in front of the camera, offset sideways */
function onAxis(cam, dist, side = 0, up = 0) {
  const f = cam.f, r = cam.r, u = cam.u;
  return [
    cam.pos[0] + f[0] * dist + r[0] * side + u[0] * up,
    cam.pos[1] + f[1] * dist + r[1] * side + u[1] * up,
    cam.pos[2] + f[2] * dist + r[2] * side + u[2] * up,
  ];
}
module.exports.onAxis = onAxis;

/* ---------- shop facade (restaurant / store) ---------- */
function storefront(ctx, cam, t, o = {}) {
  const wz = -3.2;
  // building mass
  drawBox(ctx, cam, { p: [0, 1.6, wz - 0.6] }, [7.2, 3.2, 1.6], o.wall || "#20261D", { amb: 0.45, key: 0.8, rimK: 0.8 });
  // glowing shop window
  const win = [
    [-2.4, 0.15, wz + 0.22], [2.4, 0.15, wz + 0.22], [2.4, 2.0, wz + 0.22], [-2.4, 2.0, wz + 0.22],
  ];
  drawQuad(ctx, cam, win, o.win || "#2E3A22");
  const wc = cam.project([0, 1.05, wz + 0.22]);
  if (wc) {
    glow(ctx, wc.x, wc.y, 520 * (wc.s / 800), o.winGlow || "#8DFF52", o.winGlowA === undefined ? 0.20 : o.winGlowA);
  }
  // window mullions
  for (let i = -1; i <= 1; i++) {
    const a = cam.project([i * 1.2, 0.15, wz + 0.24]), b = cam.project([i * 1.2, 2.0, wz + 0.24]);
    if (a && b) { ctx.strokeStyle = "rgba(10,12,9,0.75)"; ctx.lineWidth = Math.max(2, 8 * (a.s / 800)); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
  }
  const wl = cam.project([-2.4, 0.15, wz + 0.24]), wr = cam.project([2.4, 0.15, wz + 0.24]);
  if (wl && wr) {
    ctx.strokeStyle = "rgba(10,12,9,0.8)"; ctx.lineWidth = Math.max(2, 10 * (wl.s / 800));
    ctx.beginPath(); ctx.moveTo(wl.x, wl.y); ctx.lineTo(wr.x, wr.y); ctx.stroke();
  }
  // fascia band with green neon
  drawBox(ctx, cam, { p: [0, 2.34, wz + 0.3] }, [7.0, 0.5, 0.12], "#171C14", { amb: 0.5 });
  const n1 = cam.project([-2.9, 2.5, wz + 0.37]), n2 = cam.project([2.9, 2.5, wz + 0.37]);
  if (n1 && n2) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const g = ctx.createLinearGradient(n1.x, n1.y, n2.x, n2.y);
    g.addColorStop(0, rgba(C.green, 0)); g.addColorStop(0.5, rgba(C.green, 0.85)); g.addColorStop(1, rgba(C.green, 0));
    ctx.strokeStyle = g; ctx.lineWidth = Math.max(2, 7 * (n1.s / 800));
    ctx.beginPath(); ctx.moveTo(n1.x, n1.y); ctx.lineTo(n2.x, n2.y); ctx.stroke();
    ctx.restore();
    glow(ctx, (n1.x + n2.x) / 2, (n1.y + n2.y) / 2, 300, C.green, 0.18);
  }
}

/* ---------- hex dispatch cells ---------- */
function hexRing(ctx, cam, center, t, o = {}) {
  const R = o.radius || 2.6;
  const rings = o.rings === undefined ? 2 : o.rings;
  const size = o.size || 1.25;
  const appear = o.appear === undefined ? 1 : o.appear;
  const cells = [];
  for (let q = -rings; q <= rings; q++) {
    for (let r = -rings; r <= rings; r++) {
      const s = -q - r;
      if (Math.max(Math.abs(q), Math.abs(r), Math.abs(s)) > rings) continue;
      const x = R * 1.5 * q, z = R * Math.sqrt(3) * (r + q / 2);
      const d = Math.max(Math.abs(q), Math.abs(r), Math.abs(s));
      cells.push({ x, z, d, q, r });
    }
  }
  cells.sort((a, b) => cam.depth([center[0] + b.x, 0, center[2] + b.z]) - cam.depth([center[0] + a.x, 0, center[2] + a.z]));
  for (const c of cells) {
    const delay = c.d * 0.22;
    const a = clamp((appear - delay) / 0.5);
    if (a <= 0) continue;
    const cx = center[0] + c.x, cz = center[2] + c.z;
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const ang = (Math.PI / 3) * i + Math.PI / 6;
      pts.push([cx + Math.cos(ang) * size, 0.06, cz + Math.sin(ang) * size]);
    }
    const p2 = pts.map((p) => cam.project(p));
    if (p2.some((p) => !p)) continue;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.beginPath();
    ctx.moveTo(p2[0].x, p2[0].y);
    for (let i = 1; i < 6; i++) ctx.lineTo(p2[i].x, p2[i].y);
    ctx.closePath();
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.4 - c.d * 0.8);
    ctx.fillStyle = rgba(C.green, 0.05 + 0.06 * pulse);
    ctx.fill();
    ctx.strokeStyle = rgba(C.green, 0.25 + 0.35 * pulse);
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }
}

/* ---------- energy packet travelling between devices ---------- */
function packet(ctx, from, to, p, o = {}) {
  const t = E.clamp(p);
  if (t <= 0 || t >= 1) return;
  const x = E.lerp(from.x, to.x, E.easeInOut(t));
  const y = E.lerp(from.y, to.y, E.easeInOut(t)) - Math.sin(Math.PI * t) * (o.arc || 160);
  const r = (o.size || 16) * (1 - 0.3 * t);
  glow(ctx, x, y, r * 4.2, o.color || C.green, 0.55);
  ctx.save();
  ctx.fillStyle = "#0F0F0F";
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = rgba(o.color || C.green, 0.95); ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = o.color || C.green;
  ctx.beginPath(); ctx.arc(x, y, r * 0.42, 0, Math.PI * 2); ctx.fill();
  // trail
  for (let i = 1; i <= 5; i++) {
    const tt = Math.max(0, t - i * 0.035);
    const tx = E.lerp(from.x, to.x, E.easeInOut(tt));
    const ty = E.lerp(from.y, to.y, E.easeInOut(tt)) - Math.sin(Math.PI * tt) * (o.arc || 160);
    ctx.globalAlpha = 0.30 - i * 0.05;
    ctx.fillStyle = o.color || C.green;
    ctx.beginPath(); ctx.arc(tx, ty, r * (1 - i * 0.12), 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

module.exports.storefront = storefront;
module.exports.hexRing = hexRing;
module.exports.packet = packet;
