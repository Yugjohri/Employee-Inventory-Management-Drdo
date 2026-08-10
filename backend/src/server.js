/**
 * Employee Inventory Management — API server.
 *
 * Express in front of PostgreSQL. Everything it needs runs on the same
 * machine or the same intranet; there are no outbound network calls.
 *
 * In production it also serves the built React app, so the whole system is
 * one Node process plus Postgres.
 */

import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import fs from "node:fs";

import express from "express";
import cookieParser from "cookie-parser";

import { config } from "./config.js";
import { pool } from "./db.js";
import { authenticate } from "./auth.js";
import { errorHandler, notFound } from "./http.js";

import { authRoutes } from "./routes/auth.js";
import { lookupRoutes } from "./routes/lookups.js";
import { employeeRoutes } from "./routes/employees.js";
import { assetRoutes } from "./routes/assets.js";
import { assignmentRoutes } from "./routes/assignments.js";
import { requestRoutes } from "./routes/requests.js";

const here = path.dirname(fileURLToPath(import.meta.url));

export const app = express();

app.disable("x-powered-by");
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());

// Resolves the session cookie to req.user for every route below.
app.use(authenticate);

app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("select 1");
    res.json({ status: "ok", database: "connected" });
  } catch (error) {
    res.status(503).json({ status: "degraded", database: "unreachable", error: error.message });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api", lookupRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/assets", assetRoutes);
app.use("/api/assignments", assignmentRoutes);
app.use("/api/requests", requestRoutes);

app.use("/api", (_req, _res, next) => next(notFound("No such endpoint.")));

// --- static frontend (production) -------------------------------------------
// Present only after `npm run build` in frontend/. In development Vite serves
// the app instead and proxies /api here.
const clientDir = path.resolve(here, "../../frontend/dist");
if (fs.existsSync(clientDir)) {
  app.use(express.static(clientDir));
  // Any non-API path is a client-side route — hand it the SPA shell.
  app.get("*", (_req, res) => res.sendFile(path.join(clientDir, "index.html")));
}

app.use(errorHandler);

// Only listen when run directly, so tests can import `app` without binding a
// port. pathToFileURL handles the platform differences here — on Windows a
// file URL is file:///C:/... , which hand-built string comparison gets wrong.
const runDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (runDirectly) {
  app.listen(config.port, () => {
    console.log(`[api] listening on http://localhost:${config.port}`);
    console.log(`[api] database ${config.db.user}@${config.db.host}:${config.db.port}/${config.db.database}`);
    if (fs.existsSync(clientDir)) console.log("[api] serving frontend from frontend/dist");
  });
}
