/**
 * Start / stop the database.
 *
 *   npm run db:start
 *   npm run db:stop
 *   npm run db:status
 *
 * Only needed for a **portable** PostgreSQL — the zip download that runs from
 * a folder without being installed. If PostgreSQL was installed normally it
 * runs as a Windows service and starts with the machine, so there is nothing
 * to start here and these commands will tell you so.
 *
 * Reads PG_BIN and PG_DATA from .env.
 */

import { spawnSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import "dotenv/config";

const binDir = process.env.PG_BIN;
const dataDir = process.env.PG_DATA;
const port = process.env.PGPORT || "5432";
const action = process.argv[2] || "status";

if (!binDir || !dataDir) {
  console.log(
    "PG_BIN / PG_DATA aren't set in .env, so PostgreSQL is presumably installed\n" +
      "normally and runs as a service — there is nothing to start or stop here.\n\n" +
      "Check it's up with:  npm run db:status  (after setting PG_BIN), or just\n" +
      "run `npm start` and watch for a database connection error."
  );
  process.exit(0);
}

const exe = (name) => path.join(binDir, process.platform === "win32" ? `${name}.exe` : name);

if (!fs.existsSync(exe("pg_ctl"))) {
  console.error(`Can't find pg_ctl in PG_BIN (${binDir}). Check the path in .env.`);
  process.exit(1);
}

/** pg_ctl status exits 0 when running, 3 when stopped. */
function isRunning() {
  return spawnSync(exe("pg_ctl"), ["-D", dataDir, "status"], { encoding: "utf8" }).status === 0;
}

if (action === "status") {
  console.log(isRunning() ? `PostgreSQL is running on port ${port}.` : "PostgreSQL is stopped.");
  process.exit(0);
}

if (action === "start") {
  if (isRunning()) {
    console.log(`PostgreSQL is already running on port ${port}.`);
    process.exit(0);
  }

  const logFile = path.join(path.dirname(dataDir), "postgres.log");

  // stdio must be "ignore", not inherited or piped. The server pg_ctl launches
  // outlives this command and would hold whichever stream it was given open —
  // so the prompt would never come back. pg_ctl writes to the log file anyway.
  const result = spawnSync(
    exe("pg_ctl"),
    ["-D", dataDir, "-l", logFile, "-o", `-p ${port}`, "start"],
    { stdio: "ignore" }
  );

  if (result.status !== 0) {
    console.error(`pg_ctl failed to start the server. See ${logFile}`);
    process.exit(result.status ?? 1);
  }

  console.log(`PostgreSQL started on port ${port}.`);
  console.log(`Log: ${logFile}`);
  process.exit(0);
}

if (action === "stop") {
  if (!isRunning()) {
    console.log("PostgreSQL is already stopped.");
    process.exit(0);
  }

  // "fast" closes client connections rather than waiting for them to finish.
  const result = spawnSync(exe("pg_ctl"), ["-D", dataDir, "-m", "fast", "stop"], {
    encoding: "utf8",
    stdio: "inherit",
  });
  process.exit(result.status ?? 0);
}

console.error(`Unknown command "${action}". Use start, stop or status.`);
process.exit(1);
