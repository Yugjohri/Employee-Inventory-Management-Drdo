/**
 * Database access.
 *
 * Every authenticated request runs inside `withUser`, which opens a
 * transaction and stamps the caller's identity onto the session before any
 * query runs. The RLS policies in 01_schema.sql read that identity back, so
 * scoping is applied by Postgres itself rather than by remembering to add a
 * WHERE clause in each route.
 *
 * The practical consequence: if a route forgets to filter by group, a
 * coordinator still cannot see another group's rows. The database won't
 * return them.
 */

import pg from "pg";
import { config } from "./config.js";

// Dates come back as 'YYYY-MM-DD' strings rather than JS Date objects.
// Without this, `date` columns get shifted across timezone boundaries on the
// way to JSON — an assignment dated the 1st arrives at the browser as the 31st.
pg.types.setTypeParser(1082, (value) => value);

export const pool = new pg.Pool({
  ...config.db,
  max: 10,
  idleTimeoutMillis: 30_000,
});

pool.on("error", (err) => {
  console.error("[db] idle client error:", err.message);
});

/**
 * Run `fn` with the session bound to `user`, inside one transaction.
 *
 * Pass null for unauthenticated work: app.user_id ends up NULL and the
 * policies expose nothing.
 */
export async function withUser(user, fn) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("select public.set_app_user($1, $2, $3)", [
      user?.id ?? null,
      user?.role ?? null,
      user?.group_id ?? null,
    ]);

    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

/** Convenience for the common "one statement, already scoped" case. */
export async function queryAs(user, text, params = []) {
  return withUser(user, (client) => client.query(text, params));
}
