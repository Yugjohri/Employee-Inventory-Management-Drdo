/**
 * Sign in, sign out, and "who am I".
 */

import { Router } from "express";

import { pool } from "../db.js";
import {
  clearSession, issueSession, publicUser, requireAuth, verifyPassword,
} from "../auth.js";
import { route, unauthorized, requireText, badRequest } from "../http.js";

export const authRoutes = Router();

authRoutes.post(
  "/login",
  route(async (req, res) => {
    const username = requireText(req.body?.username, "Username", { max: 100 }).toLowerCase();
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (!password) throw badRequest("Password is required.");

    // Goes through login_lookup() rather than querying employees directly.
    // Nobody is signed in yet, so RLS would hide the very row we need to check
    // the password against — login_lookup is SECURITY DEFINER and is the only
    // place that gap is opened.
    const { rows } = await pool.query("select * from public.login_lookup($1)", [username]);

    const user = rows[0];

    // Compare against a dummy hash when the user doesn't exist so that a wrong
    // username and a wrong password take the same time to reject. Otherwise the
    // difference reveals which usernames are real.
    const hash = user?.password_hash || "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidiu";
    const passwordOk = await verifyPassword(password, hash);

    if (!user || !passwordOk) {
      throw unauthorized("Incorrect username or password.");
    }

    if (!user.is_active) {
      throw unauthorized("This account has been deactivated. Contact your administrator.");
    }

    issueSession(res, user);
    res.json({ user: publicUser(user) });
  })
);

authRoutes.post("/logout", (req, res) => {
  clearSession(res);
  res.status(204).end();
});

// req.user already carries the group name — session_lookup joins it in.
authRoutes.get("/me", requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});
