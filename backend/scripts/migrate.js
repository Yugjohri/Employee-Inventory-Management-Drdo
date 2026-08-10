/**
 * Creates the database (if needed) and applies the SQL files in order.
 *
 *   npm run migrate
 *
 * Connects as ADMIN_PGUSER because creating tables and roles needs owner
 * rights. The API itself never uses this login — it connects as eims_app,
 * which owns nothing and is therefore subject to row-level security.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import pg from "pg";
import "dotenv/config";

const here = path.dirname(fileURLToPath(import.meta.url));
const sqlDir = path.resolve(here, "../sql");

const adminConfig = {
  host: process.env.PGHOST || "localhost",
  port: Number(process.env.PGPORT || 5432),
  user: process.env.ADMIN_PGUSER || "postgres",
  password: process.env.ADMIN_PGPASSWORD || "postgres",
};

const dbName = process.env.PGDATABASE || "eims";
const appUser = process.env.PGUSER || "eims_app";
const appPassword = process.env.PGPASSWORD || "";

async function ensureDatabase() {
  const client = new pg.Client({ ...adminConfig, database: "postgres" });
  await client.connect();
  try {
    const { rows } = await client.query("select 1 from pg_database where datname = $1", [dbName]);
    if (rows.length === 0) {
      // Identifiers can't be parameterised; dbName comes from our own .env.
      await client.query(`create database "${dbName.replace(/"/g, '""')}"`);
      console.log(`[migrate] created database "${dbName}"`);
    } else {
      console.log(`[migrate] database "${dbName}" already exists`);
    }
  } finally {
    await client.end();
  }
}

async function applySqlFiles() {
  const client = new pg.Client({ ...adminConfig, database: dbName });
  await client.connect();

  try {
    const files = (await fs.readdir(sqlDir)).filter((f) => f.endsWith(".sql")).sort();

    for (const file of files) {
      const sql = await fs.readFile(path.join(sqlDir, file), "utf8");
      await client.query(sql);
      console.log(`[migrate] applied ${file}`);
    }

    if (!appPassword) {
      console.warn("[migrate] PGPASSWORD is empty — set one in .env before deploying.");
    } else {
      // ALTER ROLE is a utility statement, so it takes no bind parameters.
      // escapeIdentifier/escapeLiteral do the quoting that $1 would normally
      // have handled.
      await client.query(
        `alter role ${client.escapeIdentifier(appUser)} ` +
          `with password ${client.escapeLiteral(appPassword)}`
      );
      console.log(`[migrate] set password for role "${appUser}"`);
    }
  } finally {
    await client.end();
  }
}

try {
  await ensureDatabase();
  await applySqlFiles();
  console.log("[migrate] done. Next: npm run seed");
} catch (error) {
  console.error("\n[migrate] failed:", error.message);
  if (error.code === "ECONNREFUSED") {
    console.error(
      "  PostgreSQL doesn't appear to be running on " +
        `${adminConfig.host}:${adminConfig.port}. Start it and try again.`
    );
  }
  if (error.code === "28P01") {
    console.error("  ADMIN_PGUSER / ADMIN_PGPASSWORD in backend/.env were rejected.");
  }
  process.exit(1);
}
