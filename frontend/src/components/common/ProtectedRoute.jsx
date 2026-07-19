/**
 * ProtectedRoute
 *
 * Wraps route elements to enforce:
 *   1. The user is authenticated (otherwise -> /login)
 *   2. The user's role is permitted for this route (otherwise -> /403)
 *
 * Usage:
 *   <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
 *     <Route path="/admin/assets" element={<ManageAssets />} />
 *   </Route>
 */

import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import FullPageLoader from "./FullPageLoader";

export default function ProtectedRoute({ allowedRoles }) {
  const { isAuthenticated, role, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    // Avoid flashing a redirect while the session is still being restored
    // from a stored token on initial page load.
    return <FullPageLoader message="Checking your session…" />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to="/403" replace />;
  }

  return <Outlet />;
}
