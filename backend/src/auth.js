/**
 * Authentication: password hashing, the session cookie, and the middleware
 * that turns a cookie back into a user.
 *
 * The session is a JWT in an httpOnly cookie rather than localStorage, so
 * page scripts can't read it and an XSS bug can't exfiltrate a session.
 * SameSite=Lax keeps it off cross-site requests.
 */

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import { config } from "./config.js";
import { pool } from "./db.js";
import { forbidden, unauthorized } from "./http.js";

const COOKIE_NAME = "eims_session";
const BCRYPT_ROUNDS = 10;

export function hashPassword(plain) {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

export function issueSession(res, user) {
  const token = jwt.sign(
    { sub: user.id, role: user.role, group_id: user.group_id ?? null },
    config.jwtSecret,
    { expiresIn: `${config.sessionHours}h` }
  );

  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    // The intranet deployment may well be plain HTTP, and a Secure cookie
    // would simply never be sent there. Enable it when serving over TLS.
    secure: config.isProduction,
    maxAge: config.sessionHours * 60 * 60 * 1000,
  });
}

export function clearSession(res) {
  res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: "lax", secure: config.isProduction });
}

/**
 * Reads the session cookie and attaches `req.user`.
 *
 * The role and group are re-read from the database on every request rather
 * than trusted from the token. A token issued before an admin demoted someone
 * or moved them between groups still carries the old claims; re-reading means
 * a revoked privilege takes effect immediately instead of lingering until the
 * session expires.
 */
export const authenticate = async (req, _res, next) => {
  try {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) return next();

    let payload;
    try {
      payload = jwt.verify(token, config.jwtSecret);
    } catch {
      return next(); // expired or tampered — treated as signed out
    }

    // session_lookup is SECURITY DEFINER: at this point the session context
    // hasn't been set yet, so a direct query would be filtered out by RLS.
    const { rows } = await pool.query("select * from public.session_lookup($1)", [payload.sub]);

    const user = rows[0];
    if (user && user.is_active) {
      req.user = user;
    }
    return next();
  } catch (error) {
    return next(error);
  }
};

export function requireAuth(req, _res, next) {
  if (!req.user) return next(unauthorized());
  return next();
}

/** Route guard for role-restricted endpoints. RLS is still the real boundary;
 *  this returns a clear 403 instead of a confusing empty result. */
export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role)) return next(forbidden());
    return next();
  };
}

/** The shape the frontend's AuthContext expects. */
export function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    email: user.email,
    role: user.role,
    group_id: user.group_id ?? null,
    group_name: user.group_name ?? null,
  };
}
