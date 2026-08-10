/**
 * Configuration, read once at startup.
 *
 * Fails fast on a missing JWT_SECRET rather than booting with a default —
 * a predictable signing key would let anyone mint an admin session.
 */

import "dotenv/config";

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing ${name}. Copy backend/.env.example to backend/.env and fill it in.`
    );
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT || 4000),

  db: {
    host: process.env.PGHOST || "localhost",
    port: Number(process.env.PGPORT || 5432),
    database: process.env.PGDATABASE || "eims",
    user: process.env.PGUSER || "eims_app",
    password: process.env.PGPASSWORD || "",
  },

  jwtSecret: required("JWT_SECRET"),
  sessionHours: Number(process.env.SESSION_HOURS || 12),
  defaultPassword: process.env.DEFAULT_PASSWORD || "drdo@1234",

  isProduction: process.env.NODE_ENV === "production",
};
