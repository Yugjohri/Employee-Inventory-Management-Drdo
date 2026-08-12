/**
 * Creates the database (if needed) and applies the SQL files in order.
 *
 *   npm run migrate
 *
 * Connects as the database owner, because creating tables and roles needs
 * owner rights. The API itself never uses this login — it connects as
 * `eims_app`, which owns nothing and is therefore subject to row-level
 * security. See src/dbConfig.js.
 *
 * Works in both shapes:
 *   locally  creates the database, then applies the schema
 *   hosted   the provider already created the database, so that step is
 *            skipped and the schema is applied to it
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import pg from "pg";
import "dotenv/config";

import { ownerConnection, usingDatabaseUrl } from "../src/dbConfig.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const sqlDir = path.resolve(here, "../sql");

const dbName = process.env.PGDATABASE || "eims";
const appUser = process.env.PGUSER || "eims_app";
const appPassword = process.env.PGPASSWORD || "";

/** Only meaningful for a local install; a hosted database already exists. */
async function ensureDatabase() {
  if (usingDatabaseUrl) {
    console.log("[migrate] using DATABASE_URL — the database already exists");
    return;
  }

  const client = new pg.Client(ownerConnection("postgres"));
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

/**
 * Give the unprivileged `eims_app` role the password the API will use.
 *
 * Optional by design. A managed database won't let us create or alter roles, so
 * there is nothing to set — the API connects as the owner there, and FORCE ROW
 * LEVEL SECURITY in 01_schema.sql keeps the access rules in effect either way.
 * Warn and carry on rather than failing the deployment.
 */
async function setAppRolePassword(client) {
  const { rows } = await client.query("select 1 from pg_roles where rolname = $1", [appUser]);

  if (rows.length === 0) {
    console.log(
      `[migrate] role "${appUser}" doesn't exist — the API will connect as the ` +
        "database owner, with FORCE row-level security applying the same rules"
    );
    return;
  }

  if (!appPassword) {
    console.warn("[migrate] PGPASSWORD is empty — set one in .env before deploying.");
    return;
  }

  try {
    // ALTER ROLE is a utility statement, so it takes no bind parameters.
    // escapeIdentifier/escapeLiteral do the quoting that $1 would normally
    // have handled.
    await client.query(
      `alter role ${client.escapeIdentifier(appUser)} ` +
        `with password ${client.escapeLiteral(appPassword)}`
    );
    console.log(`[migrate] set password for role "${appUser}"`);
  } catch (error) {
    if (error.code === "42501") {
      console.log(
        `[migrate] not permitted to alter role "${appUser}" — connecting as the ` +
          "database owner instead, which FORCE row-level security still covers"
      );
      return;
    }
    throw error;
  }
}

async function applySqlFiles() {
  const client = new pg.Client(ownerConnection());
  await client.connect();

  try {
    const files = (await fs.readdir(sqlDir)).filter((f) => f.endsWith(".sql")).sort();

    for (const file of files) {
      const sql = await fs.readFile(path.join(sqlDir, file), "utf8");
      await client.query(sql);
      console.log(`[migrate] applied ${file}`);

      // 01_schema.sql defines set_app_user and turns on row-level security.
      // Everything after it — the reference data in 02_seed.sql — is an
      // ordinary write and has to say who it is, or the policies reject it.
      if (file.startsWith("01_")) {
        await client.query("select set_config('app.role', 'admin', false)");
      }
    }

    await setAppRolePassword(client);
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
    console.error("  PostgreSQL doesn't appear to be running. Start it and try again.");
  }
  if (error.code === "28P01") {
    console.error("  The database password was rejected. Check ADMIN_PGPASSWORD in backend/.env.");
  }
  if (error.code === "42501") {
    console.error(
      "  Permission denied. On a managed host the DATABASE_URL user may not be\n" +
        "  allowed to create roles — see the hosting section of README.md."
    );
  }
  process.exit(1);
}
