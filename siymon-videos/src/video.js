"use strict";
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const E = require("./engine");
const U = require("./ui");
const AUD = require("./audio");
const FFMPEG = require("@ffmpeg-installer/ffmpeg").path;

const ASSETS = path.join(__dirname, "..", "assets");
const NAMES = ["burger", "pizza", "salad", "drinks", "grocery", "pharmacy", "restaurant", "storefront"];

async function loadAssets() {
  const map = {};
  for (const n of NAMES) {
    const p = path.join(ASSETS, n + ".png");
    if (fs.existsSync(p)) map[n] = await E.loadImage(p);
  }
  const logo = path.join(__dirname, "..", "..", "public", "icons", "icon-512.png");
  map.logo = await E.loadImage(logo);
  U.setImages(map);
  return map;
}

function sceneAt(def, t) {
  for (const s of def.scenes) if (t >= s.t0 && t < s.t1) return s;
  return def.scenes[def.scenes.length - 1];
}

function drawFrame(ctx, def, t, frame) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, E.W, E.H);
  ctx.fillStyle = "#050605";
  ctx.fillRect(0, 0, E.W, E.H);
  const s = sceneAt(def, t);
  const u = t - s.t0;
  const dur = s.t1 - s.t0;
  ctx.save();
  s.draw(ctx, u, t, frame, dur);
  ctx.restore();
  // scene transition: quick dip + green sweep on boundaries
  let tr = 0;
  const fadeIn = s.fadeIn === undefined ? 0.34 : s.fadeIn;
  const fadeOut = s.fadeOut === undefined ? 0.22 : s.fadeOut;
  if (u < fadeIn && s.fade !== false) tr = Math.max(tr, 1 - E.smooth(u / fadeIn));
  if (dur - u < fadeOut && s.fade !== false) tr = Math.max(tr, 1 - E.smooth((dur - u) / fadeOut));
  if (tr > 0 && s.fade !== false) {
    ctx.fillStyle = `rgba(4,5,4,${tr * 0.92})`;
    ctx.fillRect(0, 0, E.W, E.H);
  }
  E.post(ctx, def._post, frame, { bloom: (s.bloom === undefined ? 0.5 : s.bloom) * (def.BLOOM_K || 0.62), grain: s.grain });
}

async function renderFull(def) {
  const outDir = path.join(__dirname, "..", "renders");
  fs.mkdirSync(outDir, { recursive: true });
  const silent = path.join(outDir, def.name + "-silent.mp4");
  const wav = path.join(outDir, def.name + ".wav");
  const final = path.join(__dirname, "..", def.file);

  await loadAssets();
  def._post = E.makePost();
  const fps = E.FPS;
  const total = Math.round(def.duration * fps);

  const ff = spawn(FFMPEG, [
    "-y", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", `${E.W}x${E.H}`, "-r", String(fps), "-i", "-",
    "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p",
    "-movflags", "+faststart", silent,
  ], { stdio: ["pipe", "inherit", "inherit"] });

  const cv = E.createCanvas(E.W, E.H);
  const ctx = cv.getContext("2d");
  const t0 = Date.now();
  for (let f = 0; f < total; f++) {
    const t = f / fps;
    drawFrame(ctx, def, t, f);
    const buf = cv.data ? cv.data() : null;
    const raw = Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength);
    if (!ff.stdin.write(raw)) await new Promise((r) => ff.stdin.once("drain", r));
    if (f % 60 === 0) {
      const el = (Date.now() - t0) / 1000;
      process.stdout.write(`\r${def.name}: ${f}/${total} frames  ${(f / el || 0).toFixed(1)} fps   `);
    }
  }
  ff.stdin.end();
  await new Promise((res, rej) => ff.on("close", (c) => (c === 0 ? res() : rej(new Error("ffmpeg exit " + c)))));

  // audio
  const b = AUD.score({ duration: def.duration, bpm: def.bpm || 104, cues: def.cues || [], energy: def.energy || 1 });
  AUD.writeWav(wav, b);
  await new Promise((res, rej) => {
    const mux = spawn(FFMPEG, [
      "-y", "-i", silent, "-i", wav, "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest",
      "-movflags", "+faststart", final,
    ], { stdio: "inherit" });
    mux.on("close", (c) => (c === 0 ? res() : rej(new Error("mux failed"))));
  });
  const mb = (fs.statSync(final).size / 1e6).toFixed(1);
  console.log(`\n✓ ${final}  (${mb} MB, ${def.duration}s)`);
}

async function renderStills(def, times) {
  await loadAssets();
  def._post = E.makePost();
  const cv = E.createCanvas(E.W, E.H);
  const ctx = cv.getContext("2d");
  const dir = path.join(__dirname, "..", "renders", "stills");
  fs.mkdirSync(dir, { recursive: true });
  for (const t of times) {
    drawFrame(ctx, def, t, Math.round(t * E.FPS));
    const p = path.join(dir, `${def.name}-${String(t).replace(".", "_")}.png`);
    fs.writeFileSync(p, cv.toBuffer("image/png"));
    console.log("wrote", p);
  }
}

async function main() {
  const which = process.argv[2];
  const def = require("./video" + which + ".js");
  const rest = process.argv.slice(3);
  if (rest.length && rest[0] === "audio") {
    await loadAssets();
    const b = AUD.score({ duration: def.duration, bpm: def.bpm || 104, cues: def.cues || [], energy: def.energy || 1 });
    const p = path.join(__dirname, "..", "renders", def.name + ".wav");
    fs.mkdirSync(path.dirname(p), { recursive: true });
    AUD.writeWav(p, b);
    console.log("wrote", p);
    return;
  }
  if (rest.length) await renderStills(def, rest.map(Number));
  else await renderFull(def);
}

main().catch((e) => { console.error(e); process.exit(1); });
