"use strict";
/**
 * Hex grid helper. Uses h3-js when installed (production); falls back to a
 * simple square grid so logic/tests run without the dependency.
 * Resolution 8 (~460 m edge) suits a town like Berrechid; ring k=2 ≈ 1.5 km.
 */
let h3 = null;
try { h3 = require("h3-js"); } catch (_e) { h3 = null; }

const RES = Number(process.env.DISPATCH_H3_RES || 8);
const STEP = 0.005; // fallback cell size in degrees (~550 m)

function cellOf(lat, lng) {
  if (h3) return h3.latLngToCell(lat, lng, RES);
  return `sq:${Math.floor(lat / STEP)}:${Math.floor(lng / STEP)}`;
}

function ringOf(cell, k = 2) {
  if (h3) return h3.gridDisk(cell, k);
  const [, a, b] = String(cell).split(":").map((x, i) => (i ? Number(x) : x));
  const out = [];
  for (let i = -k; i <= k; i++) for (let j = -k; j <= k; j++) out.push(`sq:${a + i}:${b + j}`);
  return out;
}

/** [[lat,lng],...] polygon for map drawing. */
function boundary(cell) {
  if (h3) return h3.cellToBoundary(cell);
  const [, a, b] = String(cell).split(":").map((x, i) => (i ? Number(x) : x));
  const la = a * STEP, lo = b * STEP;
  return [[la, lo], [la + STEP, lo], [la + STEP, lo + STEP], [la, lo + STEP]];
}

module.exports = { cellOf, ringOf, boundary, engine: h3 ? "h3" : "square-fallback", RES };
