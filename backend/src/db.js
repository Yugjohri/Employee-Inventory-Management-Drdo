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
import { appConnection } from "./dbConfig.js";

// Dates come back as 'YYYY-MM-DD' strings rather than JS Date objects.
// Without this, `date` columns get shifted across timezone boundaries on the
// way to JSON — an assignment dated the 1st arrives at the browser as the 31st.
pg.types.setTypeParser(1082, (value) => value);

// Always the unprivileged role — see dbConfig.js for why that matters even
// when a hosting provider hands us an owner connection string.
export const pool = new pg.Pool({
  ...appConnection(),
  max: 10,
  idleTimeoutMillis: 30_000,
});

pool.on("error", (err) => {
  console.error("[db] idle client error:", err.message);
});

/**
 * Check at start-up that the access rules will actually apply to us.
 *
 * PostgreSQL exempts a table's owner — and any role with BYPASSRLS — from that
 * table's row-level security. If a deployment accidentally connects with such a
 * user, every query still succeeds and every page still renders; the only
 * difference is that a coordinator can now see every group. That is precisely
 * the kind of failure nobody notices, so it's worth one query to rule out.
 */
export async function assertSecurityRulesApply() {
  const { rows } = await pool.query(`
    select current_user as who,
           (select rolbypassrls from pg_roles where rolname = current_user) as bypasses,
           pg_catalog.pg_get_userbyid(c.relowner) = current_user as owns_employees,
           c.relrowsecurity  as rls_enabled,
           c.relforcerowsecurity as rls_forced
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = 'employees'
  `);

  const state = rows[0];
  if (!state) return { ok: false, reason: "the employees table is missing — run npm run setup" };

  // BYPASSRLS skips policies unconditionally; nothing rescues that.
  if (state.bypasses) return { ok: false, reason: `"${state.who}" has BYPASSRLS` };

  if (!state.rls_enabled) return { ok: false, reason: "row-level security is switched off" };

  // Owning the tables is only a problem without FORCE, which is what removes
  // the owner's exemption. Hosted deployments rely on exactly that.
  if (state.owns_employees && !state.rls_forced) {
    return { ok: false, reason: `"${state.who}" owns the tables and FORCE is not set` };
  }

  return {
    ok: true,
    who: state.who,
    how: state.owns_employees ? "owner, with FORCE" : "unprivileged role",
  };
}

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
