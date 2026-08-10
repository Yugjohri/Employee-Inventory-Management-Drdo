/**
 * Role-aware navigation helpers.
 *
 * Shared by Login.jsx and AppRoutes.jsx's RoleBasedRedirect so both agree on
 * where a given role belongs after signing in.
 *
 * These decide what the UI *offers*. They are not a security boundary — the
 * API and the database access rules are. Editing anything here changes which
 * links a user sees, not which records they can read.
 */

export const ROLES = {
  admin: "admin",
  coordinator: "group_it_coordinator",
  employee: "employee",
};

/** How each role is described to a person. */
export const ROLE_LABELS = {
  admin: "Administrator",
  group_it_coordinator: "Group IT Coordinator",
  employee: "Employee",
};

/** The subtitle under the wordmark in the sidebar. */
export const ROLE_AREAS = {
  admin: "Administration",
  group_it_coordinator: "Group Oversight",
  employee: "Employee Portal",
};

/** The path prefix each role's pages live under. */
const ROLE_HOME = {
  admin: "/admin/dashboard",
  group_it_coordinator: "/coordinator/dashboard",
  employee: "/employee/dashboard",
};

export function homePathForRole(role) {
  return ROLE_HOME[role] || "/login";
}

/** Whether a role is allowed to open a given path. */
export function canAccessPath(role, path) {
  if (!path) return false;
  if (path.startsWith("/admin")) return role === ROLES.admin;
  if (path.startsWith("/coordinator")) return role === ROLES.coordinator;
  if (path.startsWith("/employee")) return role === ROLES.employee;
  return true; // public paths like /403
}

/**
 * Decide where to send a user immediately after login.
 *
 * ProtectedRoute stashes the page you were bounced off in `location.state.from`
 * so you can be returned there. But that page belonged to whoever was blocked —
 * if an employee follows a stale /admin/assets link, gets bounced to login, and
 * signs in, sending them "back" to /admin/assets just bounces them again, this
 * time to /403. So we only honour `from` when the role can actually open it,
 * and otherwise fall through to that role's own home page.
 *
 *   resolveLandingPath("employee", "/admin/assets")       -> "/employee/dashboard"
 *   resolveLandingPath("employee", "/employee/my-assets") -> "/employee/my-assets"
 *   resolveLandingPath("admin", undefined)                -> "/admin/dashboard"
 */
export function resolveLandingPath(role, from) {
  if (from && from !== "/" && canAccessPath(role, from)) {
    return from;
  }
  return homePathForRole(role);
}
