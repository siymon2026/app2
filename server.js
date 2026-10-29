require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const zlib = require("zlib");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const { body, validationResult } = require("express-validator");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const csrf = require("csurf");
const driverFeedback = require("./lib/driver-feedback");
const notifCore = require("./notifications-core");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const net = require("net");

// Optional (enabled when GOOGLE_CLIENT_ID is set)
let OAuth2Client = null;
try {
  // eslint-disable-next-line global-require
  ({ OAuth2Client } = require("google-auth-library"));
} catch (_e) {
  OAuth2Client = null;
}

// Optional (Web Push notifications)
let webPush = null;
try {
  // eslint-disable-next-line global-require
  webPush = require("web-push");
} catch (_e) {
  webPush = null;
}

const { logger, morganStream } = require("./logger");
const catalogLib = require("./lib/catalog");
const searchLib = require("./lib/search");
const storesLib = require("./lib/stores");
const paymentsLib = require("./lib/payments");
const orderState = require("./lib/order-state");
const verifyCodes = require("./lib/verify-codes");
const offlineSync = require("./lib/offline-sync");
const walletLedger = require("./lib/wallet-ledger");
const deliveryPricing = require("./lib/delivery-pricing");
const serviceZones = require("./lib/service-zones");
const driverEarnings = require("./lib/driver-earnings");
const financeLib = require("./lib/finance");
const adminRoles = require("./lib/admin-roles");
const { createAuditLog } = require("./lib/audit-log");
const dataProtectionLib = require("./lib/data-protection");
const systemSettingsLib = require("./lib/system-settings");
const exceptionsLib = require("./lib/exceptions");
const complaintsLib = require("./lib/complaints");
const driverReview = require("./lib/driver-review");
const storeReview = require("./lib/store-review");
const ratingsLib = require("./lib/ratings");
const pushRetry = require("./lib/push-retry");
const driverPrivacy = require("./lib/driver-privacy");
const promoLib = require("./lib/promo");
const paymentMethods = require("./lib/payment-methods");
const orderPayment = require("./lib/order-payment");
const topupsLib = require("./lib/topups");
const addressesLib = require("./lib/addresses");
const customerAccount = require("./lib/customer-account");
const geocodeLib = require("./lib/geocode");
let pkgVersion = "";
try {
  // eslint-disable-next-line import/no-dynamic-require
  pkgVersion = require("./package.json").version || "";
} catch (_e) {}

// -------------------------
// Env validation (fail-fast)
// -------------------------
const IS_PROD =
  String(process.env.NODE_ENV || "").toLowerCase() === "production";

function mustGetEnv(name) {
  const v = String(process.env[name] || "").trim();
  if (!v) {
    const msg = `[FATAL] Missing required env var: ${name}`;
    // logger may not be fully ready yet, so fallback to stderr
    try {
      logger.error(msg);
    } catch (_e) {}
    console.error(msg);
    process.exit(1);
  }
  return v;
}

function validatePort() {
  const raw = process.env.PORT;
  if (raw === undefined || raw === null || String(raw).trim() === "") return; // allow default
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0 || n > 65535) {
    const msg = `[FATAL] PORT must be an integer between 1 and 65535`;
    try {
      logger.error(msg, { raw });
    } catch (_e) {}
    console.error(msg);
    process.exit(1);
  }
}

(function validateEnv() {
  validatePort();

  // JWT secret MUST be set in production
  if (IS_PROD) {
    mustGetEnv("JWT_SECRET");
  }

  // If you intend to run Prisma/DB bootstrap in production, enforce DATABASE_URL.
  // (We keep it optional because the current server still uses JSON storage.)
  const requireDb =
    String(process.env.REQUIRE_DATABASE_URL || "").trim() === "1";
  if (requireDb) {
    mustGetEnv("DATABASE_URL");
  }
})();

// Google Sign-In (Customer) — enabled when GOOGLE_CLIENT_ID is provided
const GOOGLE_CLIENT_ID = String(process.env.GOOGLE_CLIENT_ID || "").trim();
const GOOGLE_AUTH_ENABLED = !!(GOOGLE_CLIENT_ID && OAuth2Client);
const googleOauthClient = GOOGLE_AUTH_ENABLED ? new OAuth2Client() : null;

// Apple Sign-In (Driver) — enabled when APPLE_CLIENT_ID (Services ID) and
// APPLE_REDIRECT_URI are provided. The id_token is verified against Apple's JWKS.
const APPLE_CLIENT_ID = String(process.env.APPLE_CLIENT_ID || "").trim();
const APPLE_REDIRECT_URI = String(process.env.APPLE_REDIRECT_URI || "").trim();
const APPLE_JWKS_URL = String(
  process.env.APPLE_JWKS_URL || "https://appleid.apple.com/auth/keys",
).trim();
const APPLE_ISSUER = "https://appleid.apple.com";
const APPLE_AUTH_ENABLED = !!(APPLE_CLIENT_ID && APPLE_REDIRECT_URI);

// Web Push (Real Push Notifications) — enabled when VAPID keys are configured
const WEBPUSH_SUBJECT = String(
  process.env.WEBPUSH_SUBJECT || "mailto:admin@siymon.unaux.com",
).trim();
const WEBPUSH_VAPID_PUBLIC_KEY = String(
  process.env.WEBPUSH_VAPID_PUBLIC_KEY || "",
).trim();
const WEBPUSH_VAPID_PRIVATE_KEY = String(
  process.env.WEBPUSH_VAPID_PRIVATE_KEY || "",
).trim();

const WEBPUSH_ENABLED = !!(
  webPush &&
  WEBPUSH_VAPID_PUBLIC_KEY &&
  WEBPUSH_VAPID_PRIVATE_KEY
);

// Fail-fast if partially configured (common misconfig)
if (IS_PROD) {
  const partial =
    (WEBPUSH_VAPID_PUBLIC_KEY && !WEBPUSH_VAPID_PRIVATE_KEY) ||
    (!WEBPUSH_VAPID_PUBLIC_KEY && WEBPUSH_VAPID_PRIVATE_KEY);
  if (partial) {
    const msg =
      "[FATAL] Web Push misconfigured: set BOTH WEBPUSH_VAPID_PUBLIC_KEY and WEBPUSH_VAPID_PRIVATE_KEY";
    try {
      logger.error(msg);
    } catch (_e) {}
    console.error(msg);
    process.exit(1);
  }
}

if (WEBPUSH_ENABLED) {
  try {
    webPush.setVapidDetails(
      WEBPUSH_SUBJECT || "mailto:admin@siymon.unaux.com",
      WEBPUSH_VAPID_PUBLIC_KEY,
      WEBPUSH_VAPID_PRIVATE_KEY,
    );
  } catch (e) {
    const msg =
      "[FATAL] Failed to init Web Push (web-push): " +
      String(e && e.message ? e.message : e);
    try {
      logger.error(msg);
    } catch (_e) {}
    console.error(msg);
    process.exit(1);
  }
}

/***********************
 * ESC/POS Logo raster (monochrome)
 * Generated from public/icons/icon-192.png
 ***********************/
const LOGO_RASTER_WB = 24; // 192px / 8
const LOGO_RASTER_H = 192;
const LOGO_RASTER = Buffer.from(
  "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD8AAAAAAAHgAAAAAAAAAAAAAAAAAAAAAH/gAAAAAAf4AAAAAAAAAAAAAAAAAAAAAH/8AAAAAA/+AAAAAAAAAAAAAAAAAAAAAH//AAAAAB//AAAAAAAAAAAAAAAAAAAAAP//gAAAAD//AAAAAAAAAAAAAAAAAAAAAf//wAAAAD//gAAAAAAAAAAAAAAAAAAAAf//4AAAAAf/gAAAAAAAAAAAAAAAAAAAA///4AgAAAP/wAAAAAAAAAAAAAAAAAAAA///8AwAGAP/wAAAAAAAAAAAAAAAAAAAB///8BwAGAH/wAAAAAAAAAAAAAAAAAAAD///8D4AGAH/wAAAAAAAAAAAAAAAAAAAH/P/+H8APAH/wAAAAAAAAAAAAAAAAEAAP/D/+P+APAH/4AAAAAAAAAAAAAAAAGAAf/B////AfgP/4AAAAAAAAAAAAAAAADAA/+A////h/4f/wAAAAAAAAAAAAAAAADwD/+A/////////wAAAAAAAAAAAAAAAAD///8A/////////wAAAAAAAAAAAAAAAAD///8A/9/9/////wAAAAAAAAAAAAAAAAD///8h/9/8/////wAAAAAAAAAAAAAAAAB///4//4/4/////wAAAAAAAAAAAAAAAAB///4//4/4f////gAAAAAAAAAAAAAAAAB///w//w/wP/7//AAAAAAAAAAAAAAAAAA///g//gfgH/x//AAAAAAAAAAAAAAAAAA///gf/AeAD/w/8AAAAAAAAAAAAAAAAAAf//Af+AAAB/AP4AAAAAAAAAAAAAAAAAAP/+AHwAAAAcAAAAAAAAAAAAAAAAAAAAAH/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAfAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEOAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMEEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAPAOOGM88GYc8AAAAAAAAAAAAAAAAAAAAP4OGAMMMMMMMAAAAAAAAAAAAAAAAAAAAH8OGAMMOMMMMAAAAAAAAAAAAAAAAAAAAB+OHAMMOcOMMAAAAAAAAAAAAAAAAAAAAAOODAMMOcOMMAAAAAAAAAAAAAAAAAAAAAGODAMMOcMMMAAAAAAAAAAAAAAAAAAAAIGODgMMOMMMMAAAAAAAAAAAAAAAAAAAAIEOBgMMOMIMMAAAAAAAAAAAAAAAAAAAAEAGBgMMMCQMMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  "base64",
);

const app = express();

// Request ID (helps tracing logs)
app.use((req, res, next) => {
  const incoming = String(req.headers["x-request-id"] || "").trim();
  const rid =
    incoming ||
    (crypto.randomUUID
      ? crypto.randomUUID()
      : crypto.randomBytes(16).toString("hex"));
  req.requestId = rid;
  res.setHeader("X-Request-Id", rid);
  next();
});

// HTTP access logging -> ./logs (and stdout)
app.use(
  morgan(process.env.MORGAN_FORMAT || "combined", {
    stream: morganStream,
    skip: (req) => {
      const p = String(req.originalUrl || req.url || "");
      // avoid noisy metrics/health logs
      return p.startsWith("/metrics") || p.startsWith("/health");
    },
  }),
);

// CORS
const CORS_ORIGINS = String(process.env.CORS_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const corsOptions = {
  origin: (origin, cb) => {
    // non-browser / same-origin
    if (!origin) return cb(null, true);

    if (CORS_ORIGINS.length === 0) {
      // dev convenience: allow all if not configured
      if (!IS_PROD) return cb(null, true);
      // production fallback: allow the default domain to avoid locking yourself out
      if (
        origin === "https://siymon.unaux.com" ||
        origin === "http://siymon.unaux.com"
      )
        return cb(null, true);
      return cb(new Error("CORS is not configured"));
    }

    if (CORS_ORIGINS.includes(origin)) return cb(null, true);
    return cb(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-CSRF-Token",
    "X-Request-Id",
  ],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

// Friendly CORS error
app.use((err, req, res, next) => {
  const msg = String(err && err.message ? err.message : "");
  if (msg.includes("CORS")) {
    return res.status(403).json({ error: msg });
  }
  return next(err);
});

// ✅ Compression (gzip + br) بدون أي native modules
// - يحل مشكلة Windows/node-gyp (Visual Studio build tools)
// - Express compression يدعم gzip + brotli عبر zlib المدمج
//   (Brotli متاح من Node v10.16+)
const GZIP_LEVEL = Number(process.env.GZIP_LEVEL || 6);
const BROTLI_QUALITY = Number(process.env.BROTLI_QUALITY || 4);

app.use(
  compression({
    level: Number.isFinite(GZIP_LEVEL)
      ? Math.min(9, Math.max(-1, GZIP_LEVEL))
      : 6,
    brotli: {
      params: {
        [zlib.constants.BROTLI_PARAM_QUALITY]: Number.isFinite(BROTLI_QUALITY)
          ? Math.min(11, Math.max(0, BROTLI_QUALITY))
          : 4,
      },
    },
  }),
);

// ✅ Security hardening
// - Hide framework signature
// - Add standard security headers via Helmet
// - Add a strict Content-Security-Policy (no inline scripts)
// - Add API rate limiting + stronger login protection
app.disable("x-powered-by");

// If you run behind a reverse proxy (Nginx/Cloudflare/Heroku), set TRUST_PROXY=1
// so req.ip is the real client IP (important for rate limiting).
// Example: TRUST_PROXY=1 npm start
if (process.env.TRUST_PROXY) {
  const raw = String(process.env.TRUST_PROXY).trim().toLowerCase();
  const n = Number(raw);
  if (!Number.isNaN(n)) app.set("trust proxy", n);
  else if (raw === "true") app.set("trust proxy", 1);
  else if (raw === "false") app.set("trust proxy", false);
}

// Optional: force HTTPS in production (recommended behind a reverse proxy with SSL)
// Enable with FORCE_HTTPS=1
if (String(process.env.FORCE_HTTPS || "").trim() === "1") {
  app.use((req, res, next) => {
    const xfProto = String(req.headers["x-forwarded-proto"] || "")
      .split(",")[0]
      .trim()
      .toLowerCase();
    const isHttps = req.secure || xfProto === "https";
    const host = String(req.headers.host || "");
    const isLocal =
      host.startsWith("localhost") ||
      host.startsWith("127.0.0.1") ||
      host.startsWith("0.0.0.0");
    if (isHttps || isLocal) return next();
    // For browsers: redirect GET; for APIs: reject
    if (String(req.method || "").toUpperCase() === "GET") {
      return res.redirect(301, "https://" + host + req.originalUrl);
    }
    return res.status(403).json({ error: "HTTPS required" });
  });
}

// Helmet defaults are great, but Cross-Origin-Embedder-Policy can break loading
// cross-origin images (Unsplash, etc.), so we disable it here.
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false, // إلغاء حظر النوافذ المنبثقة تماماً
    referrerPolicy: { policy: "strict-origin-when-cross-origin" }, // السماح لجوجل بمعرفة مصدر الطلب
  }),
);

// Map tiles for the live maps. Override with MAP_TILE_URL (e.g. a commercial
// provider); the OSM public server is for light use only.
const MAP_TILE_URL =
  process.env.MAP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
let MAP_TILE_ORIGIN = "https://tile.openstreetmap.org";
try {
  MAP_TILE_ORIGIN = new URL(MAP_TILE_URL.replace(/\{[a-z]\}/g, "0")).origin;
} catch (_e) {}

// Strong CSP: blocks inline scripts and untrusted sources.
// Note: we allow inline styles because the UI generates some inline style attributes.
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      objectSrc: ["'none'"],
      // These existing, same-origin applications are also shown inside the admin
      // shell. Keep every other page unframeable, including by this origin.
      frameAncestors: [(req) => /^\/(?:store|restaurant|admin\/zones)(?:\/|\/index\.html)?$/.test(req.path) ? "'self'" : "'none'"],
      // Google Sign-In (GIS) requires loading scripts/iframes from Google
      scriptSrc: [
        "'self'",
        "https://accounts.google.com",
        "https://www.gstatic.com",
        "https://appleid.cdn-apple.com",
        // Leaflet (same approach as the Wajbatna project), pinned to 1.9.4
        "https://cdnjs.cloudflare.com",
      ],
      scriptSrcAttr: ["'none'"],
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://accounts.google.com",
        "https://cdnjs.cloudflare.com",
      ],
      imgSrc: [
        "'self'",
        "data:",
        "blob:",
        "https://uploads.onecompiler.io",
        "https://images.unsplash.com",
        "https://lh3.googleusercontent.com",
        MAP_TILE_ORIGIN,
      ],
      connectSrc: [
        "'self'",
        "https://nominatim.openstreetmap.org",
        "https://accounts.google.com",
        "https://oauth2.googleapis.com",
        "https://www.googleapis.com",
        "https://appleid.apple.com",
      ],
      frameSrc: ["'self'", "https://accounts.google.com", "https://appleid.apple.com"],
      fontSrc: ["'self'", "data:"],
      mediaSrc: ["'self'"],
      manifestSrc: ["'self'"],
      workerSrc: ["'self'"],
      formAction: ["'self'"],
    },
  }),
);

// -------------------------
// Health & readiness
// -------------------------
let _pgPool = null;
function getPgPool() {
  if (_pgPool) return _pgPool;
  const url = String(process.env.DATABASE_URL || "").trim();
  if (!url) return null;
  try {
    const { Pool } = require("pg");
    _pgPool = new Pool({
      connectionString: url,
      max: 1,
      idleTimeoutMillis: 5000,
      connectionTimeoutMillis: 2500,
    });
    return _pgPool;
  } catch (_e) {
    return null;
  }
}

app.get(["/health", "/healthz"], (req, res) => {
  return res.json({
    ok: true,
    service: "siymon-server",
    version: pkgVersion || undefined,
    env: process.env.NODE_ENV || "",
    uptimeSec: Math.round(process.uptime()),
    time: new Date().toISOString(),
  });
});

app.get(["/ready", "/readyz"], async (req, res) => {
  const wantDb = String(process.env.HEALTHCHECK_DB || "").trim() === "1";
  const out = {
    ok: true,
    service: "siymon-server",
    version: pkgVersion || undefined,
    checks: { db: "skipped" },
    time: new Date().toISOString(),
  };

  if (wantDb) {
    const pool = getPgPool();
    if (!pool) {
      out.ok = false;
      out.checks.db = "missing DATABASE_URL";
    } else {
      try {
        await pool.query("SELECT 1");
        out.checks.db = "ok";
      } catch (e) {
        out.ok = false;
        out.checks.db = "fail";
        out.dbError = String(e && e.message ? e.message : e);
      }
    }
  }

  return res.status(out.ok ? 200 : 503).json(out);
});

// -------------------------
// Prometheus metrics (optional)
// -------------------------
const METRICS_ENABLED =
  String(process.env.METRICS_ENABLED || "").trim() === "1";
const METRICS_TOKEN = String(process.env.METRICS_TOKEN || "").trim();
let metricsRegister = null;
let httpHistogram = null;

if (METRICS_ENABLED) {
  try {
    const client = require("prom-client");
    metricsRegister = new client.Registry();
    client.collectDefaultMetrics({ register: metricsRegister });

    httpHistogram = new client.Histogram({
      name: "http_request_duration_ms",
      help: "HTTP request duration in ms",
      labelNames: ["method", "route", "status"],
      buckets: [25, 50, 100, 250, 500, 1000, 2500, 5000],
      registers: [metricsRegister],
    });

    app.use((req, res, next) => {
      const start = Date.now();
      res.on("finish", () => {
        try {
          const ms = Date.now() - start;
          const route =
            req.route && req.route.path
              ? String(req.route.path)
              : String(req.path || "");
          httpHistogram.observe(
            { method: req.method, route, status: String(res.statusCode) },
            ms,
          );
        } catch (_e) {}
      });
      next();
    });

    app.get("/metrics", async (req, res) => {
      if (METRICS_TOKEN) {
        const auth = String(req.headers.authorization || "");
        const tok = auth.toLowerCase().startsWith("bearer ")
          ? auth.slice(7).trim()
          : "";
        if (tok !== METRICS_TOKEN)
          return res.status(401).json({ error: "Unauthorized" });
      }
      res.setHeader("Content-Type", metricsRegister.contentType);
      return res.end(await metricsRegister.metrics());
    });
  } catch (e) {
    logger.warn("METRICS_ENABLED=1 but prom-client failed to load", {
      error: String(e && e.message ? e.message : e),
    });
  }
}

// Limits are configurable from the settings center (group "limits", server-validated bounds).
// The raw config is memoised for 2 s so the limiters do not touch the disk on every request.
let _limitsMemo = { at: 0, v: null };
function currentLimits() {
  const t = Date.now();
  if (!_limitsMemo.v || t - _limitsMemo.at > 2000) {
    _limitsMemo = { at: t, v: systemSettingsLib.limitsFromConfig(readJson(CONFIG_FILE, {}) || {}, process.env) };
  }
  return _limitsMemo.v;
}
function invalidateLimits() { _limitsMemo = { at: 0, v: null }; }

// General API rate limiting (high enough not to break polling, but still protective)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: () => currentLimits().apiRateLimitMax, // per IP (default 3000)
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/", apiLimiter);

// Stronger limiter for admin APIs
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: () => currentLimits().adminRateLimitMax, // default 600 (or ADMIN_RATE_LIMIT_MAX)
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many admin requests. Please slow down." },
});
app.use("/api/admin", adminLimiter);

// Stronger login protection: fewer attempts + progressive delay on failures
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: () => currentLimits().loginMaxAttempts, // default 10
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: "Too many login attempts. Please try again later." },
});

function createLoginFailureSlowdown({
  windowMs,
  delayAfter,
  delayMs,
  maxDelayMs,
}) {
  const hits = new Map();

  function cleanup(now) {
    // Opportunistic cleanup (keeps memory bounded)
    for (const [k, v] of hits) {
      if (!v || now - v.resetAt > windowMs) hits.delete(k);
    }
  }

  return function loginFailureSlowdown(req, res, next) {
    const now = Date.now();
    cleanup(now);

    const key = req.ip || "unknown";
    const rec = hits.get(key) || { count: 0, resetAt: now };
    if (now - rec.resetAt > windowMs) {
      rec.count = 0;
      rec.resetAt = now;
    }

    // Delay based on *previous* failures (so a correct password is not slowed down)
    const over = Math.max(0, rec.count - delayAfter + 1);
    const delay = Math.min(over * delayMs, maxDelayMs);

    // Track failures after response finishes
    res.on("finish", () => {
      // Count only auth-related failures
      if (res.statusCode === 401 || res.statusCode === 403) {
        const n2 = Date.now();
        const cur = hits.get(key) || { count: 0, resetAt: n2 };
        if (n2 - cur.resetAt > windowMs) {
          cur.count = 0;
          cur.resetAt = n2;
        }
        cur.count += 1;
        hits.set(key, cur);
      }
    });

    if (delay > 0) return setTimeout(next, delay);
    return next();
  };
}

const loginSlowdown = createLoginFailureSlowdown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 3, // start slowing after 3 failed attempts
  delayMs: 600, // +600ms per extra failure
  maxDelayMs: 6000,
});

// ✅ Body size limits
// Default is small. Large limits are enabled ONLY for image upload routes.
const DEFAULT_BODY_LIMIT = String(process.env.DEFAULT_BODY_LIMIT || "1mb");
// Driver signup can include multiple base64 images (profile + ID set). Allow a bit more headroom by default.
// You can still override via IMAGE_BODY_LIMIT env.
const IMAGE_BODY_LIMIT = String(process.env.IMAGE_BODY_LIMIT || "30mb");

// Large body parsers (only for explicit image upload routes)
app.use(
  [
    "/api/admin/upload",
    "/api/admin/notifications",
    "/api/restaurant/upload",
    "/api/store/upload",
    "/api/driver/signup",
    "/api/driver/topups",
    "/api/driver/orders",
    "/api/customer/orders",
  ],
  express.json({ limit: IMAGE_BODY_LIMIT }),
);
app.use(
  [
    "/api/admin/upload",
    "/api/admin/notifications",
    "/api/restaurant/upload",
    "/api/store/upload",
    "/api/driver/signup",
    "/api/driver/topups",
    "/api/driver/orders",
    "/api/customer/orders",
  ],
  express.urlencoded({ extended: true, limit: IMAGE_BODY_LIMIT }),
);

// Default parsers for everything else
app.use(express.json({ limit: DEFAULT_BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: DEFAULT_BODY_LIMIT }));

// Audit logs for write operations (best-effort, non-breaking)
app.use("/api/", auditWriteRequests);

// Optional CSRF protection (disabled by default).
// Enable by setting ENABLE_CSRF=1.
// Note: CSRF is mainly relevant for cookie-based auth. Since this API uses Bearer/JWT tokens,
// it is safe to keep this off unless you add cookie-based sessions.
if (String(process.env.ENABLE_CSRF || "").trim() === "1") {
  app.use(cookieParser());
  const csrfProtection = csrf({
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: String(process.env.NODE_ENV || "").toLowerCase() === "production",
    },
  });
  app.use(csrfProtection);
  // Frontend can call this to get a CSRF token and send it back in "X-CSRF-Token".
  app.get("/api/csrf", (req, res) => {
    res.json({ ok: true, csrfToken: req.csrfToken() });
  });
}

function validate(validations) {
  return async (req, res, next) => {
    try {
      await Promise.all(validations.map((v) => v.run(req)));
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        // Keep the detailed errors array for UIs that need it,
        // but also expose a single human-readable "error" string
        // so clients don't fall back to generic messages.
        const arr = errors.array();
        const first = arr && arr[0] ? arr[0] : null;
        const field = String(first?.param || first?.path || "").trim();
        let msg = String(first?.msg || "Validation failed").trim();
        if (msg === "Invalid value" && field) msg = `Invalid ${field}`;
        return res
          .status(400)
          .json({ error: msg || "Validation failed", errors: arr });
      }
      next();
    } catch (e) {
      next(e);
    }
  };
}

function stripDangerous(v) {
  if (v === undefined || v === null) return v;
  return String(v)
    .replace(/[<>]/g, "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim();
}

function safeJsonKeys(obj) {
  try {
    if (!obj || typeof obj !== "object") return [];
    return Object.keys(obj).slice(0, 50);
  } catch (_e) {
    return [];
  }
}

// Append-only, hash-chained audit log (lib/audit-log.js). No update/delete exists; secrets are redacted before
// anything is written. Never throws: an audit failure must not break the request (settings changes are the
// exception and are fail-closed in lib/system-settings.js).
function appendAuditLog(entry) {
  return auditLog.append(entry);
}

function auditWriteRequests(req, res, next) {
  const method = String(req.method || "").toUpperCase();
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) return next();
  // High-frequency GPS pings: never audit-log them (I/O load + location trail).
  if (String(req.originalUrl || req.url || "").startsWith("/api/driver/location"))
    return next();
  const startedAt = Date.now();
  res.on("finish", () => {
    // Try to infer actor from JWT (works even before route-level middleware runs)
    let actorType = "anonymous";
    let actorId = "";
    let restaurantId = null;

    const auth = String(req.header("Authorization") || "");
    const bearer = auth.toLowerCase().startsWith("bearer ")
      ? auth.slice(7).trim()
      : "";
    const decoded = bearer ? verifyToken(bearer) : null;
    const role = decoded?.role ? String(decoded.role) : "";
    if (role === "admin") {
      actorType = "admin";
      actorId = String(decoded.id || decoded.sub || "");
    } else if (role === "restaurant") {
      actorType = "restaurant";
      actorId = String(decoded.id || decoded.sub || "");
      restaurantId = actorId;
    } else if (role === "restaurant_user") {
      actorType = "restaurant_user";
      actorId = String(decoded.id || decoded.sub || "");
      restaurantId = decoded.restaurantId ? String(decoded.restaurantId) : null;
    } else if (role === "customer") {
      actorType = "customer";
      actorId = String(decoded.id || decoded.sub || "");
    } else if (role === "driver") {
      actorType = "driver";
      actorId = String(decoded.id || decoded.sub || "");
    }

    // Fallbacks (legacy tokens / route middleware)
    if (actorType === "anonymous") {
      if (req.adminId) {
        actorType = "admin";
        actorId = String(req.adminId);
      } else if (req.restaurantId) {
        actorType = "restaurant";
        actorId = String(req.restaurantId);
        restaurantId = String(req.restaurantId);
      } else if (req.customerId) {
        actorType = "customer";
        actorId = String(req.customerId);
      } else if (req.driverId) {
        actorType = "driver";
        actorId = String(req.driverId);
      }
    }

    appendAuditLog({
      actorType,
      actorId,
      restaurantId: restaurantId || req.restaurantId || null,
      method,
      path: String(req.originalUrl || req.url || "").split("?")[0].slice(0, 300),
      queryKeys: Object.keys(req.query || {}).slice(0, 20),
      status: res.statusCode,
      ms: Date.now() - startedAt,
      ip: req.ip || "",
      ua: String(req.headers["user-agent"] || ""),
      bodyKeys: safeJsonKeys(req.body),
    });
  });
  next();
}

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = path.join(ROOT, "data");

const ORDERS_FILE = path.join(DATA_DIR, "orders.json");
const ADMINS_FILE = path.join(DATA_DIR, "admins.json");
const DRIVERS_FILE = path.join(DATA_DIR, "drivers.json");
const CUSTOMERS_FILE = path.join(DATA_DIR, "customers.json");
const RESTAURANTS_FILE = path.join(DATA_DIR, "restaurants.json");
const MENU_FILE = path.join(DATA_DIR, "menu.json");
const CATALOG_FILE = path.join(DATA_DIR, "catalog.json");
const CONFIG_FILE = path.join(ROOT, "config.json");

const TOPUPS_FILE = path.join(DATA_DIR, "topups.json");
const SETTLEMENTS_FILE = path.join(DATA_DIR, "settlements.json");
const SUPPORT_CHATS_FILE = path.join(DATA_DIR, "support_chats.json");
const ORDER_CHATS_FILE = path.join(DATA_DIR, "order_chats.json");
const NOTIFICATIONS_FILE = path.join(DATA_DIR, "notifications.json");
const PUSH_SUBSCRIPTIONS_FILE = path.join(DATA_DIR, "push_subscriptions.json");
const PUSH_RETRY_FILE = path.join(DATA_DIR, "push_retry.json");
const PROMOS_FILE = path.join(DATA_DIR, "promos.json");
const PAYMENT_METHODS_FILE = path.join(DATA_DIR, "payment_methods.json");

// SaaS / security add-ons (kept as JSON for backward compatibility; can be migrated to DB later)
const REFRESH_TOKENS_FILE = path.join(DATA_DIR, "refresh_tokens.json");
const AUDIT_LOGS_FILE = path.join(DATA_DIR, "audit_logs.json"); // legacy store, only read once by the migration below
const AUDIT_DIR = path.join(DATA_DIR, "audit");
let settingsCenter = null; // created once dispatchService exists (see "System settings center")
// Optional AUDIT_HMAC_KEY (env) makes the chain keyed: file editors without the key cannot forge a valid chain.
const auditLog = createAuditLog({ dir: AUDIT_DIR, hmacKey: process.env.AUDIT_HMAC_KEY || "", logger, genId: () => genId() });
try {
  const mig = auditLog.migrateLegacy(AUDIT_LOGS_FILE);
  if (mig && mig.imported) logger.info("audit: legacy log imported into the tamper-evident chain", { imported: mig.imported, backup: mig.backup });
  if (mig && mig.ok === false) logger.error("audit: legacy import failed", { error: mig.error });
} catch (e) {
  logger.error("audit: legacy import error", { error: String(e && e.message ? e.message : e) });
}
const PLANS_FILE = path.join(DATA_DIR, "plans.json");
const RESTAURANT_USERS_FILE = path.join(DATA_DIR, "restaurant_users.json");
const STORE_TYPES_FILE = path.join(DATA_DIR, "store_types.json");
const STORE_CHATS_FILE = path.join(DATA_DIR, "store_chats.json");
const PHARMACY_FILE = path.join(DATA_DIR, "pharmacy_requests.json");
const SUPPORT_CHANNELS_FILE = path.join(DATA_DIR, "support_channels.json");
const SUPPORT_TICKETS_FILE = path.join(DATA_DIR, "support_tickets.json");
const COMPLAINTS_FILE = path.join(DATA_DIR, "complaints.json");
const EXCEPTIONS_FILE = path.join(DATA_DIR, "exceptions.json");
const SERVICE_ZONES_FILE = path.join(DATA_DIR, "service_zones.json");

// Private storage (NOT served by express.static). Used for ID images.
const PRIVATE_UPLOADS_DIR = path.join(DATA_DIR, "private_uploads");
const PRIVATE_DRIVER_ID_DIR = path.join(PRIVATE_UPLOADS_DIR, "drivers_id");
const PRIVATE_TOPUP_DIR = path.join(PRIVATE_UPLOADS_DIR, "topups"); // payment receipts: never served statically
const PRIVATE_RX_DIR = path.join(PRIVATE_UPLOADS_DIR, "prescriptions"); // medical prescriptions: never served statically, only through authorised routes

// Uploads (public): default to /uploads served explicitly.
// - In production, prefer keeping uploads OUTSIDE /public and mounting them at /uploads.
// - Legacy path (public/uploads) is still supported for backward compatibility.
const LEGACY_UPLOADS_DIR = path.join(PUBLIC_DIR, "uploads");
const UPLOADS_PUBLIC_PATH =
  String(process.env.UPLOADS_PUBLIC_PATH || "/uploads").trim() || "/uploads";
const UPLOADS_DIR = path.resolve(
  process.env.UPLOAD_DIR ||
    (IS_PROD ? path.join(ROOT, "uploads") : LEGACY_UPLOADS_DIR),
);
const TOPUPS_UPLOAD_DIR = path.join(UPLOADS_DIR, "topups");
const DRIVERS_UPLOAD_DIR = path.join(UPLOADS_DIR, "drivers");
const MENU_UPLOAD_DIR = path.join(UPLOADS_DIR, "menu");
const BANNERS_UPLOAD_DIR = path.join(UPLOADS_DIR, "banners");
const NOTIFICATIONS_UPLOAD_DIR = path.join(UPLOADS_DIR, "notifications");
// Chat attachments (images + voice notes) — separate folder, public (served like other uploads)
const CHAT_UPLOAD_DIR = path.join(UPLOADS_DIR, "chat");

// JSON read cache (simple TTL cache to reduce disk I/O under polling)
const JSON_READ_CACHE_TTL_MS = Math.max(
  0,
  Number(process.env.JSON_READ_CACHE_TTL_MS || 250),
);
const JSON_CACHE = new Map(); // file -> { expiresAt:number, value:any }
// Data protection (spec 21): the first write to a file in this process first preserves an UNREADABLE existing file
// (readJson() answers with the fallback for it, so the save would otherwise destroy the only evidence of the data).
const WRITE_PREFLIGHT_DONE = new Set();

function cloneJson(v) {
  try {
    // Node 18+ supports structuredClone
    return structuredClone(v);
  } catch (_e) {
    try {
      return JSON.parse(JSON.stringify(v));
    } catch (_e2) {
      return v;
    }
  }
}

function readJson(file, fallback) {
  try {
    if (JSON_READ_CACHE_TTL_MS > 0) {
      const hit = JSON_CACHE.get(file);
      if (hit && hit.expiresAt > Date.now()) {
        return cloneJson(hit.value);
      }
    }
    const parsed = JSON.parse(fs.readFileSync(file, "utf-8"));
    if (JSON_READ_CACHE_TTL_MS > 0) {
      JSON_CACHE.set(file, {
        expiresAt: Date.now() + JSON_READ_CACHE_TTL_MS,
        value: parsed,
      });
    }
    return cloneJson(parsed);
  } catch (e) {
    return fallback;
  }
}
function sleepSync(ms) {
  // Safe synchronous sleep (avoids busy-looping when acquiring file locks)
  const arr = new Int32Array(new SharedArrayBuffer(4));
  Atomics.wait(arr, 0, 0, Math.max(0, Number(ms) || 0));
}

function withFileLock(file, fn) {
  const lockFile = file + ".lock";
  const timeoutMs = Number(process.env.JSON_LOCK_TIMEOUT_MS || 2000);
  const retryMs = Number(process.env.JSON_LOCK_RETRY_MS || 25);

  let fd = null;
  const started = Date.now();

  while (true) {
    try {
      fd = fs.openSync(lockFile, "wx"); // exclusive create
      break;
    } catch (e) {
      if (e && e.code !== "EEXIST") throw e;
      if (Date.now() - started > timeoutMs) {
        throw new Error(
          "Could not acquire file lock for " + path.basename(file),
        );
      }
      sleepSync(retryMs);
    }
  }

  try {
    return fn();
  } finally {
    try {
      if (fd !== null) fs.closeSync(fd);
    } catch {}
    try {
      fs.unlinkSync(lockFile);
    } catch {}
  }
}

function writeJson(file, data) {
  // Future-proofing: if/when you fully switch to DB in production,
  // you can block JSON writes by setting DISABLE_JSON_WRITES=1.
  if (IS_PROD && String(process.env.DISABLE_JSON_WRITES || "").trim() === "1") {
    const msg = `JSON writes are disabled in production (attempted: ${path.basename(file)})`;
    logger.error(msg);
    throw new Error(msg);
  }

  fs.mkdirSync(path.dirname(file), { recursive: true });
  const payload = JSON.stringify(data, null, 2);

  // Atomic write (write temp + rename) + file lock to reduce race conditions
  withFileLock(file, () => {
    if (!WRITE_PREFLIGHT_DONE.has(file)) {
      dataProtectionLib.quarantineIfCorrupt(file, { logger });
      WRITE_PREFLIGHT_DONE.add(file);
    }
    const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmp, payload, "utf-8");
    fs.renameSync(tmp, file);
  });

  // Keep cache hot and consistent
  if (JSON_READ_CACHE_TTL_MS > 0) {
    try {
      JSON_CACHE.set(file, {
        expiresAt: Date.now() + JSON_READ_CACHE_TTL_MS,
        value: data,
      });
    } catch (_e) {}
  }
}

function loadConfig() {
  const cfg = readJson(CONFIG_FILE, {});
  cfg.couriers = Array.isArray(cfg.couriers) ? cfg.couriers : [];
  cfg.wifiPrinter = cfg.wifiPrinter || { ip: "", port: 9100 };
  cfg.currency = cfg.currency || "MAD";
  cfg.offersBanners = Array.isArray(cfg.offersBanners) ? cfg.offersBanners : [];
  // legacy password (kept for backward compatibility)
  // Prefer ADMIN_PASSWORD from .env (so it is not stored in config.json).
  const envAdminPassword = String(process.env.ADMIN_PASSWORD || "").trim();
  cfg.adminPassword =
    envAdminPassword || String(cfg.adminPassword || "siymon1234");
  cfg.wifiPrintEnabled = cfg.wifiPrintEnabled !== false;
  cfg.printLogoEnabled = cfg.printLogoEnabled !== false;

  // Restaurant mode: auto (hours), open (force open), closed (force closed)
  const mode = String(cfg.restaurantMode || "auto").toLowerCase();
  cfg.restaurantMode = ["auto", "open", "closed"].includes(mode)
    ? mode
    : "auto";

  // Bank account (for driver topups)
  cfg.bankAccountName = String(cfg.bankAccountName || "");
  cfg.bankAccount = String(cfg.bankAccount || "");
  // Driver wallet settings
  cfg.driverWalletEnabled = cfg.driverWalletEnabled !== false;
  const c = Number(cfg.driverCommissionPerOrder || 0);
  cfg.driverCommissionPerOrder = Number.isFinite(c) && c >= 0 ? c : 0;

  // Wallet charge mode: "subtotal" (default) | "total" | "commission"
  const cm = String(
    cfg.driverWalletChargeMode || cfg.driverWalletDeductMode || "subtotal",
  ).toLowerCase();
  cfg.driverWalletChargeMode = ["subtotal", "total", "commission"].includes(cm)
    ? cm
    : "subtotal";

  return cfg;
}

function loadOrders() {
  const data = readJson(ORDERS_FILE, { orders: [] });
  data.orders = Array.isArray(data.orders) ? data.orders : [];
  return data;
}
function saveOrders(data) {
  writeJson(ORDERS_FILE, data);
}

function loadAdmins() {
  const data = readJson(ADMINS_FILE, { admins: [] });
  data.admins = Array.isArray(data.admins) ? data.admins : [];
  return data;
}
function saveAdmins(data) {
  writeJson(ADMINS_FILE, data);
}

function loadDrivers() {
  const data = readJson(DRIVERS_FILE, { drivers: [] });
  data.drivers = Array.isArray(data.drivers) ? data.drivers : [];
  // backward-compat: ensure wallet fields exist
  data.drivers.forEach((d) => {
    if (d && typeof d === "object") {
      if (d.walletBalance === undefined) d.walletBalance = 0;
      if (!Array.isArray(d.walletHistory)) d.walletHistory = [];
    }
  });

  // Migration: move ID images out of JSON (base64/dataURL) to private disk storage
  // (Best-effort; never blocks server startup)
  try {
    let changed = false;
    for (const d of data.drivers) {
      if (!d || typeof d !== "object") continue;
      if (!d.images || typeof d.images !== "object") continue;
      const kinds = ["faceWithBikeCard", "idFront", "idBack"];
      d.images.meta =
        d.images.meta && typeof d.images.meta === "object" ? d.images.meta : {};

      for (const k of kinds) {
        const v = d.images[k];
        if (!v || typeof v !== "string") continue;
        // already migrated if it's a filename with extension
        if (/\.(jpg|jpeg|png|webp)$/i.test(v) && !v.startsWith("data:"))
          continue;

        // Support both dataURL and base64-only legacy payloads
        let dataUrl = v;
        if (!dataUrl.startsWith("data:")) {
          // Assume legacy is jpeg base64
          dataUrl = `data:image/jpeg;base64,${v}`;
        }
        const suffix = crypto.randomBytes(6).toString("hex");
        const saved = saveDataUrlImagePrivate(
          dataUrl,
          PRIVATE_DRIVER_ID_DIR,
          `${String(d.id || "driver")}_${k}_${suffix}`,
          { maxBytes: MAX_DRIVER_ID_IMAGE_BYTES },
        );
        if (saved) {
          d.images[k] = saved.file;
          d.images.meta[k] = { mime: saved.mime, ext: saved.ext };
          changed = true;
        }
      }
    }
    if (changed) saveDrivers(data);
  } catch (_e) {}

  return data;
}
function saveDrivers(data) {
  writeJson(DRIVERS_FILE, data);
}

function loadCustomers() {
  const data = readJson(CUSTOMERS_FILE, { customers: [] });
  data.customers = Array.isArray(data.customers) ? data.customers : [];
  return data;
}
function saveCustomers(data) {
  writeJson(CUSTOMERS_FILE, data);
}

function loadPaymentMethods() {
  const data = readJson(PAYMENT_METHODS_FILE, { methods: [] });
  return paymentMethods.withDefaults(data.methods);
}
function savePaymentMethods(list) {
  writeJson(PAYMENT_METHODS_FILE, { methods: list });
}

function loadPromos() {
  const data = readJson(PROMOS_FILE, { promos: [] });
  data.promos = Array.isArray(data.promos) ? data.promos : [];
  return data;
}
function savePromos(data) {
  writeJson(PROMOS_FILE, data);
}

function loadSettlements() {
  const data = readJson(SETTLEMENTS_FILE, { settlements: [] });
  data.settlements = Array.isArray(data.settlements) ? data.settlements : [];
  return data;
}
function saveSettlements(data) {
  writeJson(SETTLEMENTS_FILE, data);
}
function loadTopups() {
  const data = readJson(TOPUPS_FILE, { topups: [] });
  data.topups = Array.isArray(data.topups) ? data.topups : [];
  return data;
}
function saveTopups(data) {
  writeJson(TOPUPS_FILE, data);
}

function loadSupportChats() {
  const data = readJson(SUPPORT_CHATS_FILE, { conversations: [] });
  data.conversations = Array.isArray(data.conversations)
    ? data.conversations
    : [];
  return data;
}

function loadOrderChats() {
  const data = readJson(ORDER_CHATS_FILE, { chats: [] });
  data.chats = Array.isArray(data.chats) ? data.chats : [];
  return data;
}
function saveOrderChats(data) {
  writeJson(ORDER_CHATS_FILE, data || { chats: [] });
}
function saveSupportChats(data) {
  writeJson(SUPPORT_CHATS_FILE, data);
}

function loadNotifications() {
  const data = readJson(NOTIFICATIONS_FILE, { notifications: [] });
  data.notifications = Array.isArray(data.notifications)
    ? data.notifications
    : [];
  return data;
}

function saveNotifications(data) {
  writeJson(NOTIFICATIONS_FILE, data || { notifications: [] });
}

function loadPushSubscriptions() {
  const data = readJson(PUSH_SUBSCRIPTIONS_FILE, { subscriptions: [] });
  data.subscriptions = Array.isArray(data.subscriptions)
    ? data.subscriptions
    : [];
  return data;
}
function savePushSubscriptions(data) {
  writeJson(PUSH_SUBSCRIPTIONS_FILE, data || { subscriptions: [] });
}

function normalizePushSubscription(sub) {
  try {
    if (!sub || typeof sub !== "object") return null;
    const endpoint = String(sub.endpoint || "").trim();
    const keys = sub.keys && typeof sub.keys === "object" ? sub.keys : {};
    const p256dh = String(keys.p256dh || "").trim();
    const auth = String(keys.auth || "").trim();
    if (!endpoint || !p256dh || !auth) return null;
    return { endpoint, keys: { p256dh, auth } };
  } catch (_e) {
    return null;
  }
}

async function broadcastWebPushNotification(rec, opts = {}) {
  if (!WEBPUSH_ENABLED)
    return { ok: false, sent: 0, failed: 0, removed: 0, reason: "disabled" };

  // Optional audience filter: Set of customer ids. When provided, ONLY
  // subscriptions that belong to those customers receive the push.
  const customerIds = opts && opts.customerIds instanceof Set ? opts.customerIds : null;

  const payloadObj = notifCore.buildPushPayload(rec);
  if (notifCore.payloadBytes(payloadObj) > notifCore.LIMITS.PAYLOAD_MAX_BYTES)
    return { ok: false, sent: 0, failed: 0, removed: 0, reason: "payload_too_large" };
  const payload = JSON.stringify(payloadObj);

  const data = loadPushSubscriptions();
  const all = Array.isArray(data.subscriptions) ? data.subscriptions : [];
  const subs = notifCore.selectSubscriptions(all, customerIds);

  let sent = 0;
  let failed = 0;
  let removed = 0;

  // send sequentially to reduce CPU spikes on tiny VPS
  for (const r of subs) {
    const sub = normalizePushSubscription(r?.subscription || r); // backward compat
    if (!sub) {
      failed += 1;
      continue;
    }

    try {
      await webPush.sendNotification(sub, payload, { TTL: 60 * 60 }); // 1 hour
      sent += 1;
    } catch (e) {
      failed += 1;
      const code = e && (e.statusCode || e.status || e.code);
      // Remove expired subscriptions (410 Gone / 404 Not Found)
      if (code === 410 || code === 404) {
        removed += 1;
        r._remove = true;
      }
      try {
        logger.warn("WebPush send failed", {
          code,
          message: String(e && e.message ? e.message : e),
          endpoint: sub.endpoint,
        });
      } catch (_e2) {}
    }
  }

  if (removed > 0) {
    // re-read to avoid clobbering subscriptions added while we were sending
    const fresh = loadPushSubscriptions();
    const gone = new Set(all.filter((x) => x._remove).map((x) => String(x.endpoint)));
    fresh.subscriptions = (fresh.subscriptions || []).filter(
      (x) => !gone.has(String(x.endpoint)),
    );
    savePushSubscriptions(fresh);
  }

  return { ok: true, sent, failed, removed, devices: subs.length };
}

let pushRetryRunning = false;
async function processPushRetries() {
  if (!WEBPUSH_ENABLED || pushRetryRunning) return { skipped: true };
  pushRetryRunning = true;
  const out = { sent: 0, retried: 0, dropped: 0 };
  try {
    const file = readJson(PUSH_RETRY_FILE, { queue: [] });
    const queue = Array.isArray(file.queue) ? file.queue : [];
    if (!queue.length) return out;
    const { ready, expired } = pushRetry.due(queue);
    const ops = []; // [item, outcome] applied to a freshly read queue afterwards
    for (const it of expired) {
      ops.push([it, "permanent"]);
      out.dropped += 1;
    }
    const subsData = loadPushSubscriptions();
    const endpointOf = (x) => String(normalizePushSubscription(x?.subscription || x)?.endpoint || "");
    const gone = new Set();
    for (const it of ready) {
      const row = (subsData.subscriptions || []).find((x) => endpointOf(x) === it.endpoint);
      const sub = row && normalizePushSubscription(row.subscription || row);
      if (!sub) {
        ops.push([it, "gone"]); // device unsubscribed meanwhile
        out.dropped += 1;
        continue;
      }
      try {
        await webPush.sendNotification(sub, it.payload, { TTL: 60 * 60 });
        ops.push([it, "sent"]);
        out.sent += 1;
      } catch (e) {
        const kind = pushRetry.classify(e);
        if (kind === "gone") gone.add(it.endpoint);
        ops.push([it, kind]);
        if (kind === "retry") out.retried += 1;
        else out.dropped += 1;
      }
    }
    // Re-read: new failures may have been queued while we were sending.
    const fresh = readJson(PUSH_RETRY_FILE, { queue: [] });
    let q2 = Array.isArray(fresh.queue) ? fresh.queue : [];
    for (const [it, outcome] of ops) q2 = pushRetry.settle(q2, it, outcome);
    writeJson(PUSH_RETRY_FILE, { queue: q2 });
    if (gone.size) {
      const sd = loadPushSubscriptions();
      sd.subscriptions = (sd.subscriptions || []).filter((x) => !gone.has(endpointOf(x)));
      savePushSubscriptions(sd);
    }
    return out;
  } catch (e) {
    try {
      logger.warn("push retry tick failed", { message: String(e && e.message ? e.message : e) });
    } catch (_e) {}
    return out;
  } finally {
    pushRetryRunning = false;
  }
}

async function sendWebPushToCustomer(customerId, rec) {
  if (!WEBPUSH_ENABLED)
    return { ok: false, sent: 0, failed: 0, removed: 0, reason: "disabled" };

  const cid = String(customerId || "").trim();
  if (!cid)
    return {
      ok: false,
      sent: 0,
      failed: 0,
      removed: 0,
      reason: "missing_customerId",
    };

  const payloadObj = {
    id: String(rec?.id || ""),
    title: String(rec?.title || "siymon"),
    body: String(rec?.message || ""),
    image: rec?.imageUrl ? String(rec.imageUrl) : null,
    url: String(rec?.url || "/notifications/"),
    createdAt: String(rec?.createdAt || new Date().toISOString()),
    orderId: rec?.orderId ? String(rec.orderId) : null,
    type: rec?.type ? String(rec.type) : null,
    stage: rec?.stage ? String(rec.stage) : null,
  };
  const payload = JSON.stringify(payloadObj);

  const data = loadPushSubscriptions();
  const subsAll = Array.isArray(data.subscriptions) ? data.subscriptions : [];
  const subs = subsAll.filter((r) => String(r.customerId || "") === cid);

  let sent = 0;
  let failed = 0;
  let removed = 0;

  for (const r of subs) {
    const sub = normalizePushSubscription(r?.subscription || r);
    if (!sub) {
      failed += 1;
      continue;
    }
    try {
      await webPush.sendNotification(sub, payload, { TTL: 60 * 60 });
      sent += 1;
    } catch (e) {
      failed += 1;
      const code = e && (e.statusCode || e.status || e.code);
      const kind = pushRetry.classify(e);
      if (kind === "gone") {
        removed += 1;
        r._remove = true;
      } else if (kind === "retry") {
        // transient failure: keep the subscription and try again later
        try {
          const q = readJson(PUSH_RETRY_FILE, { queue: [] });
          q.queue = pushRetry.enqueue(q.queue, {
            recId: rec?.id,
            endpoint: sub.endpoint,
            customerId: cid,
            payload,
          });
          writeJson(PUSH_RETRY_FILE, q);
        } catch (_e3) {}
      }
      try {
        logger.warn("WebPush send failed (customer)", {
          code,
          message: String(e && e.message ? e.message : e),
          endpoint: sub.endpoint,
          customerId: cid,
        });
      } catch (_e2) {}
    }
  }

  if (removed > 0) {
    data.subscriptions = subsAll.filter((x) => !x._remove);
    savePushSubscriptions(data);
  }

  return { ok: true, sent, failed, removed };
}

// Give the wallet part of a canceled order back to the customer (idempotent by ledger ref).
function refundOrderWallet(order) {
  try {
    if (!orderPayment.needsRefund(order)) return;
    const cd = loadCustomers();
    const crec = customerById(cd, order.customerId);
    if (!crec) return;
    const amt = Number(order.payment.walletAmount);
    const e = walletLedger.applyEntry(crec, {
      ref: orderPayment.walletRefundRef(order.id),
      type: "order_refund",
      amount: amt,
      orderId: order.id,
      note: "Wallet refund for canceled order",
      actorType: "system",
    });
    if (!e.ok) return;
    if (!e.duplicate) saveCustomers(cd);
    order.payment.walletRefundedAt = e.entry.createdAt;
    order.payment.status = "wallet_refunded";
    notifyCustomerSimple({ customerId: order.customerId, orderId: order.id, type: "wallet_refund", title: "المحفظة", message: `تم استرجاع ${amt} إلى محفظتك بعد إلغاء الطلب #${order.id}` });
  } catch (_e) {}
}

function notifyCustomerSimple({ customerId, type, title, message, orderId = "" }) {
  const cid = String(customerId || "").trim();
  if (!cid) return null;
  const rec = {
    id: `notif_${genId()}`,
    title: String(title || ""),
    message: String(message || "").slice(0, 400),
    imageUrl: null,
    url: "/notifications/",
    audience: "customer",
    customerId: cid,
    orderId: String(orderId || ""),
    type: String(type || "info"),
    createdAt: new Date().toISOString(),
  };
  const data = loadNotifications();
  data.notifications = Array.isArray(data.notifications) ? data.notifications : [];
  data.notifications.unshift(rec);
  const max = Math.max(50, Number(process.env.NOTIFICATIONS_MAX || 500));
  if (data.notifications.length > max) data.notifications = data.notifications.slice(0, max);
  saveNotifications(data);
  if (WEBPUSH_ENABLED) setImmediate(() => { sendWebPushToCustomer(cid, rec).catch(() => {}); });
  return rec;
}

function createCustomerOrderStatusNotification({ customerId, orderId, stage }) {
  const cid = String(customerId || "").trim();
  const oid = String(orderId || "").trim();
  const stg = String(stage || "").trim();

  if (!cid || !oid || !stg) return null;

  const title = "تحديث الطلب";
  let message = "";
  if (stg === "admin_accepted") {
    message = `تم قبول طلبك ✅ (طلب #${oid})`;
  } else if (stg === "restaurant_ready") {
    message = `تم وضع طلبك يطبخ 🍳 (طلب #${oid})`;
  } else if (stg === "accepted") {
    message = `طلبك في طريقه إليك 🚚 (طلب #${oid})`;
  } else if (stg === "canceled") {
    message = `تعذّر تنفيذ طلبك لأن المتجر غير متاح حالياً (طلب #${oid})`;
  } else {
    message = `تم تحديث طلبك (طلب #${oid})`;
  }

  const rec = {
    id: `notif_${genId()}`,
    title,
    message,
    imageUrl: null,
    url: "/notifications/",
    audience: "customer",
    customerId: cid,
    orderId: oid,
    type: "order_status",
    stage: stg,
    createdAt: new Date().toISOString(),
  };

  const data = loadNotifications();
  data.notifications = Array.isArray(data.notifications)
    ? data.notifications
    : [];
  data.notifications.unshift(rec);

  const max = Math.max(50, Number(process.env.NOTIFICATIONS_MAX || 500));
  if (data.notifications.length > max)
    data.notifications = data.notifications.slice(0, max);

  saveNotifications(data);

  if (WEBPUSH_ENABLED) {
    setImmediate(() => {
      sendWebPushToCustomer(cid, rec).catch(() => {});
    });
  }

  return rec;
}

function loadRefreshTokens() {
  const data = readJson(REFRESH_TOKENS_FILE, { tokens: [] });
  data.tokens = Array.isArray(data.tokens) ? data.tokens : [];
  return data;
}
function saveRefreshTokens(data) {
  writeJson(REFRESH_TOKENS_FILE, data || { tokens: [] });
}


function defaultPlans() {
  // You can edit data/plans.json any time (no code change required).
  return {
    Basic: {
      id: "Basic",
      name: "Basic",
      limits: { monthlyOrders: 500, drivers: 3 },
      features: {
        printing: false,
        advancedReports: false,
        prioritySupport: false,
      },
    },
    Pro: {
      id: "Pro",
      name: "Pro",
      limits: { monthlyOrders: 5000, drivers: 20 },
      features: {
        printing: true,
        advancedReports: true,
        prioritySupport: true,
      },
    },
    Enterprise: {
      id: "Enterprise",
      name: "Enterprise",
      limits: { monthlyOrders: -1, drivers: -1 },
      features: {
        printing: true,
        advancedReports: true,
        prioritySupport: true,
      },
    },
  };
}

function loadPlans() {
  const data = readJson(PLANS_FILE, { plans: defaultPlans() });
  data.plans =
    data && typeof data.plans === "object" ? data.plans : defaultPlans();
  return data;
}
function savePlans(data) {
  writeJson(PLANS_FILE, data || { plans: defaultPlans() });
}

function ensurePlansSeeded() {
  try {
    if (!fs.existsSync(PLANS_FILE)) {
      savePlans({ plans: defaultPlans() });
    }
  } catch (_e) {}
}

function loadRestaurantUsers() {
  const data = readJson(RESTAURANT_USERS_FILE, { users: [] });
  data.users = Array.isArray(data.users) ? data.users : [];
  return data;
}
function saveRestaurantUsers(data) {
  writeJson(RESTAURANT_USERS_FILE, data || { users: [] });
}

function ensureDriverWalletFields(driver) {
  if (!driver || typeof driver !== "object") return driver;
  if (driver.walletBalance === undefined) driver.walletBalance = 0;
  if (!Array.isArray(driver.walletHistory)) driver.walletHistory = [];
  return driver;
}

function ensureUploadsDirs() {
  try {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  } catch (_e) {}
  try {
    fs.mkdirSync(TOPUPS_UPLOAD_DIR, { recursive: true });
  } catch (_e) {}
  try {
    fs.mkdirSync(DRIVERS_UPLOAD_DIR, { recursive: true });
  } catch (_e) {}
  try {
    fs.mkdirSync(MENU_UPLOAD_DIR, { recursive: true });
  } catch (_e) {}
  try {
    fs.mkdirSync(BANNERS_UPLOAD_DIR, { recursive: true });
  } catch (_e) {}
  try {
    fs.mkdirSync(NOTIFICATIONS_UPLOAD_DIR, { recursive: true });
  } catch (_e) {}
  try {
    fs.mkdirSync(CHAT_UPLOAD_DIR, { recursive: true });
  } catch (_e) {}
  try {
    fs.mkdirSync(PRIVATE_UPLOADS_DIR, { recursive: true });
  } catch (_e) {}
  try {
    fs.mkdirSync(PRIVATE_DRIVER_ID_DIR, { recursive: true });
    fs.mkdirSync(PRIVATE_TOPUP_DIR, { recursive: true });
    fs.mkdirSync(PRIVATE_RX_DIR, { recursive: true });
  } catch (_e) {}
}

ensureUploadsDirs();
ensurePlansSeeded();

// Image hardening
const MAX_MENU_IMAGE_BYTES = Math.max(
  10_000,
  Number(process.env.MAX_MENU_IMAGE_BYTES || 2_000_000),
);
const MAX_BANNER_IMAGE_BYTES = Math.max(
  10_000,
  Number(process.env.MAX_BANNER_IMAGE_BYTES || 2_000_000),
);
const MAX_NOTIFICATION_IMAGE_BYTES = Math.max(
  10_000,
  Number(process.env.MAX_NOTIFICATION_IMAGE_BYTES || 2_000_000),
);
const MAX_TOPUP_RECEIPT_BYTES = Math.max(
  10_000,
  Number(process.env.MAX_TOPUP_RECEIPT_BYTES || 3_000_000),
);
const MAX_CHAT_IMAGE_BYTES = Math.max(
  10_000,
  Number(process.env.MAX_CHAT_IMAGE_BYTES || 2_000_000),
);
const MAX_CHAT_AUDIO_BYTES = Math.max(
  10_000,
  Number(process.env.MAX_CHAT_AUDIO_BYTES || 5_000_000),
);
// Phones often produce large images; keep reasonable defaults while remaining configurable via env.
const MAX_DRIVER_PROFILE_PHOTO_BYTES = Math.max(
  10_000,
  Number(process.env.MAX_DRIVER_PROFILE_PHOTO_BYTES || 5_000_000),
);
const MAX_DRIVER_ID_IMAGE_BYTES = Math.max(
  10_000,
  Number(process.env.MAX_DRIVER_ID_IMAGE_BYTES || 8_000_000),
);

function estimateBase64Bytes(b64) {
  // pre-check before Buffer.from(base64)
  const s = String(b64 || "");
  if (!s) return 0;
  const len = s.length;
  const pad = s.endsWith("==") ? 2 : s.endsWith("=") ? 1 : 0;
  return Math.floor((len * 3) / 4) - pad;
}

function detectImageType(buf) {
  if (!buf || !Buffer.isBuffer(buf) || buf.length < 16) return null;
  // JPEG
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { ext: "jpg", mime: "image/jpeg" };
  }
  // PNG
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return { ext: "png", mime: "image/png" };
  }
  // WebP (RIFF....WEBP)
  if (
    buf.slice(0, 4).toString("ascii") === "RIFF" &&
    buf.slice(8, 12).toString("ascii") === "WEBP"
  ) {
    return { ext: "webp", mime: "image/webp" };
  }
  return null;
}

function decodeDataUrlImage(dataUrl, { maxBytes }) {
  const s = String(dataUrl || "");
  if (!s.startsWith("data:")) return null;
  const m = s.match(/^data:([^;]+);base64,(.*)$/);
  if (!m) return null;
  const b64 = m[2] || "";

  const est = estimateBase64Bytes(b64);
  if (maxBytes && est > maxBytes) {
    throw new Error(
      `Image too large (${est} bytes). Max is ${maxBytes} bytes.`,
    );
  }

  const buf = Buffer.from(b64, "base64");
  if (maxBytes && buf.length > maxBytes) {
    throw new Error(
      `Image too large (${buf.length} bytes). Max is ${maxBytes} bytes.`,
    );
  }

  const type = detectImageType(buf);
  if (!type) {
    throw new Error("Unsupported image type. Allowed: JPG/PNG/WebP");
  }
  return { buf, ...type };
}

function saveDataUrlImage(dataUrl, destDir, fileBaseName, { maxBytes } = {}) {
  try {
    const decoded = decodeDataUrlImage(dataUrl, { maxBytes });
    if (!decoded) return null;
    const { buf, ext } = decoded;
    const safeBase = String(fileBaseName || genId()).replace(
      /[^a-zA-Z0-9_-]/g,
      "_",
    );
    const fname = `${safeBase}.${ext}`;
    const outPath = path.join(destDir, fname);
    fs.writeFileSync(outPath, buf);
    // Public URL (served from UPLOADS_PUBLIC_PATH)
    const relPath = path
      .relative(UPLOADS_DIR, outPath)
      .split(path.sep)
      .join("/");
    const rel = `${UPLOADS_PUBLIC_PATH}/${relPath}`.replace(/\/+/g, "/");
    return rel;
  } catch (_e) {
    return null;
  }
}

function saveDataUrlImagePrivate(
  dataUrl,
  destDir,
  fileBaseName,
  { maxBytes } = {},
) {
  const decoded = decodeDataUrlImage(dataUrl, { maxBytes });
  if (!decoded) return null;
  const { buf, ext, mime } = decoded;
  const safeBase = String(fileBaseName || genId()).replace(
    /[^a-zA-Z0-9_-]/g,
    "_",
  );
  const fname = `${safeBase}.${ext}`;
  const outPath = path.join(destDir, fname);
  fs.writeFileSync(outPath, buf);
  return { file: fname, mime, ext };
}

function decodeDataUrlAudio(dataUrl, { maxBytes }) {
  const s = String(dataUrl || "");
  if (!s.startsWith("data:")) return null;
  const m = s.match(/^data:([^;]+);base64,(.*)$/);
  if (!m) return null;
  const mime = String(m[1] || "").toLowerCase();
  const b64 = m[2] || "";

  const allowed = {
    "audio/webm": "webm",
    "audio/ogg": "ogg",
    "audio/mp4": "m4a",
    "audio/aac": "aac",
    "audio/mpeg": "mp3",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
  };
  const ext = allowed[mime];
  if (!ext) throw new Error("Unsupported audio type");

  const est = estimateBase64Bytes(b64);
  if (maxBytes && est > maxBytes) {
    throw new Error(`Audio too large (${est} bytes). Max is ${maxBytes} bytes.`);
  }
  const buf = Buffer.from(b64, "base64");
  if (maxBytes && buf.length > maxBytes) {
    throw new Error(`Audio too large (${buf.length} bytes). Max is ${maxBytes} bytes.`);
  }
  return { buf, ext, mime };
}

function saveDataUrlAudio(dataUrl, destDir, fileBaseName, { maxBytes } = {}) {
  try {
    const decoded = decodeDataUrlAudio(dataUrl, { maxBytes });
    if (!decoded) return null;
    const { buf, ext } = decoded;
    const safeBase = String(fileBaseName || genId()).replace(/[^a-zA-Z0-9_-]/g, "_");
    const fname = `${safeBase}.${ext}`;
    const outPath = path.join(destDir, fname);
    fs.writeFileSync(outPath, buf);
    const relPath = path.relative(UPLOADS_DIR, outPath).split(path.sep).join("/");
    return `${UPLOADS_PUBLIC_PATH}/${relPath}`.replace(/\/+/g, "/");
  } catch (_e) {
    return null;
  }
}

function handleMenuImageUpload(req, res) {
  const dataUrl = String(
    (req.body && (req.body.image || req.body.dataUrl)) || "",
  );
  const id = `menu_${genId()}`;
  const url = saveDataUrlImage(dataUrl, MENU_UPLOAD_DIR, id, {
    maxBytes: MAX_MENU_IMAGE_BYTES,
  });
  if (!url) return res.status(400).json({ error: "Invalid image" });
  return res.json({ ok: true, url });
}

// Upload meal images (admin + restaurant)
app.post("/api/admin/upload/menu-image", requireAdmin, (req, res) =>
  handleMenuImageUpload(req, res),
);
app.post("/api/restaurant/upload/menu-image", requireRestaurant, (req, res) =>
  handleMenuImageUpload(req, res),
);

// Upload restaurant logo / cover (admin)
app.post("/api/admin/upload/restaurant-image", requireAdmin, (req, res) =>
  handleMenuImageUpload(req, res),
);

function cleanImgUrl(v) {
  const u = String(v || "").trim();
  if (!u) return "";
  return /^(\/uploads\/|https:\/\/)/.test(u) && u.length < 600 ? u : "";
}

// Upload offer banner images (admin)
app.post("/api/admin/upload/banner-image", requireAdmin, (req, res) => {
  const dataUrl = String(
    (req.body && (req.body.image || req.body.dataUrl)) || "",
  );
  const id = `banner_${genId()}`;
  const url = saveDataUrlImage(dataUrl, BANNERS_UPLOAD_DIR, id, {
    maxBytes: MAX_BANNER_IMAGE_BYTES,
  });
  if (!url) return res.status(400).json({ error: "Invalid image" });
  return res.json({ ok: true, url });
});

function loadRestaurants() {
  const data = readJson(RESTAURANTS_FILE, { restaurants: [] });
  data.restaurants = Array.isArray(data.restaurants) ? data.restaurants : [];
  // Backward compat: ensure SaaS fields exist
  data.restaurants.forEach((r) => {
    if (!r || typeof r !== "object") return;
    if (r.ownerId === undefined) r.ownerId = null;
    if (!r.subscriptionPlan) r.subscriptionPlan = "Basic";
    if (!r.subscriptionStatus) r.subscriptionStatus = "active";
    if (r.subscriptionRenewsAt === undefined) r.subscriptionRenewsAt = null;
    if (r.subscriptionProvider === undefined) r.subscriptionProvider = null;
    if (!r.subscriptionMeta || typeof r.subscriptionMeta !== "object")
      r.subscriptionMeta = {};
  });
  return data;
}
function saveRestaurants(data) {
  writeJson(RESTAURANTS_FILE, data);
}

function loadMenu() {
  const data = readJson(MENU_FILE, { items: [] });
  data.items = Array.isArray(data.items) ? data.items : [];
  return data;
}
function saveMenu(data) {
  writeJson(MENU_FILE, data);
}

// Store (business) types: built-in seeds + super-admin edits (data/store_types.json).
function loadStoreTypes() {
  return storesLib.mergeTypes(readJson(STORE_TYPES_FILE, { types: [] }));
}
// Admin create/update of a store: the chosen `type` must be an enabled, known type.
function storeTypeGuard(req, res, next) {
  const t = req.body && req.body.type;
  if (t === undefined) return next();
  const want = String(t).trim().toLowerCase();
  // Editing a store that already has a legacy/custom type string must not break.
  if (req.params && req.params.id) {
    const cur = (loadRestaurants().restaurants || []).find(
      (x) => String(x.id) === String(req.params.id),
    );
    if (cur && String(cur.type || "restaurant") === want) return next();
  }
  const found = loadStoreTypes().find((x) => x.id === want);
  if (!found) return res.status(400).json({ error: "Unknown store type" });
  if (found.enabled === false)
    return res.status(400).json({ error: "Store type disabled" });
  req.body.type = found.id;
  next();
}

// Homepage catalog: store categories, banners and home sections (admin-managed).
function loadCatalog() {
  const d = readJson(CATALOG_FILE, null);
  if (!d || typeof d !== "object") return catalogLib.defaultCatalog();
  return {
    categories: Array.isArray(d.categories) ? d.categories : [],
    banners: Array.isArray(d.banners) ? d.banners : [],
    sections: Array.isArray(d.sections)
      ? d.sections
      : catalogLib.defaultCatalog().sections,
  };
}
function saveCatalog(data) {
  writeJson(CATALOG_FILE, data);
}

function asI18nText(val, fallback = "") {
  // accepts string or {ar,en,fr}
  if (!val) return { ar: fallback, en: fallback, fr: fallback };
  if (typeof val === "string") return { ar: val, en: val, fr: val };
  const ar = String(val.ar || val.AR || "" || fallback);
  const en = String(val.en || val.EN || ar || fallback);
  const fr = String(val.fr || val.FR || en || ar || fallback);
  return { ar, en, fr };
}

function ensureSeedData() {
  // Seed restaurants and menu items if missing, so the app works out-of-the-box.
  const r = loadRestaurants();
  const m = loadMenu();

  if (r.restaurants.length === 0) {
    const cfg = loadConfig();
    r.restaurants.push({
      id: "REST-1",
      name: asI18nText(cfg.restaurantName || "siymon"),
      phone: String(cfg.supportPhone || ""),
      address: "",
      isActive: true,

      // SaaS fields (safe defaults)
      ownerId: null,
      subscriptionPlan: "Basic",
      subscriptionStatus: "active", // active | past_due | canceled
      subscriptionRenewsAt: null,
      subscriptionProvider: null,
      subscriptionMeta: {},

      // Restaurant login (set later from Admin -> Restaurants)
      loginEmail: "",
      loginPhone: "",
      password: null,
      createdAt: new Date().toISOString(),
    });
    saveRestaurants(r);
  }

  if (m.items.length === 0) {
    const seed = [
      {
        id: "m1",
        cat: "moroccan",
        catLabel: { ar: "مغربي", en: "Moroccan", fr: "Marocain" },
        price: 40,
        img: "https://uploads.onecompiler.io/44avb35xn/44azkc7wy/Photoroom-20260120_003048_5.png",
        name: {
          ar: "طاجين دجاج",
          en: "Chicken Tagine",
          fr: "Tajine de poulet",
        },
        desc: {
          ar: "طاجين دجاج بالليمون والزيتون",
          en: "Chicken tagine with lemon & olives",
          fr: "Tajine de poulet au citron & olives",
        },
      },
      {
        id: "m2",
        cat: "moroccan",
        catLabel: { ar: "مغربي", en: "Moroccan", fr: "Marocain" },
        price: 45,
        img: "https://uploads.onecompiler.io/44avb35xn/44azkc7wy/Photoroom-20260120_003048_7.png",
        name: { ar: "كسكس", en: "Couscous", fr: "Couscous" },
        desc: {
          ar: "كسكس بالخضر والمرق",
          en: "Couscous with vegetables",
          fr: "Couscous aux légumes",
        },
      },
      {
        id: "i1",
        cat: "italian",
        catLabel: { ar: "إيطالي", en: "Italian", fr: "Italien" },
        price: 45,
        img: "https://images.unsplash.com/photo-1521389508051-d7ffb5dc8ff7?auto=format&fit=crop&w=900&q=70",
        name: {
          ar: "بيتزا مارغريتا",
          en: "Margherita Pizza",
          fr: "Pizza Margherita",
        },
        desc: {
          ar: "طماطم + جبن + ريحان",
          en: "Tomato + cheese + basil",
          fr: "Tomate + fromage + basilic",
        },
      },
      {
        id: "i2",
        cat: "italian",
        catLabel: { ar: "إيطالي", en: "Italian", fr: "Italien" },
        price: 40,
        img: "https://images.unsplash.com/photo-1604908554085-2c0a82b1f345?auto=format&fit=crop&w=900&q=70",
        name: { ar: "باستا ألفريدو", en: "Alfredo Pasta", fr: "Pâtes Alfredo" },
        desc: {
          ar: "صلصة كريمية وجبن",
          en: "Creamy sauce & cheese",
          fr: "Sauce crémeuse & fromage",
        },
      },
      {
        id: "a1",
        cat: "american",
        catLabel: { ar: "أمريكي", en: "American", fr: "Américain" },
        price: 50,
        img: "https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=900&q=70",
        name: { ar: "برغر لحم", en: "Beef Burger", fr: "Burger de bœuf" },
        desc: {
          ar: "برغر مع بطاطس",
          en: "Burger with fries",
          fr: "Burger avec frites",
        },
      },
      {
        id: "a2",
        cat: "american",
        catLabel: { ar: "أمريكي", en: "American", fr: "Américain" },
        price: 30,
        img: "https://images.unsplash.com/photo-1604908176997-125f25cc5002?auto=format&fit=crop&w=900&q=70",
        name: {
          ar: "دجاج مقرمش",
          en: "Crispy Chicken",
          fr: "Poulet croustillant",
        },
        desc: {
          ar: "قطع دجاج مقرمشة",
          en: "Crispy chicken bites",
          fr: "Bouchées de poulet croustillantes",
        },
      },
      {
        id: "h1",
        cat: "indian",
        catLabel: { ar: "هندي", en: "Indian", fr: "Indien" },
        price: 55,
        img: "https://uploads.onecompiler.io/44avb35xn/44azkc7wy/Photoroom-20260120_003048_2.png",
        name: {
          ar: "دجاج تيكا ماسالا",
          en: "Chicken Tikka Masala",
          fr: "Poulet Tikka Masala",
        },
        desc: {
          ar: "صلصة متبلة وكريمية",
          en: "Spiced creamy sauce",
          fr: "Sauce épicée et crémeuse",
        },
      },
      {
        id: "h2",
        cat: "indian",
        catLabel: { ar: "هندي", en: "Indian", fr: "Indien" },
        price: 20,
        img: "https://images.unsplash.com/photo-1625944522862-37c4f97e3b16?auto=format&fit=crop&w=900&q=70",
        name: {
          ar: "برياني دجاج",
          en: "Chicken biryani",
          fr: "Biryani au poulet",
        },
        desc: {
          ar: "أرز هندي طري",
          en: "Soft Indian rice",
          fr: "Riz indien parfumé",
        },
      },
      {
        id: "j1",
        cat: "juice",
        catLabel: { ar: "عصائر", en: "Juice", fr: "Jus" },
        price: 3,
        img: "https://images.unsplash.com/photo-1542444459-db63c3c0e3b4?auto=format&fit=crop&w=900&q=70",
        name: { ar: "عصير برتقال", en: "Orange Juice", fr: "Jus d'orange" },
        desc: {
          ar: "كأس عصير طبيعي",
          en: "Fresh orange juice",
          fr: "Jus d’orange frais",
        },
      },
      {
        id: "s1",
        cat: "soda",
        catLabel: { ar: "مشروبات غازية", en: "Soda", fr: "Soda" },
        price: 8,
        img: "https://uploads.onecompiler.io/44avb35xn/44azkc7wy/lkj%5Ehj%20(8).png",
        name: { ar: "كوكا كولا", en: "Coca Cola", fr: "Coca-Cola" },
        desc: { ar: "علبة 330ml", en: "Can 330ml", fr: "Canette 330ml" },
      },
      {
        id: "w1",
        cat: "water",
        catLabel: { ar: "مياه", en: "Water", fr: "Eau" },
        price: 6,
        img: "https://uploads.onecompiler.io/44avb35xn/44azkc7wy/Photoroom-20260120_003048_1.png",
        name: { ar: "ماء معدني", en: "Mineral Water", fr: "Eau minérale" },
        desc: { ar: "قارورة 500ml", en: "Bottle 500ml", fr: "Bouteille 500ml" },
      },
    ];
    m.items = seed.map((p) => ({
      ...p,
      restaurantId: "REST-1",
      isAvailable: true,
      createdAt: new Date().toISOString(),
    }));
    saveMenu(m);
  }
}

function makeId() {
  const rnd = crypto.randomBytes(3).toString("hex");
  const ts = Date.now().toString(36);
  return `${ts}-${rnd}`.toUpperCase();
}

function genId() {
  return makeId();
}

/***********************
 * Password hashing (bcrypt + legacy pbkdf2 migration)
 ***********************/
function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function normalizePhone(phone) {
  // Keep digits only, then normalize common Morocco formats:
  //  - +2126xxxxxxx / 002126xxxxxxx  -> 06xxxxxxx
  //  - 6xxxxxxx (9 digits)           -> 06xxxxxxx
  // Fallback: if still long, keep last 10 digits (best effort).
  let d = String(phone || "").replace(/\D/g, "");
  if (!d) return "";

  // drop leading 00 (international prefix)
  if (d.startsWith("00")) d = d.slice(2);

  // Morocco country code 212 (mobile numbers are 9 digits after 212)
  if (d.startsWith("212")) {
    const rest = d.slice(3);
    if (rest.length === 9) {
      d = "0" + rest;
    } else if (rest.length > 9) {
      // best-effort: take last 9 digits
      d = "0" + rest.slice(-9);
    }
  }

  // If user enters 9 digits starting with 6/7, add leading 0
  if (d.length === 9 && (d.startsWith("6") || d.startsWith("7"))) {
    d = "0" + d;
  }

  // Best-effort: if still longer than 10, keep last 10 digits
  if (d.length > 10) d = d.slice(-10);

  return d;
}

// bcrypt cost factor (min 8 / max 14 to avoid blocking too much)
const BCRYPT_ROUNDS = (() => {
  const n = Number(process.env.BCRYPT_ROUNDS || 10);
  if (!Number.isFinite(n)) return 10;
  return Math.max(8, Math.min(14, Math.floor(n)));
})();

function isBcryptHashString(str) {
  return typeof str === "string" && /^\$2[aby]\$\d{2}\$/.test(str);
}

function timingSafeEqualStr(a, b) {
  try {
    const ba = Buffer.from(String(a), "utf-8");
    const bb = Buffer.from(String(b), "utf-8");
    if (ba.length !== bb.length) return false;
    return crypto.timingSafeEqual(ba, bb);
  } catch (_e) {
    return false;
  }
}

// Legacy format (old versions): { salt, iterations, hash, digest, keylen }
function isLegacyPasswordRecord(record) {
  return (
    record &&
    typeof record === "object" &&
    typeof record.salt === "string" &&
    typeof record.hash === "string" &&
    record.hash.length > 0
  );
}

function hashPassword(password) {
  return bcrypt.hashSync(String(password), BCRYPT_ROUNDS);
}

function verifyLegacyPassword(password, record) {
  try {
    const { salt, iterations, hash, digest, keylen } = record || {};
    if (!salt || !iterations || !hash) return false;
    const calc = crypto
      .pbkdf2Sync(
        String(password),
        String(salt),
        Number(iterations),
        Number(keylen || 32),
        String(digest || "sha256"),
      )
      .toString("hex");
    return crypto.timingSafeEqual(
      Buffer.from(calc, "hex"),
      Buffer.from(String(hash), "hex"),
    );
  } catch (e) {
    return false;
  }
}

function verifyPassword(password, record) {
  try {
    if (!record) return false;

    // New format: bcrypt hash string
    if (typeof record === "string") {
      if (isBcryptHashString(record)) {
        return bcrypt.compareSync(String(password), record);
      }
      // Legacy: plain text password stored as string
      return timingSafeEqualStr(String(password), record);
    }

    // Old format: pbkdf2 record object
    if (isLegacyPasswordRecord(record)) {
      return verifyLegacyPassword(password, record);
    }

    return false;
  } catch (e) {
    return false;
  }
}

/***********************
 * JWT authentication (admin/customer/driver/restaurant)
 ***********************/
const JWT_SECRET =
  String(process.env.JWT_SECRET || "").trim() ||
  crypto.randomBytes(32).toString("hex");

if (!process.env.JWT_SECRET) {
  console.warn(
    "[WARN] JWT_SECRET is not set. Using a random secret (tokens will reset on restart). " +
      "Create a .env file and set JWT_SECRET for production.",
  );
}

// Secret used to derive pickup/delivery verification codes (never stored per order).
const VERIFY_SECRET =
  String(process.env.VERIFY_CODE_SECRET || "").trim() || JWT_SECRET;

// Token lifetimes (override in .env if needed)
const JWT_ADMIN_EXPIRES_IN = String(process.env.JWT_ADMIN_EXPIRES_IN || "2h"); // admin dashboard
const JWT_CUSTOMER_EXPIRES_IN = String(
  process.env.JWT_CUSTOMER_EXPIRES_IN || "30d",
); // customer app
const JWT_DRIVER_EXPIRES_IN = String(process.env.JWT_DRIVER_EXPIRES_IN || "7d"); // driver app
const JWT_RESTAURANT_EXPIRES_IN = String(
  process.env.JWT_RESTAURANT_EXPIRES_IN || "7d",
); // restaurant login

function signToken(payload, expiresIn) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

// Refresh tokens (rotating) — stored hashed in JSON for now (can be moved to DB later)
const REFRESH_TOKEN_EXPIRES_DAYS = Number(
  process.env.REFRESH_TOKEN_EXPIRES_DAYS || 30,
);

function sha256Hex(input) {
  return crypto
    .createHash("sha256")
    .update(String(input || ""), "utf-8")
    .digest("hex");
}

function makeRefreshToken() {
  // 48 bytes ~ 64 chars base64url
  return crypto.randomBytes(48).toString("base64url");
}

function issueRefreshToken({
  userType,
  userId,
  role,
  restaurantId = null,
  meta = {},
}) {
  const raw = makeRefreshToken();
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() +
      Math.max(1, REFRESH_TOKEN_EXPIRES_DAYS) * 24 * 60 * 60 * 1000,
  );
  const rec = {
    id: genId(),
    userType: String(userType || ""),
    userId: String(userId || ""),
    role: String(role || ""),
    restaurantId: restaurantId ? String(restaurantId) : null,
    tokenHash: sha256Hex(raw),
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    revokedAt: null,
    replacedBy: null,
    meta: meta && typeof meta === "object" ? meta : {},
  };
  const data = loadRefreshTokens();
  data.tokens.unshift(rec);
  // keep bounded
  const max = Number(process.env.REFRESH_TOKENS_MAX || 10000);
  if (Number.isFinite(max) && max > 0 && data.tokens.length > max)
    data.tokens = data.tokens.slice(0, max);
  saveRefreshTokens(data);
  return { refreshToken: raw, record: rec };
}

function findRefreshTokenRecord(raw) {
  if (!raw) return null;
  const h = sha256Hex(raw);
  const data = loadRefreshTokens();
  return (data.tokens || []).find((t) => String(t.tokenHash) === h) || null;
}

function isRefreshTokenValid(rec) {
  if (!rec) return false;
  if (rec.revokedAt) return false;
  const exp = Date.parse(String(rec.expiresAt || ""));
  if (!Number.isFinite(exp)) return false;
  return Date.now() < exp;
}

function revokeRefreshToken(raw, { replacedBy = null } = {}) {
  try {
    if (!raw) return false;
    const h = sha256Hex(raw);
    const data = loadRefreshTokens();
    const idx = (data.tokens || []).findIndex((t) => String(t.tokenHash) === h);
    if (idx < 0) return false;
    const rec = data.tokens[idx];
    rec.revokedAt = new Date().toISOString();
    if (replacedBy) rec.replacedBy = String(replacedBy);
    data.tokens[idx] = rec;
    saveRefreshTokens(data);
    return true;
  } catch (_e) {
    return false;
  }
}

function getAdminTokenFromReq(req) {
  const auth = String(req.header("Authorization") || "");
  if (auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return req.header("X-Admin-Token");
}

function decodeAdminToken(t) {
  const decoded = verifyToken(t);
  if (!decoded || decoded.role !== "admin") return null;
  return decoded;
}

// Keep the same function name used by the rest of the code.
// Returns a JWT that includes role-based claims.
function issueToken(adminId) {
  return signToken(
    { id: String(adminId || ""), role: "admin" },
    JWT_ADMIN_EXPIRES_IN,
  );
}

function isValidToken(t) {
  return !!decodeAdminToken(t);
}

// Role-based auth middleware (admin-only)
// Resolve the CURRENT role of an admin token from the admin file on every
// request, so demoting or disabling a staff member takes effect immediately.
// Accounts created before roles existed have no role => system_admin.
function resolveAdminRole(adminId) {
  const id = String(adminId || "");
  if (id === "legacy") return { ok: true, role: adminRoles.FULL };
  const rec = (loadAdmins().admins || []).find((a) => String(a.id) === id);
  if (!rec || rec.disabled) return { ok: false };
  return { ok: true, role: adminRoles.normalizeRole(rec.role) || null };
}

function requireAdmin(req, res, next) {
  const token = getAdminTokenFromReq(req);
  const decoded = decodeAdminToken(token);
  if (!decoded) return res.status(401).json({ error: "Unauthorized" });
  const who = resolveAdminRole(decoded.id);
  if (!who.ok) return res.status(401).json({ error: "Unauthorized" });
  const az = adminRoles.authorize(who.role, req.method, req.originalUrl || req.url);
  if (!az.ok) {
    appendAuditLog({
      actorType: "admin",
      actorId: String(decoded.id || ""),
      action: "admin.denied",
      role: String(who.role || ""),
      method: req.method,
      path: String(req.originalUrl || req.url || "").split("?")[0].slice(0, 200),
    });
    return res.status(az.status).json({ error: az.error });
  }
  req.user = decoded; // { id, role, iat, exp }
  req.adminRole = who.role;
  // Backward-compat convenience alias (some endpoints expect req.adminId)
  req.adminId = String(decoded.id || "");
  next();
}

function requireRole(role) {
  return function (req, res, next) {
    if (!req.user || req.user.role !== role) return res.sendStatus(403);
    next();
  };
}

/***********************
 * Simple customer token auth (in-memory)
 ***********************/
const customerTokens = new Map(); // token -> { expiresAt, customerId }

function issueCustomerToken(customerId) {
  return signToken(
    { id: String(customerId), role: "customer" },
    JWT_CUSTOMER_EXPIRES_IN,
  );
}

function getCustomerTokenFromReq(req) {
  const auth = String(req.header("Authorization") || "");
  if (auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return req.header("X-Customer-Token");
}

function getCustomerIdFromToken(t) {
  if (!t) return null;

  // Legacy in-memory tokens (old builds)
  const legacy = customerTokens.get(t);
  if (legacy) {
    if (Date.now() > legacy.expiresAt) {
      customerTokens.delete(t);
      return null;
    }
    return String(legacy.customerId || "");
  }

  // JWT
  const decoded = verifyToken(t);
  if (!decoded || decoded.role !== "customer") return null;
  return String(decoded.id || decoded.sub || "");
}

function requireCustomer(req, res, next) {
  const token = getCustomerTokenFromReq(req);
  const customerId = getCustomerIdFromToken(token);
  if (!customerId) return res.status(401).json({ error: "Unauthorized" });
  req.customerId = customerId;
  next();
}

function safeCustomer(c) {
  if (!c) return null;
  // Never expose password or Google subject identifier
  const { password, googleSub, googleEmailVerified, ...rest } = c;
  return rest;
}

/***********************
 * Simple driver token auth (in-memory)
 ***********************/
const driverTokens = new Map(); // token -> { expiresAt, driverId }

function issueDriverToken(driverId) {
  return signToken(
    { id: String(driverId), role: "driver" },
    JWT_DRIVER_EXPIRES_IN,
  );
}

function getDriverTokenFromReq(req) {
  const auth = String(req.header("Authorization") || "");
  if (auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return req.header("X-Driver-Token");
}

function getDriverIdFromToken(t) {
  if (!t) return null;

  // Legacy in-memory tokens (old builds)
  const legacy = driverTokens.get(t);
  if (legacy) {
    if (Date.now() > legacy.expiresAt) {
      driverTokens.delete(t);
      return null;
    }
    return String(legacy.driverId || "");
  }

  // JWT
  const decoded = verifyToken(t);
  if (!decoded || decoded.role !== "driver") return null;
  return String(decoded.id || decoded.sub || "");
}

function requireDriver(req, res, next) {
  const token = getDriverTokenFromReq(req);
  const driverId = getDriverIdFromToken(token);
  if (!driverId) return res.status(401).json({ error: "Unauthorized" });
  req.driverId = driverId;
  next();
}

function safeDriver(d) {
  if (!d) return null;
  const { password, ...rest } = d;
  // keep images for admin review, but hide them in /me by default
  return rest;
}

function requireApprovedDriver(req, res, next) {
  const data = loadDrivers();
  const d = data.drivers.find((x) => String(x.id) === String(req.driverId));
  if (!d) return res.status(401).json({ error: "Unauthorized" });
  if (String(d.status || "pending") !== "approved") {
    return res.status(403).json({
      error: "Driver pending approval",
      status: d.status || "pending",
    });
  }
  req.driver = d;
  next();
}

// Like requireApprovedDriver, but a SUSPENDED driver may still finish an order
// that is already in their hands (picked up / on the way) so food and customers
// are not abandoned. Everything else stays blocked.
function requireApprovedOrFinishing(req, res, next) {
  const data = loadDrivers();
  const d = data.drivers.find((x) => String(x.id) === String(req.driverId));
  if (!d) return res.status(401).json({ error: "Unauthorized" });
  if (String(d.status || "pending") === "approved") {
    req.driver = d;
    return next();
  }
  const o = (loadOrders().orders || []).find((x) => String(x.id) === String(req.params.id));
  if (driverReview.mayFinishDelivery(d, o)) {
    req.driver = d;
    return next();
  }
  return res.status(403).json({
    error: "Driver pending approval",
    status: d.status || "pending",
  });
}

/***********************
 * Simple restaurant token auth (in-memory)
 ***********************/
const restaurantTokens = new Map(); // token -> { expiresAt, restaurantId }

function issueRestaurantToken(restaurantId) {
  return signToken(
    { id: String(restaurantId), role: "restaurant" },
    JWT_RESTAURANT_EXPIRES_IN,
  );
}

function getRestaurantTokenFromReq(req) {
  const auth = String(req.header("Authorization") || "");
  if (auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return req.header("X-Restaurant-Token");
}

function getRestaurantIdFromToken(t) {
  if (!t) return null;

  // Legacy in-memory tokens (old builds)
  const legacy = restaurantTokens.get(t);
  if (legacy) {
    if (Date.now() > legacy.expiresAt) {
      restaurantTokens.delete(t);
      return null;
    }
    return String(legacy.restaurantId || "");
  }

  // JWT
  const decoded = verifyToken(t);
  if (!decoded || decoded.role !== "restaurant") return null;
  return String(decoded.id || decoded.sub || "");
}

function requireRestaurant(req, res, next) {
  const token = getRestaurantTokenFromReq(req);
  const restaurantId = getRestaurantIdFromToken(token);
  if (!restaurantId) return res.status(401).json({ error: "Unauthorized" });

  const r = loadRestaurants();
  const rest = r.restaurants.find((x) => String(x.id) === String(restaurantId));
  if (!rest) return res.status(401).json({ error: "Unauthorized" });
  if (rest.isActive === false)
    return res.status(403).json({ error: "Restaurant disabled" });

  req.restaurantId = String(restaurantId);
  req.restaurant = rest;
  next();
}

function safeRestaurant(r) {
  if (!r) return null;
  const { password, ...rest } = r;
  // do not expose password hash
  return rest;
}

/***********************
 * Restaurant users (RBAC within a tenant)
 * - These are staff accounts like Owner/Manager/Cashier.
 * - Kept optional so the legacy restaurant token (single password per restaurant) keeps working.
 ***********************/

const JWT_RESTAURANT_USER_EXPIRES_IN = String(
  process.env.JWT_RESTAURANT_USER_EXPIRES_IN || "12h",
);

function issueRestaurantUserToken(user) {
  return signToken(
    {
      id: String(user.id),
      role: "restaurant_user",
      restaurantId: String(user.restaurantId),
      restaurantRole: String(user.role),
    },
    JWT_RESTAURANT_USER_EXPIRES_IN,
  );
}

function getRestaurantUserTokenFromReq(req) {
  const auth = String(req.header("Authorization") || "");
  if (auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return req.header("X-Restaurant-User-Token");
}

function requireRestaurantUser(allowedRoles = null) {
  return function (req, res, next) {
    const t = getRestaurantUserTokenFromReq(req);
    const decoded = verifyToken(t);
    if (!decoded || decoded.role !== "restaurant_user")
      return res.status(401).json({ error: "Unauthorized" });

    const uid = String(decoded.id || "");
    const rid = String(decoded.restaurantId || "");
    const rrole = String(decoded.restaurantRole || "");
    if (!uid || !rid) return res.status(401).json({ error: "Unauthorized" });

    const data = loadRestaurantUsers();
    const user = (data.users || []).find(
      (u) => String(u.id) === uid && String(u.restaurantId) === rid,
    );
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    if (user.isActive === false)
      return res.status(403).json({ error: "User disabled" });

    if (allowedRoles && Array.isArray(allowedRoles) && allowedRoles.length) {
      if (!allowedRoles.includes(String(user.role)))
        return res.status(403).json({ error: "Forbidden" });
    }

    req.restaurantId = rid;
    req.restaurantUser = {
      id: uid,
      role: String(user.role),
      email: user.email || null,
      phone: user.phone || null,
    };
    next();
  };
}

function safeRestaurantUser(u) {
  if (!u) return null;
  const { password, ...rest } = u;
  return rest;
}

// Seed initial menu / restaurants if empty (safe to call multiple times)
ensureSeedData();

function getRestaurantById(restaurantId) {
  ensureSeedData();
  const r = loadRestaurants();
  return (
    (r.restaurants || []).find((x) => String(x.id) === String(restaurantId)) ||
    null
  );
}

function getDefaultRestaurantId() {
  ensureSeedData();
  const r = loadRestaurants();
  const list = (r.restaurants || []).filter((x) => x && x.isActive !== false);
  const first = list[0] || (r.restaurants || [])[0] || null;
  return first ? String(first.id) : "";
}

function getPlanForRestaurant(rest) {
  const plans = loadPlans().plans || defaultPlans();
  const pid = String(rest?.subscriptionPlan || "Basic");
  return plans[pid] || plans.Basic || defaultPlans().Basic;
}

function countRestaurantOrdersInMonth(restaurantId, year, monthIndex0) {
  // monthIndex0: 0..11
  const data = loadOrders();
  const start = new Date(Date.UTC(year, monthIndex0, 1, 0, 0, 0));
  const end = new Date(Date.UTC(year, monthIndex0 + 1, 1, 0, 0, 0));
  const sid = String(restaurantId || "");
  let n = 0;
  for (const o of data.orders || []) {
    if (String(o.restaurantId || "") !== sid) continue;
    const t = Date.parse(String(o.createdAt || ""));
    if (!Number.isFinite(t)) continue;
    if (t >= start.getTime() && t < end.getTime()) n += 1;
  }
  return n;
}

function enforceRestaurantCanReceiveOrders(restaurantId) {
  const rest = getRestaurantById(restaurantId);
  if (!rest) return { ok: false, error: "Invalid restaurantId" };
  if (rest.isActive === false)
    return { ok: false, error: "Restaurant disabled" };

  const status = String(rest.subscriptionStatus || "active").toLowerCase();
  if (status !== "active") {
    return {
      ok: false,
      error: "Subscription inactive",
      subscriptionStatus: status,
    };
  }

  const plan = getPlanForRestaurant(rest);
  const lim = Number(plan?.limits?.monthlyOrders ?? -1);
  if (Number.isFinite(lim) && lim >= 0) {
    const now = new Date();
    const used = countRestaurantOrdersInMonth(
      restaurantId,
      now.getUTCFullYear(),
      now.getUTCMonth(),
    );
    if (used >= lim) {
      return {
        ok: false,
        error: "Monthly order limit reached",
        plan: plan?.id || rest.subscriptionPlan || "Basic",
        used,
        limit: lim,
      };
    }
  }
  return { ok: true, restaurant: rest, plan };
}

function asIsoDate(d) {
  try {
    return new Date(d).toISOString();
  } catch {
    return null;
  }
}

function startOfDayUtc(date) {
  const d = new Date(date);
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0),
  );
}

function computeOrderStats({ restaurantId = null } = {}) {
  const data = loadOrders();
  const orders = (data.orders || []).filter((o) => {
    if (!restaurantId) return true;
    return String(o.restaurantId || "") === String(restaurantId);
  });

  const now = new Date();
  const todayStart = startOfDayUtc(now).getTime();
  const monthStart = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    1,
    0,
    0,
    0,
  );

  const statusCounts = {};
  let ordersToday = 0;
  let ordersThisMonth = 0;
  let revenueToday = 0;
  let revenueThisMonth = 0;

  const productAgg = new Map(); // name -> {qty, revenue}
  const driverAgg = new Map(); // driverId -> {orders, revenue}

  for (const o of orders) {
    const st = String(o.status || "new");
    statusCounts[st] = (statusCounts[st] || 0) + 1;

    const t = Date.parse(String(o.createdAt || ""));
    const total = Number(o.total || 0);
    if (Number.isFinite(t)) {
      if (t >= todayStart) {
        ordersToday += 1;
        revenueToday += Number.isFinite(total) ? total : 0;
      }
      if (t >= monthStart) {
        ordersThisMonth += 1;
        revenueThisMonth += Number.isFinite(total) ? total : 0;
      }
    }

    // products
    const its = Array.isArray(o.items) ? o.items : [];
    for (const it of its) {
      const name = String(it.name || it.id || "").trim();
      if (!name) continue;
      const qty = Number(it.qty || 0);
      const price = Number(it.price || 0);
      const cur = productAgg.get(name) || { qty: 0, revenue: 0 };
      cur.qty += Number.isFinite(qty) ? qty : 0;
      cur.revenue +=
        (Number.isFinite(qty) ? qty : 0) * (Number.isFinite(price) ? price : 0);
      productAgg.set(name, cur);
    }

    // drivers
    const did = String(o.driverId || "");
    if (did) {
      const cur = driverAgg.get(did) || { orders: 0, revenue: 0 };
      cur.orders += 1;
      cur.revenue += Number.isFinite(total) ? total : 0;
      driverAgg.set(did, cur);
    }
  }

  const topProducts = Array.from(productAgg.entries())
    .map(([name, v]) => ({ name, qty: v.qty, revenue: v.revenue }))
    .sort((a, b) => b.qty - a.qty || b.revenue - a.revenue)
    .slice(0, 20);

  const drivers = loadDrivers();
  const byDriverId = new Map(
    (drivers.drivers || []).map((d) => [String(d.id), d]),
  );
  const driverPerformance = Array.from(driverAgg.entries())
    .map(([driverId, v]) => {
      const d = byDriverId.get(String(driverId)) || {};
      return {
        driverId,
        name: d.name || "",
        phone: d.phone || "",
        orders: v.orders,
        revenue: v.revenue,
      };
    })
    .sort((a, b) => b.orders - a.orders || b.revenue - a.revenue)
    .slice(0, 50);

  return {
    totalOrders: orders.length,
    ordersToday,
    ordersThisMonth,
    revenueToday,
    revenueThisMonth,
    statusCounts,
    topProducts,
    driverPerformance,
    generatedAt: new Date().toISOString(),
  };
}

function csvEscape(v) {
  let s = String(v ?? "");
  // CSV/formula injection: a text cell a spreadsheet could execute (customer name, phone "+212...") gets an apostrophe
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function ordersToCsv(orders) {
  const cols = [
    "id",
    "createdAt",
    "status",
    "restaurantId",
    "customerId",
    "customerName",
    "customerPhone",
    "subtotal",
    "deliveryFee",
    "total",
    "driverId",
  ];
  const lines = [cols.join(",")];
  for (const o of orders) {
    const row = [
      o.id,
      o.createdAt,
      o.status,
      o.restaurantId,
      o.customerId,
      o.customer?.name,
      o.customer?.phone,
      o.subtotal,
      o.deliveryFee,
      o.total,
      o.driverId,
    ].map(csvEscape);
    lines.push(row.join(","));
  }
  return lines.join("\n");
}

/***********************
 * Public endpoints
 ***********************/
app.get("/api/health", (req, res) => res.json({ ok: true }));

// Generic refresh + logout endpoints (works for admin/customer/driver/restaurant)
app.post(
  "/api/auth/refresh",
  validate([
    body("refreshToken")
      .optional()
      .customSanitizer(stripDangerous)
      .isLength({ max: 400 }),
  ]),
  (req, res) => {
    const raw = String(
      req.body?.refreshToken || req.header("X-Refresh-Token") || "",
    ).trim();
    if (!raw) return res.status(400).json({ error: "Missing refreshToken" });

    const rec = findRefreshTokenRecord(raw);
    if (!rec || !isRefreshTokenValid(rec))
      return res.status(401).json({ error: "Invalid refreshToken" });

    // Rotate refresh token
    const rotated = issueRefreshToken({
      userType: rec.userType,
      userId: rec.userId,
      role: rec.role,
      restaurantId: rec.restaurantId,
      meta: { rotatedFrom: rec.id },
    });
    revokeRefreshToken(raw, { replacedBy: rotated.record.id });

    let accessToken = null;
    if (rec.userType === "admin") accessToken = issueToken(rec.userId);
    else if (rec.userType === "customer")
      accessToken = issueCustomerToken(rec.userId);
    else if (rec.userType === "driver")
      accessToken = issueDriverToken(rec.userId);
    else if (rec.userType === "restaurant_user") {
      const data = loadRestaurantUsers();
      const user =
        (data.users || []).find(
          (u) =>
            String(u.id) === String(rec.userId) &&
            String(u.restaurantId) === String(rec.restaurantId || ""),
        ) || null;
      if (!user || user.isActive === false)
        return res.status(401).json({ error: "Invalid refreshToken" });
      accessToken = issueRestaurantUserToken(user);
    } else if (rec.userType === "restaurant")
      accessToken = issueRestaurantToken(rec.userId || rec.restaurantId);
    else return res.status(400).json({ error: "Unknown userType" });

    return res.json({
      ok: true,
      token: accessToken,
      refreshToken: rotated.refreshToken,
    });
  },
);

app.post(
  "/api/auth/logout",
  validate([
    body("refreshToken")
      .optional()
      .customSanitizer(stripDangerous)
      .isLength({ max: 400 }),
  ]),
  (req, res) => {
    const raw = String(
      req.body?.refreshToken || req.header("X-Refresh-Token") || "",
    ).trim();
    if (!raw) return res.status(400).json({ error: "Missing refreshToken" });
    const ok = revokeRefreshToken(raw);
    return res.json({ ok: true, revoked: ok });
  },
);

app.get("/api/public-config", (req, res) => {
  const cfg = loadConfig();
  const polRaw =
    cfg.companyPolicy && typeof cfg.companyPolicy === "object"
      ? cfg.companyPolicy
      : {};
  const policyObj = {
    ar: String(polRaw.ar || ""),
    en: String(polRaw.en || ""),
    fr: String(polRaw.fr || ""),
  };
  const companyPolicyEnabled = Object.values(policyObj).some(
    (v) => String(v || "").trim().length > 0,
  );

  res.json({
    restaurantName: cfg.restaurantName || "siymon",
    supportPhone: cfg.supportPhone || "",
    adminWhatsappNumber: cfg.adminWhatsappNumber || null,
    bankAccountName: cfg.bankAccountName || "",
    bankAccount: cfg.bankAccount || "",

    // Customer Google Sign-In (enabled when GOOGLE_CLIENT_ID is set)
    googleAuthEnabled: GOOGLE_AUTH_ENABLED,
    googleClientId: GOOGLE_AUTH_ENABLED ? GOOGLE_CLIENT_ID : "",

    // Driver Apple Sign-In (enabled when APPLE_CLIENT_ID + APPLE_REDIRECT_URI are set)
    appleAuthEnabled: APPLE_AUTH_ENABLED,
    appleClientId: APPLE_AUTH_ENABLED ? APPLE_CLIENT_ID : "",
    appleRedirectUri: APPLE_AUTH_ENABLED ? APPLE_REDIRECT_URI : "",

    // Web Push (Real Push Notifications)
    webPushEnabled: WEBPUSH_ENABLED,
    webPushPublicKey: WEBPUSH_ENABLED ? WEBPUSH_VAPID_PUBLIC_KEY : "",

    companyPolicy: policyObj,
    companyPolicyEnabled,
    companyPolicyRequireAccept: cfg.companyPolicyRequireAccept !== false,
    companyPolicyUpdatedAt: cfg.companyPolicyUpdatedAt || null,

    offersBanners: Array.isArray(cfg.offersBanners) ? cfg.offersBanners : [],

    driverWalletEnabled: cfg.driverWalletEnabled !== false,
    driverCommissionPerOrder: Number(cfg.driverCommissionPerOrder || 0),
    driverWalletChargeMode: cfg.driverWalletChargeMode || "subtotal",
    deliveryPricing: (() => {
      const dpS = deliveryPricing.settingsFromConfig(cfg);
      return { mode: dpS.mode, pricePerKm: dpS.pricePerKm, baseFee: dpS.baseFee, maxKm: dpS.maxKm };
    })(),
    currency: cfg.currency || "MAD",
    restaurantMode: cfg.restaurantMode || "auto",
  });
});

app.get("/api/company-policy", (req, res) => {
  const cfg = loadConfig();
  const polRaw =
    cfg.companyPolicy && typeof cfg.companyPolicy === "object"
      ? cfg.companyPolicy
      : {};
  const policy = {
    ar: String(polRaw.ar || ""),
    en: String(polRaw.en || ""),
    fr: String(polRaw.fr || ""),
  };
  const enabled = Object.values(policy).some(
    (v) => String(v || "").trim().length > 0,
  );
  const requireAccept = cfg.companyPolicyRequireAccept !== false;

  let lang = String(req.query.lang || "").toLowerCase();
  if (!["ar", "en", "fr"].includes(lang)) lang = "";

  const text =
    lang && policy[lang]
      ? policy[lang]
      : policy.ar || policy.en || policy.fr || "";

  res.json({
    ok: true,
    enabled,
    requireAccept,
    updatedAt: cfg.companyPolicyUpdatedAt || null,
    lang: lang || null,
    policy,
    text,
  });
});

// Public restaurants + menu
// Public store averages: recomputed at most every 30 s (they only change when a customer rates).
let _storeRatingsMemo = { at: 0, map: new Map() };
function storeRatingsCached() {
  if (Date.now() - _storeRatingsMemo.at > 30_000) {
    _storeRatingsMemo = { at: Date.now(), map: ratingsLib.storeAverages(loadOrders().orders || []) };
  }
  return _storeRatingsMemo.map;
}

app.get("/api/restaurants", (req, res) => {
  ensureSeedData();
  const r = loadRestaurants();
  // Customers only see published stores (active or temporarily paused).
  const restaurants = r.restaurants
    .filter((x) => catalogLib.isPublic(x))
    .map((x) => {
      const ra = storeRatingsCached().get(String(x.id));
      return { ...catalogLib.publicStore(x), rating: ra ? { avg: ra.avg, count: ra.count } : { avg: 0, count: 0 } };
    })
    .sort((a, b) => a.sortOrder - b.sortOrder);
  res.json({ ok: true, restaurants });
});

app.get("/api/menu", (req, res) => {
  ensureSeedData();
  const m = loadMenu();
  const restaurantId = String(req.query.restaurantId || "").trim();
  const published = new Set(
    loadRestaurants()
      .restaurants.filter((x) => catalogLib.isPublic(x))
      .map((x) => String(x.id)),
  );
  // Public side: published stores, available + non-archived + in-stock items only
  let items = m.items.filter(
    (x) => catalogLib.itemOrderable(x) && published.has(String(x.restaurantId || "")),
  );
  if (restaurantId)
    items = items.filter((x) => String(x.restaurantId || "") === restaurantId);
  items = items
    .map((x) => ({
      ...x,
      salePrice:
        catalogLib.unitPrice(x) !== Number(x.price) ? catalogLib.unitPrice(x) : null,
    }))
    .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
  res.json({ ok: true, items });
});

// Public search: products / medicines / stores. Every published store is searched (not just the selected one);
// unavailable items are returned flagged so the customer sees "not available" (and can ask the pharmacy) instead of nothing.
app.get("/api/search", (req, res) => {
  ensureSeedData();
  const q = String(req.query.q || "").slice(0, 60);
  const stores = loadRestaurants().restaurants.filter((x) => catalogLib.isPublic(x));
  const out = searchLib.search({
    q,
    items: loadMenu().items,
    stores,
    limit: Number(req.query.limit) || 12,
    storeId: String(req.query.storeId || "").trim(),
  });
  res.set("Cache-Control", "no-store");
  res.json({ ok: true, ...out });
});

// Public homepage payload (categories, banners, sections) - published data only.
app.get("/api/home", (req, res) => {
  ensureSeedData();
  res.json({
    ok: true,
    ...catalogLib.buildHome({
      catalog: loadCatalog(),
      stores: loadRestaurants().restaurants,
      items: loadMenu().items,
    }),
  });
});

// Admin: homepage catalog management (categories / banners / sections)
app.get("/api/admin/catalog", requireAdmin, (req, res) => {
  res.json({ ok: true, ...loadCatalog() });
});
app.put("/api/admin/catalog", requireAdmin, (req, res) => {
  const clean = catalogLib.sanitizeCatalog(req.body, {
    i18n: asI18nText,
    cleanImg: cleanImgUrl,
    makeId,
  });
  saveCatalog(clean);
  res.json({ ok: true, ...clean });
});

// Service-area gate (spec 18). Zones are independent of H3 dispatch rings and of the pricing mode.
function loadServiceZones() {
  return serviceZones.normalizeDoc(readJson(SERVICE_ZONES_FILE, null)).zones;
}
function zoneGuard({ settings, store, dropoff }) {
  return serviceZones.guard({ zones: loadServiceZones(), settings, store, dropoff, routeService });
}

// Road-distance delivery quote for order creation. Runs only in "distance"
// mode; routing/location problems are answered here with an explicit error
// (never a guessed distance). Free-delivery threshold is applied in the handler
// once the server-side subtotal is known.
async function deliveryQuoteMw(req, res, next) {
  try {
    const cfg = loadConfig();
    const settings = deliveryPricing.settingsFromConfig(cfg);
    const body = req.body || {};
    const rid = String(body.restaurantId || "").trim() || getDefaultRestaurantId();
    const store = rid ? getRestaurantById(rid) : null;
    if (!store) return next(); // the order handler reports invalid restaurants
    const c = body.customer || {};
    const dropoff = { lat: Number(c.lat), lng: Number(c.lng) };
    // Service area first (spec 18): zone + store-in-zone + the zone's road-distance limit.
    const g = await zoneGuard({ settings, store, dropoff });
    if (!g.ok) return res.status(g.status).json(serviceZones.failureBody(g));
    req.serviceZoneSnapshot = g.snapshot;
    if (settings.mode !== "distance") return next();
    const q = await deliveryPricing.quote({
      settings: g.settings,
      store,
      dropoff,
      subtotal: 0,
      routeService,
    });
    if (!q.ok) return res.status(q.status).json(serviceZones.failureBody(q));
    req.deliveryQuote = q;
    return next();
  } catch (e) {
    return next(e);
  }
}

app.post(
  "/api/orders",
  deliveryQuoteMw,
  validate([
    body("customer.name").optional().customSanitizer(stripDangerous),
    body("customer.phone").optional().trim().isLength({ max: 25 }),
    body("customer.addr")
      .optional()
      .customSanitizer(stripDangerous)
      .isLength({ max: 300 }),
    body("customer.notes")
      .optional()
      .customSanitizer(stripDangerous)
      .isLength({ max: 500 }),
    body("restaurantId")
      .optional()
      .customSanitizer(stripDangerous)
      .isLength({ max: 80 }),
    body("items").optional().isArray({ max: 100 }),
    body("items.*.id")
      .optional()
      .customSanitizer(stripDangerous)
      .isLength({ max: 80 }),
    body("items.*.name")
      .optional()
      .customSanitizer(stripDangerous)
      .isLength({ max: 120 }),
    body("items.*.qty").optional().toInt(),
    body("items.*.price").optional().toFloat(),
    body("subtotal").optional().toFloat(),
    body("paymentMethod").optional().isString().isLength({ max: 40 }),
    body("useWallet").optional(),
  ]),
  (req, res) => {
    const cfg = loadConfig();
    const body = req.body || {};

    // السماح للزوار بإنشاء طلب بدون تسجيل دخول
    const token = getCustomerTokenFromReq(req);
    const customerId = getCustomerIdFromToken(token) || null;

    const customersData = loadCustomers();
    const custRec = customerId
      ? customersData.customers.find((c) => String(c.id) === String(customerId))
      : null;

    if (String(cfg.restaurantMode || "auto") === "closed") {
      return res.status(403).json({ error: "Restaurant is closed" });
    }
    const customer = body.customer || {};
    // Autofill name/phone from customer profile when missing
    if (!customer.name && custRec) {
      const fn = String(custRec.firstName || "").trim();
      const ln = String(custRec.lastName || "").trim();
      const full = `${fn} ${ln}`.trim();
      if (full) customer.name = full;
    }
    if (!customer.phone && custRec && custRec.phone) {
      customer.phone = String(custRec.phone);
    }
    const items = Array.isArray(body.items) ? body.items : [];

    if (!customer.name || !customer.phone || !customer.addr) {
      return res.status(400).json({ error: "Missing customer fields" });
    }
    if (items.length === 0) {
      return res.status(400).json({ error: "Empty items" });
    }

    // Payment policy: only Cash on Delivery is enabled (see lib/payments.js).
    // Online methods (card/visa/mastercard/paypal) are rejected server-side.
    const pay = paymentsLib.resolveOrderPayment(body.paymentMethod, loadPaymentMethods());
    if (!pay.ok) {
      return res
        .status(400)
        .json({ error: pay.error, code: pay.code, method: pay.method });
    }

    // Multi-tenant: restaurantId is required for SaaS. For backward compatibility,
    // if the client does not send it, we fallback to the first active restaurant.
    const restaurantId =
      String(body.restaurantId || "").trim() || getDefaultRestaurantId();
    if (!restaurantId)
      return res.status(400).json({ error: "Missing restaurantId" });
    const check = enforceRestaurantCanReceiveOrders(restaurantId);
    if (!check.ok) {
      const msg = check.error || "Not allowed";
      if (msg === "Invalid restaurantId") return res.status(400).json(check);
      if (msg === "Restaurant disabled") return res.status(403).json(check);
      // Subscription-related
      return res.status(402).json(check);
    }

    // ✅ Server-side pricing (anti-tampering)
    // Never trust price/subtotal/total from the client.
    const orderLang = String(body.lang || "ar");
    const menu = loadMenu();
    const byId = new Map(
      (menu.items || [])
        .filter((it) => String(it.restaurantId || "") === String(restaurantId))
        .map((it) => [String(it.id), it]),
    );

    const pickName = (it) => {
      const n = it?.name;
      if (!n) return "";
      if (typeof n === "string") return n;
      const l =
        orderLang === "fr"
          ? n.fr || n.en || n.ar
          : orderLang === "en"
            ? n.en || n.fr || n.ar
            : n.ar || n.en || n.fr;
      return String(l || "");
    };

    const cleanedItems = items
      .map((it) => {
        const id = String(it.id || "").trim();
        const qty = Number(it.qty || 0);
        return { id, qty };
      })
      .filter((x) => x.id && Number.isFinite(x.qty) && x.qty > 0);

    if (cleanedItems.length === 0) {
      return res.status(400).json({ error: "Empty items" });
    }

    // Regulated goods (e.g. prescription-only medicines) are never sold online.
    if (cleanedItems.some((l) => storesLib.blockedForSale(byId.get(l.id)))) {
      return res
        .status(409)
        .json({ error: "Item not sold online", code: "regulated_item" });
    }

    // Server decides price (incl. sale price), delivery fee, minimum order,
    // opening hours and stock. Item name/price are snapshotted in the order.
    const pricing = catalogLib.computePricing({
      store: check.restaurant,
      lines: cleanedItems,
      byId,
      nameOf: pickName,
    });
    if (!pricing.ok) {
      const { status, ...payload } = pricing;
      return res.status(status || 400).json(payload);
    }
    const computedItems = pricing.items;
    const subtotal = pricing.subtotal;
    let deliveryFee = pricing.deliveryFee;
    let total = pricing.total;
    let deliveryPricingSnapshot = null;
    if (req.deliveryQuote && req.deliveryQuote.mode === "distance") {
      // server-computed road-distance fee replaces the flat fee
      const base = req.deliveryQuote.snapshot.feeBeforeFreeOver;
      deliveryFee = deliveryPricing.applyFreeOver(base, subtotal, check.restaurant);
      total = Math.round((subtotal + deliveryFee + Number.EPSILON) * 100) / 100;
      deliveryPricingSnapshot = { ...req.deliveryQuote.snapshot, fee: deliveryFee };
    }

    // Discount code (server-side only; the client never sends an amount).
    let promoSnap = null;
    const promoCodeIn = promoLib.normalizeCode(body.promoCode);
    if (promoCodeIn) {
      const promo = loadPromos().promos.find((p) => p.code === promoCodeIn);
      const ev = promoLib.evaluate({
        promo,
        subtotal,
        eligibleSubtotal: promoLib.eligibleSubtotal(computedItems, byId, promo && promo.categories),
        customerId,
        storeId: restaurantId,
        orders: loadOrders().orders,
      });
      if (!ev.ok) {
        return res.status(ev.status).json({ error: ev.error, code: ev.code });
      }
      promoSnap = ev.snapshot;
      total = Math.round((subtotal + deliveryFee - ev.amount + Number.EPSILON) * 100) / 100;
    }

    // Store type decides the flow: restaurants keep admin review first;
    // other activities go straight to the store (admin still sees the order).
    const storeType = storesLib.getType(loadStoreTypes(), check.restaurant?.type);
    const orderStatus = storesLib.initialOrderStatus(storeType);
    const autoAccepted = orderStatus === "admin_accepted";
    const nowIso = new Date().toISOString();
    // Guest orders get a private tracking link token (only its hash is stored).
    const trackingIssued = customerId ? null : customerAccount.newTrackingToken();

    const order = {
      id: makeId(),
      createdAt: nowIso,
      status: orderStatus,
      storeType: storeType ? storeType.id : "restaurant",
      autoAccepted,
      driverId: null,
      assignedAt: null,
      acceptedAt: null,
      adminAcceptedAt: autoAccepted ? nowIso : null,
      restaurantReadyAt: null,
      deliveredAt: null,
      updatedAt: nowIso,
      customerId: customerId,
      lang: orderLang,
      currency: cfg.currency || "MAD",
      restaurantId,
      customer: {
        name: String(customer.name),
        phone: String(customer.phone),
        addr: String(customer.addr),
        notes: String(customer.notes || ""),
        // Validated delivery coordinates (used for the live tracking map only).
        ...(geocodeLib.validCoords(Number(customer.lat), Number(customer.lng))
          ? { lat: Number(customer.lat), lng: Number(customer.lng) }
          : {}),
      },
      items: computedItems,
      subtotal,
      deliveryFee,
      total,
      paymentMethod: pay.method,
      verify: verifyCodes.newVerify(),
      ...(trackingIssued ? { trackHash: trackingIssued.hash } : {}),
      ...(promoSnap ? { promo: promoSnap } : {}),
      ...(deliveryPricingSnapshot ? { deliveryPricing: deliveryPricingSnapshot } : {}),
      ...(req.serviceZoneSnapshot ? { serviceZone: req.serviceZoneSnapshot } : {}),
    };

    {
      // Driver earnings snapshot (formula mode only; legacy mode reads deliveryFee live)
      const snap = driverEarnings.snapshot(order, driverEarnings.settingsFromConfig(cfg));
      if (snap) order.driverEarnings = snap;
      // Financial snapshot (commission setting + amounts) frozen at order time
      order.financials = financeLib.orderFinancials({
        order,
        store: check.restaurant,
        driverEarning: driverEarnings.earningOf(order),
      });
    }

    // Customer wallet contribution (goods part only; the ledger entry is idempotent per order).
    let walletPaid = 0;
    const walletReq = body.useWallet === true || body.useWallet === "true" || body.useWallet === 1 ? true : typeof body.useWallet === "number" ? body.useWallet : false;
    if (walletReq) {
      if (!customerId) return res.status(401).json({ error: "Login required to use the wallet", code: "LOGIN_REQUIRED" });
      const cd = loadCustomers();
      const crec = customerById(cd, customerId);
      if (!crec) return res.status(401).json({ error: "Unauthorized" });
      const share = orderPayment.walletShare({
        balance: crec.walletBalance,
        subtotal,
        discount: promoSnap ? promoSnap.amount : 0,
        requested: walletReq,
      });
      if (!share.ok) return res.status(share.status).json({ error: share.error, code: share.code });
      if (share.amount > 0) {
        const e = walletLedger.applyEntry(crec, {
          ref: orderPayment.walletPayRef(order.id),
          type: "order_payment",
          amount: -share.amount,
          orderId: order.id,
          note: "Order paid from wallet",
          actorType: "customer",
          actorId: customerId,
          at: nowIso,
        });
        if (!e.ok) return res.status(409).json({ error: e.error, code: e.code });
        saveCustomers(cd);
        walletPaid = share.amount;
      }
    }
    order.payment = orderPayment.snapshot({
      total,
      deliveryFee,
      walletAmount: walletPaid,
      method: pay.method,
      ledgerRef: orderPayment.walletPayRef(order.id),
      at: nowIso,
    });

    const data = loadOrders();
    data.orders.unshift(order); // newest first
    saveOrders(data);

    if (catalogLib.applyStock(menu, computedItems)) saveMenu(menu);

    if (autoAccepted) {
      try {
        createCustomerOrderStatusNotification({
          customerId: order.customerId,
          orderId: order.id,
          stage: "admin_accepted",
        });
      } catch (_e) {}
    }

    res.json({
      ok: true,
      id: order.id,
      ...(trackingIssued ? { trackingToken: trackingIssued.token } : {}),
    });
  },
);

/***********************
 * Customer auth + "My Orders"
 ***********************/

app.post(
  "/api/customer/signup",
  validate([
    body("firstName").optional().customSanitizer(stripDangerous),
    body("name").optional().customSanitizer(stripDangerous),
    body("lastName").optional().customSanitizer(stripDangerous),
    body("surname").optional().customSanitizer(stripDangerous),
    body("familyName").optional().customSanitizer(stripDangerous),
    body("email").isEmail().normalizeEmail(),
    body("phone").optional().trim().isLength({ max: 25 }),
    body("password").optional().isLength({ max: 128 }),
    body("password2").optional().isLength({ max: 128 }),
    body("passwordConfirm").optional().isLength({ max: 128 }),
  ]),
  (req, res) => {
    const firstName = String(
      req.body?.firstName || req.body?.name || "",
    ).trim();
    const lastName = String(
      req.body?.lastName || req.body?.surname || req.body?.familyName || "",
    ).trim();
    const email = normalizeEmail(req.body?.email);
    const phone = String(req.body?.phone || "").replace(/\D/g, "");
    const password = String(req.body?.password || "");
    const password2 = String(
      req.body?.password2 || req.body?.passwordConfirm || "",
    );

    if (!firstName) return res.status(400).json({ error: "Missing firstName" });
    if (!lastName) return res.status(400).json({ error: "Missing lastName" });
    if (!email || !email.includes("@"))
      return res.status(400).json({ error: "Invalid email" });
    if (email && !email.includes("@"))
      return res.status(400).json({ error: "Invalid email" });
    if (phone && phone.length < 8)
      return res.status(400).json({ error: "Invalid phone" });
    if (!password || password.length < 6)
      return res.status(400).json({ error: "Password too short (min 6)" });
    if (!password2) return res.status(400).json({ error: "Confirm password" });
    if (password2 !== password)
      return res.status(400).json({ error: "Passwords do not match" });

    // Company policy acceptance (required at signup when policy is enabled)
    const cfg = loadConfig();
    const polRaw =
      cfg.companyPolicy && typeof cfg.companyPolicy === "object"
        ? cfg.companyPolicy
        : {};
    const policyObj = {
      ar: String(polRaw.ar || ""),
      en: String(polRaw.en || ""),
      fr: String(polRaw.fr || ""),
    };
    const policyEnabled = Object.values(policyObj).some(
      (v) => String(v || "").trim().length > 0,
    );
    const policyRequired =
      policyEnabled && cfg.companyPolicyRequireAccept !== false;

    const acceptPolicy =
      req.body?.acceptPolicy === true ||
      String(req.body?.acceptPolicy || "").toLowerCase() === "true" ||
      req.body?.policyAccepted === true ||
      String(req.body?.policyAccepted || "").toLowerCase() === "true" ||
      req.body?.acceptTerms === true ||
      String(req.body?.acceptTerms || "").toLowerCase() === "true";

    if (policyRequired && !acceptPolicy) {
      return res.status(400).json({ error: "Policy not accepted" });
    }

    const data = loadCustomers();
    const exists = data.customers.some((c) => {
      const ce = normalizeEmail(c.email);
      const cp = String(c.phone || "").replace(/\D/g, "");
      return (email && ce === email) || (phone && cp === phone);
    });
    if (exists)
      return res.status(409).json({ error: "Customer already exists" });

    const rec = {
      id: makeId(),
      firstName,
      lastName,
      email: email || null,
      phone: phone || null,
      password: hashPassword(password),
      googleSub: null,
      googleEmailVerified: null,
      googlePicture: null,
      policyAcceptedAt: acceptPolicy ? new Date().toISOString() : null,
      policyAcceptedVersion: acceptPolicy
        ? cfg.companyPolicyUpdatedAt || null
        : null,
      notificationsLastSeenAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    data.customers.unshift(rec);
    saveCustomers(data);

    const token = issueCustomerToken(rec.id);
    const rt = issueRefreshToken({
      userType: "customer",
      userId: rec.id,
      role: "customer",
      meta: { ip: req.ip || "", ua: String(req.headers["user-agent"] || "") },
    });
    res.json({
      ok: true,
      token,
      refreshToken: rt.refreshToken,
      customer: safeCustomer(rec),
    });
  },
);

app.post(
  "/api/customer/login",
  loginSlowdown,
  loginLimiter,
  validate([
    body("email").optional({ checkFalsy: true }).normalizeEmail(),
    body("phone").optional({ checkFalsy: true }).trim().isLength({ max: 25 }),
    body("password").optional().isLength({ max: 128 }),
  ]),
  (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const phone = String(req.body?.phone || "").replace(/\D/g, "");
    const password = String(req.body?.password || "");
    if ((!email && !phone) || !password)
      return res.status(400).json({ error: "Missing email/phone or password" });

    const data = loadCustomers();
    let found = null;
    if (email)
      found =
        data.customers.find((c) => normalizeEmail(c.email) === email) || null;
    if (!found && phone)
      found =
        data.customers.find(
          (c) => String(c.phone || "").replace(/\D/g, "") === phone,
        ) || null;
    if (!found) return res.status(401).json({ error: "Wrong credentials" });
    if (!verifyPassword(password, found.password))
      return res.status(401).json({ error: "Wrong credentials" });

    // If this account used the legacy pbkdf2 format, upgrade to bcrypt on successful login
    if (isLegacyPasswordRecord(found.password)) {
      found.password = hashPassword(password);
      found.updatedAt = new Date().toISOString();
      saveCustomers(data);
    }

    const token = issueCustomerToken(found.id);
    const rt = issueRefreshToken({
      userType: "customer",
      userId: found.id,
      role: "customer",
      meta: { ip: req.ip || "", ua: String(req.headers["user-agent"] || "") },
    });
    res.json({
      ok: true,
      token,
      refreshToken: rt.refreshToken,
      customer: safeCustomer(found),
    });
  },
);

// Google Sign-In (creates account if missing)
app.post(
  "/api/customer/google",
  validate([
    body("idToken")
      .optional()
      .customSanitizer(stripDangerous)
      .isLength({ min: 10, max: 5000 }),
    body("acceptPolicy").optional(),
  ]),
  async (req, res) => {
    if (!GOOGLE_AUTH_ENABLED || !googleOauthClient) {
      return res.status(400).json({ error: "Google login not enabled" });
    }
    const idToken = String(
      req.body?.idToken || req.body?.credential || "",
    ).trim();
    if (!idToken) return res.status(400).json({ error: "Missing idToken" });

    let payload = null;
    try {
      const ticket = await googleOauthClient.verifyIdToken({
        idToken,
        audience: GOOGLE_CLIENT_ID,
      });
      payload = ticket && ticket.getPayload ? ticket.getPayload() : null;
    } catch (_e) {
      return res.status(401).json({ error: "Invalid Google token" });
    }
    if (!payload || !payload.sub)
      return res.status(401).json({ error: "Invalid Google token" });

    const googleSub = String(payload.sub || "").trim();
    const email = normalizeEmail(payload.email || "");
    const givenName = String(payload.given_name || "").trim();
    const familyName = String(payload.family_name || "").trim();
    const fullName = String(payload.name || "").trim();
    const picture = String(payload.picture || "").trim();
    const emailVerified = payload.email_verified === true;

    // Normalize names
    let firstName = givenName;
    let lastName = familyName;
    if (!firstName || !lastName) {
      const parts = fullName.split(/\s+/).filter(Boolean);
      if (!firstName) firstName = parts[0] || "";
      if (!lastName) lastName = parts.slice(1).join(" ") || "";
    }
    if (!firstName) firstName = "Customer";
    if (!lastName) lastName = "";

    const acceptPolicy =
      req.body?.acceptPolicy === true ||
      String(req.body?.acceptPolicy || "").toLowerCase() === "true" ||
      req.body?.policyAccepted === true ||
      String(req.body?.policyAccepted || "").toLowerCase() === "true" ||
      req.body?.acceptTerms === true ||
      String(req.body?.acceptTerms || "").toLowerCase() === "true";

    const cfg = loadConfig();
    const polRaw =
      cfg.companyPolicy && typeof cfg.companyPolicy === "object"
        ? cfg.companyPolicy
        : {};
    const policyObj = {
      ar: String(polRaw.ar || ""),
      en: String(polRaw.en || ""),
      fr: String(polRaw.fr || ""),
    };
    const policyEnabled = Object.values(policyObj).some(
      (v) => String(v || "").trim().length > 0,
    );
    const policyRequired =
      policyEnabled && cfg.companyPolicyRequireAccept !== false;

    const data = loadCustomers();
    let found =
      data.customers.find((c) => String(c.googleSub || "") === googleSub) ||
      null;

    // Link by email if possible (best-effort)
    if (!found && email && email.includes("@")) {
      const byEmail =
        data.customers.find((c) => normalizeEmail(c.email) === email) || null;
      if (byEmail && !byEmail.googleSub) {
        byEmail.googleSub = googleSub;
        byEmail.googleEmailVerified = emailVerified;
        if (picture) byEmail.googlePicture = picture;
        byEmail.updatedAt = new Date().toISOString();
        found = byEmail;
        saveCustomers(data);
      }
    }

    if (!found) {
      if (policyRequired && !acceptPolicy) {
        return res
          .status(400)
          .json({ error: "Policy not accepted", code: "POLICY_NOT_ACCEPTED" });
      }
      const now = new Date().toISOString();
      const rec = {
        id: makeId(),
        firstName,
        lastName,
        email: email && email.includes("@") ? email : null,
        phone: null,
        password: null,
        googleSub,
        googleEmailVerified: emailVerified,
        googlePicture: picture || null,
        policyAcceptedAt: acceptPolicy ? now : null,
        policyAcceptedVersion: acceptPolicy
          ? cfg.companyPolicyUpdatedAt || null
          : null,
        notificationsLastSeenAt: null,
        createdAt: now,
        updatedAt: now,
      };
      data.customers.unshift(rec);
      saveCustomers(data);
      found = rec;
    }

    const token = issueCustomerToken(found.id);
    const rt = issueRefreshToken({
      userType: "customer",
      userId: found.id,
      role: "customer",
      meta: { ip: req.ip || "", ua: String(req.headers["user-agent"] || "") },
    });
    return res.json({
      ok: true,
      token,
      refreshToken: rt.refreshToken,
      customer: safeCustomer(found),
    });
  },
);

/***********************
 * Delivery addresses (saved per customer) + reverse geocoding
 ***********************/
const geocodeCache = geocodeLib.makeCache();
const geocodeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests" },
});

// Delivery-fee estimate shown before the customer confirms. POST keeps the
// coordinates out of access logs. The same function is re-run at order creation.
app.post("/api/delivery/quote", geocodeLimiter, async (req, res) => {
  try {
    const body = req.body || {};
    const settings = deliveryPricing.settingsFromConfig(loadConfig());
    const rid = String(body.restaurantId || "").trim() || getDefaultRestaurantId();
    const store = rid ? getRestaurantById(rid) : null;
    if (!store) return res.status(400).json({ error: "Invalid restaurantId" });
    const sub = Number(body.subtotal);
    const dropoff = { lat: Number(body.lat), lng: Number(body.lng) };
    const g = await zoneGuard({ settings, store, dropoff });
    if (!g.ok) return res.status(g.status).json(serviceZones.failureBody(g));
    const q = await deliveryPricing.quote({
      settings: g.settings,
      store,
      dropoff,
      subtotal: Number.isFinite(sub) && sub >= 0 ? sub : 0,
      routeService,
    });
    if (!q.ok) return res.status(q.status).json(serviceZones.failureBody(q));
    res.json({
      ok: true,
      mode: q.mode,
      fee: q.fee,
      ...(q.mode === "distance" ? { km: q.km, pricePerKm: settings.pricePerKm, baseFee: settings.baseFee } : {}),
    });
  } catch (_e) {
    res.status(503).json({ error: "Road distance cannot be calculated right now", code: "ROUTING_UNAVAILABLE" });
  }
});

// Coordinates -> readable address. POST so coordinates stay out of access logs.
app.post("/api/geocode/reverse", geocodeLimiter, async (req, res) => {
  const lat = Number(req.body?.lat), lng = Number(req.body?.lng);
  const lang = ["ar", "fr", "en"].includes(req.body?.lang) ? req.body.lang : "ar";
  if (!geocodeLib.validCoords(lat, lng)) return res.status(400).json({ error: "Invalid coordinates" });
  const hit = geocodeCache.get(lat, lng, lang);
  if (hit) return res.json({ ok: true, ...hit });
  const r = await geocodeLib.reverseGeocode({ lat, lng, lang });
  if (!r.ok) return res.status(r.status || 502).json({ error: r.error });
  const { ok, ...data } = r;
  geocodeCache.set(lat, lng, lang, data);
  res.json({ ok: true, ...data });
});

app.get("/api/customer/addresses", requireCustomer, (req, res) => {
  const data = loadCustomers();
  const c = data.customers.find((x) => String(x.id) === String(req.customerId));
  if (!c) return res.status(404).json({ error: "Not found" });
  res.json({ ok: true, addresses: addressesLib.sanitizeList(c.addresses) });
});

// Replace the customer's saved list (max 10). Only the owner can write it.
app.put("/api/customer/addresses", requireCustomer, (req, res) => {
  if (!Array.isArray(req.body?.addresses) || req.body.addresses.length > 50)
    return res.status(400).json({ error: "Invalid addresses" });
  const data = loadCustomers();
  const c = data.customers.find((x) => String(x.id) === String(req.customerId));
  if (!c) return res.status(404).json({ error: "Not found" });
  c.addresses = addressesLib.sanitizeList(req.body.addresses);
  c.updatedAt = new Date().toISOString();
  saveCustomers(data);
  res.json({ ok: true, addresses: c.addresses });
});

// Profile edit (whitelisted fields only: name, email, phone). Never wallet/password/id.
app.patch("/api/customer/me", requireCustomer, (req, res) => {
  const data = loadCustomers();
  const c = customerById(data, req.customerId);
  if (!c) return res.status(404).json({ error: "Not found" });
  const r = customerAccount.sanitizeProfile(req.body, c);
  if (!r.ok) return res.status(400).json({ error: r.error, code: r.code });
  const clash = customerAccount.findConflict(data.customers, c.id, r.patch);
  if (clash) return res.status(409).json({ error: `${clash} already in use`, code: "DUPLICATE_" + clash.toUpperCase() });
  const before = { email: c.email || null, phone: c.phone || null };
  Object.assign(c, r.patch);
  c.updatedAt = new Date().toISOString();
  saveCustomers(data);
  if (r.phoneChanged || r.emailChanged) {
    appendAuditLog({ actorType: "customer", actorId: String(c.id), action: "customer.profile.contact_change", targetId: String(c.id), previous: { emailChanged: r.emailChanged, phoneChanged: r.phoneChanged, hadEmail: !!before.email, hadPhone: !!before.phone } });
  }
  res.json({ ok: true, customer: safeCustomer(c) });
});

// Favorites (stores + items). The list is private to the account.
app.get("/api/customer/favorites", requireCustomer, (req, res) => {
  const c = customerById(loadCustomers(), req.customerId);
  if (!c) return res.status(404).json({ error: "Not found" });
  res.json({ ok: true, favorites: customerAccount.sanitizeFavorites(c.favorites) });
});
app.put("/api/customer/favorites", requireCustomer, (req, res) => {
  if (!Array.isArray(req.body?.favorites) || req.body.favorites.length > 500)
    return res.status(400).json({ error: "Invalid favorites" });
  const data = loadCustomers();
  const c = customerById(data, req.customerId);
  if (!c) return res.status(404).json({ error: "Not found" });
  c.favorites = customerAccount.sanitizeFavorites(req.body.favorites);
  c.updatedAt = new Date().toISOString();
  saveCustomers(data);
  res.json({ ok: true, favorites: c.favorites });
});

function customerOwnedOrder(req, res) {
  const me = customerById(loadCustomers(), req.customerId);
  if (!me) { res.status(401).json({ error: "Unauthorized" }); return null; }
  const order = (loadOrders().orders || []).find((o) => String(o.id) === String(req.params.id));
  // 404 (not 403) so order ids cannot be probed.
  if (!order || !customerAccount.ownsOrder(order, me)) { res.status(404).json({ error: "Not found" }); return null; }
  return { me, order };
}

// Reorder: rebuilds a cart from a past order against the CURRENT catalogue.
// It only returns a proposal; the real price/stock/hours checks run again at POST /api/orders.
app.post("/api/customer/orders/:id/reorder", requireCustomer, (req, res) => {
  const got = customerOwnedOrder(req, res);
  if (!got) return;
  const { order } = got;
  const store = order.restaurantId ? getRestaurantById(order.restaurantId) : null;
  if (!store) return res.status(409).json({ error: "Store no longer available", code: "STORE_UNAVAILABLE" });
  const chk = enforceRestaurantCanReceiveOrders(String(order.restaurantId));
  if (!chk.ok) return res.status(409).json({ error: chk.error || "Store not accepting orders", code: "STORE_UNAVAILABLE" });
  const lang = ["ar", "fr", "en"].includes(String(req.body?.lang)) ? String(req.body.lang) : String(order.lang || "ar");
  const menu = loadMenu();
  const byId = new Map((menu.items || []).filter((it) => String(it.restaurantId || "") === String(order.restaurantId)).map((it) => [String(it.id), it]));
  const nameOf = (it) => {
    const n = it && it.name;
    if (!n) return "";
    if (typeof n === "string") return n;
    return String((lang === "fr" ? n.fr || n.en || n.ar : lang === "en" ? n.en || n.fr || n.ar : n.ar || n.en || n.fr) || "");
  };
  const r = customerAccount.buildReorder({
    order, byId, nameOf,
    itemOrderable: (it) => catalogLib.itemOrderable(it) && !storesLib.blockedForSale(it),
    unitPrice: catalogLib.unitPrice,
  });
  if (!r.ok) return res.status(409).json({ error: "No items from this order can be reordered", code: "NOTHING_AVAILABLE", unavailable: r.unavailable });
  res.json({ ok: true, restaurantId: r.storeId, items: r.lines, unavailable: r.unavailable, subtotal: r.subtotal });
});

// Receipt / invoice for a delivered order (owner only, whitelisted fields).
app.get("/api/customer/orders/:id/receipt", requireCustomer, (req, res) => {
  const got = customerOwnedOrder(req, res);
  if (!got) return;
  const store = got.order.restaurantId ? getRestaurantById(got.order.restaurantId) : null;
  const rc = customerAccount.receiptOf(got.order, { storeName: store ? String(store.nameAr || store.nameEn || store.name || "") : "", currency: loadConfig().currency || "MAD" });
  if (!rc) return res.status(409).json({ error: "Receipt available after delivery", code: "NOT_DELIVERED" });
  res.json({ ok: true, receipt: rc });
});

// Guest tracking: needs the private token handed out when the order was placed.
// The order id alone (or a phone number) reveals nothing.
const trackLimiter = rateLimit({ windowMs: 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false, message: { error: "Too many requests" } });
app.get("/api/track/:id", trackLimiter, (req, res) => {
  const token = String(req.header("X-Track-Token") || "");
  const order = (loadOrders().orders || []).find((o) => String(o.id) === String(req.params.id));
  if (!order || !customerAccount.checkTrackingToken(order, token)) return res.status(404).json({ error: "Not found" });
  const store = order.restaurantId ? getRestaurantById(order.restaurantId) : null;
  res.json({ ok: true, order: customerAccount.trackingView(order, { storeName: store ? String(store.nameAr || store.nameEn || store.name || "") : "" }) });
});

// Account deletion = privacy-aware erasure. The account is removed (it can no
// longer log in), personal data is scrubbed, but financial records are kept:
// closed orders keep items/amounts/dates with name, phone and address hidden.
app.delete("/api/customer/me", requireCustomer, (req, res) => {
  const data = loadCustomers();
  const idx = data.customers.findIndex((c) => String(c.id) === String(req.customerId));
  if (idx < 0) return res.status(404).json({ error: "Not found" });
  const c = data.customers[idx];

  // Re-authentication: password accounts must confirm it; Google-only accounts type DELETE.
  const hasPassword = !!c.password && !c.googleSub;
  if (hasPassword) {
    if (!verifyPassword(String(req.body?.password || ""), c.password))
      return res.status(403).json({ error: "Password required to delete the account", code: "REAUTH_REQUIRED" });
  } else if (String(req.body?.confirm || "") !== "DELETE") {
    return res.status(403).json({ error: 'Type "DELETE" to confirm', code: "REAUTH_REQUIRED" });
  }

  const ordersData = loadOrders();
  if (customerAccount.activeOrders(ordersData.orders, c).length)
    return res.status(409).json({ error: "You have orders in progress", code: "ACTIVE_ORDERS" });
  if (Number(c.walletBalance || 0) > 0)
    return res.status(409).json({ error: "Wallet balance must be settled with support first", code: "WALLET_BALANCE" });

  const nowIso = new Date().toISOString();
  const mine = customerAccount.ordersOf(ordersData.orders, c);
  mine.forEach((o) => customerAccount.anonymizeOrderPII(o));
  if (mine.length) saveOrders(ordersData);

  // Tombstone (id only + wallet ledger) kept separately; the live list no longer contains the person.
  data.deletedCustomers = Array.isArray(data.deletedCustomers) ? data.deletedCustomers : [];
  data.deletedCustomers.push(customerAccount.anonymizeCustomer(c, nowIso));
  data.customers.splice(idx, 1);
  saveCustomers(data);

  const rtData = loadRefreshTokens();
  rtData.tokens = (rtData.tokens || []).filter((t) => !(t.userType === "customer" && String(t.userId) === String(req.customerId)));
  saveRefreshTokens(rtData);
  const pushData = loadPushSubscriptions();
  pushData.subscriptions = (pushData.subscriptions || []).filter((s) => String(s.customerId) !== String(req.customerId));
  savePushSubscriptions(pushData);

  appendAuditLog({ actorType: "customer", actorId: String(req.customerId), action: "customer.account.delete", targetId: String(req.customerId), ordersAnonymized: mine.length });
  res.json({ ok: true, deleted: true, ordersRetained: mine.length });
});

app.get("/api/customer/me", requireCustomer, (req, res) => {
  const data = loadCustomers();
  const found = data.customers.find(
    (c) => String(c.id) === String(req.customerId),
  );
  if (!found) return res.status(404).json({ error: "Not found" });
  res.json({ ok: true, customer: safeCustomer(found) });
});

app.get("/api/customer/orders", requireCustomer, (req, res) => {
  const customers = loadCustomers();
  const me = customers.customers.find(
    (c) => String(c.id) === String(req.customerId),
  );
  if (!me) return res.status(401).json({ error: "Unauthorized" });

  // Ownership: customerId, or a VERIFIED phone for legacy guest orders only.
  // A phone number alone never exposes someone's orders (spec 15).

  // Build driver info map to allow "Contact about order" on customer side
  const driversData = loadDrivers();
  const driverInfoById = new Map(
    (driversData.drivers || []).map((d) => [
      String(d.id),
      { phone: String(d.phone || ""), name: String(d.name || "") },
    ]),
  );

  const data = loadOrders();
  const mine = customerAccount.ordersOf(data.orders, me);

  const chatByOrder = new Map(
    (loadOrderChats().chats || []).map((c) => [String(c.orderId), c]),
  );
  const storeChatByOrder = new Map(
    (readJson(STORE_CHATS_FILE, { conversations: [] }).conversations || []).map((c) => [String(c.orderId), c]),
  );
  const nowMs = Date.now();
  const driverAvgById = ratingsLib.driverAverages(data.orders);
  const enhanced = mine.map((o) => {
    const { verify: _v, trackHash: _th, ...out } = o;
    out.storeChatUnread = storesLib.unreadForCustomer(storeChatByOrder.get(String(o.id)));
    out.storeChatAvailable = !!o.restaurantId;
    const dc = verifyCodes.deliveryCodeForCustomer(VERIFY_SECRET, o);
    if (dc) out.deliveryCode = dc; // shown to the customer only; give it to the driver on arrival
    out.chatUnread = driverFeedback.unreadFor(
      chatByOrder.get(String(o.id)),
      "customer",
    );
    out.chatOpen = driverFeedback.isChatOpen(o);
    const cr = driverFeedback.canRateDriver(o, nowMs);
    out.canRateDriver = cr.ok;
    out.rateDriverUntil = cr.ok ? cr.expiresAt : null;
    out.ratingPrompted = !!o.ratingPromptedAt;
    Object.assign(out, ratingsLib.customerFlags(o, nowMs)); // canRateStore / rateStoreUntil / storeRating{stars,comment,commentStatus}
    const did = String(o.driverId || "");
    if (did) {
      const info = driverInfoById.get(did) || null;
      if (info?.phone) out.driverPhone = info.phone;
      if (info?.name) out.driverName = info.name;
      const da = driverAvgById.get(did);
      if (da) out.driverAvg = { avg: da.avg, count: da.count }; // public average only
    }
    return out;
  });

  res.json({ ok: true, orders: enhanced });
});

app.post("/api/customer/orders/:id/cancel", requireCustomer, (req, res) => {
  const id = String(req.params.id);

  const customers = loadCustomers();
  const me = customers.customers.find(
    (c) => String(c.id) === String(req.customerId),
  );
  if (!me) return res.status(401).json({ error: "Unauthorized" });

  const data = loadOrders();
  const idx = data.orders.findIndex((o) => String(o.id) === id);
  if (idx < 0) return res.status(404).json({ error: "Not found" });

  const order = data.orders[idx];

  const belongs = customerAccount.ownsOrder(order, me);

  if (!belongs) return res.status(403).json({ error: "Not your order" });

  const cc = orderState.canCustomerCancel(order);
  if (!cc.ok) {
    return res.status(409).json({ error: cc.error, code: cc.code });
  }

  orderState.recordEvent(order, {
    from: order.status,
    to: "canceled",
    actorType: "customer",
    actorId: req.customerId,
  });
  order.status = "canceled";
  order.canceledAt = order.canceledAt || new Date().toISOString();
  order.canceledBy = "customer";
  financeLib.finalize(order);
  refundOrderWallet(order);
  order.updatedAt = new Date().toISOString();

  saveOrders(data);
  try {
    // give the reserved stock back (same as a store rejection)
    const menu = loadMenu();
    if (catalogLib.restoreStock(menu, order.items)) saveMenu(menu);
  } catch (_e) {}
  res.json({ ok: true, order });
});

// Rating the store (POST /api/customer/orders/:id/rate) lives in lib/feedback-routes.js: one rating per order, stars count at
// once, the written comment is only public after a supervisor publishes it (spec 16).

// Public: latest customer ratings (testimonials)
// Only non-sensitive fields are returned.
app.get("/api/ratings", (req, res) => {
  try {
    ensureSeedData();
  } catch (_e) {}

  const limitRaw = Number(req.query.limit || 12);
  const limit = Math.max(
    1,
    Math.min(50, Number.isFinite(limitRaw) ? Math.floor(limitRaw) : 12),
  );

  const orders = loadOrders();
  const rs = loadRestaurants();
  const byId = new Map((rs.restaurants || []).map((r) => [String(r.id), r]));

  const pickRestName = (r) => {
    if (!r) return "";
    const n = r.name;
    if (typeof n === "string") return String(n);
    if (n && typeof n === "object") return String(n.ar || n.en || n.fr || "");
    return String(r.id || "");
  };

  const maskName = (name) => {
    const clean = String(stripDangerous(name || "")).trim();
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "Customer";
    if (parts.length === 1) return parts[0];
    return `${parts[0]} ${String(parts[1] || "").slice(0, 1)}.`;
  };

  const list = (orders.orders || [])
    .filter(
      (o) => o && o.customerRating && Number(o.customerRating.stars || 0) >= 1,
    )
    .map((o) => {
      const rating = o.customerRating || {};
      const stars = Number(rating.stars || 0);
      // stars are public; the written comment only once a supervisor published it
      const comment = ratingsLib.isPublished(rating)
        ? String(stripDangerous(String(rating.comment || ""))).trim().slice(0, 500)
        : "";
      const sortKey = String(
        rating.updatedAt ||
          rating.createdAt ||
          o.updatedAt ||
          o.createdAt ||
          "",
      );
      const rest = byId.get(String(o.restaurantId || "")) || null;
      return {
        stars,
        comment,
        createdAt: rating.createdAt || o.updatedAt || o.createdAt || null,
        updatedAt: rating.updatedAt || null,
        customerName: maskName(o.customer?.name || ""),
        restaurantId: String(o.restaurantId || ""),
        restaurantName: pickRestName(rest),
        _sort: sortKey,
      };
    })
    .sort((a, b) => String(b._sort).localeCompare(String(a._sort)))
    .slice(0, limit)
    .map(({ _sort, ...x }) => x);

  res.json({ ok: true, ratings: list });
});

/***********************
 * Order ↔ Driver chat (Customer ↔ Driver) — Admin can view
 ***********************/

// Customer reads chat
app.get("/api/customer/orders/:id/chat", requireCustomer, (req, res) => {
  const id = String(req.params.id);
  const orders = loadOrders();
  const order = (orders.orders || []).find((o) => String(o.id) === String(id));
  if (!order) return res.status(404).json({ error: "Not found" });
  if (String(order.customerId || "") !== String(req.customerId || ""))
    return res.status(403).json({ error: "Forbidden" });

  // If no driver yet, return empty chat
  const did = String(order.driverId || "");
  if (!did)
    return res.json({ ok: true, orderId: id, driverId: null, messages: [] });

  const data = loadOrderChats();
  let chat = data.chats.find((c) => String(c.orderId) === String(id));
  if (!chat) {
    chat = {
      orderId: String(id),
      customerId: String(order.customerId || ""),
      driverId: did,
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    data.chats.push(chat);
    saveOrderChats(data);
  } else {
    // keep participants in sync
    chat.customerId = String(order.customerId || chat.customerId || "");
    chat.driverId = did;
  }

  chat.messages = Array.isArray(chat.messages) ? chat.messages : [];
  if (driverFeedback.markRead(chat, "customer", new Date().toISOString()))
    saveOrderChats(data);
  res.json({
    ok: true,
    orderId: id,
    driverId: did,
    closed: !driverFeedback.isChatOpen(order),
    messages: chat.messages.slice(-300),
  });
});

// Customer sends message
app.post("/api/customer/orders/:id/chat", requireCustomer, (req, res) => {
  const id = String(req.params.id);
  const text = String(req.body?.text || "").trim();
  if (!text) return res.status(400).json({ error: "Missing text" });
  if (text.length > 1200)
    return res.status(400).json({ error: "Message too long" });

  const orders = loadOrders();
  const order = (orders.orders || []).find((o) => String(o.id) === String(id));
  if (!order) return res.status(404).json({ error: "Not found" });
  if (String(order.customerId || "") !== String(req.customerId || ""))
    return res.status(403).json({ error: "Forbidden" });
    if (!driverFeedback.isChatOpen(order))
      return res.status(409).json({ error: "chat_closed" });

  const did = String(order.driverId || "");
  if (!did) return res.status(409).json({ error: "No driver assigned" });

  const data = loadOrderChats();
  let chat = data.chats.find((c) => String(c.orderId) === String(id));
  if (!chat) {
    chat = {
      orderId: String(id),
      customerId: String(order.customerId || ""),
      driverId: did,
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    data.chats.push(chat);
  }
  chat.messages = Array.isArray(chat.messages) ? chat.messages : [];
  const msg = {
    id: genId(),
    from: "customer",
    text,
    createdAt: new Date().toISOString(),
  };
  chat.messages.push(msg);
  chat.updatedAt = msg.createdAt;
  // keep participants in sync
  chat.customerId = String(order.customerId || chat.customerId || "");
  chat.driverId = did;

  saveOrderChats(data);
  res.json({ ok: true, message: msg });
});

// Customer sends an image
app.post("/api/customer/orders/:id/chat/image", requireCustomer, (req, res) => {
  const id = String(req.params.id);
  const dataUrl = String(req.body?.image || req.body?.dataUrl || "");
  if (!dataUrl) return res.status(400).json({ error: "Missing image" });

  const orders = loadOrders();
  const order = (orders.orders || []).find((o) => String(o.id) === id);
  if (!order) return res.status(404).json({ error: "Not found" });
  if (String(order.customerId || "") !== String(req.customerId || ""))
    return res.status(403).json({ error: "Forbidden" });
    if (!driverFeedback.isChatOpen(order))
      return res.status(409).json({ error: "chat_closed" });

  const did = String(order.driverId || "");
  if (!did) return res.status(409).json({ error: "No driver assigned" });

  const msgId = genId();
  const url = saveDataUrlImage(dataUrl, CHAT_UPLOAD_DIR, `chat_${id}_${msgId}`, {
    maxBytes: MAX_CHAT_IMAGE_BYTES,
  });
  if (!url) return res.status(400).json({ error: "Invalid image" });

  const data = loadOrderChats();
  let chat = data.chats.find((c) => String(c.orderId) === String(id));
  if (!chat) {
    chat = {
      orderId: String(id),
      customerId: String(order.customerId || ""),
      driverId: did,
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    data.chats.push(chat);
  }
  chat.messages = Array.isArray(chat.messages) ? chat.messages : [];
  const msg = {
    id: msgId,
    from: "customer",
    type: "image",
    text: "",
    url,
    createdAt: new Date().toISOString(),
  };
  chat.messages.push(msg);
  chat.updatedAt = msg.createdAt;
  chat.customerId = String(order.customerId || chat.customerId || "");
  chat.driverId = did;

  saveOrderChats(data);
  res.json({ ok: true, message: msg });
});

// Customer sends a voice note
app.post("/api/customer/orders/:id/chat/audio", requireCustomer, (req, res) => {
  const id = String(req.params.id);
  const dataUrl = String(req.body?.audio || req.body?.dataUrl || "");
  const duration = Number(req.body?.duration || 0);
  if (!dataUrl) return res.status(400).json({ error: "Missing audio" });

  const orders = loadOrders();
  const order = (orders.orders || []).find((o) => String(o.id) === id);
  if (!order) return res.status(404).json({ error: "Not found" });
  if (String(order.customerId || "") !== String(req.customerId || ""))
    return res.status(403).json({ error: "Forbidden" });
    if (!driverFeedback.isChatOpen(order))
      return res.status(409).json({ error: "chat_closed" });

  const did = String(order.driverId || "");
  if (!did) return res.status(409).json({ error: "No driver assigned" });

  const msgId = genId();
  const url = saveDataUrlAudio(dataUrl, CHAT_UPLOAD_DIR, `chat_${id}_${msgId}`, {
    maxBytes: MAX_CHAT_AUDIO_BYTES,
  });
  if (!url) return res.status(400).json({ error: "Invalid audio" });

  const data = loadOrderChats();
  let chat = data.chats.find((c) => String(c.orderId) === String(id));
  if (!chat) {
    chat = {
      orderId: String(id),
      customerId: String(order.customerId || ""),
      driverId: did,
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    data.chats.push(chat);
  }
  chat.messages = Array.isArray(chat.messages) ? chat.messages : [];
  const msg = {
    id: msgId,
    from: "customer",
    type: "audio",
    text: "",
    url,
    duration: Number.isFinite(duration) && duration > 0 ? Math.round(duration) : null,
    createdAt: new Date().toISOString(),
  };
  chat.messages.push(msg);
  chat.updatedAt = msg.createdAt;
  chat.customerId = String(order.customerId || chat.customerId || "");
  chat.driverId = did;

  saveOrderChats(data);
  res.json({ ok: true, message: msg });
});

// Driver reads chat
app.get(
  "/api/driver/orders/:id/chat",
  requireDriver,
  requireApprovedDriver,
  (req, res) => {
    const id = String(req.params.id);
    const orders = loadOrders();
    const order = (orders.orders || []).find(
      (o) => String(o.id) === String(id),
    );
    if (!order) return res.status(404).json({ error: "Not found" });
    if (String(order.driverId || "") !== String(req.driverId || ""))
      return res.status(403).json({ error: "Forbidden" });

    const data = loadOrderChats();
    let chat = data.chats.find((c) => String(c.orderId) === String(id));
    if (!chat) {
      chat = {
        orderId: String(id),
        customerId: String(order.customerId || ""),
        driverId: String(req.driverId || ""),
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      data.chats.push(chat);
      saveOrderChats(data);
    } else {
      chat.customerId = String(order.customerId || chat.customerId || "");
      chat.driverId = String(req.driverId || "");
    }

    chat.messages = Array.isArray(chat.messages) ? chat.messages : [];
    if (driverFeedback.markRead(chat, "driver", new Date().toISOString()))
      saveOrderChats(data);
    res.json({
      ok: true,
      orderId: id,
      customerId: String(order.customerId || ""),
      closed: !driverFeedback.isChatOpen(order),
      messages: chat.messages.slice(-300),
    });
  },
);

// Driver sends message
app.post(
  "/api/driver/orders/:id/chat",
  requireDriver,
  requireApprovedDriver,
  (req, res) => {
    const id = String(req.params.id);
    const text = String(req.body?.text || "").trim();
    if (!text) return res.status(400).json({ error: "Missing text" });
    if (text.length > 1200)
      return res.status(400).json({ error: "Message too long" });

    const orders = loadOrders();
    const order = (orders.orders || []).find(
      (o) => String(o.id) === String(id),
    );
    if (!order) return res.status(404).json({ error: "Not found" });
    if (String(order.driverId || "") !== String(req.driverId || ""))
      return res.status(403).json({ error: "Forbidden" });
    if (!driverFeedback.isChatOpen(order))
      return res.status(409).json({ error: "chat_closed" });

    const data = loadOrderChats();
    let chat = data.chats.find((c) => String(c.orderId) === String(id));
    if (!chat) {
      chat = {
        orderId: String(id),
        customerId: String(order.customerId || ""),
        driverId: String(req.driverId || ""),
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      data.chats.push(chat);
    }
    chat.messages = Array.isArray(chat.messages) ? chat.messages : [];
    // Idempotency (section 20): a retry/replay of the same message returns the stored one, never a second copy.
    const clientId = offlineSync.cleanKey(req.body?.clientId);
    const dup = offlineSync.findDuplicateMessage(chat.messages, clientId);
    if (dup) return res.json({ ok: true, message: dup, duplicate: true });
    const msg = {
      id: genId(),
      from: "driver",
      text,
      createdAt: new Date().toISOString(),
      ...(clientId ? { clientId } : {}),
    };
    chat.messages.push(msg);
    chat.updatedAt = msg.createdAt;
    chat.customerId = String(order.customerId || chat.customerId || "");
    chat.driverId = String(req.driverId || "");

    saveOrderChats(data);
    res.json({ ok: true, message: msg });
  },
);

// Driver sends an image
app.post(
  "/api/driver/orders/:id/chat/image",
  requireDriver,
  requireApprovedDriver,
  (req, res) => {
    const id = String(req.params.id);
    const dataUrl = String(req.body?.image || req.body?.dataUrl || "");
    if (!dataUrl) return res.status(400).json({ error: "Missing image" });

    const orders = loadOrders();
    const order = (orders.orders || []).find((o) => String(o.id) === id);
    if (!order) return res.status(404).json({ error: "Not found" });
    if (String(order.driverId || "") !== String(req.driverId))
      return res.status(403).json({ error: "Not your order" });
    if (!driverFeedback.isChatOpen(order))
      return res.status(409).json({ error: "chat_closed" });

    const msgId = genId();
    const url = saveDataUrlImage(dataUrl, CHAT_UPLOAD_DIR, `chat_${id}_${msgId}`, {
      maxBytes: MAX_CHAT_IMAGE_BYTES,
    });
    if (!url) return res.status(400).json({ error: "Invalid image" });

    const data = loadOrderChats();
    let chat = data.chats.find((c) => String(c.orderId) === String(id));
    if (!chat) {
      chat = {
        orderId: String(id),
        customerId: String(order.customerId || ""),
        driverId: String(req.driverId),
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      data.chats.push(chat);
    }
    chat.messages = Array.isArray(chat.messages) ? chat.messages : [];
    const msg = {
      id: msgId,
      from: "driver",
      type: "image",
      text: "",
      url,
      createdAt: new Date().toISOString(),
    };
    chat.messages.push(msg);
    chat.updatedAt = msg.createdAt;
    chat.customerId = String(order.customerId || chat.customerId || "");
    chat.driverId = String(req.driverId);

    saveOrderChats(data);
    res.json({ ok: true, message: msg });
  },
);

// Driver sends a voice note
app.post(
  "/api/driver/orders/:id/chat/audio",
  requireDriver,
  requireApprovedDriver,
  (req, res) => {
    const id = String(req.params.id);
    const dataUrl = String(req.body?.audio || req.body?.dataUrl || "");
    const duration = Number(req.body?.duration || 0);
    if (!dataUrl) return res.status(400).json({ error: "Missing audio" });

    const orders = loadOrders();
    const order = (orders.orders || []).find((o) => String(o.id) === id);
    if (!order) return res.status(404).json({ error: "Not found" });
    if (String(order.driverId || "") !== String(req.driverId))
      return res.status(403).json({ error: "Not your order" });
    if (!driverFeedback.isChatOpen(order))
      return res.status(409).json({ error: "chat_closed" });

    const msgId = genId();
    const url = saveDataUrlAudio(dataUrl, CHAT_UPLOAD_DIR, `chat_${id}_${msgId}`, {
      maxBytes: MAX_CHAT_AUDIO_BYTES,
    });
    if (!url) return res.status(400).json({ error: "Invalid audio" });

    const data = loadOrderChats();
    let chat = data.chats.find((c) => String(c.orderId) === String(id));
    if (!chat) {
      chat = {
        orderId: String(id),
        customerId: String(order.customerId || ""),
        driverId: String(req.driverId),
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      data.chats.push(chat);
    }
    chat.messages = Array.isArray(chat.messages) ? chat.messages : [];
    const msg = {
      id: msgId,
      from: "driver",
      type: "audio",
      text: "",
      url,
      duration: Number.isFinite(duration) && duration > 0 ? Math.round(duration) : null,
      createdAt: new Date().toISOString(),
    };
    chat.messages.push(msg);
    chat.updatedAt = msg.createdAt;
    chat.customerId = String(order.customerId || chat.customerId || "");
    chat.driverId = String(req.driverId);

    saveOrderChats(data);
    res.json({ ok: true, message: msg });
  },
);

// Admin reads order chat (driver ↔ customer)
app.get("/api/admin/orders/:id/chat", requireAdmin, (req, res) => {
  const id = String(req.params.id);
  const orders = loadOrders();
  const order = (orders.orders || []).find((o) => String(o.id) === String(id));
  if (!order) return res.status(404).json({ error: "Not found" });

  const did = String(order.driverId || "");
  const data = loadOrderChats();
  const chat = data.chats.find((c) => String(c.orderId) === String(id)) || {
    orderId: String(id),
    messages: [],
  };

  const driversData = loadDrivers();
  const driver = did
    ? (driversData.drivers || []).find((d) => String(d.id) === did)
    : null;

  res.json({
    ok: true,
    orderId: id,
    customer: {
      name: String(order.customer?.name || ""),
      phone: String(order.customer?.phone || ""),
    },
    driver: driver
      ? {
          id: String(driver.id),
          name: String(driver.name || driver.email || ""),
          phone: String(driver.phone || ""),
        }
      : null,
    messages: (Array.isArray(chat.messages) ? chat.messages : []).slice(-300),
  });
});

/***********************
 * Customer ↔ Admin support chat
 ***********************/
app.get("/api/customer/support", requireCustomer, (req, res) => {
  const customers = loadCustomers();
  const me = customers.customers.find(
    (c) => String(c.id) === String(req.customerId),
  );
  if (!me) return res.status(401).json({ error: "Unauthorized" });

  const data = loadSupportChats();
  const cid = String(req.customerId);
  let conv = data.conversations.find((c) => String(c.customerId) === cid);
  if (!conv) {
    conv = {
      customerId: cid,
      createdAt: new Date().toISOString(),
      lastAt: null,
      unreadForAdmin: 0,
      unreadForCustomer: 0,
      messages: [],
    };
    data.conversations.unshift(conv);
  }
  conv.unreadForCustomer = 0;
  saveSupportChats(data);

  res.json({
    ok: true,
    customerId: cid,
    messages: conv.messages || [],
    unreadForCustomer: 0,
  });
});

app.post("/api/customer/support", requireCustomer, (req, res) => {
  const text = String(req.body?.text || "").trim();
  if (!text) return res.status(400).json({ error: "Missing text" });

  const data = loadSupportChats();
  const cid = String(req.customerId);
  let conv = data.conversations.find((c) => String(c.customerId) === cid);
  if (!conv) {
    conv = {
      customerId: cid,
      createdAt: new Date().toISOString(),
      lastAt: null,
      unreadForAdmin: 0,
      unreadForCustomer: 0,
      messages: [],
    };
    data.conversations.unshift(conv);
  }

  const msg = {
    id: genId(),
    from: "customer",
    text,
    createdAt: new Date().toISOString(),
  };
  conv.messages = Array.isArray(conv.messages) ? conv.messages : [];
  conv.messages.push(msg);
  conv.lastAt = msg.createdAt;
  conv.unreadForAdmin = Number(conv.unreadForAdmin || 0) + 1;
  saveSupportChats(data);

  res.json({ ok: true, message: msg });
});

app.get("/api/admin/support/conversations", requireAdmin, (req, res) => {
  const data = loadSupportChats();
  const customers = loadCustomers();
  const byId = new Map(
    (customers.customers || []).map((c) => [String(c.id), c]),
  );
  const list = (data.conversations || [])
    .map((c) => {
      const cid = String(c.customerId);
      const cust = byId.get(cid) || {};
      const lastMsg =
        Array.isArray(c.messages) && c.messages.length
          ? c.messages[c.messages.length - 1]
          : null;
      return {
        customerId: cid,
        customerName:
          cust.fullName ||
          [cust.firstName, cust.lastName].filter(Boolean).join(" ").trim(),
        customerPhone: cust.phone || "",
        customerEmail: cust.email || "",
        customerPicture: cust.googlePicture || "",
        lastAt: c.lastAt || lastMsg?.createdAt || null,
        lastText: lastMsg?.text || "",
        unreadForAdmin: Number(c.unreadForAdmin || 0),
        unreadForCustomer: Number(c.unreadForCustomer || 0),
      };
    })
    .sort((a, b) =>
      String(b.lastAt || "").localeCompare(String(a.lastAt || "")),
    );

  res.json({ ok: true, conversations: list });
});

app.get("/api/admin/support/:customerId", requireAdmin, (req, res) => {
  const cid = String(req.params.customerId || "");
  const data = loadSupportChats();
  let conv = data.conversations.find((c) => String(c.customerId) === cid);
  if (!conv) {
    conv = {
      customerId: cid,
      createdAt: new Date().toISOString(),
      lastAt: null,
      unreadForAdmin: 0,
      unreadForCustomer: 0,
      messages: [],
    };
    data.conversations.unshift(conv);
  }
  conv.unreadForAdmin = 0;
  saveSupportChats(data);

  res.json({ ok: true, customerId: cid, messages: conv.messages || [] });
});

app.post("/api/admin/support/:customerId", requireAdmin, (req, res) => {
  const cid = String(req.params.customerId || "");
  const text = String(req.body?.text || "").trim();
  if (!text) return res.status(400).json({ error: "Missing text" });

  const data = loadSupportChats();
  let conv = data.conversations.find((c) => String(c.customerId) === cid);
  if (!conv) {
    conv = {
      customerId: cid,
      createdAt: new Date().toISOString(),
      lastAt: null,
      unreadForAdmin: 0,
      unreadForCustomer: 0,
      messages: [],
    };
    data.conversations.unshift(conv);
  }

  const msg = {
    id: genId(),
    from: "admin",
    text,
    createdAt: new Date().toISOString(),
  };
  conv.messages = Array.isArray(conv.messages) ? conv.messages : [];
  conv.messages.push(msg);
  conv.lastAt = msg.createdAt;
  conv.unreadForCustomer = Number(conv.unreadForCustomer || 0) + 1;
  saveSupportChats(data);

  res.json({ ok: true, message: msg });
});

/***********************
 * Admin: customers list
 ***********************/
// Current admin identity for the sidebar (never returns password/hash)
app.get("/api/admin/me", requireAdmin, (req, res) => {
  const id = String(req.adminId || "");
  const admin = (loadAdmins().admins || []).find((a) => String(a.id) === id);
  if (!admin)
    return res.json({ id, email: "", phone: "", name: "", role: req.adminRole, permissions: adminRoles.permissionsOf(req.adminRole) });
  return res.json({
    role: req.adminRole,
    permissions: adminRoles.permissionsOf(req.adminRole),
    id,
    email: String(admin.email || ""),
    phone: String(admin.phone || ""),
    name: String(admin.name || ""),
  });
});

app.get("/api/admin/customers", requireAdmin, (req, res) => {
  const c = loadCustomers();
  res.json({ ok: true, customers: (c.customers || []).map(safeCustomer) });
});

/***********************
 * Admin: notifications (broadcast to customers)
 ***********************/
app.get("/api/admin/notifications", requireAdmin, (req, res) => {
  const data = loadNotifications();
  const list = (data.notifications || [])
    .slice()
    .sort((a, b) =>
      String(b.createdAt || "").localeCompare(String(a.createdAt || "")),
    );
  res.json({
    ok: true,
    notifications: list.map(notifPublic),
    pushEnabled: WEBPUSH_ENABLED,
    limits: notifCore.LIMITS,
    maxImageBytes: MAX_NOTIFICATION_IMAGE_BYTES,
  });
});

/* ---- Admin notification editor helpers ---- */
const notifSending = new Set(); // ids currently being dispatched (in-memory lock)

function notifFail(res, status, code, message, extra) {
  return res.status(status).json({ error: message, code, ...(extra || {}) });
}

// Keep line breaks (unlike stripDangerous) but still drop markup/control chars.
function notifCleanText(v) {
  if (v === undefined || v === null) return "";
  return String(v)
    .replace(/\r\n?/g, "\n")
    .replace(/[<>]/g, "")
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, "")
    .trim();
}

function notifPublic(n) {
  if (!n) return n;
  const { recipientIds, ...rest } = n;
  if (Array.isArray(recipientIds)) rest.recipientCount = recipientIds.length;
  return rest;
}

function notifAudienceSnapshot(audienceKey) {
  return notifCore.computeAudience({
    customers: loadCustomers().customers,
    orders: loadOrders().orders,
    subscriptions: loadPushSubscriptions().subscriptions,
    audience: audienceKey,
  });
}

function notifSaveImage(dataUrl, baseName) {
  try {
    const d = decodeDataUrlImage(dataUrl, { maxBytes: MAX_NOTIFICATION_IMAGE_BYTES });
    if (!d) return { error: "image_invalid" };
  } catch (e) {
    const m = String(e && e.message ? e.message : e);
    return { error: /too large/i.test(m) ? "image_too_large" : "image_type" };
  }
  const url = saveDataUrlImage(dataUrl, NOTIFICATIONS_UPLOAD_DIR, baseName, {
    maxBytes: MAX_NOTIFICATION_IMAGE_BYTES,
  });
  return url ? { url } : { error: "image_invalid" };
}

const NOTIF_ERR_MSG = {
  missing_title: "Missing title",
  missing_message: "Missing message",
  title_too_long: "Title too long",
  message_too_long: "Message too long",
  url_invalid: "Invalid link (use a /path or an https:// URL)",
  url_too_long: "Link too long",
  invalid_audience: "Invalid audience",
  image_invalid: "Invalid image",
  image_too_large: "Image too large",
  image_type: "Unsupported image type. Allowed: JPG/PNG/WebP",
};

function saveNotificationsBounded(data) {
  const max = Math.max(50, Number(process.env.NOTIFICATIONS_MAX || 500));
  if (data.notifications.length > max) {
    // never evict drafts to make room
    const keep = [];
    let kept = 0;
    for (const n of data.notifications) {
      if (n.status === "draft" || kept < max) keep.push(n);
      if (n.status !== "draft") kept += 1;
    }
    data.notifications = keep;
  }
  saveNotifications(data);
}

/**
 * Re-checks audience on the server, applies safety checks and flips the record
 * to "sending". Returns { error } (nothing changed) or { rec, snap }.
 */
function notifPrepareSend(data, rec, expectedRecipients) {
  const snap = notifAudienceSnapshot(rec.audienceKey);
  if (snap.targetedCustomers === 0)
    return { error: { status: 400, code: "no_recipients", msg: "Audience has no customers" } };

  const exp = Number(expectedRecipients);
  if (Number.isFinite(exp) && exp >= 0) {
    const tol = Math.max(5, Math.ceil(snap.targetedCustomers * 0.1));
    if (Math.abs(exp - snap.targetedCustomers) > tol)
      return {
        error: {
          status: 409,
          code: "audience_changed",
          msg: "Audience size changed since confirmation",
          extra: { targetedCustomers: snap.targetedCustomers, pushCustomers: snap.pushCustomers },
        },
      };
  }

  const nowMs = Date.now();
  const dup = data.notifications.find(
    (n) =>
      n.id !== rec.id &&
      (n.status === "sent" || n.status === "sending") &&
      n.type === "broadcast" &&
      n.title === rec.title &&
      n.message === rec.message &&
      String(n.url || "") === String(rec.url || "") &&
      String(n.audienceKey || "all") === rec.audienceKey &&
      nowMs - new Date(n.sentAt || n.createdAt).getTime() < 60_000,
  );
  if (dup)
    return { error: { status: 409, code: "duplicate_recent", msg: "Same notification was just sent" } };

  const nowIso = new Date().toISOString();
  rec.status = "sending";
  rec.audience = rec.audienceKey === "all" ? "all" : "segment";
  if (rec.audience === "segment") rec.recipientIds = snap.targetedIds;
  else delete rec.recipientIds;
  rec.createdAt = nowIso; // inbox ordering / unread logic use createdAt
  rec.sentAt = nowIso;
  rec.updatedAt = nowIso;
  rec.delivery = {
    pushEnabled: WEBPUSH_ENABLED,
    targetedCustomers: snap.targetedCustomers,
    pushCustomers: snap.pushCustomers,
    pushDevices: snap.pushDevices,
  };
  return { rec, snap };
}

async function notifDispatch(id) {
  let delivery = null;
  try {
    const rec = (loadNotifications().notifications || []).find((n) => n.id === id);
    if (!rec) return null;
    let push;
    if (!WEBPUSH_ENABLED) {
      push = { ok: false, reason: "disabled", sent: 0, failed: 0, removed: 0, devices: 0 };
    } else {
      // segment => ONLY its recipients (empty set means nobody, never "all")
      const ids =
        rec.audience === "segment" ? new Set(rec.recipientIds || []) : null;
      push = await broadcastWebPushNotification(rec, { customerIds: ids });
    }
    delivery = {
      pushEnabled: WEBPUSH_ENABLED,
      pushOk: !!push.ok,
      reason: push.reason || null,
      sent: push.sent || 0,
      failed: push.failed || 0,
      removed: push.removed || 0,
      devices: push.devices || 0,
    };
  } catch (e) {
    delivery = {
      pushEnabled: WEBPUSH_ENABLED,
      pushOk: false,
      reason: "error",
      sent: 0,
      failed: 0,
      removed: 0,
      devices: 0,
    };
    try {
      logger.warn("Notification dispatch failed", { id, message: String(e && e.message ? e.message : e) });
    } catch (_e2) {}
  } finally {
    try {
      const data = loadNotifications();
      const rec = (data.notifications || []).find((n) => n.id === id);
      if (rec) {
        rec.status = "sent";
        rec.delivery = { ...(rec.delivery || {}), ...(delivery || {}), finishedAt: new Date().toISOString() };
        saveNotifications(data);
        delivery = rec.delivery;
      }
    } catch (_e3) {}
    notifSending.delete(id);
  }
  return delivery;
}

async function notifSendAndRespond(res, id) {
  notifSending.add(id);
  const sleep = new Promise((r) => setTimeout(() => r("timeout"), 20_000));
  const result = await Promise.race([notifDispatch(id), sleep]);
  const rec = (loadNotifications().notifications || []).find((n) => n.id === id);
  const processing = result === "timeout";
  return res.json({
    ok: true,
    processing,
    notification: notifPublic(rec),
    delivery: processing ? rec?.delivery || null : result,
  });
}

// Audience preview (real data only): used by the editor before sending.
app.get("/api/admin/notifications/audience", requireAdmin, (req, res) => {
  const key = String(req.query.audience || "all");
  if (!notifCore.isValidAudience(key))
    return notifFail(res, 400, "invalid_audience", NOTIF_ERR_MSG.invalid_audience);
  const snap = notifAudienceSnapshot(key);
  const { targetedIds, ...out } = snap;
  res.json({ ok: true, pushEnabled: WEBPUSH_ENABLED, ...out });
});

// Create: sends immediately by default (backward compatible) or saves a draft.
app.post("/api/admin/notifications", requireAdmin, async (req, res) => {
  try {
    const draft = req.body?.draft === true;
    const v = notifCore.validateNotifInput(
      {
        title: notifCleanText(req.body?.title),
        message: notifCleanText(req.body?.message ?? req.body?.body ?? req.body?.text),
        url: req.body?.url,
        audience: req.body?.audience,
      },
      { requireContent: !draft },
    );
    if (!v.ok) return notifFail(res, 400, v.error, NOTIF_ERR_MSG[v.error] || "Invalid input");

    const requestId = String(req.body?.requestId || "").slice(0, 80);
    const data = loadNotifications();
    data.notifications = Array.isArray(data.notifications) ? data.notifications : [];

    // idempotency: same requestId => return the existing record, never resend
    if (requestId) {
      const prev = data.notifications.find((n) => n.requestId === requestId);
      if (prev)
        return res.json({ ok: true, duplicate: true, notification: notifPublic(prev), delivery: prev.delivery || null });
    }

    const id = `notif_${genId()}`;
    let imageUrl = null;
    const image = String(req.body?.image || req.body?.dataUrl || "").trim();
    if (image) {
      if (!image.startsWith("data:")) return notifFail(res, 400, "image_invalid", NOTIF_ERR_MSG.image_invalid);
      const r = notifSaveImage(image, id);
      if (r.error) return notifFail(res, 400, r.error, NOTIF_ERR_MSG[r.error]);
      imageUrl = r.url;
    }

    const nowIso = new Date().toISOString();
    const rec = {
      id,
      title: v.value.title,
      message: v.value.message,
      imageUrl,
      url: v.value.url || "/notifications/",
      linkUrl: v.value.url || null, // what the admin typed (null = default)
      audience: "all",
      audienceKey: v.value.audience,
      type: "broadcast",
      status: "draft",
      requestId: requestId || undefined,
      createdBy: String(req.adminId || ""),
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    if (draft) {
      data.notifications.unshift(rec);
      saveNotificationsBounded(data);
      return res.json({ ok: true, notification: notifPublic(rec) });
    }

    const prep = notifPrepareSend(data, rec, req.body?.expectedRecipients);
    if (prep.error) {
      if (imageUrl) { /* image file is left in place; harmless and overwritten on retry */ }
      return notifFail(res, prep.error.status, prep.error.code, prep.error.msg, prep.error.extra);
    }
    data.notifications.unshift(rec);
    saveNotificationsBounded(data);
    try {
      logger.info("Admin notification send", {
        id, admin: rec.createdBy, audience: rec.audienceKey,
        targeted: prep.snap.targetedCustomers, devices: prep.snap.pushDevices,
      });
    } catch (_e) {}
    return notifSendAndRespond(res, id);
  } catch (e) {
    return notifFail(res, 500, "server_error", String(e && e.message ? e.message : e));
  }
});

// Update a draft
app.put("/api/admin/notifications/:id", requireAdmin, (req, res) => {
  try {
    const data = loadNotifications();
    const rec = (data.notifications || []).find((n) => n.id === String(req.params.id));
    if (!rec) return notifFail(res, 404, "not_found", "Not found");
    if (rec.status !== "draft") return notifFail(res, 409, "not_draft", "Only drafts can be edited");

    const v = notifCore.validateNotifInput(
      {
        title: notifCleanText(req.body?.title),
        message: notifCleanText(req.body?.message),
        url: req.body?.url,
        audience: req.body?.audience,
      },
      { requireContent: false },
    );
    if (!v.ok) return notifFail(res, 400, v.error, NOTIF_ERR_MSG[v.error] || "Invalid input");

    const image = String(req.body?.image || "").trim();
    if (image) {
      if (!image.startsWith("data:")) return notifFail(res, 400, "image_invalid", NOTIF_ERR_MSG.image_invalid);
      const r = notifSaveImage(image, rec.id);
      if (r.error) return notifFail(res, 400, r.error, NOTIF_ERR_MSG[r.error]);
      rec.imageUrl = r.url;
    } else if (req.body?.removeImage === true) {
      rec.imageUrl = null;
    }
    rec.title = v.value.title;
    rec.message = v.value.message;
    rec.url = v.value.url || "/notifications/";
    rec.linkUrl = v.value.url || null;
    rec.audienceKey = v.value.audience;
    rec.updatedAt = new Date().toISOString();
    saveNotifications(data);
    res.json({ ok: true, notification: notifPublic(rec) });
  } catch (e) {
    notifFail(res, 500, "server_error", String(e && e.message ? e.message : e));
  }
});

// Send a saved draft
app.post("/api/admin/notifications/:id/send", requireAdmin, async (req, res) => {
  try {
    const id = String(req.params.id);
    if (notifSending.has(id)) return notifFail(res, 409, "already_sending", "Already sending");
    const data = loadNotifications();
    const rec = (data.notifications || []).find((n) => n.id === id);
    if (!rec) return notifFail(res, 404, "not_found", "Not found");
    if (rec.status !== "draft") return notifFail(res, 409, "not_draft", "Already sent");

    const v = notifCore.validateNotifInput(
      { title: rec.title, message: rec.message, url: rec.linkUrl, audience: rec.audienceKey || "all" },
      { requireContent: true },
    );
    if (!v.ok) return notifFail(res, 400, v.error, NOTIF_ERR_MSG[v.error] || "Invalid input");

    const prep = notifPrepareSend(data, rec, req.body?.expectedRecipients);
    if (prep.error) return notifFail(res, prep.error.status, prep.error.code, prep.error.msg, prep.error.extra);
    saveNotifications(data);
    try {
      logger.info("Admin notification send (draft)", {
        id, admin: String(req.adminId || ""), audience: rec.audienceKey,
        targeted: prep.snap.targetedCustomers, devices: prep.snap.pushDevices,
      });
    } catch (_e) {}
    return notifSendAndRespond(res, id);
  } catch (e) {
    return notifFail(res, 500, "server_error", String(e && e.message ? e.message : e));
  }
});

// Delete a draft (sent notifications are kept as history)
app.delete("/api/admin/notifications/:id", requireAdmin, (req, res) => {
  const data = loadNotifications();
  const idx = (data.notifications || []).findIndex((n) => n.id === String(req.params.id));
  if (idx < 0) return notifFail(res, 404, "not_found", "Not found");
  if (data.notifications[idx].status !== "draft")
    return notifFail(res, 409, "not_draft", "Only drafts can be deleted");
  data.notifications.splice(idx, 1);
  saveNotifications(data);
  res.json({ ok: true });
});

// Test push to ONE explicitly chosen customer device (no inbox record is created)
app.post("/api/admin/notifications/test", requireAdmin, async (req, res) => {
  try {
    if (!WEBPUSH_ENABLED)
      return notifFail(res, 400, "push_disabled", "Web Push is not configured (VAPID keys)");

    const v = notifCore.validateNotifInput({
      title: notifCleanText(req.body?.title),
      message: notifCleanText(req.body?.message),
      url: req.body?.url,
    });
    if (!v.ok) return notifFail(res, 400, v.error, NOTIF_ERR_MSG[v.error] || "Invalid input");

    const target = String(req.body?.target || "").trim().toLowerCase();
    if (!target) return notifFail(res, 400, "missing_target", "Missing test recipient");
    const digits = target.replace(/\D/g, "");
    const cust = (loadCustomers().customers || []).find(
      (c) =>
        String(c.id).toLowerCase() === target ||
        (c.email && String(c.email).toLowerCase() === target) ||
        (digits.length >= 6 && c.phone && String(c.phone).replace(/\D/g, "") === digits),
    );
    if (!cust) return notifFail(res, 404, "customer_not_found", "Customer not found");
    const hasDevice = (loadPushSubscriptions().subscriptions || []).some(
      (r) => String(r.customerId) === String(cust.id),
    );
    if (!hasDevice) return notifFail(res, 404, "no_device", "This customer has no subscribed device");

    let imageUrl = null;
    const image = String(req.body?.image || "").trim();
    if (image) {
      if (!image.startsWith("data:")) return notifFail(res, 400, "image_invalid", NOTIF_ERR_MSG.image_invalid);
      const safeAdmin = String(req.adminId || "admin").replace(/[^a-zA-Z0-9_-]/g, "_");
      const r = notifSaveImage(image, `test_${safeAdmin}`);
      if (r.error) return notifFail(res, 400, r.error, NOTIF_ERR_MSG[r.error]);
      imageUrl = `${r.url}?v=${Date.now()}`;
    }

    const rec = {
      id: `test_${genId()}`,
      title: `[TEST] ${v.value.title}`.slice(0, notifCore.LIMITS.TITLE_MAX + 7),
      message: v.value.message,
      imageUrl,
      url: v.value.url || "/notifications/",
      createdAt: new Date().toISOString(),
    };
    if (notifCore.payloadBytes(notifCore.buildPushPayload(rec)) > notifCore.LIMITS.PAYLOAD_MAX_BYTES)
      return notifFail(res, 400, "payload_too_large", "Notification too large for Web Push");

    const r = await sendWebPushToCustomer(cust.id, rec);
    try {
      logger.info("Admin test push", { admin: String(req.adminId || ""), customerId: cust.id, sent: r.sent, failed: r.failed });
    } catch (_e) {}
    if (!r.sent) return notifFail(res, 502, "send_failed", "Push service rejected the test", { failed: r.failed });
    res.json({ ok: true, sent: r.sent, failed: r.failed });
  } catch (e) {
    notifFail(res, 500, "server_error", String(e && e.message ? e.message : e));
  }
});

/***********************
 * Customer: notifications inbox
 ***********************/
app.get("/api/customer/notifications", requireCustomer, (req, res) => {
  const customers = loadCustomers();
  const me = (customers.customers || []).find(
    (c) => String(c.id) === String(req.customerId),
  );
  if (!me) return res.status(401).json({ error: "Unauthorized" });

  const notif = loadNotifications();
  const all = (notif.notifications || [])
    .slice()
    .sort((a, b) =>
      String(b.createdAt || "").localeCompare(String(a.createdAt || "")),
    );

  // Filter: broadcast (all) + targeted segments + personal notifications.
  // Drafts are never visible to customers.
  const list = all.filter((n) => notifCore.visibleToCustomer(n, req.customerId));

  const lastSeenAt = me.notificationsLastSeenAt
    ? String(me.notificationsLastSeenAt)
    : null;
  const lastSeenMs = lastSeenAt ? new Date(lastSeenAt).getTime() : 0;
  const unreadCount = list.reduce((n, it) => {
    const t = it && it.createdAt ? new Date(String(it.createdAt)).getTime() : 0;
    return n + (t && t > lastSeenMs ? 1 : 0);
  }, 0);

  res.json({ ok: true, notifications: list, unreadCount, lastSeenAt });
});

app.post("/api/customer/notifications/seen", requireCustomer, (req, res) => {
  const customers = loadCustomers();
  const idx = (customers.customers || []).findIndex(
    (c) => String(c.id) === String(req.customerId),
  );
  if (idx < 0) return res.status(401).json({ error: "Unauthorized" });

  customers.customers[idx].notificationsLastSeenAt = new Date().toISOString();
  customers.customers[idx].updatedAt = new Date().toISOString();
  saveCustomers(customers);
  res.json({
    ok: true,
    lastSeenAt: customers.customers[idx].notificationsLastSeenAt,
  });
});

/***********************
 * Customer: Web Push subscription (Real Push Notifications)
 ***********************/
app.get("/api/customer/push/status", requireCustomer, (req, res) => {
  const data = loadPushSubscriptions();
  const list = (data.subscriptions || []).filter(
    (r) => String(r.customerId) === String(req.customerId),
  );
  res.json({ ok: true, enabled: WEBPUSH_ENABLED, count: list.length });
});

app.post(
  "/api/customer/push/subscribe",
  requireCustomer,
  validate([
    body("subscription").custom((v) => {
      if (!v || typeof v !== "object") throw new Error("Invalid subscription");
      return true;
    }),
  ]),
  (req, res) => {
    if (!WEBPUSH_ENABLED)
      return res.status(400).json({ error: "Web Push is not configured" });

    const customers = loadCustomers();
    const me = (customers.customers || []).find(
      (c) => String(c.id) === String(req.customerId),
    );
    if (!me) return res.status(401).json({ error: "Unauthorized" });

    const sub = normalizePushSubscription(req.body.subscription);
    if (!sub) return res.status(400).json({ error: "Invalid subscription" });

    const data = loadPushSubscriptions();
    data.subscriptions = Array.isArray(data.subscriptions)
      ? data.subscriptions
      : [];

    const ua = String(req.headers["user-agent"] || "");
    const nowIso = new Date().toISOString();

    // Update existing by endpoint (multi-device supported)
    const idx = data.subscriptions.findIndex(
      (r) => String(r.endpoint) === String(sub.endpoint),
    );
    if (idx >= 0) {
      data.subscriptions[idx] = {
        ...data.subscriptions[idx],
        customerId: String(req.customerId),
        endpoint: sub.endpoint,
        subscription: sub,
        userAgent: ua,
        updatedAt: nowIso,
      };
    } else {
      data.subscriptions.unshift({
        id: `ps_${genId()}`,
        customerId: String(req.customerId),
        endpoint: sub.endpoint,
        subscription: sub,
        userAgent: ua,
        createdAt: nowIso,
        updatedAt: nowIso,
      });
    }

    // bound file size
    const max = Math.max(
      200,
      Number(process.env.PUSH_SUBSCRIPTIONS_MAX || 5000),
    );
    if (data.subscriptions.length > max)
      data.subscriptions = data.subscriptions.slice(0, max);

    savePushSubscriptions(data);
    res.json({ ok: true });
  },
);

app.post(
  "/api/customer/push/unsubscribe",
  requireCustomer,
  validate([body("endpoint").optional().isLength({ max: 2000 })]),
  (req, res) => {
    const endpoint = String(req.body?.endpoint || "").trim();

    const data = loadPushSubscriptions();
    const before = (data.subscriptions || []).length;

    data.subscriptions = (data.subscriptions || []).filter((r) => {
      if (String(r.customerId) !== String(req.customerId)) return true;
      if (!endpoint) return false; // remove all for this customer
      return String(r.endpoint) !== endpoint;
    });

    const removed = before - data.subscriptions.length;
    if (removed > 0) savePushSubscriptions(data);

    res.json({ ok: true, removed });
  },
);

/***********************
 * Driver endpoints
 ***********************/
app.post(
  "/api/driver/signup",
  validate([
    // allow empty strings from clients (treat as absent)
    body("email").optional({ checkFalsy: true }).isEmail().normalizeEmail(),
    body("phone").optional({ checkFalsy: true }).trim().isLength({ max: 25 }),
    body("name")
      .optional()
      .customSanitizer(stripDangerous)
      .isLength({ max: 80 }),
    body("cardNumber")
      .optional()
      .customSanitizer(stripDangerous)
      .isLength({ max: 40 }),
    body("password").optional().isLength({ max: 128 }),
  ]),
  (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const phone = normalizePhone(req.body?.phone);
    const name = String(req.body?.name || req.body?.fullName || "").trim();
    const cardNumber = String(
      req.body?.cardNumber || req.body?.idNumber || "",
    ).trim();
    const password = String(req.body?.password || "");
    const password2 = String(
      req.body?.password2 || req.body?.passwordConfirm || "",
    );

    const faceWithBikeCard = String(
      req.body?.faceWithBikeCard || req.body?.face || "",
    );
    const idFront = String(req.body?.idFront || req.body?.cardFront || "");
    const idBack = String(req.body?.idBack || req.body?.cardBack || "");
    const profilePhoto = String(
      req.body?.profilePhoto || req.body?.avatar || "",
    );
    const licenseImage = String(req.body?.licenseImage || req.body?.license || "");
    const vType = String(req.body?.vehicleType || "").trim().toLowerCase();
    if (vType && !driverReview.VEHICLE_TYPES.includes(vType))
      return res.status(400).json({ error: "Invalid vehicleType" });
    const vehicle = vType
      ? {
          type: vType,
          plate: String(req.body?.vehiclePlate || "").replace(/[<>"'`]/g, "").trim().slice(0, 20),
          model: String(req.body?.vehicleModel || "").replace(/[<>"'`]/g, "").trim().slice(0, 40),
        }
      : null;

    // Email is optional; phone is required.
    if (email && !email.includes("@"))
      return res.status(400).json({ error: "Invalid email" });
    if (!phone || phone.length < 8)
      return res.status(400).json({ error: "Invalid phone" });
    if (!name) return res.status(400).json({ error: "Missing name" });
    if (!cardNumber || cardNumber.length < 4)
      return res.status(400).json({ error: "Invalid cardNumber" });
    if (!password || password.length < 6)
      return res.status(400).json({ error: "Password too short (min 6)" });
    if (password2 && password2 !== password)
      return res.status(400).json({ error: "Passwords do not match" });

    if (!faceWithBikeCard || !idFront || !idBack) {
      return res
        .status(400)
        .json({ error: "Missing images (faceWithBikeCard, idFront, idBack)" });
    }

    const data = loadDrivers();
    const exists = data.drivers.some(
      (d) =>
        (email && normalizeEmail(d.email) === email) ||
        normalizePhone(d.phone) === phone ||
        String(d.cardNumber || "") === cardNumber,
    );
    if (exists) return res.status(409).json({ error: "Driver already exists" });

    const driverId = makeId();
    const profilePhotoUrl =
      profilePhoto && profilePhoto.startsWith("data:")
        ? saveDataUrlImage(profilePhoto, DRIVERS_UPLOAD_DIR, driverId, {
            maxBytes: MAX_DRIVER_PROFILE_PHOTO_BYTES,
          })
        : null;

    // Store ID images on disk (private), NOT as base64 in JSON
    const faceSaved = saveDataUrlImagePrivate(
      faceWithBikeCard,
      PRIVATE_DRIVER_ID_DIR,
      `${driverId}_face`,
      { maxBytes: MAX_DRIVER_ID_IMAGE_BYTES },
    );
    const frontSaved = saveDataUrlImagePrivate(
      idFront,
      PRIVATE_DRIVER_ID_DIR,
      `${driverId}_id_front`,
      { maxBytes: MAX_DRIVER_ID_IMAGE_BYTES },
    );
    const backSaved = saveDataUrlImagePrivate(
      idBack,
      PRIVATE_DRIVER_ID_DIR,
      `${driverId}_id_back`,
      { maxBytes: MAX_DRIVER_ID_IMAGE_BYTES },
    );
    if (!faceSaved || !frontSaved || !backSaved) {
      return res
        .status(400)
        .json({ error: "Invalid images (only JPG/PNG/WebP are allowed)" });
    }
    let licenseSaved = null;
    if (licenseImage) {
      licenseSaved = saveDataUrlImagePrivate(
        licenseImage,
        PRIVATE_DRIVER_ID_DIR,
        `${driverId}_license`,
        { maxBytes: MAX_DRIVER_ID_IMAGE_BYTES },
      );
      if (!licenseSaved)
        return res
          .status(400)
          .json({ error: "Invalid images (only JPG/PNG/WebP are allowed)" });
    }

    const record = {
      id: driverId,
      email: email || "",
      phone,
      name,
      cardNumber,
      password: hashPassword(password),
      profilePhotoUrl,
      images: {
        // file names in PRIVATE_DRIVER_ID_DIR
        faceWithBikeCard: faceSaved.file,
        idFront: frontSaved.file,
        idBack: backSaved.file,
        ...(licenseSaved ? { license: licenseSaved.file } : {}),
        meta: {
          faceWithBikeCard: { mime: faceSaved.mime, ext: faceSaved.ext },
          idFront: { mime: frontSaved.mime, ext: frontSaved.ext },
          idBack: { mime: backSaved.mime, ext: backSaved.ext },
        },
      },
      ...(vehicle ? { vehicle } : {}),
      walletBalance: 0,
      walletHistory: [],
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      approvedAt: null,
      rejectedAt: null,
    };

    data.drivers.unshift(record);
    saveDrivers(data);

    const token = issueDriverToken(record.id);
    const rt = issueRefreshToken({
      userType: "driver",
      userId: record.id,
      role: "driver",
      meta: { ip: req.ip || "", ua: String(req.headers["user-agent"] || "") },
    });
    res.json({
      ok: true,
      token,
      refreshToken: rt.refreshToken,
      driver: {
        id: record.id,
        name: record.name,
        email: record.email,
        phone: record.phone,
        cardNumber: record.cardNumber,
        status: record.status,
      },
    });
  },
);

app.post(
  "/api/driver/login",
  loginSlowdown,
  loginLimiter,
  validate([
    body("email").optional({ checkFalsy: true }).normalizeEmail(),
    body("phone").optional({ checkFalsy: true }).trim().isLength({ max: 25 }),
    body("password").optional().isLength({ max: 128 }),
  ]),
  (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const phone = normalizePhone(req.body?.phone);
    const password = String(req.body?.password || "");

    if ((!email && !phone) || !password)
      return res.status(400).json({ error: "Missing email/phone or password" });

    const data = loadDrivers();
    let found = null;
    if (email)
      found =
        data.drivers.find((d) => normalizeEmail(d.email) === email) || null;
    if (!found && phone)
      found =
        data.drivers.find((d) => normalizePhone(d.phone) === phone) || null;
    if (!found) return res.status(401).json({ error: "Wrong credentials" });
    if (!verifyPassword(password, found.password))
      return res.status(401).json({ error: "Wrong credentials" });

    // If this account used the legacy pbkdf2 format, upgrade to bcrypt on successful login
    if (isLegacyPasswordRecord(found.password)) {
      found.password = hashPassword(password);
      found.updatedAt = new Date().toISOString();
      saveDrivers(data);
    }

    // Legacy plain-text password upgrade (old builds stored passwords as plain strings)
    if (
      typeof found.password === "string" &&
      !isBcryptHashString(found.password)
    ) {
      found.password = hashPassword(password);
      found.updatedAt = new Date().toISOString();
      saveDrivers(data);
    }

    const token = issueDriverToken(found.id);
    const rt = issueRefreshToken({
      userType: "driver",
      userId: found.id,
      role: "driver",
      meta: { ip: req.ip || "", ua: String(req.headers["user-agent"] || "") },
    });
    res.json({
      ok: true,
      token,
      refreshToken: rt.refreshToken,
      driver: {
        id: found.id,
        name: found.name || "",
        email: found.email,
        phone: found.phone,
        cardNumber: found.cardNumber,
        status: found.status || "pending",
      },
    });
  },
);

/***********************
 * Driver social sign-in (Google / Apple)
 * Signs in an EXISTING driver account only (signup needs ID documents).
 * Match order: provider subject id -> verified provider email.
 ***********************/
let _appleKeysCache = { at: 0, keys: [] };
async function getAppleKeys() {
  if (_appleKeysCache.keys.length && Date.now() - _appleKeysCache.at < 3600 * 1000) {
    return _appleKeysCache.keys;
  }
  const r = await fetch(APPLE_JWKS_URL);
  if (!r.ok) throw new Error("apple jwks fetch failed");
  const j = await r.json();
  _appleKeysCache = { at: Date.now(), keys: Array.isArray(j.keys) ? j.keys : [] };
  return _appleKeysCache.keys;
}
async function verifyAppleIdToken(idToken) {
  const decoded = jwt.decode(idToken, { complete: true });
  if (!decoded || !decoded.header || decoded.header.alg !== "RS256") {
    throw new Error("bad apple token");
  }
  const keys = await getAppleKeys();
  const jwk = keys.find((k) => k.kid === decoded.header.kid);
  if (!jwk) throw new Error("apple key not found");
  const pub = crypto.createPublicKey({ key: jwk, format: "jwk" });
  return jwt.verify(idToken, pub, {
    algorithms: ["RS256"],
    issuer: APPLE_ISSUER,
    audience: APPLE_CLIENT_ID,
  });
}

function driverSocialLogin(req, res, { subField, sub, email, emailVerified }) {
  const data = loadDrivers();
  let found = data.drivers.find((d) => String(d[subField] || "") === sub) || null;
  if (!found && email && emailVerified) {
    const byEmail =
      data.drivers.find((d) => normalizeEmail(d.email) === email) || null;
    if (byEmail && !byEmail[subField]) {
      byEmail[subField] = sub;
      byEmail.updatedAt = new Date().toISOString();
      found = byEmail;
      saveDrivers(data);
    }
  }
  if (!found) {
    return res.status(404).json({
      error: "No driver account is linked to this login. Register first with the sign-up form.",
      code: "DRIVER_NOT_FOUND",
    });
  }
  const token = issueDriverToken(found.id);
  const rt = issueRefreshToken({
    userType: "driver",
    userId: found.id,
    role: "driver",
    meta: { ip: req.ip || "", ua: String(req.headers["user-agent"] || "") },
  });
  return res.json({
    ok: true,
    token,
    refreshToken: rt.refreshToken,
    driver: {
      id: found.id,
      name: found.name || "",
      email: found.email,
      phone: found.phone,
      cardNumber: found.cardNumber,
      status: found.status || "pending",
    },
  });
}

app.post(
  "/api/driver/google",
  loginSlowdown,
  loginLimiter,
  async (req, res) => {
    if (!GOOGLE_AUTH_ENABLED || !googleOauthClient) {
      return res.status(400).json({ error: "Google login not enabled" });
    }
    const idToken = String(req.body?.idToken || req.body?.credential || "").trim();
    if (idToken.length < 10 || idToken.length > 5000) {
      return res.status(400).json({ error: "Missing idToken" });
    }
    let payload = null;
    try {
      const ticket = await googleOauthClient.verifyIdToken({
        idToken,
        audience: GOOGLE_CLIENT_ID,
      });
      payload = ticket && ticket.getPayload ? ticket.getPayload() : null;
    } catch (_e) {
      return res.status(401).json({ error: "Invalid Google token" });
    }
    if (!payload || !payload.sub) {
      return res.status(401).json({ error: "Invalid Google token" });
    }
    return driverSocialLogin(req, res, {
      subField: "googleSub",
      sub: String(payload.sub),
      email: normalizeEmail(payload.email || ""),
      emailVerified: payload.email_verified === true,
    });
  },
);

app.post(
  "/api/driver/apple",
  loginSlowdown,
  loginLimiter,
  async (req, res) => {
    if (!APPLE_AUTH_ENABLED) {
      return res.status(400).json({ error: "Apple login not enabled" });
    }
    const idToken = String(req.body?.idToken || req.body?.id_token || "").trim();
    if (idToken.length < 10 || idToken.length > 8000) {
      return res.status(400).json({ error: "Missing idToken" });
    }
    let payload = null;
    try {
      payload = await verifyAppleIdToken(idToken);
    } catch (_e) {
      return res.status(401).json({ error: "Invalid Apple token" });
    }
    if (!payload || !payload.sub) {
      return res.status(401).json({ error: "Invalid Apple token" });
    }
    return driverSocialLogin(req, res, {
      subField: "appleSub",
      sub: String(payload.sub),
      email: normalizeEmail(payload.email || ""),
      emailVerified: payload.email_verified === true || payload.email_verified === "true",
    });
  },
);

app.get("/api/driver/me", requireDriver, (req, res) => {
  const data = loadDrivers();
  const found = data.drivers.find((d) => String(d.id) === String(req.driverId));
  if (!found) return res.status(404).json({ error: "Not found" });

  // Hide big images in /me response (keep status & identity)
  const me = {
    id: found.id,
    name: found.name || "",
    email: found.email,
    phone: found.phone,
    cardNumber: found.cardNumber,
    profilePhotoUrl: found.profilePhotoUrl || null,
    walletBalance: Number(found.walletBalance || 0),
    status: found.status || "pending",
    createdAt: found.createdAt,
    approvedAt: found.approvedAt || null,
    rejectedAt: found.rejectedAt || null,
  };
  res.json({ ok: true, driver: me });
});

app.get("/api/driver/orders", requireDriver, (req, res) => {
  const drivers = loadDrivers();
  const me = drivers.drivers.find((d) => String(d.id) === String(req.driverId));
  if (!me) return res.status(401).json({ error: "Unauthorized" });

  if (String(me.status || "pending") !== "approved") {
    return res.json({
      ok: true,
      status: me.status || "pending",
      available: [],
      mine: [],
    });
  }

  const data = loadOrders();
  const offersMode = loadConfig().dispatchMode === "offers";
  const available = offersMode
    ? []
    : data.orders.filter(
        (o) => String(o.status || "new") === "restaurant_ready" && !o.driverId,
      ).map((o) => ({ ...driverPrivacy.forAvailable(verifyCodes.stripForDriver(o)), driverEarning: driverEarnings.earningOf(o) }));
  const chatByOrder = new Map(
    (loadOrderChats().chats || []).map((c) => [String(c.orderId), c]),
  );
  const mine = data.orders
    .filter((o) => String(o.driverId || "") === String(req.driverId))
    .map((o) => ({
      ...driverPrivacy.forMine(verifyCodes.stripForDriver(o)),
      driverEarning: driverEarnings.earningOf(o),
      chatUnread: driverFeedback.unreadFor(chatByOrder.get(String(o.id)), "driver"),
      chatOpen: driverFeedback.isChatOpen(o),
    }));
  const delivered = mine.filter((o) =>
    ["delivered", "done"].includes(String(o.status || "")),
  );

  // Earnings windows (driver earning per order: snapshot, or deliveryFee in legacy mode)
  const now = new Date();
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startWeek = new Date(startToday);
  const dow = startWeek.getDay(); // 0=Sun..6=Sat
  const diff = (dow + 6) % 7; // week starts Monday
  startWeek.setDate(startWeek.getDate() - diff);

  const tsOf = (o) => {
    const t = o.deliveredAt || o.updatedAt || o.createdAt;
    const d = t ? new Date(t) : null;
    return d && !isNaN(d.getTime()) ? d : null;
  };

  const sumFee = (arr) =>
    arr.reduce((s, o) => s + driverEarnings.earningOf(o), 0);
  const inToday = delivered.filter((o) => {
    const d = tsOf(o);
    return d && d >= startToday;
  });
  const inWeek = delivered.filter((o) => {
    const d = tsOf(o);
    return d && d >= startWeek;
  });
  const inMonth = delivered.filter((o) => {
    const d = tsOf(o);
    return d && d >= startMonth;
  });

  const stats = {
    deliveredCount: delivered.length,
    deliveredTotal: delivered.reduce((s, o) => s + Number(o.total || 0), 0),
    deliveredDeliveryFee: sumFee(delivered),

    earningsToday: sumFee(inToday),
    earningsWeek: sumFee(inWeek),
    earningsMonth: sumFee(inMonth),
  };
  res.json({ ok: true, available, mine, stats });
});

app.post(
  "/api/driver/orders/:id/accept",
  requireDriver,
  requireApprovedDriver,
  (req, res) => {
    if (loadConfig().dispatchMode === "offers") {
      return res
        .status(409)
        .json({ error: "Offers mode: use /api/driver/offers" });
    }
    const id = String(req.params.id);
    const data = loadOrders();
    const idx = data.orders.findIndex((o) => o.id === id);
    if (idx < 0) return res.status(404).json({ error: "Not found" });

    const order = data.orders[idx];
    const prevStatus = String(order.status || "new");
    if (order.driverId && String(order.driverId) !== String(req.driverId)) {
      return res.status(409).json({ error: "Order already assigned" });
    }
    const st = String(order.status || "new");
    // Repeat of an accept this driver already made (lost response / retry after reconnect): harmless no-op.
    // It must never move the order back to "accepted" after pickup, nor re-run the wallet gate.
    if (offlineSync.isRepeatAccept(order, req.driverId)) {
      return res.json({ ok: true, order, duplicate: true });
    }
    // Driver can only accept when restaurant marked it ready
    if (!order.driverId && st !== "restaurant_ready") {
      return res.status(409).json({ error: "Order not ready" });
    }

    // Wallet gate: prevent accepting if wallet balance is not enough
    const cfg = loadConfig();
    if (cfg.driverWalletEnabled !== false) {
      const drivers = loadDrivers();
      const d = (drivers.drivers || []).find(
        (x) => String(x.id) === String(req.driverId),
      );
      if (d) {
        ensureDriverWalletFields(d);
        const mode = String(
          cfg.driverWalletChargeMode || "subtotal",
        ).toLowerCase();
        const chargeOf = (o) => {
          if (!o) return 0;
          if (mode === "commission")
            return Number(cfg.driverCommissionPerOrder || 0);
          if (mode === "total") return Number(o.total || 0);
          return promoLib.goodsDue(o);
        };
        const required = Math.max(0, Number(chargeOf(order) || 0));
        if (required > 0) {
          const reserved = (data.orders || [])
            .filter(
              (o) =>
                String(o.driverId || "") === String(req.driverId) &&
                String(o.id) !== id,
            )
            .filter((o) => {
              const s = String(o.status || "").toLowerCase();
              const done = ["delivered", "done", "canceled"].includes(s);
              const charged = !!(o.walletChargedAt || o.commissionChargedAt);
              return !done && !charged;
            })
            .reduce((sum, o) => sum + Math.max(0, Number(chargeOf(o) || 0)), 0);

          const balance = Number(d.walletBalance || 0);
          const available = balance - reserved;
          if (required > available + 1e-9) {
            return res.status(402).json({
              error: "Insufficient wallet balance",
              walletBalance: balance,
              walletReserved: reserved,
              walletAvailable: available,
              required,
              mode,
            });
          }
        }
      }
    }

    order.driverId = String(req.driverId);
    // move into delivery stage
    order.status = "accepted";
    order.acceptedAt = order.acceptedAt || new Date().toISOString();
    order.updatedAt = new Date().toISOString();

    // Auto customer notification: driver accepted
    try {
      const nextStatus = String(order.status || "new");
      if (nextStatus !== prevStatus && nextStatus === "accepted") {
        createCustomerOrderStatusNotification({
          customerId: order.customerId,
          orderId: order.id,
          stage: "accepted",
        });
      }
    } catch (_e) {}

    saveOrders(data);
    res.json({ ok: true, order });
  },
);

app.patch(
  "/api/driver/orders/:id",
  requireDriver,
  requireApprovedOrFinishing,
  (req, res) => {
    const id = String(req.params.id);
    const patch = req.body || {};
    const data = loadOrders();
    const idx = data.orders.findIndex((o) => o.id === id);
    if (idx < 0) return res.status(404).json({ error: "Not found" });

    const order = data.orders[idx];
    if (String(order.driverId || "") !== String(req.driverId)) {
      return res.status(403).json({ error: "Not your order" });
    }

    if (patch.status) {
      const st = String(patch.status);
      // Section 20: updates replayed from an offline queue are re-validated here. Verified steps
      // (pickup/delivery) can never arrive this way; stale queued updates are refused.
      const qg = offlineSync.checkQueuedStatusUpdate(patch, Date.now());
      if (!qg.ok) return res.status(qg.status).json({ error: qg.error, code: qg.code });
      const allowed = [
        "accepted",
        "picked_up",
        "on_the_way",
        "delivered",
        "canceled",
        "done",
      ];
      if (!allowed.includes(st))
        return res.status(400).json({ error: "Invalid status" });
      // A suspended driver may only complete the delivery in progress (no cancelling).
      if (req.driver && String(req.driver.status) !== "approved" && !["on_the_way", "delivered", "done"].includes(st)) {
        return res.status(403).json({ error: "Account suspended: you can only finish the current delivery", code: "DRIVER_SUSPENDED" });
      }
      // Server-side state machine: no skipping steps, no rewinding closed orders.
      const tr = orderState.checkDriverTransition(order.status, st);
      if (!tr.ok) {
        return res.status(409).json({ error: tr.error, code: tr.code });
      }
      // Pickup / delivery verification (server-side; cannot be skipped via the API).
      if (!tr.noop && (st === "picked_up" || st === "delivered")) {
        const stage = st === "picked_up" ? "pickup" : "delivery";
        const vr = verifyCodes.check(VERIFY_SECRET, order, stage, patch.code);
        if (!vr.ok) {
          saveOrders(data); // persist attempt counters / lock
          return res.status(vr.status).json({
            error: "Verification failed",
            code: vr.code,
            stage,
            ...(vr.attemptsLeft !== undefined ? { attemptsLeft: vr.attemptsLeft } : {}),
          });
        }
      }
      if (!tr.noop) {
        orderState.recordEvent(order, {
          from: order.status,
          to: st,
          actorType: "driver",
          actorId: req.driverId,
        });
        order.status = st;
      }
      if (!tr.noop && (st === "delivered" || st === "done")) {
        order.deliveredAt = order.deliveredAt || new Date().toISOString();

        // wallet charge (charged once per order)
        // Default: subtract order.subtotal (does NOT include deliveryFee)
        const cfg = loadConfig();
        if (
          cfg.driverWalletEnabled !== false &&
          !order.walletChargedAt &&
          !order.commissionChargedAt
        ) {
          const mode = String(
            cfg.driverWalletChargeMode || "subtotal",
          ).toLowerCase();
          let chargeType = "subtotal";
          let chargeAmount = 0;

          if (mode === "commission") {
            chargeType = "commission";
            chargeAmount = Number(cfg.driverCommissionPerOrder || 0);
          } else if (mode === "total") {
            // includes deliveryFee (optional mode)
            chargeType = "total";
            chargeAmount = Number(order.total || 0);
          } else {
            // items only (recommended)
            chargeType = "subtotal";
            chargeAmount = promoLib.goodsDue(order); // subtotal minus any platform-funded discount
          }

          chargeAmount =
            Number.isFinite(chargeAmount) && chargeAmount > 0
              ? chargeAmount
              : 0;

          if (chargeAmount > 0) {
            order.walletChargedAt = new Date().toISOString();
            order.walletChargeType = chargeType;
            order.walletChargeAmount = chargeAmount;

            const drivers = loadDrivers();
            const d = (drivers.drivers || []).find(
              (x) => String(x.id) === String(req.driverId),
            );
            if (d) {
              // Unique ref per order: a retry can never charge twice. Negative is
              // allowed here on purpose: the balance was verified when the driver
              // accepted the order (see the wallet gate in the accept route).
              walletLedger.applyEntry(d, {
                ref: `order:${order.id}:charge`,
                type: "order_deduct",
                amount: -chargeAmount,
                orderId: order.id,
                note: `Order charge (${chargeType})`,
                actorType: "driver",
                actorId: req.driverId,
                at: order.walletChargedAt,
                allowNegative: true,
              });
              saveDrivers(drivers);
            }
          }
        }
      }
    }
    financeLib.finalize(order);
    refundOrderWallet(order);
    order.updatedAt = new Date().toISOString();

    saveOrders(data);
    res.json({ ok: true, order });
  },
);

/***********************
 * Driver wallet + Topups
 ***********************/
app.get("/api/driver/wallet", requireDriver, (req, res) => {
  const drivers = loadDrivers();
  const d = (drivers.drivers || []).find(
    (x) => String(x.id) === String(req.driverId),
  );
  if (!d) return res.status(404).json({ error: "Driver not found" });
  if (d.walletBalance === undefined) d.walletBalance = 0;
  if (!Array.isArray(d.walletHistory)) d.walletHistory = [];
  const topups = loadTopups();
  const mine = (topups.topups || [])
    .filter((t) => String(t.driverId) === String(req.driverId))
    .sort((a, b) =>
      String(b.createdAt || "").localeCompare(String(a.createdAt || "")),
    );
  res.json({
    ok: true,
    walletBalance: Number(d.walletBalance || 0),
    walletHistory: d.walletHistory.slice(0, 50),
    topups: mine.slice(0, 50).map(topupsLib.ownerView),
  });
});

app.get("/api/driver/topups", requireDriver, (req, res) => {
  const topups = loadTopups();
  const mine = (topups.topups || [])
    .filter((t) => topupsLib.walletTypeOf(t) === "driver" && String(t.driverId) === String(req.driverId))
    .sort((a, b) =>
      String(b.createdAt || "").localeCompare(String(a.createdAt || "")),
    );
  res.json({ ok: true, topups: mine.map(topupsLib.ownerView) });
});

const topupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `topup:${req.driverId || req.customerId || req.ip}`,
});

/** Where a stored receipt lives (private dir, or a legacy file under uploads/topups). Never a client-supplied path. */
function receiptPathOf(t) {
  if (t && t.receiptFile) return path.join(PRIVATE_TOPUP_DIR, path.basename(String(t.receiptFile)));
  const u = String((t && t.receiptUrl) || "");
  if (u) {
    const base = path.basename(u.split("?")[0]);
    for (const dir of [TOPUPS_UPLOAD_DIR, path.join(LEGACY_UPLOADS_DIR, "topups")]) {
      const abs = path.join(dir, base);
      if (fs.existsSync(abs)) return abs;
    }
  }
  return null;
}
function sendReceipt(res, t) {
  const abs = receiptPathOf(t);
  if (!abs || !fs.existsSync(abs)) return res.status(404).json({ error: "No receipt" });
  const ext = abs.split(".").pop().toLowerCase();
  res.setHeader("Content-Type", ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Disposition", "inline");
  return res.sendFile(abs);
}

/**
 * Create a pending transfer request for a wallet owner. NEVER credits anything.
 * Returns {ok:true, topup} or {ok:false, status, body}.
 */
function createTransferRequest({ walletType, ownerId, body }) {
  const data = loadTopups();
  const v = topupsLib.validateRequest({
    walletType,
    ownerId,
    methodId: body?.methodId,
    amount: body?.amount,
    reference: body?.reference,
    hasReceipt: !!(body?.receipt && String(body.receipt).startsWith("data:")),
    methods: loadPaymentMethods(),
    topups: data.topups,
  });
  if (!v.ok) {
    const { status, ...payload } = v;
    return { ok: false, status, body: payload };
  }
  const id = genId();
  let receiptFile = null;
  if (body?.receipt) {
    try {
      const saved = saveDataUrlImagePrivate(String(body.receipt), PRIVATE_TOPUP_DIR, id, { maxBytes: MAX_TOPUP_RECEIPT_BYTES });
      if (!saved) return { ok: false, status: 400, body: { error: "Invalid receipt", code: "INVALID_RECEIPT" } };
      receiptFile = saved.file;
    } catch (e) {
      return { ok: false, status: 400, body: { error: String(e && e.message ? e.message : "Invalid receipt"), code: "INVALID_RECEIPT" } };
    }
  }
  const rec = {
    id,
    walletType,
    ...(walletType === "customer" ? { customerId: String(ownerId) } : { driverId: String(ownerId) }),
    methodId: v.value.methodId,
    amount: v.value.amount,
    currency: loadConfig().currency || "MAD",
    reference: v.value.reference,
    refKey: v.value.refKey,
    receiptFile,
    note: String(body?.note || "").replace(/[<>]/g, "").trim().slice(0, 300),
    status: "pending",
    createdAt: new Date().toISOString(),
    decidedAt: null,
    decidedBy: null,
    decisionNote: null,
  };
  data.topups.unshift(rec);
  saveTopups(data);
  return { ok: true, topup: rec };
}

app.post(
  "/api/driver/topups",
  requireDriver,
  requireApprovedDriver,
  topupLimiter,
  (req, res) => {
    const hasTransfer = loadPaymentMethods().some(
      (m) => m.kind === "transfer" && paymentMethods.availability(m, "driverTopup").available,
    );
    if (req.body?.methodId || hasTransfer) {
      const r = createTransferRequest({ walletType: "driver", ownerId: req.driverId, body: req.body });
      if (!r.ok) return res.status(r.status).json(r.body);
      appendAuditLog({ actorType: "driver", actorId: String(req.driverId), action: "topup.request", topupId: r.topup.id, methodId: r.topup.methodId, amount: r.topup.amount });
      return res.json({ ok: true, topup: topupsLib.ownerView(r.topup) });
    }

    // Legacy flow (no transfer method configured yet): the single bank account from the settings.
    const amount = Number(req.body?.amount || 0);
    const receipt = String(req.body?.receipt || req.body?.receiptImage || "");
    const note = String(req.body?.note || "").trim();
    if (!Number.isFinite(amount) || amount <= 0)
      return res.status(400).json({ error: "Invalid amount" });
    if (!receipt || !receipt.startsWith("data:"))
      return res.status(400).json({ error: "Missing receipt" });
    const data = loadTopups();
    const id = genId();
    let saved = null;
    try {
      saved = saveDataUrlImagePrivate(receipt, PRIVATE_TOPUP_DIR, id, { maxBytes: MAX_TOPUP_RECEIPT_BYTES });
    } catch (_e) {}
    if (!saved) return res.status(400).json({ error: "Invalid receipt" });
    const rec = {
      id,
      walletType: "driver",
      driverId: String(req.driverId),
      amount,
      receiptFile: saved.file,
      note,
      status: "pending",
      createdAt: new Date().toISOString(),
      decidedAt: null,
      decidedBy: null,
      decisionNote: null,
    };
    data.topups.unshift(rec);
    saveTopups(data);
    res.json({ ok: true, topup: topupsLib.ownerView(rec) });
  },
);

app.get("/api/driver/topups/:id/receipt", requireDriver, (req, res) => {
  const t = (loadTopups().topups || []).find((x) => String(x.id) === String(req.params.id));
  if (!t || topupsLib.walletTypeOf(t) !== "driver" || String(t.driverId) !== String(req.driverId)) return res.status(404).json({ error: "Not found" });
  return sendReceipt(res, t);
});

app.get("/api/admin/topups", requireAdmin, (req, res) => {
  const data = loadTopups();
  const drivers = loadDrivers();
  const dById = new Map((drivers.drivers || []).map((d) => [String(d.id), d]));
  const cById = new Map((loadCustomers().customers || []).map((c) => [String(c.id), c]));
  const methods = new Map(loadPaymentMethods().map((m) => [m.id, m]));
  const list = (data.topups || []).map((t) => {
    const wt = topupsLib.walletTypeOf(t);
    const owner = wt === "customer" ? cById.get(String(t.customerId)) || {} : dById.get(String(t.driverId)) || {};
    const { receiptFile, receiptUrl, ...rest } = t; // paths never leave the server; the receipt has its own authenticated route
    const m = methods.get(t.methodId);
    return {
      ...rest,
      walletType: wt,
      hasReceipt: !!(receiptFile || receiptUrl),
      receiptUrl: receiptFile || receiptUrl ? `/api/admin/topups/${encodeURIComponent(t.id)}/receipt` : "",
      methodName: m ? (m.name.ar || m.id) : t.methodId || "",
      driverName: wt === "driver" ? owner.name || "" : "",
      driverPhone: wt === "driver" ? owner.phone || "" : "",
      driverEmail: wt === "driver" ? owner.email || "" : "",
      customerName: wt === "customer" ? [owner.firstName, owner.lastName].filter(Boolean).join(" ") || owner.email || "" : "",
      ownerName: wt === "customer" ? [owner.firstName, owner.lastName].filter(Boolean).join(" ") || owner.email || "" : owner.name || "",
      walletBalance: Number(owner.walletBalance || 0),
      driverWalletBalance: wt === "driver" ? Number(owner.walletBalance || 0) : 0,
    };
  });
  res.json({ ok: true, topups: list });
});

app.get("/api/admin/topups/:id/receipt", requireAdmin, (req, res) => {
  const t = (loadTopups().topups || []).find((x) => String(x.id) === String(req.params.id));
  if (!t) return res.status(404).json({ error: "Not found" });
  appendAuditLog({ actorType: "admin", actorId: String(req.adminId || ""), action: "topup.receipt.view", topupId: String(t.id) });
  return sendReceipt(res, t);
});

// Admin: manual wallet adjustment (credit/debit). Reason is mandatory, the
// balance can never go negative, and every adjustment is audited.
app.post("/api/admin/drivers/:id/wallet-adjust", requireAdmin, (req, res) => {
  const amount = Number(req.body?.amount);
  const reason = String(req.body?.reason || "").trim();
  if (!Number.isFinite(amount) || amount === 0)
    return res.status(400).json({ error: "Invalid amount" });
  if (reason.length < 3) return res.status(400).json({ error: "Reason required" });
  const drivers = loadDrivers();
  const d = (drivers.drivers || []).find((x) => String(x.id) === String(req.params.id));
  if (!d) return res.status(404).json({ error: "Not found" });
  const r = walletLedger.applyEntry(d, {
    ref: `adj:${genId()}`,
    type: "admin_adjust",
    amount,
    note: reason,
    actorType: "admin",
    actorId: req.adminId,
  });
  if (!r.ok) return res.status(r.code === "INSUFFICIENT_FUNDS" ? 409 : 400).json({ error: r.error, code: r.code });
  saveDrivers(drivers);
  appendAuditLog({
    actorType: "admin",
    actorId: String(req.adminId || ""),
    action: "wallet.adjust",
    driverId: String(d.id),
    amount: r.entry.amount,
    balanceAfter: r.entry.balanceAfter,
    reason: r.entry.note,
  });
  res.json({ ok: true, entry: r.entry, walletBalance: d.walletBalance });
});

// Admin: does the stored balance match the sum of the ledger entries?
app.get("/api/admin/drivers/:id/wallet-reconcile", requireAdmin, (req, res) => {
  const d = (loadDrivers().drivers || []).find((x) => String(x.id) === String(req.params.id));
  if (!d) return res.status(404).json({ error: "Not found" });
  res.json({ ok: true, ...walletLedger.reconcile(d) });
});

/***********************
 * Finance: store commission, manual settlements, statements
 * Enforced by role (see lib/admin-roles.js): system_admin and accountant.
 ***********************/
function requireFinance(req, res, next) {
  const perm = req.method === "GET" ? "finance.read" : "finance.write";
  if (!req.user || !adminRoles.can(req.adminRole, perm)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
}

// Set a store's commission. Strict validation, audited with before/after.
app.put("/api/admin/stores/:id/commission", requireAdmin, requireFinance, (req, res) => {
  const v = financeLib.validateCommission(req.body || {});
  if (!v.ok) return res.status(400).json({ error: v.error });
  const data = loadRestaurants();
  const st = data.restaurants.find((r) => String(r.id) === String(req.params.id));
  if (!st) return res.status(404).json({ error: "Not found" });
  const before = financeLib.normalizeCommission(st.commission);
  st.commission = v.value;
  saveRestaurants(data);
  appendAuditLog({
    actorType: "admin",
    actorId: String(req.adminId || ""),
    action: "store.commission",
    storeId: String(st.id),
    before,
    after: v.value,
  });
  res.json({ ok: true, commission: v.value });
});

app.get("/api/admin/stores/:id/commission", requireAdmin, requireFinance, (req, res) => {
  const st = loadRestaurants().restaurants.find((r) => String(r.id) === String(req.params.id));
  if (!st) return res.status(404).json({ error: "Not found" });
  res.json({ ok: true, commission: financeLib.normalizeCommission(st.commission) });
});

// Manual settlements (append-only; void instead of delete).
app.get("/api/admin/settlements", requireAdmin, requireFinance, (req, res) => {
  const storeId = String(req.query.storeId || "").trim();
  let list = loadSettlements().settlements;
  if (storeId) list = list.filter((x) => String(x.storeId) === storeId);
  res.json({ ok: true, settlements: list.slice(0, 500) });
});

app.post("/api/admin/settlements", requireAdmin, requireFinance, (req, res) => {
  const data = loadSettlements();
  const v = financeLib.validateSettlement(req.body || {}, data.settlements);
  if (!v.ok) return res.status(v.status || 400).json({ error: v.error });
  if (!loadRestaurants().restaurants.some((r) => String(r.id) === v.value.storeId)) {
    return res.status(404).json({ error: "Unknown store" });
  }
  const rec = {
    id: genId(),
    ...v.value,
    status: "recorded",
    createdBy: String(req.adminId || ""),
    createdAt: new Date().toISOString(),
  };
  data.settlements.unshift(rec);
  saveSettlements(data);
  appendAuditLog({
    actorType: "admin",
    actorId: String(req.adminId || ""),
    action: "settlement.create",
    storeId: rec.storeId,
    settlementId: rec.id,
    amount: rec.amount,
    direction: rec.direction,
    reference: rec.reference,
  });
  res.json({ ok: true, settlement: rec });
});

app.post("/api/admin/settlements/:id/void", requireAdmin, requireFinance, (req, res) => {
  const reason = String(req.body?.reason || "").trim();
  if (reason.length < 3) return res.status(400).json({ error: "Reason required" });
  const data = loadSettlements();
  const rec = data.settlements.find((x) => String(x.id) === String(req.params.id));
  if (!rec) return res.status(404).json({ error: "Not found" });
  if (rec.status === "void") return res.status(409).json({ error: "Already void" });
  rec.status = "void";
  rec.voidedBy = String(req.adminId || "");
  rec.voidedAt = new Date().toISOString();
  rec.voidReason = reason.slice(0, 300);
  saveSettlements(data);
  appendAuditLog({
    actorType: "admin",
    actorId: String(req.adminId || ""),
    action: "settlement.void",
    storeId: rec.storeId,
    settlementId: rec.id,
    reason: rec.voidReason,
  });
  res.json({ ok: true, settlement: rec });
});

function storeStatementFor(storeId, query) {
  const t = (v) => {
    const n = Date.parse(String(v || ""));
    return Number.isFinite(n) ? n : null;
  };
  return financeLib.statement({
    orders: loadOrders().orders,
    settlements: loadSettlements().settlements,
    storeId,
    from: t(query.from),
    to: t(query.to) !== null ? t(query.to) + 86399999 : null,
  });
}

/***********************
 * Payment methods (registry configured by an authorised supervisor)
 ***********************/
// Public list. Account details are only returned to a signed-in customer / driver for their own top-up context.
app.get("/api/payment-methods", (req, res) => {
  const context = String(req.query.context || "checkout");
  if (!paymentMethods.CONTEXTS.includes(context)) return res.status(400).json({ error: "Invalid context" });
  let includeAccount = false;
  if (context === "customerTopup") {
    const id = getCustomerIdFromToken(getCustomerTokenFromReq(req));
    if (!id) return res.status(401).json({ error: "Unauthorized" });
    includeAccount = true;
  } else if (context === "driverTopup") {
    const t = getDriverTokenFromReq(req);
    const decoded = t ? verifyToken(t) : null;
    if (!decoded || decoded.role !== "driver") return res.status(401).json({ error: "Unauthorized" });
    includeAccount = true;
  }
  const methods = loadPaymentMethods()
    .filter((m) => m.contexts && m.contexts[context])
    .map((m) => paymentMethods.publicView(m, context, { includeAccount }));
  res.set("Cache-Control", "no-store");
  res.json({ ok: true, context, methods });
});

app.get("/api/admin/payment-methods", requireAdmin, (req, res) => {
  res.json({ ok: true, methods: loadPaymentMethods(), stripeUnavailableLabel: paymentMethods.STRIPE_UNAVAILABLE_LABEL });
});

app.put("/api/admin/payment-methods/:id", requireAdmin, (req, res) => {
  const list = loadPaymentMethods();
  const cur = list.find((m) => m.id === String(req.params.id));
  if (!cur) return res.status(404).json({ error: "Not found" });
  const expected = req.body && req.body.expectedVersion;
  if (expected !== undefined && Number(expected) !== Number(cur.version || 1)) {
    return res.status(409).json({ error: "Changed by someone else; reload", code: "VERSION_CONFLICT", version: cur.version || 1 });
  }
  const r = paymentMethods.applyUpdate(cur, req.body);
  if (!r.ok) return res.status(r.status).json({ error: r.error, code: r.code, ...(r.context ? { context: r.context } : {}) });
  const next = list.map((m) => (m.id === cur.id ? r.value : m));
  savePaymentMethods(next);
  appendAuditLog({
    actorType: "admin",
    actorId: String(req.adminId || ""),
    action: "payment.config.update",
    methodId: cur.id,
    changed: paymentMethods.changeSummary(cur, r.value), // account numbers are masked, never logged in full
  });
  res.json({ ok: true, method: r.value });
});

/***********************
 * Discount codes
 ***********************/
const promoLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `promo:${req.ip}`,
});

// Customer: preview what a code would give for this basket (amount computed here).
app.post("/api/promo/preview", promoLimiter, (req, res) => {
  const body = req.body || {};
  const token = getCustomerTokenFromReq(req);
  const customerId = getCustomerIdFromToken(token) || null;
  const code = promoLib.normalizeCode(body.code);
  const rid = String(body.restaurantId || "").trim() || getDefaultRestaurantId();
  const store = rid ? getRestaurantById(rid) : null;
  if (!code || !store) return res.status(400).json({ error: "Invalid request", code: "BAD_REQUEST" });
  const byId = new Map(
    (loadMenu().items || []).filter((it) => String(it.restaurantId || "") === String(rid)).map((it) => [String(it.id), it]),
  );
  const lines = (Array.isArray(body.items) ? body.items : [])
    .map((it) => ({ id: String(it.id || ""), qty: Number(it.qty || 0) }))
    .filter((x) => x.id && Number.isFinite(x.qty) && x.qty > 0)
    .slice(0, 100);
  const pricing = catalogLib.computePricing({ store, lines, byId, nameOf: () => "" });
  if (!pricing.ok) return res.status(pricing.status || 400).json({ error: pricing.error });
  const promo = loadPromos().promos.find((p) => p.code === code);
  const ev = promoLib.evaluate({
    promo,
    subtotal: pricing.subtotal,
    eligibleSubtotal: promoLib.eligibleSubtotal(pricing.items, byId, promo && promo.categories),
    customerId,
    storeId: rid,
    orders: loadOrders().orders,
  });
  if (!ev.ok) return res.status(ev.status).json({ error: ev.error, code: ev.code, ...(ev.minSubtotal ? { minSubtotal: ev.minSubtotal } : {}) });
  res.json({ ok: true, code, discount: ev.amount, subtotal: pricing.subtotal });
});

const promoView = (p, orders) => ({ ...p, ...promoLib.usage(p.id, orders, null) });

app.get("/api/admin/promos", requireAdmin, (req, res) => {
  const orders = loadOrders().orders;
  res.json({ ok: true, promos: loadPromos().promos.map((p) => promoView(p, orders)) });
});

app.post("/api/admin/promos", requireAdmin, (req, res) => {
  const v = promoLib.validateDefinition(req.body);
  if (!v.ok) return res.status(400).json({ error: v.error, code: v.code });
  const data = loadPromos();
  if (data.promos.some((p) => p.code === v.value.code)) return res.status(409).json({ error: "Code already exists", code: "EXISTS" });
  const now = new Date().toISOString();
  const rec = { id: makeId(), isActive: true, storeIds: [], maxDiscount: null, minSubtotal: null, maxUses: null, maxUsesPerCustomer: 1, startsAt: null, endsAt: null, ...v.value, createdAt: now, updatedAt: now, createdBy: String(req.adminId || "") };
  data.promos.unshift(rec);
  savePromos(data);
  appendAuditLog({ actorType: "admin", actorId: String(req.adminId || ""), action: "promo.create", promoId: rec.id, code: rec.code });
  res.json({ ok: true, promo: promoView(rec, loadOrders().orders) });
});

// Existing orders keep their snapshot; only code/type/value are frozen once used.
app.patch("/api/admin/promos/:id", requireAdmin, (req, res) => {
  const data = loadPromos();
  const cur = data.promos.find((p) => String(p.id) === String(req.params.id));
  if (!cur) return res.status(404).json({ error: "Not found" });
  const orders = loadOrders().orders;
  const used = promoLib.usage(cur.id, orders, null).total > 0;
  const body = { ...(req.body || {}) };
  if (used) for (const k of ["code", "type", "value"]) delete body[k];
  const v = promoLib.validateDefinition({ type: cur.type, ...body }, { partial: true });
  if (!v.ok) return res.status(400).json({ error: v.error, code: v.code });
  if (v.value.code && data.promos.some((p) => p.code === v.value.code && p.id !== cur.id)) return res.status(409).json({ error: "Code already exists", code: "EXISTS" });
  Object.assign(cur, v.value, { updatedAt: new Date().toISOString() });
  savePromos(data);
  appendAuditLog({ actorType: "admin", actorId: String(req.adminId || ""), action: "promo.update", promoId: cur.id, changed: Object.keys(v.value) });
  res.json({ ok: true, promo: promoView(cur, orders) });
});

app.get("/api/admin/stores/:id/statement", requireAdmin, requireFinance, (req, res) => {
  const st = loadRestaurants().restaurants.find((r) => String(r.id) === String(req.params.id));
  if (!st) return res.status(404).json({ error: "Not found" });
  res.json({ ok: true, storeId: String(st.id), commission: financeLib.normalizeCommission(st.commission), ...storeStatementFor(st.id, req.query) });
});

// Review a transfer request. The ONLY place a top-up credits a wallet.
// Synchronous end to end (no await between the status change and the ledger write), so two
// simultaneous approvals cannot interleave; the ledger ref `topup:<id>` is the second line of defence.
app.patch("/api/admin/topups/:id", requireAdmin, (req, res) => {
  const id = String(req.params.id || "");
  const data = loadTopups();
  const idx = (data.topups || []).findIndex((t) => String(t.id) === id);
  if (idx < 0) return res.status(404).json({ error: "Not found" });
  const topup = data.topups[idx];
  const wt = topupsLib.walletTypeOf(topup);

  // Load the target wallet BEFORE deciding, so a missing owner cannot leave an approved-but-uncredited request.
  const walletData = wt === "customer" ? loadCustomers() : loadDrivers();
  const list = wt === "customer" ? walletData.customers : walletData.drivers;
  const owner = (list || []).find((x) => String(x.id) === topupsLib.ownerIdOf(topup));
  if (!owner) return res.status(409).json({ error: "Wallet owner not found", code: "OWNER_MISSING" });

  const r = topupsLib.decide(topup, {
    to: req.body?.status,
    by: req.adminId || "admin",
    reason: req.body?.reason || req.body?.note || req.body?.decisionNote,
    confirmedReference: req.body?.confirmedReference,
  });
  if (!r.ok) return res.status(r.status).json({ error: r.error, code: r.code });

  if (r.credit) {
    const e = walletLedger.applyEntry(owner, {
      ref: topupsLib.ledgerRef(topup),
      type: "topup",
      amount: Number(topup.amount || 0),
      topupId: topup.id,
      note: topup.decisionNote || "Top-up confirmed",
      actorType: "admin",
      actorId: req.adminId,
      at: topup.decidedAt,
    });
    if (!e.ok) {
      topup.status = "pending"; // nothing was written yet: undo the in-memory decision
      topup.decidedAt = topup.decidedBy = topup.decisionNote = null;
      return res.status(409).json({ error: e.error, code: e.code });
    }
    if (wt === "customer") saveCustomers(walletData);
    else saveDrivers(walletData);
  }
  data.topups[idx] = topup;
  saveTopups(data);

  appendAuditLog({
    actorType: "admin",
    actorId: String(req.adminId || ""),
    action: "topup.review",
    topupId: id,
    walletType: wt,
    ownerId: topupsLib.ownerIdOf(topup),
    methodId: topup.methodId || "",
    to: topup.status,
    amount: topup.amount,
    reason: topup.decisionNote || "",
  });
  if (wt === "customer") {
    try {
      notifyCustomerSimple({
        customerId: topup.customerId,
        type: "wallet_topup",
        title: "المحفظة",
        message:
          topup.status === "approved"
            ? `تم تأكيد شحن محفظتك بمبلغ ${topup.amount} ✅`
            : `تعذّر تأكيد شحن محفظتك بمبلغ ${topup.amount}: ${topup.decisionNote || ""}`,
      });
    } catch (_e) {}
  }
  res.json({ ok: true, topup });
});

// ---- customer wallet (separate ledger from the driver wallet) ----
function customerById(data, id) {
  return (data.customers || []).find((c) => String(c.id) === String(id));
}

app.get("/api/customer/wallet", requireCustomer, (req, res) => {
  const data = loadCustomers();
  const c = customerById(data, req.customerId);
  if (!c) return res.status(404).json({ error: "Not found" });
  const mine = (loadTopups().topups || [])
    .filter((t) => topupsLib.walletTypeOf(t) === "customer" && String(t.customerId) === String(req.customerId))
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
    .slice(0, 50)
    .map(topupsLib.ownerView);
  res.json({
    ok: true,
    walletBalance: Number(c.walletBalance || 0),
    walletHistory: (Array.isArray(c.walletHistory) ? c.walletHistory : []).slice(0, 50),
    topups: mine,
    currency: loadConfig().currency || "MAD",
  });
});

app.post("/api/customer/wallet/topups", requireCustomer, topupLimiter, (req, res) => {
  const c = customerById(loadCustomers(), req.customerId);
  if (!c) return res.status(404).json({ error: "Not found" });
  const r = createTransferRequest({ walletType: "customer", ownerId: req.customerId, body: req.body });
  if (!r.ok) return res.status(r.status).json(r.body);
  appendAuditLog({ actorType: "customer", actorId: String(req.customerId), action: "topup.request", topupId: r.topup.id, methodId: r.topup.methodId, amount: r.topup.amount });
  try { notifyCustomerSimple({ customerId: req.customerId, type: "wallet_topup", title: "المحفظة", message: `طلب شحن ${r.topup.amount} قيد المراجعة` }); } catch (_e) {}
  res.json({ ok: true, topup: topupsLib.ownerView(r.topup) });
});

app.get("/api/customer/wallet/topups/:id/receipt", requireCustomer, (req, res) => {
  const t = (loadTopups().topups || []).find((x) => String(x.id) === String(req.params.id));
  if (!t || topupsLib.walletTypeOf(t) !== "customer" || String(t.customerId) !== String(req.customerId)) return res.status(404).json({ error: "Not found" });
  return sendReceipt(res, t);
});

/***********************
 * Admin - drivers review
 ***********************/
app.get("/api/admin/drivers", requireAdmin, (req, res) => {
  const data = loadDrivers();
  const allOrders = loadOrders().orders || [];
  const drivers = data.drivers.map((d) => {
    const { password, ...rest } = d;
    rest.ratingStats = driverFeedback.summarize(allOrders, d.id);
    return rest;
  });
  res.json({ ok: true, drivers });
});

// Admin: secure access to driver ID images (stored privately on disk)
app.get("/api/admin/drivers/:id/image/:kind", requireAdmin, (req, res) => {
  const id = String(req.params.id || "");
  const kind = String(req.params.kind || "");
  if (!id) return res.status(400).json({ error: "Missing id" });
  if (!["faceWithBikeCard", "idFront", "idBack", "license"].includes(kind)) {
    return res.status(400).json({ error: "Invalid kind" });
  }
  const data = loadDrivers();
  const d = (data.drivers || []).find((x) => String(x.id) === id);
  if (!d) return res.status(404).json({ error: "Not found" });

  const file = d?.images?.[kind];
  if (!file || typeof file !== "string")
    return res.status(404).json({ error: "No image" });

  // Prevent path traversal
  const safe = path.basename(file);
  const abs = path.join(PRIVATE_DRIVER_ID_DIR, safe);
  if (!fs.existsSync(abs))
    return res.status(404).json({ error: "Missing file" });

  const ext = safe.split(".").pop()?.toLowerCase();
  const mime =
    ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";

  // Every view of a private identity document is audited (who, which driver, which file).
  appendAuditLog({
    actorType: "admin",
    actorId: String(req.adminId || ""),
    action: "driver.document.view",
    driverId: id,
    kind,
  });
  res.setHeader("Content-Type", mime);
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.sendFile(abs);
});

app.patch("/api/admin/stores/:id/review", requireAdmin, (req, res) => {
  const id = String(req.params.id);
  const data = loadRestaurants();
  const idx = data.restaurants.findIndex((x) => String(x.id) === id);
  if (idx < 0) return res.status(404).json({ error: "Not found" });
  const s = data.restaurants[idx];
  const r = storeReview.applyReview(s, {
    to: req.body?.status,
    by: req.adminId,
    reason: req.body?.reason,
  });
  if (!r.ok) {
    return res.status(r.status).json({
      error: r.error,
      code: r.code,
      ...(r.missing ? { missing: r.missing } : {}),
    });
  }
  saveRestaurants(data);

  let handled = { cancelled: [], flagged: [] };
  if (r.leftApproved) {
    const od = loadOrders();
    handled = storeReview.handleSuspension(od.orders, id, {
      by: req.adminId,
      reason: s.review?.reason,
    });
    if (handled.cancelled.length || handled.flagged.length) {
      const nowIso = new Date().toISOString();
      const byId = new Map(od.orders.map((o) => [String(o.id), o]));
      for (const oid of handled.cancelled) {
        const o = byId.get(oid);
        try {
          financeLib.finalize(o, new Date(nowIso));
          refundOrderWallet(o);
        } catch (_e) {}
      }
      saveOrders(od);
      try {
        const menu = loadMenu();
        let ch = false;
        for (const oid of handled.cancelled)
          if (catalogLib.restoreStock(menu, byId.get(oid).items)) ch = true;
        if (ch) saveMenu(menu);
      } catch (_e) {}
      for (const oid of handled.cancelled) {
        try {
          createCustomerOrderStatusNotification({
            customerId: byId.get(oid).customerId,
            orderId: oid,
            stage: "canceled",
          });
        } catch (_e) {}
      }
    }
  }

  appendAuditLog({
    actorType: "admin",
    actorId: String(req.adminId || ""),
    action: "store.review",
    storeId: id,
    from: r.from,
    to: r.to,
    reason: s.review?.reason || "",
    cancelled: handled.cancelled,
    inProgress: handled.flagged,
  });
  res.json({
    ok: true,
    restaurant: { ...safeRestaurant(s), hasPassword: !!s.password },
    cancelled: handled.cancelled,
    inProgress: handled.flagged,
  });
});

app.patch("/api/admin/drivers/:id", requireAdmin, (req, res) => {
  const id = String(req.params.id);
  const data = loadDrivers();
  const idx = data.drivers.findIndex((d) => String(d.id) === id);
  if (idx < 0) return res.status(404).json({ error: "Not found" });

  const d = data.drivers[idx];
  const r = driverReview.applyReview(d, {
    to: req.body?.status,
    by: req.adminId,
    reason: req.body?.reason,
  });
  if (!r.ok) {
    return res.status(r.status).json({
      error: r.error,
      code: r.code,
      ...(r.missing ? { missing: r.missing } : {}),
    });
  }
  saveDrivers(data);

  // Losing approval: safely release / flag the driver's active orders.
  let handled = { released: [], keptActive: [] };
  if (r.leftApproved) {
    const od = loadOrders();
    handled = driverReview.handleSuspension(od.orders, id, { by: req.adminId });
    if (handled.released.length || handled.keptActive.length) saveOrders(od);
    for (const oid of handled.released) {
      try {
        dispatchService.resetOrder(oid, "driver_suspended");
      } catch (_e) {}
    }
    try {
      dispatchService.setStatus(id, "offline"); // cancels this driver's pending offers
    } catch (_e) {}
  }

  appendAuditLog({
    actorType: "admin",
    actorId: String(req.adminId || ""),
    action: "driver.review",
    driverId: id,
    from: r.from,
    to: r.to,
    reason: d.review?.reason || "",
    released: handled.released,
    inDelivery: handled.keptActive,
  });
  const { password, ...rest } = d;
  res.json({
    ok: true,
    driver: rest,
    warnings: r.warnings,
    released: handled.released,
    inDelivery: handled.keptActive,
  });
});

/***********************
 * Admin auth endpoints
 ***********************/

// Create first admin (public) OR create more admins (requires admin token)
app.post(
  "/api/admin/signup",
  validate([
    body("email").isEmail().normalizeEmail(),
    body("phone").trim().isLength({ min: 7, max: 25 }),
    body("password").isLength({ min: 6, max: 128 }),
    body("password2").optional().isLength({ max: 128 }),
    body("passwordConfirm").optional().isLength({ max: 128 }),
  ]),
  (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const phone = String(req.body?.phone || "").replace(/\D/g, "");
    const password = String(req.body?.password || "");
    const password2 = String(
      req.body?.password2 || req.body?.passwordConfirm || "",
    );

    if (!email || !email.includes("@"))
      return res.status(400).json({ error: "Invalid email" });
    if (!phone || phone.length < 8)
      return res.status(400).json({ error: "Invalid phone" });
    if (!password || password.length < 6)
      return res.status(400).json({ error: "Password too short (min 6)" });
    if (!password2) return res.status(400).json({ error: "Confirm password" });
    if (password2 !== password)
      return res.status(400).json({ error: "Passwords do not match" });

    const admins = loadAdmins();
    const hasAdmins = admins.admins.length > 0;
    if (hasAdmins) {
      const token = getAdminTokenFromReq(req);
      if (!isValidToken(token))
        return res.status(403).json({ error: "Signup disabled" });
      // A restricted staff role must never be able to mint a new admin.
      const dec = decodeAdminToken(token);
      const who = dec ? resolveAdminRole(dec.id) : { ok: false };
      if (!who.ok || who.role !== adminRoles.FULL)
        return res.status(403).json({ error: "Forbidden" });
    }

    const exists = admins.admins.some((a) => normalizeEmail(a.email) === email);
    if (exists) return res.status(409).json({ error: "Email already exists" });

    const existsPhone = admins.admins.some(
      (a) => String(a.phone || "").replace(/\D/g, "") === phone,
    );
    if (existsPhone)
      return res.status(409).json({ error: "Phone already exists" });

    const pwd = hashPassword(password);
    const adminId = makeId();
    admins.admins.push({
      id: adminId,
      email,
      phone,
      password: pwd,
      role: adminRoles.FULL,
      createdAt: new Date().toISOString(),
    });
    saveAdmins(admins);

    const token = issueToken(adminId);
    const rt = issueRefreshToken({
      userType: "admin",
      userId: adminId,
      role: "admin",
      meta: { ip: req.ip || "", ua: String(req.headers["user-agent"] || "") },
    });
    res.json({
      ok: true,
      token,
      refreshToken: rt.refreshToken,
      admin: { email, phone },
    });
  },
);

// Login with email + phone + password// Login with email + phone + password
// Backward compatibility: if there are no admins yet, login with legacy config.adminPassword is accepted.
app.post(
  "/api/admin/login",
  loginSlowdown,
  loginLimiter,
  validate([
    body("email").optional().normalizeEmail(),
    body("phone").optional().trim().isLength({ max: 25 }),
    body("identifier")
      .optional()
      .customSanitizer(stripDangerous)
      .isLength({ max: 80 }),
    body("password").optional().isLength({ max: 128 }),
  ]),
  (req, res) => {
    let email = normalizeEmail(req.body?.email);
    let phone = String(req.body?.phone || "").replace(/\D/g, "");
    const identifier = String(
      req.body?.identifier || req.body?.id || "",
    ).trim();
    const password = String(req.body?.password || "");

    // Support: login with a single field (email OR phone)
    if (identifier && !email && !phone) {
      if (identifier.includes("@")) email = normalizeEmail(identifier);
      else phone = String(identifier).replace(/\D/g, "");
    }

    if (!password) return res.status(400).json({ error: "Missing password" });

    const admins = loadAdmins();

    // legacy password-only (only if no admins exist)
    if ((admins.admins || []).length === 0) {
      const cfg = loadConfig();
      if (password && password === cfg.adminPassword) {
        const token = issueToken("legacy");
        const rt = issueRefreshToken({
          userType: "admin",
          userId: "legacy",
          role: "admin",
          meta: {
            legacy: true,
            ip: req.ip || "",
            ua: String(req.headers["user-agent"] || ""),
          },
        });
        return res.json({
          ok: true,
          token,
          refreshToken: rt.refreshToken,
          admin: { email: "legacy@local", phone: "" },
        });
      }
    }

    if (!email && !phone)
      return res.status(400).json({ error: "Missing email/phone" });

    let found = null;
    if (email) {
      if (!email.includes("@"))
        return res.status(400).json({ error: "Invalid email" });
      found =
        admins.admins.find((a) => normalizeEmail(a.email) === email) || null;
    } else {
      if (phone.length < 8)
        return res.status(400).json({ error: "Invalid phone" });
      found =
        admins.admins.find(
          (a) => String(a.phone || "").replace(/\D/g, "") === phone,
        ) || null;
    }

    if (!found) return res.status(401).json({ error: "Wrong credentials" });

    // If both were provided, enforce match.
    if (email && phone) {
      const storedPhone = String(found.phone || "").replace(/\D/g, "");
      if (storedPhone !== phone)
        return res.status(401).json({ error: "Wrong credentials" });
    }

    if (!verifyPassword(password, found.password))
      return res.status(401).json({ error: "Wrong credentials" });
    if (found.disabled) return res.status(401).json({ error: "Wrong credentials" });

    // If this account used the legacy pbkdf2 format, upgrade to bcrypt on successful login
    if (isLegacyPasswordRecord(found.password)) {
      found.password = hashPassword(password);
      found.updatedAt = new Date().toISOString();
      saveAdmins(admins);
    }

    const token = issueToken(found.id);
    const rt = issueRefreshToken({
      userType: "admin",
      userId: found.id,
      role: "admin",
      meta: { ip: req.ip || "", ua: String(req.headers["user-agent"] || "") },
    });
    return res.json({
      ok: true,
      token,
      refreshToken: rt.refreshToken,
      admin: { email: found.email, phone: found.phone },
    });
  },
);

/***********************
 * Staff accounts & roles (system_admin only: not listed in the role rules)
 ***********************/
const publicStaff = (a) => ({
  id: String(a.id),
  email: String(a.email || ""),
  phone: String(a.phone || ""),
  name: String(a.name || ""),
  role: adminRoles.normalizeRole(a.role) || "invalid",
  disabled: a.disabled === true,
  createdAt: a.createdAt || null,
});
const activeSystemAdmins = (admins) =>
  admins.filter((a) => !a.disabled && adminRoles.normalizeRole(a.role) === adminRoles.FULL);

app.get("/api/admin/staff", requireAdmin, (req, res) => {
  res.json({ ok: true, roles: adminRoles.ROLES, staff: (loadAdmins().admins || []).map(publicStaff) });
});

app.post("/api/admin/staff", requireAdmin, (req, res) => {
  const b = req.body || {};
  const email = normalizeEmail(b.email);
  const phone = String(b.phone || "").replace(/\D/g, "");
  const password = String(b.password || "");
  const role = String(b.role || "");
  if (!email || !email.includes("@")) return res.status(400).json({ error: "Invalid email" });
  if (phone.length < 8) return res.status(400).json({ error: "Invalid phone" });
  if (password.length < 8 || password.length > 128) return res.status(400).json({ error: "Password must be 8-128 characters" });
  if (!adminRoles.ROLES.includes(role)) return res.status(400).json({ error: "Invalid role" });
  const data = loadAdmins();
  if (data.admins.some((a) => normalizeEmail(a.email) === email)) return res.status(409).json({ error: "Email already exists" });
  if (data.admins.some((a) => String(a.phone || "").replace(/\D/g, "") === phone)) return res.status(409).json({ error: "Phone already exists" });
  const rec = {
    id: makeId(),
    email,
    phone,
    name: String(b.name || "").trim().slice(0, 80),
    password: hashPassword(password),
    role,
    createdAt: new Date().toISOString(),
    createdBy: String(req.adminId || ""),
  };
  data.admins.push(rec);
  saveAdmins(data);
  appendAuditLog({
    actorType: "admin",
    actorId: String(req.adminId || ""),
    action: "staff.create",
    targetId: rec.id,
    role,
  });
  res.json({ ok: true, staff: publicStaff(rec) });
});

// Change role / disable. You cannot change your OWN role or status, and the
// last active system_admin can never be demoted or disabled.
app.patch("/api/admin/staff/:id", requireAdmin, (req, res) => {
  const id = String(req.params.id);
  const b = req.body || {};
  const data = loadAdmins();
  const rec = data.admins.find((a) => String(a.id) === id);
  if (!rec) return res.status(404).json({ error: "Not found" });
  const wantsRole = b.role !== undefined;
  const wantsDisable = b.disabled !== undefined;
  if ((wantsRole || wantsDisable) && id === String(req.adminId)) {
    return res.status(403).json({ error: "You cannot change your own role or status" });
  }
  const before = publicStaff(rec);
  if (wantsRole) {
    if (!adminRoles.ROLES.includes(String(b.role))) return res.status(400).json({ error: "Invalid role" });
    rec.role = String(b.role);
  }
  if (wantsDisable) rec.disabled = b.disabled === true;
  if (b.name !== undefined) rec.name = String(b.name || "").trim().slice(0, 80);
  if (activeSystemAdmins(data.admins).length === 0) {
    return res.status(409).json({ error: "At least one active system_admin is required" });
  }
  rec.updatedAt = new Date().toISOString();
  saveAdmins(data);
  appendAuditLog({
    actorType: "admin",
    actorId: String(req.adminId || ""),
    action: "staff.update",
    targetId: id,
    before,
    after: publicStaff(rec),
  });
  res.json({ ok: true, staff: publicStaff(rec) });
});

/***********************
 * Admin data endpoints
 ***********************/
app.get("/api/orders", requireAdmin, (req, res) => {
  const data = loadOrders();
  res.json({ ok: true, orders: data.orders });
});

app.get("/api/orders/:id", requireAdmin, (req, res) => {
  const id = String(req.params.id);
  const data = loadOrders();
  const found = data.orders.find((o) => o.id === id);
  if (!found) return res.status(404).json({ error: "Not found" });
  res.json({ ok: true, order: found });
});

// Supervisor exception: let ONE verification stage pass without the code
// (customer unreachable, no connectivity, ...). Reason is mandatory and audited.
app.post("/api/admin/orders/:id/verify-exception", requireAdmin, (req, res) => {
  const id = String(req.params.id);
  const stage = String(req.body?.stage || "");
  const data = loadOrders();
  const order = data.orders.find((o) => String(o.id) === id);
  if (!order) return res.status(404).json({ error: "Not found" });
  if (!verifyCodes.STAGES.includes(stage))
    return res.status(400).json({ error: "stage must be pickup or delivery" });
  if (["done", "canceled", "cancelled"].includes(String(order.status)))
    return res.status(409).json({ error: "Order is closed" });
  const r = verifyCodes.grantException(order, stage, {
    by: req.adminId,
    reason: req.body?.reason,
  });
  if (!r.ok) return res.status(400).json({ error: r.error });
  order.updatedAt = new Date().toISOString();
  saveOrders(data);
  appendAuditLog({
    actorType: "admin",
    actorId: String(req.adminId || ""),
    action: "order.verify_exception",
    orderId: id,
    stage,
    reason: order.verify[stage].exception.reason,
  });
  res.json({ ok: true });
});

app.patch("/api/orders/:id", requireAdmin, (req, res) => {
  const id = String(req.params.id);
  const patch = req.body || {};
  const data = loadOrders();
  const idx = data.orders.findIndex((o) => o.id === id);
  if (idx < 0) return res.status(404).json({ error: "Not found" });

  const order = data.orders[idx];
  const prevStatus = String(order.status || "new");

  // Assign / unassign driver (admin dispatch)
  if (patch.driverId !== undefined) {
    const nextDriverId = String(patch.driverId || "").trim();

    // Unassign
    if (!nextDriverId) {
      order.driverId = null;
      if (String(order.status || "new") === "accepted") {
        // revert back to restaurant_ready so it can be dispatched again
        orderState.recordEvent(order, {
          from: order.status,
          to: "restaurant_ready",
          actorType: "admin",
          actorId: req.adminId,
        });
        order.status = "restaurant_ready";
        order.acceptedAt = null;
      }
      order.updatedAt = new Date().toISOString();
    } else {
      const st = String(order.status || "new");
      if (st !== "restaurant_ready") {
        return res.status(409).json({ error: "Order not ready for driver" });
      }

      // Validate driver
      const drivers = loadDrivers();
      const drv = drivers.drivers.find((d) => String(d.id) === nextDriverId);
      if (!drv) return res.status(400).json({ error: "Invalid driverId" });
      if (String(drv.status || "pending") !== "approved") {
        return res.status(400).json({ error: "Driver not approved" });
      }

      // Only allow reassignment if it's the same driver
      const current = String(order.driverId || "");
      if (current && current !== nextDriverId) {
        return res.status(409).json({ error: "Cannot reassign order" });
      }

      order.driverId = nextDriverId;
      order.assignedAt = new Date().toISOString();
      // Keep status as "restaurant_ready" until the driver accepts
      if (!order.status || st === "sent") order.status = "restaurant_ready";
      order.updatedAt = new Date().toISOString();
    }
  }

  // status (admin -> restaurant -> driver -> customer)
  if (patch.status) {
    const st = String(patch.status || "");
    const allowed = [
      "new",
      "admin_accepted",
      "restaurant_ready",
      "accepted",
      "picked_up",
      "on_the_way",
      "delivered",
      "canceled",
      "sent",
      "done",
    ];
    if (allowed.includes(st)) {
      if (st === "restaurant_ready") {
        return res.status(400).json({
          ok: false,
          error: "forbidden_status",
          message: "Only the restaurant can send the order to drivers.",
        });
      }
      const atr = orderState.checkAdminTransition(order.status, st);
      if (!atr.ok) {
        return res.status(409).json({ error: atr.error, code: atr.code });
      }
      if (!atr.noop) {
        // A supervisor cannot silently skip verification: use the audited exception.
        const stage = st === "picked_up" ? "pickup" : st === "delivered" ? "delivery" : null;
        if (stage && verifyCodes.isRequired(order, stage)) {
          return res.status(409).json({
            error: "Verification required: verify the code or record an exception first",
            code: "VERIFICATION_REQUIRED",
            stage,
          });
        }
        orderState.recordEvent(order, {
          from: order.status,
          to: st,
          actorType: "admin",
          actorId: req.adminId,
        });
        order.status = st;
      }

      if (st === "admin_accepted")
        order.adminAcceptedAt =
          order.adminAcceptedAt || new Date().toISOString();
      if (st === "restaurant_ready")
        order.restaurantReadyAt =
          order.restaurantReadyAt || new Date().toISOString();
      if (st === "delivered" || st === "done")
        order.deliveredAt = order.deliveredAt || new Date().toISOString();
    }
  }

  // editable customer fields (optional)
  if (patch.customer && typeof patch.customer === "object") {
    const c = patch.customer;
    if (c.name !== undefined) order.customer.name = String(c.name || "");
    if (c.phone !== undefined) order.customer.phone = String(c.phone || "");
    if (c.addr !== undefined) order.customer.addr = String(c.addr || "");
    if (c.notes !== undefined) order.customer.notes = String(c.notes || "");
  }

  // editable items (for receipt corrections)
  if (Array.isArray(patch.items)) {
    const cleaned = patch.items
      .map((it) => ({
        id: String(it.id || it.name || ""),
        name: String(it.name || it.id || ""),
        qty: Number(it.qty || 0),
        price: Number(it.price || 0),
      }))
      .filter(
        (it) =>
          it.name &&
          Number.isFinite(it.qty) &&
          it.qty > 0 &&
          Number.isFinite(it.price) &&
          it.price >= 0,
      );

    if (cleaned.length === 0) {
      return res.status(400).json({ error: "Empty items" });
    }

    order.items = cleaned;
    // recompute subtotal from items
    order.subtotal = cleaned.reduce((sum, it) => sum + it.qty * it.price, 0);
    order.editedAt = new Date().toISOString();
    order.edited = true;
  } else if (patch.subtotal !== undefined) {
    const s = Number(patch.subtotal || 0);
    if (Number.isFinite(s) && s >= 0) order.subtotal = s;
  }

  // delivery fee
  if (patch.deliveryFee !== undefined) {
    const fee = Number(patch.deliveryFee || 0);
    order.deliveryFee =
      Number.isFinite(fee) && fee >= 0 ? fee : order.deliveryFee;
  }

  // recompute total
  order.total = promoLib.totalOf(order);
  financeLib.refresh(order, driverEarnings.earningOf(order));
  financeLib.finalize(order); // delivered / cancelled by a supervisor
  refundOrderWallet(order);

  data.orders[idx] = order;

  // Auto customer notification: admin accepted
  try {
    const nextStatus = String(order.status || "new");
    if (nextStatus !== prevStatus && nextStatus === "admin_accepted") {
      createCustomerOrderStatusNotification({
        customerId: order.customerId,
        orderId: order.id,
        stage: "admin_accepted",
      });
    }
  } catch (_e) {}

  saveOrders(data);

  res.json(order);
});

/***********************
 * Reports / Analytics (Admin)
 ***********************/

app.get("/api/admin/stats", requireAdmin, (req, res) => {
  const restaurantId = String(req.query.restaurantId || "").trim() || null;
  const stats = computeOrderStats({ restaurantId });
  res.json({ ok: true, restaurantId, stats });
});

app.get("/api/admin/reports/orders.csv", requireAdmin, (req, res) => {
  const restaurantId = String(req.query.restaurantId || "").trim() || null;
  const data = loadOrders();
  const orders = (data.orders || []).filter((o) => {
    if (restaurantId && String(o.restaurantId || "") !== restaurantId)
      return false;
    return true;
  });
  const csv = ordersToCsv(orders);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=orders.csv");
  res.send(csv);
});

/***********************
 * Restaurant endpoints
 ***********************/
app.post(
  "/api/restaurant/login",
  loginSlowdown,
  loginLimiter,
  validate([
    body("email").optional().normalizeEmail(),
    body("phone").optional().trim().isLength({ max: 25 }),
    body("identifier")
      .optional()
      .customSanitizer(stripDangerous)
      .isLength({ max: 80 }),
    body("password").optional().isLength({ max: 128 }),
  ]),
  (req, res) => {
    ensureSeedData();
    const email = normalizeEmail(req.body?.email);
    const phone = String(req.body?.phone || "").replace(/\D/g, "");
    const identifier = String(
      req.body?.identifier || req.body?.id || "",
    ).trim();
    const password = String(req.body?.password || "");

    if (!email && !phone && !identifier)
      return res.status(400).json({ error: "Missing email or phone" });
    if (email && !email.includes("@"))
      return res.status(400).json({ error: "Invalid email" });
    if (phone && phone.length < 8)
      return res.status(400).json({ error: "Invalid phone" });
    if (!password) return res.status(400).json({ error: "Missing password" });

    const r = loadRestaurants();
    const identKey = identifier ? identifier.toLowerCase() : "";
    const rest = r.restaurants.find((x) => {
      const le = normalizeEmail(x.loginEmail || "");
      const lp = String(x.loginPhone || "").replace(/\D/g, "");
      if ((email && le && le === email) || (phone && lp && lp === phone))
        return true;
      if (!identKey) return false;
      const idKey = String(x.id || "").toLowerCase();
      const n = x.name || {};
      const nAr = String(n.ar || "").toLowerCase();
      const nEn = String(n.en || "").toLowerCase();
      const nFr = String(n.fr || "").toLowerCase();
      return (
        idKey === identKey ||
        nAr === identKey ||
        nEn === identKey ||
        nFr === identKey
      );
    });

    if (!rest) return res.status(401).json({ error: "Invalid credentials" });
    if (rest.isActive === false)
      return res.status(403).json({ error: "Restaurant disabled" });
    if (!rest.password)
      return res.status(403).json({ error: "Restaurant password not set" });
    if (!verifyPassword(password, rest.password))
      return res.status(401).json({ error: "Invalid credentials" });

    // If this account used the legacy pbkdf2 format, upgrade to bcrypt on successful login
    if (isLegacyPasswordRecord(rest.password)) {
      rest.password = hashPassword(password);
      rest.updatedAt = new Date().toISOString();
      saveRestaurants(r);
    }

    const token = issueRestaurantToken(rest.id);
    const rt = issueRefreshToken({
      userType: "restaurant",
      userId: rest.id,
      role: "restaurant",
      restaurantId: rest.id,
      meta: { ip: req.ip || "", ua: String(req.headers["user-agent"] || "") },
    });
    res.json({
      ok: true,
      token,
      refreshToken: rt.refreshToken,
      restaurant: safeRestaurant(rest),
    });
  },
);

// Restaurant staff login (Owner/Manager/Cashier)
app.post(
  "/api/restaurant-user/login",
  loginSlowdown,
  loginLimiter,
  validate([
    body("restaurantId")
      .customSanitizer(stripDangerous)
      .isLength({ min: 1, max: 80 }),
    body("email").optional().normalizeEmail(),
    body("phone").optional().trim().isLength({ max: 25 }),
    body("identifier")
      .optional()
      .customSanitizer(stripDangerous)
      .isLength({ max: 120 }),
    body("password").optional().isLength({ max: 128 }),
  ]),
  (req, res) => {
    ensureSeedData();
    const restaurantId = String(req.body?.restaurantId || "").trim();
    const identifier = String(req.body?.identifier || "").trim();
    let email = normalizeEmail(req.body?.email);
    let phone = String(req.body?.phone || "").replace(/\D/g, "");
    const password = String(req.body?.password || "");

    if (!restaurantId)
      return res.status(400).json({ error: "Missing restaurantId" });
    if (!password) return res.status(400).json({ error: "Missing password" });

    // Support: login with a single field (email OR phone)
    if (identifier && !email && !phone) {
      if (identifier.includes("@")) email = normalizeEmail(identifier);
      else phone = String(identifier).replace(/\D/g, "");
    }
    if (!email && !phone)
      return res.status(400).json({ error: "Missing email/phone" });

    const users = loadRestaurantUsers();
    let found = null;
    if (email)
      found =
        (users.users || []).find(
          (u) =>
            String(u.restaurantId) === restaurantId &&
            normalizeEmail(u.email) === email,
        ) || null;
    if (!found && phone)
      found =
        (users.users || []).find(
          (u) =>
            String(u.restaurantId) === restaurantId &&
            String(u.phone || "").replace(/\D/g, "") === phone,
        ) || null;
    if (!found) return res.status(401).json({ error: "Wrong credentials" });
    if (found.isActive === false)
      return res.status(403).json({ error: "User disabled" });
    if (!verifyPassword(password, found.password))
      return res.status(401).json({ error: "Wrong credentials" });

    if (isLegacyPasswordRecord(found.password)) {
      found.password = hashPassword(password);
      found.updatedAt = new Date().toISOString();
      saveRestaurantUsers(users);
    }

    const token = issueRestaurantUserToken(found);
    const rt = issueRefreshToken({
      userType: "restaurant_user",
      userId: found.id,
      role: "restaurant_user",
      restaurantId,
      meta: { ip: req.ip || "", ua: String(req.headers["user-agent"] || "") },
    });
    res.json({
      ok: true,
      token,
      refreshToken: rt.refreshToken,
      user: safeRestaurantUser(found),
    });
  },
);

app.get("/api/restaurant-user/me", requireRestaurantUser(), (req, res) => {
  res.json({
    ok: true,
    restaurantId: req.restaurantId,
    user: req.restaurantUser,
  });
});

app.get("/api/restaurant/me", requireRestaurant, (req, res) => {
  res.json({ ok: true, restaurant: safeRestaurant(req.restaurant) });
});

app.get("/api/restaurant/stats", requireRestaurant, (req, res) => {
  const stats = computeOrderStats({ restaurantId: req.restaurantId });
  res.json({
    ok: true,
    restaurantId: req.restaurantId,
    plan: getPlanForRestaurant(req.restaurant),
    stats,
  });
});

app.get("/api/restaurant/reports/orders.csv", requireRestaurant, (req, res) => {
  const data = loadOrders();
  const orders = (data.orders || []).filter(
    (o) => String(o.restaurantId || "") === String(req.restaurantId),
  );
  const csv = ordersToCsv(orders);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=orders.csv");
  res.send(csv);
});

app.get("/api/restaurant/orders", requireRestaurant, (req, res) => {
  const data = loadOrders();
  const mine = data.orders.filter(
    (o) =>
      String(o.restaurantId || "") === String(req.restaurantId) &&
      String(o.status || "new") !== "new",
  );
  const drivers = loadDrivers();
  const byId = new Map((drivers.drivers || []).map((d) => [String(d.id), d]));
  const enhanced = mine.map((o) => {
    const { verify: _v, ...out } = o;
    const pc = verifyCodes.pickupCodeForStore(VERIFY_SECRET, o);
    if (pc) out.pickupCode = pc; // shown to the store only; give it to the driver at pickup
    const did = String(o.driverId || "");
    if (did) {
      const d = byId.get(did) || null;
      out.driver = d
        ? {
            id: String(d.id),
            name: String(d.name || ""),
            phone: String(d.phone || ""),
          }
        : { id: did, name: "", phone: "" };
    }
    return out;
  });
  res.json({ ok: true, orders: enhanced });
});

app.patch("/api/restaurant/orders/:id", requireRestaurant, (req, res) => {
  const id = String(req.params.id);
  const patch = req.body || {};
  const data = loadOrders();
  const idx = data.orders.findIndex((o) => String(o.id) === id);
  if (idx < 0) return res.status(404).json({ error: "Not found" });

  const order = data.orders[idx];
  const prevStatus = String(order.status || "new");
  if (String(order.restaurantId || "") !== String(req.restaurantId)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const st = String(order.status || "new");

  // 1) Restaurant can mark ready
  if (patch.status !== undefined) {
    const next = String(patch.status || "");
    if (next !== "restaurant_ready") {
      return res
        .status(400)
        .json({ error: "Only restaurant_ready is allowed" });
    }
    if (st !== "admin_accepted" && st !== "restaurant_ready") {
      return res.status(409).json({ error: "Order not ready for restaurant" });
    }

    order.status = "restaurant_ready";
    order.restaurantReadyAt =
      order.restaurantReadyAt || new Date().toISOString();
    order.updatedAt = new Date().toISOString();
  }

  // 2) Restaurant can edit receipt BEFORE driver accepts
  // Allowed only when order is still between admin_accepted -> restaurant_ready.
  const wantsEdit =
    patch.items !== undefined ||
    patch.deliveryFee !== undefined ||
    patch.subtotal !== undefined;
  if (wantsEdit) {
    if (st !== "admin_accepted" && st !== "restaurant_ready") {
      return res
        .status(409)
        .json({ error: "Order can only be edited before driver accepts" });
    }

    // items
    if (Array.isArray(patch.items)) {
      const cleaned = patch.items
        .map((it) => ({
          id: String(it.id || it.name || ""),
          name: String(it.name || it.id || ""),
          qty: Number(it.qty || 0),
          price: Number(it.price || 0),
        }))
        .filter(
          (it) =>
            it.name &&
            Number.isFinite(it.qty) &&
            it.qty > 0 &&
            Number.isFinite(it.price) &&
            it.price >= 0,
        );

      if (cleaned.length === 0) {
        return res.status(400).json({ error: "Empty items" });
      }
      order.items = cleaned;
      order.subtotal = cleaned.reduce((sum, it) => sum + it.qty * it.price, 0);
      order.editedAt = new Date().toISOString();
      order.edited = true;
    } else if (patch.subtotal !== undefined) {
      // Allow overriding subtotal only if items exist (rare case)
      const s = Number(patch.subtotal || 0);
      if (Number.isFinite(s) && s >= 0) order.subtotal = s;
    }

    // delivery fee
    if (patch.deliveryFee !== undefined) {
      const fee = Number(patch.deliveryFee || 0);
      order.deliveryFee =
        Number.isFinite(fee) && fee >= 0 ? fee : order.deliveryFee;
    }
  }

  // recompute total
  order.total = promoLib.totalOf(order);
  financeLib.refresh(order, driverEarnings.earningOf(order));

  data.orders[idx] = order;

  // Auto customer notification: restaurant started preparing / sent to drivers
  try {
    const nextStatus = String(order.status || "new");
    if (nextStatus !== prevStatus && nextStatus === "restaurant_ready") {
      createCustomerOrderStatusNotification({
        customerId: order.customerId,
        orderId: order.id,
        stage: "restaurant_ready",
      });
    }
  } catch (_e) {}

  saveOrders(data);
  try {
    if (
      String(order.status || "") === "restaurant_ready" &&
      !order.driverId &&
      dispatchService.settings().auto
    ) {
      dispatchService.dispatchOrder(order.id, { actor: "system" });
    }
  } catch (_e) {}
  res.json(order);
});

// Restaurant confirms that the driver has taken the order (manual notify step)
app.post(
  "/api/restaurant/orders/:id/driver_taken",
  requireRestaurant,
  (req, res) => {
    const id = String(req.params.id);
    const data = loadOrders();
    const idx = data.orders.findIndex((o) => String(o.id) === id);
    if (idx < 0) return res.status(404).json({ error: "Not found" });

    const order = data.orders[idx];
    const prevStatus = String(order.status || "new");
    if (String(order.restaurantId || "") !== String(req.restaurantId)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const st = String(order.status || "new");
    if (!order.driverId)
      return res.status(409).json({ error: "No driver assigned" });

    // only allow while it's still in dispatch stage
    if (st !== "restaurant_ready" && st !== "accepted") {
      return res.status(409).json({ error: "Order not in dispatch stage" });
    }

    order.status = "accepted";
    order.acceptedAt = order.acceptedAt || new Date().toISOString();
    order.restaurantDriverTakenAt =
      order.restaurantDriverTakenAt || new Date().toISOString();
    order.updatedAt = new Date().toISOString();

    data.orders[idx] = order;

    // Auto customer notification: driver taken (manual step)
    try {
      const nextStatus = String(order.status || "new");
      if (nextStatus !== prevStatus && nextStatus === "accepted") {
        createCustomerOrderStatusNotification({
          customerId: order.customerId,
          orderId: order.id,
          stage: "accepted",
        });
      }
    } catch (_e) {}

    saveOrders(data);
    res.json({ ok: true, order });
  },
);

// Wi‑Fi printing hardening
const WIFI_PRINT_ALLOW_OVERRIDE =
  String(process.env.WIFI_PRINT_ALLOW_OVERRIDE || "0").trim() === "1";

function isPrivateIpv4(ip) {
  const s = String(ip || "").trim();
  const m = s.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const a = m.slice(1).map((x) => Number(x));
  if (a.some((n) => !Number.isFinite(n) || n < 0 || n > 255)) return false;
  // 10.0.0.0/8
  if (a[0] === 10) return true;
  // 172.16.0.0/12
  if (a[0] === 172 && a[1] >= 16 && a[1] <= 31) return true;
  // 192.168.0.0/16
  if (a[0] === 192 && a[1] === 168) return true;
  return false;
}

function resolveWifiPrinterTarget(cfg, body) {
  const fallbackIp = String(cfg.wifiPrinter?.ip || "").trim();
  const fallbackPort = Number(cfg.wifiPrinter?.port || 9100);

  const reqIp = String(body?.printerIp || "").trim();
  const reqPort = Number(body?.printerPort || 0);

  const ip = WIFI_PRINT_ALLOW_OVERRIDE ? reqIp || fallbackIp : fallbackIp;
  const port = WIFI_PRINT_ALLOW_OVERRIDE
    ? reqPort || fallbackPort
    : fallbackPort;

  const p = Number(port || 0);
  if (!ip) return { ok: false, error: "Missing printer IP" };
  if (!Number.isFinite(p) || p < 1 || p > 65535)
    return { ok: false, error: "Invalid printer port" };
  if (!isPrivateIpv4(ip))
    return {
      ok: false,
      error:
        "Printer IP must be a private IPv4 (10.x / 172.16-31.x / 192.168.x)",
    };
  return { ok: true, ip, port: p };
}

// Restaurant Wi‑Fi printing (same as admin printing, but scoped to its own orders)
app.post("/api/restaurant/print/wifi", requireRestaurant, async (req, res) => {
  const cfg = loadConfig();
  if (cfg.wifiPrintEnabled === false)
    return res.status(403).json({ error: "Wi-Fi printing is disabled" });

  const { orderId } = req.body || {};
  const target = resolveWifiPrinterTarget(cfg, req.body);
  if (!target.ok) return res.status(400).json({ error: target.error });
  const { ip, port } = target;

  const data = loadOrders();
  const order = data.orders.find((o) => String(o.id) === String(orderId));
  if (!order) return res.status(404).json({ error: "Order not found" });
  if (String(order.restaurantId || "") !== String(req.restaurantId)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const buf = escposReceipt(order, cfg);
  try {
    await sendToPrinter(ip, port, buf);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Print failed: " + e.message });
  }
});

// Restaurant menu management (restaurant can add/edit its own products)
app.get("/api/restaurant/menu", requireRestaurant, (req, res) => {
  ensureSeedData();
  const m = loadMenu();
  const mine = m.items.filter(
    (it) => String(it.restaurantId || "") === String(req.restaurantId),
  );
  res.json({ ok: true, items: mine });
});

app.post("/api/restaurant/menu", requireRestaurant, (req, res) => {
  ensureSeedData();
  const body = req.body || {};
  const name = asI18nText(body.name || "");
  const desc = asI18nText(body.desc || "");
  const cat = String(body.cat || "general").trim() || "general";
  const catLabel = asI18nText(body.catLabel || cat, cat);
  const price = Number(body.price || 0);
  const img = String(body.img || body.image || "").trim();
  const isAvailable = body.isAvailable !== false;

  const baseName = name.ar || name.en || name.fr;
  if (!baseName) return res.status(400).json({ error: "Missing name" });
  if (!Number.isFinite(price) || price < 0)
    return res.status(400).json({ error: "Invalid price" });

  const m = loadMenu();
  const item = {
    id: makeId(),
    restaurantId: String(req.restaurantId),
    name,
    desc,
    cat,
    catLabel,
    price,
    img,
    isAvailable,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  m.items.unshift(item);
  saveMenu(m);
  res.json({ ok: true, item });
});

app.put("/api/restaurant/menu/:id", requireRestaurant, (req, res) => {
  ensureSeedData();
  const id = String(req.params.id);
  const body = req.body || {};
  const m = loadMenu();
  const idx = m.items.findIndex((it) => String(it.id) === id);
  if (idx < 0) return res.status(404).json({ error: "Not found" });
  const cur = m.items[idx];
  if (String(cur.restaurantId || "") !== String(req.restaurantId)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (body.name !== undefined)
    cur.name = asI18nText(body.name, cur.name?.ar || "");
  if (body.desc !== undefined)
    cur.desc = asI18nText(body.desc, cur.desc?.ar || "");
  if (body.cat !== undefined)
    cur.cat = String(body.cat || "general").trim() || "general";
  if (body.catLabel !== undefined)
    cur.catLabel = asI18nText(body.catLabel || cur.cat, cur.cat);
  if (body.price !== undefined) {
    const price = Number(body.price || 0);
    if (!Number.isFinite(price) || price < 0)
      return res.status(400).json({ error: "Invalid price" });
    cur.price = price;
  }
  if (body.img !== undefined || body.image !== undefined)
    cur.img = String(body.img || body.image || "").trim();
  if (body.isAvailable !== undefined)
    cur.isAvailable = body.isAvailable !== false;

  cur.updatedAt = new Date().toISOString();
  m.items[idx] = cur;
  saveMenu(m);
  res.json({ ok: true, item: cur });
});

app.delete("/api/restaurant/menu/:id", requireRestaurant, (req, res) => {
  ensureSeedData();
  const id = String(req.params.id);
  const m = loadMenu();
  const idx = m.items.findIndex((it) => String(it.id) === id);
  if (idx < 0) return res.status(404).json({ error: "Not found" });
  const cur = m.items[idx];
  if (String(cur.restaurantId || "") !== String(req.restaurantId)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  m.items.splice(idx, 1);
  saveMenu(m);
  res.json({ ok: true });
});

// Restaurants management
app.get("/api/admin/plans", requireAdmin, (req, res) => {
  const data = loadPlans();
  res.json({ ok: true, plans: data.plans || defaultPlans() });
});

app.put("/api/admin/plans", requireAdmin, (req, res) => {
  const body = req.body || {};
  if (!body || typeof body !== "object")
    return res.status(400).json({ error: "Invalid payload" });
  // Expect: { plans: { Basic: {...}, Pro: {...}, ... } }
  const plans =
    body.plans && typeof body.plans === "object" ? body.plans : null;
  if (!plans) return res.status(400).json({ error: "Missing plans" });
  savePlans({ plans });
  res.json({ ok: true, plans });
});

app.get("/api/admin/restaurants", requireAdmin, (req, res) => {
  ensureSeedData();
  const r = loadRestaurants();
  const list = (r.restaurants || []).map((x) => ({
    ...safeRestaurant(x),
    hasPassword: !!x.password,
  }));
  res.json({ ok: true, restaurants: list });
});

app.post("/api/admin/restaurants", requireAdmin, storeTypeGuard, (req, res) => {
  ensureSeedData();
  const body = req.body || {};
  const name = asI18nText(body.name || body.nameText || body.title || "");
  if (!name.ar || !name.en || !name.fr) {
    // ensure not empty
    const base = name.ar || name.en || name.fr;
    if (!base)
      return res.status(400).json({ error: "Missing restaurant name" });
  }
  const r = loadRestaurants();
  const id = String(body.id || makeId());
  if (r.restaurants.some((x) => String(x.id) === id)) {
    return res.status(409).json({ error: "Restaurant id exists" });
  }
  const rest = {
    id,
    name,
    phone: String(body.phone || "").trim(),
    address: String(body.address || "").trim(),
    logo: cleanImgUrl(body.logo),
    cover: cleanImgUrl(body.cover),
    isActive: body.isActive !== false,

    // SaaS subscription fields
    ownerId: body.ownerId ? String(body.ownerId) : null,
    subscriptionPlan: String(body.subscriptionPlan || "Basic"),
    subscriptionStatus: String(body.subscriptionStatus || "active"),
    subscriptionRenewsAt: body.subscriptionRenewsAt
      ? String(body.subscriptionRenewsAt)
      : null,
    subscriptionProvider: body.subscriptionProvider
      ? String(body.subscriptionProvider)
      : null,
    subscriptionMeta:
      body.subscriptionMeta && typeof body.subscriptionMeta === "object"
        ? body.subscriptionMeta
        : {},

    // Restaurant login (optional)
    loginEmail: normalizeEmail(body.loginEmail || ""),
    loginPhone: String(body.loginPhone || "").replace(/\D/g, ""),
    password: body.password ? hashPassword(String(body.password)) : null,

    createdAt: new Date().toISOString(),
    ...catalogLib.pickStoreMeta(body, asI18nText, cleanImgUrl),
  };

  // Validate plan id
  const plans = loadPlans().plans || defaultPlans();
  if (!plans[String(rest.subscriptionPlan || "")])
    rest.subscriptionPlan = "Basic";
  const st = String(rest.subscriptionStatus || "active").toLowerCase();
  rest.subscriptionStatus = ["active", "past_due", "canceled"].includes(st)
    ? st
    : "active";

  // New stores enter the review queue: hidden and not orderable until approved.
  storeReview.initPending(rest, { by: req.adminId });
  appendAuditLog({
    actorType: "admin",
    actorId: String(req.adminId || ""),
    action: "store.created",
    storeId: id,
  });

  r.restaurants.unshift(rest);
  saveRestaurants(r);
  res.json({
    ok: true,
    restaurant: { ...safeRestaurant(rest), hasPassword: !!rest.password },
  });
});

app.put("/api/admin/restaurants/:id", requireAdmin, storeTypeGuard, (req, res) => {
  ensureSeedData();
  const id = String(req.params.id);
  const body = req.body || {};
  const r = loadRestaurants();
  const idx = r.restaurants.findIndex((x) => String(x.id) === id);
  if (idx < 0) return res.status(404).json({ error: "Not found" });
  const cur = r.restaurants[idx];
  if (body.name !== undefined)
    cur.name = asI18nText(body.name, cur.name?.ar || "");
  if (body.phone !== undefined) cur.phone = String(body.phone || "").trim();
  if (body.address !== undefined)
    cur.address = String(body.address || "").trim();
  if (body.isActive !== undefined) cur.isActive = body.isActive !== false;
  if (body.logo !== undefined) cur.logo = cleanImgUrl(body.logo);
  if (body.cover !== undefined) cur.cover = cleanImgUrl(body.cover);
  if (body.loginEmail !== undefined)
    cur.loginEmail = normalizeEmail(body.loginEmail || "");
  if (body.loginPhone !== undefined)
    cur.loginPhone = String(body.loginPhone || "").replace(/\D/g, "");
  if (body.password !== undefined) {
    const p = String(body.password || "");
    if (p) cur.password = hashPassword(p);
  }
  if (body.clearPassword === true) cur.password = null;
  Object.assign(cur, catalogLib.pickStoreMeta(body, asI18nText, cleanImgUrl));
  // Publishing is decided only by the review workflow: a store that is not
  // approved can never be switched on through a plain edit.
  if (storeReview.statusOf(cur) !== "approved") {
    cur.status = "unpublished";
    cur.isActive = false;
  }

  // SaaS subscription fields
  if (body.ownerId !== undefined)
    cur.ownerId = body.ownerId ? String(body.ownerId) : null;
  if (body.subscriptionPlan !== undefined) {
    const plans = loadPlans().plans || defaultPlans();
    const pid = String(body.subscriptionPlan || "Basic");
    cur.subscriptionPlan = plans[pid] ? pid : "Basic";
  }
  if (body.subscriptionStatus !== undefined) {
    const st = String(body.subscriptionStatus || "active").toLowerCase();
    cur.subscriptionStatus = ["active", "past_due", "canceled"].includes(st)
      ? st
      : cur.subscriptionStatus;
  }
  if (body.subscriptionRenewsAt !== undefined)
    cur.subscriptionRenewsAt = body.subscriptionRenewsAt
      ? String(body.subscriptionRenewsAt)
      : null;
  if (body.subscriptionProvider !== undefined)
    cur.subscriptionProvider = body.subscriptionProvider
      ? String(body.subscriptionProvider)
      : null;
  if (body.subscriptionMeta !== undefined)
    cur.subscriptionMeta =
      body.subscriptionMeta && typeof body.subscriptionMeta === "object"
        ? body.subscriptionMeta
        : cur.subscriptionMeta;

  r.restaurants[idx] = cur;
  saveRestaurants(r);
  res.json({
    ok: true,
    restaurant: { ...safeRestaurant(cur), hasPassword: !!cur.password },
  });
});

app.delete("/api/admin/restaurants/:id", requireAdmin, (req, res) => {
  ensureSeedData();
  const id = String(req.params.id);
  const r = loadRestaurants();
  const hasOrders = (loadOrders().orders || []).some(
    (o) => String(o.restaurantId || "") === id,
  );
  if (hasOrders) {
    return res.status(409).json({
      error: "Restaurant has orders; archive it instead (status: archived)",
    });
  }
  const before = r.restaurants.length;
  r.restaurants = r.restaurants.filter((x) => String(x.id) !== id);
  if (r.restaurants.length === before)
    return res.status(404).json({ error: "Not found" });
  saveRestaurants(r);
  // cascade remove menu items
  const m = loadMenu();
  m.items = (m.items || []).filter(
    (it) => String(it.restaurantId || "") !== id,
  );
  saveMenu(m);
  res.json({ ok: true });
});

// Restaurant staff (tenant RBAC)
app.get("/api/admin/restaurant-users", requireAdmin, (req, res) => {
  const restaurantId = String(req.query.restaurantId || "").trim();
  const data = loadRestaurantUsers();
  let users = (data.users || []).map(safeRestaurantUser);
  if (restaurantId)
    users = users.filter((u) => String(u.restaurantId) === restaurantId);
  res.json({ ok: true, users });
});

app.post(
  "/api/admin/restaurant-users",
  requireAdmin,
  validate([
    body("restaurantId")
      .customSanitizer(stripDangerous)
      .isLength({ min: 1, max: 80 }),
    body("email").optional().isEmail().normalizeEmail(),
    body("phone").optional().trim().isLength({ max: 25 }),
    body("password").isLength({ min: 6, max: 128 }),
    body("role")
      .optional()
      .customSanitizer(stripDangerous)
      .isLength({ max: 30 }),
  ]),
  (req, res) => {
    ensureSeedData();
    const restaurantId = String(req.body?.restaurantId || "").trim();
    const r = loadRestaurants();
    if (!(r.restaurants || []).some((x) => String(x.id) === restaurantId)) {
      return res.status(400).json({ error: "Invalid restaurantId" });
    }

    const email = normalizeEmail(req.body?.email);
    const phone = String(req.body?.phone || "").replace(/\D/g, "");
    const password = String(req.body?.password || "");
    const role = String(req.body?.role || "owner").toLowerCase();
    if (!email && !phone)
      return res.status(400).json({ error: "Missing email or phone" });
    if (!["owner", "manager", "cashier"].includes(role))
      return res.status(400).json({ error: "Invalid role" });

    const data = loadRestaurantUsers();
    const exists = (data.users || []).some(
      (u) =>
        String(u.restaurantId) === restaurantId &&
        ((email && normalizeEmail(u.email) === email) ||
          (phone && String(u.phone || "").replace(/\D/g, "") === phone)),
    );
    if (exists) return res.status(409).json({ error: "User already exists" });

    const rec = {
      id: makeId(),
      restaurantId,
      email: email || null,
      phone: phone || null,
      role,
      isActive: true,
      password: hashPassword(password),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    data.users.unshift(rec);
    saveRestaurantUsers(data);
    res.json({ ok: true, user: safeRestaurantUser(rec) });
  },
);

app.patch("/api/admin/restaurant-users/:id", requireAdmin, (req, res) => {
  const id = String(req.params.id || "");
  const body = req.body || {};
  const data = loadRestaurantUsers();
  const idx = (data.users || []).findIndex((u) => String(u.id) === id);
  if (idx < 0) return res.status(404).json({ error: "Not found" });
  const cur = data.users[idx];

  if (body.isActive !== undefined) cur.isActive = body.isActive !== false;
  if (body.role !== undefined) {
    const role = String(body.role || cur.role).toLowerCase();
    if (!["owner", "manager", "cashier"].includes(role))
      return res.status(400).json({ error: "Invalid role" });
    cur.role = role;
  }
  if (body.password !== undefined) {
    const p = String(body.password || "");
    if (p && p.length >= 6) cur.password = hashPassword(p);
  }
  cur.updatedAt = new Date().toISOString();
  data.users[idx] = cur;
  saveRestaurantUsers(data);
  res.json({ ok: true, user: safeRestaurantUser(cur) });
});

// Menu items management
app.get("/api/admin/menu", requireAdmin, (req, res) => {
  ensureSeedData();
  const m = loadMenu();
  res.json({ ok: true, items: m.items });
});

app.post("/api/admin/menu", requireAdmin, (req, res) => {
  ensureSeedData();
  const body = req.body || {};
  const restaurantId = String(body.restaurantId || "").trim();
  if (!restaurantId)
    return res.status(400).json({ error: "Missing restaurantId" });

  const r = loadRestaurants();
  if (!r.restaurants.some((x) => String(x.id) === restaurantId)) {
    return res.status(400).json({ error: "Invalid restaurantId" });
  }

  const name = asI18nText(body.name || "");
  const desc = asI18nText(body.desc || body.description || "");
  const cat = String(body.cat || body.category || "").trim() || "general";
  const catLabel = asI18nText(body.catLabel || body.categoryLabel || cat);
  const price = Number(body.price || 0);
  if (!name.ar && !name.en && !name.fr)
    return res.status(400).json({ error: "Missing item name" });
  if (!Number.isFinite(price) || price < 0)
    return res.status(400).json({ error: "Invalid price" });

  const m = loadMenu();
  const id = String(body.id || makeId());
  if (m.items.some((x) => String(x.id) === id))
    return res.status(409).json({ error: "Item id exists" });

  const item = {
    id,
    restaurantId,
    cat,
    catLabel,
    price,
    img: String(body.img || body.image || "").trim(),
    name,
    desc,
    isAvailable: body.isAvailable !== false,
    createdAt: new Date().toISOString(),
    ...catalogLib.pickItemMeta(body),
  };
  m.items.unshift(item);
  saveMenu(m);
  res.json({ ok: true, item });
});

app.put("/api/admin/menu/:id", requireAdmin, (req, res) => {
  ensureSeedData();
  const id = String(req.params.id);
  const body = req.body || {};
  const m = loadMenu();
  const idx = m.items.findIndex((x) => String(x.id) === id);
  if (idx < 0) return res.status(404).json({ error: "Not found" });
  const cur = m.items[idx];
  if (body.restaurantId !== undefined)
    cur.restaurantId = String(body.restaurantId || cur.restaurantId);
  if (body.cat !== undefined || body.category !== undefined)
    cur.cat = String(body.cat || body.category || cur.cat);
  if (body.catLabel !== undefined || body.categoryLabel !== undefined)
    cur.catLabel = asI18nText(body.catLabel || body.categoryLabel, cur.cat);
  if (body.name !== undefined)
    cur.name = asI18nText(body.name, cur.name?.ar || "");
  if (body.desc !== undefined || body.description !== undefined)
    cur.desc = asI18nText(body.desc || body.description, "");
  if (body.price !== undefined) {
    const p = Number(body.price);
    if (Number.isFinite(p) && p >= 0) cur.price = p;
  }
  if (body.img !== undefined || body.image !== undefined)
    cur.img = String(body.img || body.image || "").trim();
  if (body.isAvailable !== undefined)
    cur.isAvailable = body.isAvailable !== false;
  Object.assign(cur, catalogLib.pickItemMeta(body));
  cur.updatedAt = new Date().toISOString();
  m.items[idx] = cur;
  saveMenu(m);
  res.json({ ok: true, item: cur });
});

app.delete("/api/admin/menu/:id", requireAdmin, (req, res) => {
  ensureSeedData();
  const id = String(req.params.id);
  const m = loadMenu();
  const before = m.items.length;
  m.items = m.items.filter((x) => String(x.id) !== id);
  if (m.items.length === before)
    return res.status(404).json({ error: "Not found" });
  saveMenu(m);
  res.json({ ok: true });
});

app.get("/api/config", requireAdmin, (req, res) => {
  const cfg = loadConfig();
  res.json({
    couriers: cfg.couriers || [],
    wifiPrinter: cfg.wifiPrinter || { ip: "", port: 9100 },
    wifiPrintEnabled: cfg.wifiPrintEnabled !== false,
    restaurantMode: cfg.restaurantMode || "auto",

    bankAccountName: adminRoles.can(req.adminRole, "finance.read") ? cfg.bankAccountName || "" : "",
    bankAccount: adminRoles.can(req.adminRole, "finance.read") ? cfg.bankAccount || "" : "",
    companyPolicy:
      cfg.companyPolicy && typeof cfg.companyPolicy === "object"
        ? {
            ar: String(cfg.companyPolicy.ar || ""),
            en: String(cfg.companyPolicy.en || ""),
            fr: String(cfg.companyPolicy.fr || ""),
          }
        : { ar: "", en: "", fr: "" },
    companyPolicyRequireAccept: cfg.companyPolicyRequireAccept !== false,
    companyPolicyUpdatedAt: cfg.companyPolicyUpdatedAt || null,

    driverWalletEnabled: cfg.driverWalletEnabled !== false,
    driverWalletChargeMode: cfg.driverWalletChargeMode || "subtotal",
    driverCommissionPerOrder: Number(cfg.driverCommissionPerOrder || 0),
    deliveryPricing: deliveryPricing.settingsFromConfig(cfg),
    driverEarnings: driverEarnings.settingsFromConfig(cfg),

    offersBanners: Array.isArray(cfg.offersBanners) ? cfg.offersBanners : [],
  });
});

// Values that PUT /api/config can change, grouped for the audit trail. Personal/secret data is reduced
// (courier numbers -> count, policy text -> length); account numbers are masked by the audit store itself.
function configAuditViews(cfg) {
  const pol = cfg.companyPolicy && typeof cfg.companyPolicy === "object" ? cfg.companyPolicy : {};
  return {
    delivery_pricing: deliveryPricing.settingsFromConfig(cfg),
    driver_earnings: driverEarnings.settingsFromConfig(cfg),
    general: {
      couriersCount: Array.isArray(cfg.couriers) ? cfg.couriers.length : 0,
      wifiPrinter: { ip: String((cfg.wifiPrinter && cfg.wifiPrinter.ip) || ""), port: Number((cfg.wifiPrinter && cfg.wifiPrinter.port) || 9100) },
      wifiPrintEnabled: cfg.wifiPrintEnabled !== false,
      restaurantMode: cfg.restaurantMode || "auto",
      bankAccountName: String(cfg.bankAccountName || ""),
      bankAccount: String(cfg.bankAccount || ""),
      driverWalletEnabled: cfg.driverWalletEnabled !== false,
      driverWalletChargeMode: cfg.driverWalletChargeMode || "subtotal",
      driverCommissionPerOrder: Number(cfg.driverCommissionPerOrder || 0),
      companyPolicyRequireAccept: cfg.companyPolicyRequireAccept !== false,
      companyPolicyChars: { ar: String(pol.ar || "").length, fr: String(pol.fr || "").length, en: String(pol.en || "").length },
      offersBannersCount: Array.isArray(cfg.offersBanners) ? cfg.offersBanners.length : 0,
    },
  };
}

app.put("/api/config", requireAdmin, (req, res) => {
  const cfg = loadConfig();
  const body = req.body || {};
  const beforeViews = configAuditViews(cfg);

  if (Array.isArray(body.couriers))
    cfg.couriers = body.couriers
      .map((x) => String(x).replace(/\D/g, ""))
      .filter(Boolean);
  if (body.wifiPrinter) {
    const nextIp = String(
      body.wifiPrinter.ip || cfg.wifiPrinter.ip || "",
    ).trim();
    const nextPort = Number(
      body.wifiPrinter.port || cfg.wifiPrinter.port || 9100,
    );
    if (nextIp && !isPrivateIpv4(nextIp)) {
      return res.status(400).json({
        error:
          "Printer IP must be a private IPv4 (10.x / 172.16-31.x / 192.168.x)",
      });
    }
    if (!Number.isFinite(nextPort) || nextPort < 1 || nextPort > 65535) {
      return res.status(400).json({ error: "Invalid printer port" });
    }
    cfg.wifiPrinter = { ip: nextIp, port: nextPort };
  }
  if (body.wifiPrintEnabled !== undefined) {
    cfg.wifiPrintEnabled = body.wifiPrintEnabled !== false;
  }
  if (body.restaurantMode !== undefined) {
    const mode = String(body.restaurantMode || "auto").toLowerCase();
    cfg.restaurantMode = ["auto", "open", "closed"].includes(mode)
      ? mode
      : "auto";
  }
  if (body.bankAccountName !== undefined)
    cfg.bankAccountName = String(body.bankAccountName || "");
  if (body.bankAccount !== undefined)
    cfg.bankAccount = String(body.bankAccount || "");
  if (body.driverWalletEnabled !== undefined)
    cfg.driverWalletEnabled = body.driverWalletEnabled !== false;
  if (body.driverWalletChargeMode !== undefined) {
    const m = String(body.driverWalletChargeMode || "subtotal").toLowerCase();
    cfg.driverWalletChargeMode = ["subtotal", "total", "commission"].includes(m)
      ? m
      : "subtotal";
  }
  if (body.driverCommissionPerOrder !== undefined) {
    const c = Number(body.driverCommissionPerOrder || 0);
    cfg.driverCommissionPerOrder = Number.isFinite(c) && c >= 0 ? c : 0;
  }

  // Delivery pricing (flat | distance). Out-of-range values are rejected.
  {
    const dpv = deliveryPricing.validateUpdate(body);
    if (!dpv.ok) return res.status(400).json({ error: dpv.error });
    if (Object.keys(dpv.values).length) {
      Object.assign(cfg, dpv.values);
    }
  }

  // Driver earnings per delivery (delivery_fee | formula). Strict bounds.
  {
    const dev = driverEarnings.validateUpdate(body);
    if (!dev.ok) return res.status(400).json({ error: dev.error });
    if (Object.keys(dev.values).length) {
      Object.assign(cfg, dev.values);
    }
  }

  // Offer banners
  if (body.offersBanners !== undefined) {
    const arr = Array.isArray(body.offersBanners) ? body.offersBanners : [];
    // keep only safe relative URLs under /uploads/banners
    cfg.offersBanners = arr
      .map((x) => String(x || "").trim())
      .filter((x) => x && x.startsWith("/uploads/banners/"))
      .slice(0, 20);
  }

  // Company policy settings
  if (body.companyPolicyRequireAccept !== undefined) {
    cfg.companyPolicyRequireAccept = body.companyPolicyRequireAccept !== false;
  }
  if (body.companyPolicy && typeof body.companyPolicy === "object") {
    const prev =
      cfg.companyPolicy && typeof cfg.companyPolicy === "object"
        ? cfg.companyPolicy
        : {};
    const next = {
      ar: String(body.companyPolicy.ar || ""),
      en: String(body.companyPolicy.en || ""),
      fr: String(body.companyPolicy.fr || ""),
    };
    const prevN = {
      ar: String(prev.ar || ""),
      en: String(prev.en || ""),
      fr: String(prev.fr || ""),
    };
    const changed =
      next.ar !== prevN.ar || next.en !== prevN.en || next.fr !== prevN.fr;
    cfg.companyPolicy = next;
    if (changed) cfg.companyPolicyUpdatedAt = new Date().toISOString();
  }
  // Audit BEFORE saving (fail-closed): every group that changed gets an intent record with previous/new
  // values; if the audit store cannot be written the settings are NOT saved.
  const afterViews = configAuditViews(cfg);
  const actor = { id: String(req.adminId || ""), role: adminRoles.normalizeRole(req.adminRole) || "", ip: req.ip || "" };
  const changedGroups = Object.keys(afterViews).filter((g) => settingsCenter.changedKeys(beforeViews[g], afterViews[g]).length);
  const intents = {};
  for (const g of changedGroups) {
    intents[g] = settingsCenter.begin(actor, g, beforeViews[g], { next: afterViews[g], via: "PUT /api/config" });
    if (!intents[g]) return res.status(503).json({ error: "Audit log unavailable; settings were NOT saved" });
  }
  try {
    // Persist like before, but never write the (env-provided or default) admin password into config.json.
    const raw = readJson(CONFIG_FILE, {}) || {};
    const toSave = { ...cfg };
    if (Object.prototype.hasOwnProperty.call(raw, "adminPassword")) toSave.adminPassword = raw.adminPassword;
    else delete toSave.adminPassword;
    writeJson(CONFIG_FILE, toSave);
  } catch (e) {
    for (const g of changedGroups) settingsCenter.finish(intents[g], actor, g, beforeViews[g], null, e);
    return res.status(500).json({ error: "Could not save settings" });
  }
  for (const g of changedGroups) settingsCenter.finish(intents[g], actor, g, beforeViews[g], afterViews[g]);
  invalidateLimits();
  res.json({
    couriers: cfg.couriers,
    wifiPrinter: cfg.wifiPrinter,
    wifiPrintEnabled: cfg.wifiPrintEnabled !== false,
    restaurantMode: cfg.restaurantMode || "auto",
    deliveryPricing: deliveryPricing.settingsFromConfig(cfg),
    driverEarnings: driverEarnings.settingsFromConfig(cfg),

    bankAccountName: cfg.bankAccountName || "",
    bankAccount: cfg.bankAccount || "",

    driverWalletEnabled: cfg.driverWalletEnabled !== false,
    driverWalletChargeMode: cfg.driverWalletChargeMode || "subtotal",
    driverCommissionPerOrder: Number(cfg.driverCommissionPerOrder || 0),

    companyPolicy:
      cfg.companyPolicy && typeof cfg.companyPolicy === "object"
        ? {
            ar: String(cfg.companyPolicy.ar || ""),
            en: String(cfg.companyPolicy.en || ""),
            fr: String(cfg.companyPolicy.fr || ""),
          }
        : { ar: "", en: "", fr: "" },
    companyPolicyRequireAccept: cfg.companyPolicyRequireAccept !== false,
    companyPolicyUpdatedAt: cfg.companyPolicyUpdatedAt || null,

    offersBanners: Array.isArray(cfg.offersBanners) ? cfg.offersBanners : [],
  });
});

/***********************
 * Wi‑Fi ESC/POS printing (RAW TCP 9100)
 ***********************/
function escposReceipt(order, cfg) {
  const NL = "\n";
  const cut = Buffer.from([0x1d, 0x56, 0x41, 0x10]); // partial cut
  const init = Buffer.from([0x1b, 0x40]);
  const alignCenter = Buffer.from([0x1b, 0x61, 0x01]);
  const alignLeft = Buffer.from([0x1b, 0x61, 0x00]);
  const boldOn = Buffer.from([0x1b, 0x45, 0x01]);
  const boldOff = Buffer.from([0x1b, 0x45, 0x00]);
  const bigOn = Buffer.from([0x1d, 0x21, 0x11]);
  const bigOff = Buffer.from([0x1d, 0x21, 0x00]);

  // Resolve restaurant name (supports multi-restaurants)
  let restName = String(cfg?.restaurantName || "siymon");
  try {
    const rid = String(order?.restaurantId || "").trim();
    if (rid) {
      const rs = loadRestaurants();
      const hit = Array.isArray(rs?.restaurants)
        ? rs.restaurants.find((x) => String(x.id) === rid)
        : null;
      if (hit) {
        const n =
          typeof hit.name === "string"
            ? hit.name
            : hit.name?.ar || hit.name?.en || hit.name?.fr || hit.name?.en;
        if (n) restName = String(n);
      }
    }
  } catch (_e) {
    /* ignore */
  }

  const money = (n) =>
    Number(n || 0).toFixed(2) + " " + (order.currency || "MAD");
  const sep = "--------------------------------";
  const WIDTH = 32;

  function line(left, right, width = WIDTH) {
    const l0 = String(left || "");
    const r0 = String(right || "");
    let l = l0;
    const r = r0;
    if (l.length + r.length + 1 > width) {
      l = l.slice(0, Math.max(0, width - r.length - 1));
    }
    const spaces = Math.max(1, width - l.length - r.length);
    return l + " ".repeat(spaces) + r;
  }

  const seq = [];
  seq.push(init, alignCenter);

  // Optional logo (raster). Many ESC/POS printers support GS v 0
  if (cfg?.printLogoEnabled !== false && LOGO_RASTER && LOGO_RASTER.length) {
    seq.push(
      Buffer.from([
        0x1d,
        0x76,
        0x30,
        0x00,
        LOGO_RASTER_WB & 0xff,
        (LOGO_RASTER_WB >> 8) & 0xff,
        LOGO_RASTER_H & 0xff,
        (LOGO_RASTER_H >> 8) & 0xff,
      ]),
    );
    seq.push(LOGO_RASTER);
    seq.push(Buffer.from(NL, "utf8"));
  }

  seq.push(boldOn, bigOn);
  seq.push(Buffer.from(restName + NL, "utf8"));
  seq.push(bigOff, boldOff);

  seq.push(boldOn);
  seq.push(Buffer.from(`ORDER #${order.id}` + NL, "utf8"));
  seq.push(boldOff);

  seq.push(
    Buffer.from(new Date(order.createdAt).toLocaleString() + NL, "utf8"),
  );
  seq.push(Buffer.from(sep + NL, "utf8"));

  seq.push(alignLeft);
  seq.push(Buffer.from(`Name:  ${order.customer?.name || "-"}` + NL, "utf8"));
  seq.push(Buffer.from(`Phone: ${order.customer?.phone || "-"}` + NL, "utf8"));
  seq.push(Buffer.from(`Addr:  ${order.customer?.addr || "-"}` + NL, "utf8"));
  if (order.customer?.notes)
    seq.push(Buffer.from(`Notes: ${order.customer.notes}` + NL, "utf8"));

  seq.push(Buffer.from(sep + NL, "utf8"));

  seq.push(Buffer.from(line("QTY ITEM", "TOTAL") + NL, "utf8"));
  seq.push(Buffer.from(sep + NL, "utf8"));

  (order.items || []).forEach((it) => {
    const lt = (it.price || 0) * (it.qty || 0);
    const left = `${it.qty || 0}x ${it.name || it.id || ""}`;
    seq.push(Buffer.from(line(left, money(lt)) + NL, "utf8"));
  });

  seq.push(Buffer.from(sep + NL, "utf8"));
  seq.push(boldOn);
  seq.push(Buffer.from(line("Subtotal", money(order.subtotal)) + NL, "utf8"));
  seq.push(
    Buffer.from(line("Delivery", money(order.deliveryFee)) + NL, "utf8"),
  );
  if (promoLib.discountOf(order) > 0)
    seq.push(Buffer.from(line("Discount", "-" + money(promoLib.discountOf(order))) + NL, "utf8"));
  seq.push(Buffer.from(line("TOTAL", money(order.total)) + NL, "utf8"));
  seq.push(boldOff);

  seq.push(Buffer.from(NL + NL, "utf8"));
  seq.push(alignCenter);
  seq.push(Buffer.from("Thank you" + NL + NL, "utf8"));
  seq.push(cut);

  return Buffer.concat(seq);
}

function sendToPrinter(ip, port, data) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    const timeoutMs = 8000;

    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error("Printer timeout"));
    }, timeoutMs);

    socket.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    socket.connect(port, ip, () => {
      socket.write(data, (err) => {
        if (err) {
          clearTimeout(timer);
          socket.destroy();
          reject(err);
          return;
        }
        socket.end();
      });
    });

    socket.on("close", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

app.post("/api/print/wifi", requireAdmin, async (req, res) => {
  const cfg = loadConfig();
  if (cfg.wifiPrintEnabled === false)
    return res.status(403).json({ error: "Wi-Fi printing is disabled" });

  const { orderId } = req.body || {};
  const target = resolveWifiPrinterTarget(cfg, req.body);
  if (!target.ok) return res.status(400).json({ error: target.error });
  const { ip, port } = target;

  const data = loadOrders();
  const order = data.orders.find((o) => o.id === String(orderId));
  if (!order) return res.status(404).json({ error: "Order not found" });

  const buf = escposReceipt(order, cfg);

  try {
    await sendToPrinter(ip, port, buf);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Print failed: " + e.message });
  }
});

/***********************
 * Static hosting
 ***********************/

// Serve uploads explicitly from UPLOADS_DIR (and legacy public/uploads if it exists)
const UPLOAD_CACHE_MAX_AGE = Math.max(
  0,
  Number(process.env.UPLOAD_CACHE_MAX_AGE || (IS_PROD ? 604800 : 0)),
); // default 7d in prod
function setUploadsCacheHeaders(res, filePath) {
  try {
    const ext = path.extname(filePath).toLowerCase();
    const cacheable = [".png", ".jpg", ".jpeg", ".webp", ".svg", ".mp3"];
    if (UPLOAD_CACHE_MAX_AGE > 0 && cacheable.includes(ext)) {
      res.setHeader("Cache-Control", `public, max-age=${UPLOAD_CACHE_MAX_AGE}`);
    } else {
      // default: no special caching
    }
  } catch (_e) {}
}

// Payment receipts contain bank data: never publicly served, not even legacy files.
app.use(`${UPLOADS_PUBLIC_PATH}/topups`, (_req, res) => res.status(404).json({ error: "Not found" }));
try {
  const legacy = path.resolve(LEGACY_UPLOADS_DIR);
  const primary = path.resolve(UPLOADS_DIR);
  if (legacy !== primary && fs.existsSync(LEGACY_UPLOADS_DIR)) {
    app.use(
      UPLOADS_PUBLIC_PATH,
      express.static(LEGACY_UPLOADS_DIR, {
        setHeaders: setUploadsCacheHeaders,
      }),
    );
  }
} catch (_e) {}
app.use(
  UPLOADS_PUBLIC_PATH,
  express.static(UPLOADS_DIR, { setHeaders: setUploadsCacheHeaders }),
);

// PWA critical files should not be aggressively cached by the browser/CDN
app.get("/sw.js", (req, res) => {
  res.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate",
  );
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  res.sendFile(path.join(PUBLIC_DIR, "sw.js"));
});
app.get("/manifest.webmanifest", (req, res) => {
  res.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate",
  );
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  res.sendFile(path.join(PUBLIC_DIR, "manifest.webmanifest"));
});
app.get("/driver/manifest.webmanifest", (req, res) => {
  res.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate",
  );
  res.sendFile(path.join(PUBLIC_DIR, "driver", "manifest.webmanifest"));
});

const STATIC_CACHE_MAX_AGE = Math.max(
  0,
  Number(process.env.STATIC_CACHE_MAX_AGE || 604800),
); // default 7d
app.use(
  express.static(PUBLIC_DIR, {
    setHeaders: (res, filePath) => {
      const ext = path.extname(filePath).toLowerCase();
      // Never cache HTML (ensures users don't get stuck on old builds)
      if (ext === ".html") {
        res.setHeader(
          "Cache-Control",
          "no-store, no-cache, must-revalidate, proxy-revalidate",
        );
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
        return;
      }

      // Panels that change often (store / restaurant / admin): always revalidate (ETag) so updates show at once
      if ((ext === ".js" || ext === ".css") && /[\\/]public[\\/](store|stores|restaurant|admin)[\\/]/.test(filePath)) {
        res.setHeader("Cache-Control", "no-cache");
        return;
      }

      // Cache static assets (js/css/img/fonts) for performance
      const cacheable = [
        ".js",
        ".css",
        ".png",
        ".jpg",
        ".jpeg",
        ".webp",
        ".svg",
        ".woff",
        ".woff2",
        ".ttf",
        ".eot",
        ".mp3",
      ];
      if (cacheable.includes(ext)) {
        // Default: one week (safe even without hashed filenames). You can override via STATIC_CACHE_MAX_AGE.
        res.setHeader(
          "Cache-Control",
          `public, max-age=${STATIC_CACHE_MAX_AGE}`,
        );
        return;
      }
    },
  }),
);

// ==========================================
// Social Links API (صفحة الروابط)
// ==========================================
const SOCIAL_FILE = path.join(DATA_DIR, "social.json");

function loadSocial() {
  if (!fs.existsSync(SOCIAL_FILE)) {
    const def = {
      name: "siymon",
      desc: "أفضل مطعم في برشيد",
      instagram: "",
      facebook: "",
      tiktok: "",
      youtube: "",
      playstore: "",
      appstore: "",
      website: "",
      profileImg: "",
      bgImg: "",
      password: "123", // الرقم السري الافتراضي للوحة التحكم
    };
    fs.writeFileSync(SOCIAL_FILE, JSON.stringify(def, null, 2));
    return def;
  }
  return JSON.parse(fs.readFileSync(SOCIAL_FILE, "utf-8"));
}

function saveSocial(data) {
  fs.writeFileSync(SOCIAL_FILE, JSON.stringify(data, null, 2));
}

// جلب البيانات للزوار
app.get("/api/social", (req, res) => {
  const data = loadSocial();
  const { password, ...publicData } = data; // بنخفي الرقم السري عن الزوار
  res.json(publicData);
});

// حفظ البيانات (بواسطة المشرف)
// زودنا الحجم لـ 10 ميجا عشان يقبل رفع الصور
app.post("/api/social", express.json({ limit: "10mb" }), (req, res) => {
  const data = loadSocial();
  if (req.body.adminPass !== data.password) {
    return res.status(401).json({ error: "الرقم السري غير صحيح!" });
  }

  const fields = [
    "name",
    "desc",
    "instagram",
    "facebook",
    "tiktok",
    "youtube",
    "playstore",
    "appstore",
    "website",
    "profileImg",
    "bgImg",
  ];
  fields.forEach((f) => {
    if (req.body[f] !== undefined) data[f] = req.body[f];
  });

  if (req.body.newPassword) {
    data.password = req.body.newPassword;
  }

  saveSocial(data);
  res.json({ ok: true });
});

app.get("/", (req, res) => res.sendFile(path.join(PUBLIC_DIR, "index.html")));
app.get("/admin", (req, res) => res.redirect("/admin/index.html"));

// ---- Smart dispatch (offers mode is opt-in via config.dispatchMode) ----
const dispatchCore = require("./lib/dispatch-core");
const dispatchGrid = require("./lib/hexgrid");
const dispatchService = require("./lib/dispatch-service").createDispatchService({
  core: dispatchCore,
  grid: dispatchGrid,
  file: path.join(DATA_DIR, "dispatch.json"),
  readJson,
  writeJson,
  loadOrders,
  saveOrders,
  loadDrivers,
  loadRestaurants,
  loadConfig,
  logger,
  onAccepted: (order, prevStatus) => {
    if (prevStatus !== "accepted") {
      createCustomerOrderStatusNotification({
        customerId: order.customerId,
        orderId: order.id,
        stage: "accepted",
      });
    }
  },
});
const updateRawConfig = (patch) => {
  const raw = readJson(CONFIG_FILE, {});
  Object.assign(raw, patch);
  writeJson(CONFIG_FILE, raw);
  invalidateLimits();
};
// ---- System settings center (spec 19): one validated, audited path for every operational setting ----
settingsCenter = systemSettingsLib.createSystemSettings({
  loadConfig, updateConfig: updateRawConfig, deliveryPricing, driverEarnings, dispatchService,
  exceptionsLib, complaintsLib, readJson, writeJson, exceptionsFile: EXCEPTIONS_FILE, complaintsFile: COMPLAINTS_FILE, audit: auditLog,
});
const settingsRoutes = require("./lib/settings-routes").registerSettingsRoutes(app, {
  requireAdmin, auditLog, settings: settingsCenter, adminRoles, onSettingsChanged: invalidateLimits,
});
const adminActor = settingsRoutes.actorOf;
const adminCan = settingsRoutes.canOf;

// ---- Data protection (spec 21): verified + encrypted backups, integrity report. Restore is a CLI operation only. ----
const dataProtection = dataProtectionLib.createDataProtection({
  rootDir: ROOT, dataDir: DATA_DIR, configFile: CONFIG_FILE, uploadsDir: UPLOADS_DIR,
  backupDir: path.resolve(process.env.BACKUP_DIR || path.join(ROOT, "backups")),
  env: process.env, logger, audit: auditLog, auditHmacKey: process.env.AUDIT_HMAC_KEY || "", requireEncryption: IS_PROD,
});
try { dataProtection.hardenPermissions(); } catch (e) { logger.warn("data protection: permission hardening skipped", { error: String(e && e.message ? e.message : e) }); }
require("./lib/backup-routes").registerBackupRoutes(app, { requireAdmin, dp: dataProtection, auditLog, actorOf: adminActor });

require("./lib/dispatch-routes").registerDispatchRoutes(app, {
  service: dispatchService,
  requireDriver,
  requireApprovedDriver,
  requireAdmin,
  appendAuditLog,
  updateConfig: updateRawConfig,
  settings: settingsCenter,
  actorOf: adminActor,
  canOf: adminCan,
});

// ---- Unified store dashboard (all business types) ----
/***********************
 * Pharmacy requests -> real order (only after the customer accepted the pharmacist's offer)
 ***********************/
async function pharmacyDeliveryFor(store, customer, subtotal) {
  const settings = deliveryPricing.settingsFromConfig(loadConfig());
  const dropoff = { lat: Number(customer && customer.lat), lng: Number(customer && customer.lng) };
  const g = await zoneGuard({ settings, store, dropoff });
  if (!g.ok) { const b = serviceZones.failureBody(g); return { ...g, error: b.error, message: b.message }; }
  if (settings.mode === "distance") {
    const q = await deliveryPricing.quote({ settings: g.settings, store, subtotal, dropoff, routeService });
    if (!q.ok) { const b = serviceZones.failureBody(q); return { ...q, error: b.error, message: b.message, reason: b.reason }; }
    return { ...q, serviceZone: g.snapshot };
  }
  const flat = Math.round((Number(store.deliveryFee || 0) + Number.EPSILON) * 100) / 100;
  const free = store.freeDeliveryOver !== undefined && store.freeDeliveryOver !== null && Number(subtotal) >= Number(store.freeDeliveryOver);
  return { ok: true, mode: "flat", fee: free ? 0 : flat, snapshot: null, serviceZone: g.snapshot };
}

function createOrderFromPharmacyRequest({ request, store, deliveryFee, deliverySnapshot, serviceZone = null, payment, total }) {
  const cfg = loadConfig();
  const nowIso = new Date().toISOString();
  const lines = request.quote.lines.map((l, i) => ({ id: `${request.id}-${i + 1}`, name: l.name, qty: l.qty, price: l.price }));
  const subtotal = request.quote.medicinesTotal;
  const c = request.customer || {};
  const order = {
    id: makeId(),
    createdAt: nowIso,
    // The pharmacist already confirmed availability and price, and the customer accepted: the store only has to
    // prepare it. Preparing -> "ready" then goes through the normal dispatch hook (drivers see it only from there).
    status: "admin_accepted",
    storeType: "pharmacy",
    autoAccepted: true,
    pharmacyRequestId: request.id,
    driverId: null,
    assignedAt: null,
    acceptedAt: null,
    adminAcceptedAt: nowIso,
    storeAcceptedAt: nowIso,
    restaurantReadyAt: null,
    deliveredAt: null,
    updatedAt: nowIso,
    customerId: request.customerId,
    lang: "ar",
    currency: cfg.currency || "MAD",
    restaurantId: String(store.id),
    customer: {
      name: String(c.name || ""), phone: String(c.phone || ""), addr: String(c.addr || ""),
      notes: String(request.note || ""),
      ...(geocodeLib.validCoords(Number(c.lat), Number(c.lng)) ? { lat: Number(c.lat), lng: Number(c.lng) } : {}),
    },
    items: lines,
    subtotal,
    deliveryFee,
    total,
    paymentMethod: payment.method,
    verify: verifyCodes.newVerify(),
    ...(deliverySnapshot ? { deliveryPricing: { ...deliverySnapshot, fee: deliveryFee } } : {}),
    ...(serviceZone ? { serviceZone } : {}),
  };
  const snap = driverEarnings.snapshot(order, driverEarnings.settingsFromConfig(cfg));
  if (snap) order.driverEarnings = snap;
  order.financials = financeLib.orderFinancials({ order, store, driverEarning: driverEarnings.earningOf(order) });
  order.payment = orderPayment.snapshot({ total, deliveryFee, walletAmount: 0, method: payment.method, ledgerRef: orderPayment.walletPayRef(order.id), at: nowIso });
  orderState.recordEvent(order, { from: null, to: "admin_accepted", actorType: "customer", actorId: request.customerId, at: nowIso });
  const data = loadOrders();
  data.orders.unshift(order);
  saveOrders(data);
  try {
    createCustomerOrderStatusNotification({ customerId: order.customerId, orderId: order.id, stage: "admin_accepted" });
  } catch (_e) {}
  return order;
}

function notifyCustomerGeneric({ customerId, orderId, type, title, message, url }) {
  const cid = String(customerId || "").trim();
  if (!cid) return;
  const rec = {
    id: `notif_${genId()}`,
    title: String(title || ""),
    message: String(message || ""),
    imageUrl: null,
    url: /^\/[a-z0-9\-_\/]*$/i.test(String(url || "")) ? String(url) : "/notifications/",
    audience: "customer",
    customerId: cid,
    orderId: String(orderId || ""),
    type: String(type || "store_message"),
    createdAt: new Date().toISOString(),
  };
  const data = loadNotifications();
  data.notifications = Array.isArray(data.notifications)
    ? data.notifications
    : [];
  data.notifications.unshift(rec);
  const max = Math.max(50, Number(process.env.NOTIFICATIONS_MAX || 500));
  if (data.notifications.length > max)
    data.notifications = data.notifications.slice(0, max);
  saveNotifications(data);
  if (WEBPUSH_ENABLED) {
    setImmediate(() => {
      sendWebPushToCustomer(cid, rec).catch(() => {});
    });
  }
}

const storeApi = require("./lib/store-routes").registerStoreRoutes({
  extraStats: (storeId) => {
    const list = (readJson(COMPLAINTS_FILE, { complaints: [] }).complaints || []).filter((c) => c.against === "store" && String(c.storeId) === String(storeId));
    return { complaintsAwaiting: list.filter((c) => c.status === "with_party").length };
  },
  pickupCodeFor: (o) => verifyCodes.pickupCodeForStore(VERIFY_SECRET, o),
  statementFor: (storeId, query) => storeStatementFor(storeId, query),
  app,
  requireAdmin,
  requireCustomer,
  loginMiddleware: [loginSlowdown, loginLimiter],
  signToken,
  verifyToken,
  verifyPassword,
  normalizeEmail,
  getRestaurantIdFromToken: (t) => getRestaurantIdFromToken(t),
  loadRestaurants,
  saveRestaurants,
  loadMenu,
  saveMenu,
  loadOrders,
  saveOrders,
  loadRestaurantUsers,
  saveRestaurantUsers,
  hashPassword,
  appendAuditLog,
  readJson,
  writeJson,
  typesFile: STORE_TYPES_FILE,
  chatsFile: STORE_CHATS_FILE,
  support: { channelsFile: SUPPORT_CHANNELS_FILE, ticketsFile: SUPPORT_TICKETS_FILE },
  pharmacy: {
    file: PHARMACY_FILE,
    privateDir: PRIVATE_RX_DIR,
    saveImagePrivate: (dataUrl, dir, base, opts) => {
      fs.mkdirSync(dir, { recursive: true });
      return saveDataUrlImagePrivate(dataUrl, dir, base, opts);
    },
    readPrivate: (file) => {
      try { return fs.readFileSync(path.join(PRIVATE_RX_DIR, path.basename(String(file || "")))); } catch (_e) { return null; }
    },
    isPublicStore: (st) => catalogLib.isPublic(st),
    canReceive: (storeId) => enforceRestaurantCanReceiveOrders(storeId),
    resolvePayment: (method) => paymentsLib.resolveOrderPayment(method, loadPaymentMethods()),
    deliveryFor: pharmacyDeliveryFor,
    createOrder: createOrderFromPharmacyRequest,
  },
  makeId,
  asI18nText,
  cleanImgUrl: cleanImgUrl,
  // Product photos uploaded by the merchant (data URL -> /uploads/menu/...)
  saveProductImage: (dataUrl) => {
    const d = String(dataUrl || "");
    decodeDataUrlImage(d, { maxBytes: MAX_MENU_IMAGE_BYTES }); // throws a readable reason (too large / bad type)
    fs.mkdirSync(MENU_UPLOAD_DIR, { recursive: true });
    return saveDataUrlImage(d, MENU_UPLOAD_DIR, `menu_${genId()}`, { maxBytes: MAX_MENU_IMAGE_BYTES });
  },
  catalogLib,
  safeRestaurant,
  notifyCustomer: notifyCustomerGeneric,
  onOrderReady: (order) => {
    createCustomerOrderStatusNotification({
      customerId: order.customerId,
      orderId: order.id,
      stage: "restaurant_ready",
    });
    if (!order.driverId && dispatchService.settings().auto) {
      dispatchService.dispatchOrder(order.id, { actor: "system" });
    }
  },
});

app.get("/api/map-config", (_req, res) => {
  const pk = (loadConfig() || {}).pickupLocation;
  res.set("Cache-Control", "public, max-age=300");
  res.json({
    tileUrl: MAP_TILE_URL,
    attribution: process.env.MAP_ATTRIBUTION || "© OpenStreetMap contributors",
    pickup:
      pk && dispatchCore.validCoords(Number(pk.lat), Number(pk.lng))
        ? { lat: Number(pk.lat), lng: Number(pk.lng), name: String(pk.name || "") }
        : null,
  });
});

const routeService = require("./lib/route-service").createRouteService({
  osrmUrl: process.env.ROUTING_URL,
  orsKey: process.env.ORS_API_KEY,
});
require("./lib/extras-routes").registerExtrasRoutes(app, {
  routeService,
  requireCustomer,
  requireDriver,
  requireApprovedDriver,
  loadOrders,
  saveOrders,
  dispatchService,
});

// ---- Geographic service areas (spec 18): public check + supervisor zone management ----
require("./lib/service-zone-routes").registerServiceZoneRoutes(app, {
  requireAdmin,
  readJson,
  writeJson,
  file: SERVICE_ZONES_FILE,
  appendAuditLog,
  adminRoles,
  getStore: (id) => getRestaurantById(id),
  limiter: geocodeLimiter,
});

// ---- Exception-management center (delays, rejections, unassigned, failed deliveries, disputes, payment errors) ----
const exceptionCenter = require("./lib/exception-routes").registerExceptionRoutes(app, {
  requireAdmin,
  readJson,
  writeJson,
  file: EXCEPTIONS_FILE,
  loadOrders,
  saveOrders,
  dispatchService,
  appendAuditLog,
  adminRoles,
  logger,
});
{
  // Real detection from order records every minute (idempotent); a failure is logged, never silent, never fatal.
  const t = setInterval(() => {
    try { exceptionCenter.scan(); } catch (e) { logger.warn("exception scan failed", { message: String(e && e.message ? e.message : e) }); }
  }, 60 * 1000);
  if (t.unref) t.unref();
}

// Reports & analytics (section 17): admin / business / driver endpoints over the real order + ledger records.
require("./lib/report-routes").registerReportRoutes(app, {
  requireAdmin,
  requireStore: storeApi.requireStore,
  requireDriver,
  adminRoles,
  appendAuditLog,
  getConfig: loadConfig,
  logger,
  loaders: {
    orders: () => loadOrders().orders,
    stores: () => loadRestaurants().restaurants,
    drivers: () => loadDrivers().drivers,
    customers: () => loadCustomers().customers,
    settlements: () => loadSettlements().settlements,
    topups: () => loadTopups().topups,
    exceptions: () => {
      const j = readJson(EXCEPTIONS_FILE, { cases: [], settings: {} }) || {};
      return { cases: Array.isArray(j.cases) ? j.cases : [], settings: j.settings || {} };
    },
  },
});

// ---- Ratings moderation, complaints and customer support centre (spec 16) ----
const feedbackApi = require("./lib/feedback-routes").registerFeedbackRoutes(app, {
  requireCustomer,
  requireDriver,
  requireStore: storeApi.requireStore,
  requireAdmin,
  loadOrders,
  saveOrders,
  loadRestaurants,
  loadDrivers,
  readJson,
  writeJson,
  file: COMPLAINTS_FILE,
  ownsOrder: (req, order) => {
    const me = (loadCustomers().customers || []).find((c) => String(c.id) === String(req.customerId));
    return !!me && customerAccount.ownsOrder(order, me);
  },
  appendAuditLog,
  adminRoles,
  notifyCustomer: (n) => notifyCustomerGeneric({ ...n, url: "/support/" }),
  exceptions: exceptionCenter,
  channels: () => (readJson(SUPPORT_CHANNELS_FILE, { channels: [] }).channels || []),
  publicChannels: require("./lib/support").publicChannels,
  limiter: (windowMs, max, prefix) =>
    rateLimit({
      windowMs, max, standardHeaders: true, legacyHeaders: false, message: { error: "Too many requests" },
      keyGenerator: (req) => prefix + String(req.customerId || req.driverId || req.ip),
    }),
  logger,
});
{
  // Deadline rules (party did not answer / customer did not reply) are also applied by a timer, so they fire even when nobody opens the page.
  const t = setInterval(() => {
    try { feedbackApi.age(); } catch (e) { logger.warn("complaint ageing failed", { message: String(e && e.message ? e.message : e) }); }
  }, 5 * 60 * 1000);
  if (t.unref) t.unref();
}

if (WEBPUSH_ENABLED) {
  const t = setInterval(() => processPushRetries().catch(() => {}), 30 * 1000);
  if (t.unref) t.unref();
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info("siymon server started", {
    port: Number(PORT),
    env: process.env.NODE_ENV || "",
    uploadsDir: UPLOADS_DIR,
    uploadsMount: UPLOADS_PUBLIC_PATH,
    version: pkgVersion || undefined,
  });
});
