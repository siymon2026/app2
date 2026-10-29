const fs = require("fs");
const path = require("path");
const winston = require("winston");

// Logs directory
const ROOT = __dirname;
const LOG_DIR = process.env.LOG_DIR
  ? path.resolve(process.env.LOG_DIR)
  : path.join(ROOT, "logs");

try {
  fs.mkdirSync(LOG_DIR, { recursive: true });
} catch (_e) {
  // best-effort
}

const isProd = String(process.env.NODE_ENV || "").toLowerCase() === "production";
const level = String(process.env.LOG_LEVEL || (isProd ? "info" : "debug"));

// Winston logger (JSON logs are easiest to parse + rotate externally)
const logger = winston.createLogger({
  level,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: "siymon-server" },
  transports: [
    new winston.transports.File({ filename: path.join(LOG_DIR, "error.log"), level: "error" }),
    new winston.transports.File({ filename: path.join(LOG_DIR, "combined.log") }),
  ],
});

// Always log to console too (useful for Docker/PM2)
logger.add(
  new winston.transports.Console({
    level,
    format: winston.format.combine(
      winston.format.colorize({ all: !isProd }),
      winston.format.timestamp(),
      winston.format.printf((info) => {
        const meta = { ...info };
        delete meta.level;
        delete meta.message;
        delete meta.timestamp;
        const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
        return `${info.timestamp} ${info.level}: ${info.message}${metaStr}`;
      })
    ),
  })
);

// Morgan -> Winston stream
const morganStream = {
  write: (message) => {
    const msg = String(message || "").trim();
    if (!msg) return;
    // Keep it as a single line string (standard combined format)
    logger.info(msg, { kind: "http" });
  },
};

module.exports = { logger, morganStream, LOG_DIR };
