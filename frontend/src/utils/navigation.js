/**
 * Role-aware navigation helpers.
 *
 * Shared by Login.jsx and AppRoutes.jsx's RoleBasedRedirect so both agree
 * on where a given role belongs after signing in.
 */

/** Where each role lands when there's no specific page to return to. */
export function homePathForRole(role) {
  return role === "admin" ? "/admin/dashboard" : "/employee/dashboard";
}

/** Whether a role is allowed to open a given path. */
export function canAccessPath(role, path) {
  if (!path) return false;
  if (path.startsWith("/admin")) return role === "admin";
  if (path.startsWith("/employee")) return role === "employee";
  return true; // public paths like /403
}

/**
 * Decide where to send a user immediately after login.
 *
 * ProtectedRoute stashes the page you were bounced off in `location.state.from`
 * so you can be returned there. But that page belonged to whoever was blocked
 * -- if an employee follows a stale /admin/assets link, gets bounced to login,
 * and signs in, sending them "back" to /admin/assets just bounces them again,
 * this time to /403. So we only honour `from` when the role can actually open
 * it, and otherwise fall through to that role's own home page.
 *
 *   resolveLandingPath("employee", "/admin/assets")     -> "/employee/dashboard"
 *   resolveLandingPath("employee", "/employee/my-assets") -> "/employee/my-assets"
 *   resolveLandingPath("admin", undefined)              -> "/admin/dashboard"
 */
export function resolveLandingPath(role, from) {
  if (from && from !== "/" && canAccessPath(role, from)) {
    return from;
  }
  return homePathForRole(role);
}
