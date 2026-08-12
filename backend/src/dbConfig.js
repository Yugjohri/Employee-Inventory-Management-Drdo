/**
 * Working out how to connect to PostgreSQL.
 *
 * Two shapes, because local installs and managed hosts describe a database
 * differently:
 *
 *   locally   PGHOST / PGPORT / PGDATABASE / PGUSER / PGPASSWORD
 *   hosted    a single DATABASE_URL, which is what Render, Fly, Neon,
 *             Railway and Supabase all hand you
 *
 * ---------------------------------------------------------------------------
 * WHY THE APP DOESN'T JUST USE DATABASE_URL AS-IS
 * ---------------------------------------------------------------------------
 * A managed host's connection string belongs to the user that *owns* the
 * tables, and PostgreSQL exempts a table's owner from its own row-level
 * security policies. Connecting the API with that user would silently switch
 * off every access rule in 01_schema.sql — the app would appear to work, and a
 * coordinator would quietly be able to see every group.
 *
 * So the API always connects as the unprivileged `eims_app` role, even when a
 * DATABASE_URL is present: we keep the host, port and database name from it and
 * substitute the application credentials. The owner connection is used only by
 * migrate and seed, which legitimately need to create things.
 */

import { config } from "./config.js";

/** True when the deployment gave us a single connection string. */
export const usingDatabaseUrl = Boolean(process.env.DATABASE_URL);

/**
 * Managed PostgreSQL requires TLS, and issues certificates from an internal
 * authority Node doesn't ship. Verifying the chain isn't possible without
 * pinning their CA, and the connection is inside the provider's network.
 */
const managedSsl = { rejectUnauthorized: false };

/**
 * Connection for the API.
 *
 * With a DATABASE_URL, PGUSER decides which of two safe arrangements applies:
 *
 *   PGUSER set    connect as that unprivileged role — it owns nothing, so the
 *                 policies apply to it normally. Preferred where we're allowed
 *                 to create roles.
 *   PGUSER unset  connect as the DATABASE_URL user, which owns the tables.
 *                 Safe only because 01_schema.sql marks every table FORCE ROW
 *                 LEVEL SECURITY, which removes the owner's exemption. Managed
 *                 databases don't let us create roles, so this is their path.
 *
 * Read straight from process.env rather than config.db, which defaults PGUSER
 * to "eims_app" — a default that would be wrong here, because on a managed
 * database that role does not exist and the connection would simply fail.
 */
export function appConnection() {
  if (!usingDatabaseUrl) return { ...config.db };

  const url = new URL(process.env.DATABASE_URL);

  if (process.env.PGUSER) {
    url.username = encodeURIComponent(process.env.PGUSER);
    url.password = encodeURIComponent(process.env.PGPASSWORD || "");
  }

  return { connectionString: url.toString(), ssl: managedSsl };
}

/**
 * Connection for migrate/seed: the owner, which may create tables and roles.
 * Locally that's ADMIN_PGUSER; on a managed host it's whoever DATABASE_URL
 * names.
 */
export function ownerConnection(database) {
  if (usingDatabaseUrl) {
    return { connectionString: process.env.DATABASE_URL, ssl: managedSsl };
  }

  return {
    host: config.db.host,
    port: config.db.port,
    database: database ?? config.db.database,
    user: process.env.ADMIN_PGUSER || "postgres",
    password: process.env.ADMIN_PGPASSWORD || "postgres",
  };
}
