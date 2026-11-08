"use strict";
const fs = require("fs");
const path = require("path");
const E = require("./engine");
const { renderDevice, screenCanvas } = require("./phone");
const S = require("./screens");
const U = require("./ui");

const ASSETS = path.join(__dirname, "..", "assets");
const NAMES = ["burger", "pizza", "salad", "drinks", "grocery", "pharmacy", "restaurant", "storefront"];

async function loadAssets() {
  const logos = [
    path.join(__dirname, "..", "..", "public", "icons", "icon-192.png"),
    path.join(__dirname, "..", "..", "public", "icons", "icon-512.png"),
  ];
  const map = {};
  for (const n of NAMES) {
    const p = path.join(ASSETS, n + ".png");
    if (fs.existsSync(p)) map[n] = await E.loadImage(p);
  }
  for (const p of logos) if (fs.existsSync(p)) { map.logo = await E.loadImage(p); break; }
  U.setImages(map);
  return map;
}

async function still(out, kind, t, opts = {}) {
  await loadAssets();
  const cv = E.createCanvas(E.W, E.H);
  const ctx = cv.getContext("2d");
  const cam = E.makeCam(opts.cam || { pos: [0.9, 0.5, 3.2], target: [0, 0, 0], fov: 38 });
  const bg = ctx.createRadialGradient(E.W / 2, E.H * 0.45, 30, E.W / 2, E.H * 0.5, E.H * 0.7);
  bg.addColorStop(0, "#151A13"); bg.addColorStop(1, "#050605");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, E.W, E.H);
  E.particles(ctx, cam, t, { n: 40, spread: 8, height: 5, depth: 6, base: -1.6 });
  const SC = 2;
  const sc = screenCanvas("s_" + kind, 520 * SC, 1134 * SC, (x) => {
    x.scale(SC, SC);
    S[kind](x, 520, 1134, t, opts.o || {});
  });
  renderDevice(ctx, cam, opts.m || { p: [0, 0, 0], ry: -0.3, rx: 0.02 }, sc, {});
  const postc = E.makePost();
  E.post(ctx, postc, 0, { bloom: 0.18 });
  fs.writeFileSync(out, cv.toBuffer("image/png"));
  console.log("wrote", out);
}

still(path.join(__dirname, "..", "renders", "still-home.png"), "home", 1.2, {}).catch((e) => { console.error(e); process.exit(1); });
