/**
 * AppRoutes
 *
 * Central route definitions. Role-based access is enforced by wrapping route
 * groups in <ProtectedRoute allowedRoles={[...]} />, and all three role groups
 * sit inside the same <DashboardLayout /> so every role gets an identical
 * shell with different nav links.
 *
 * These guards decide what the UI will render. They are not the security
 * boundary — the API re-checks the role on every request, and the database
 * access rules apply underneath that. Bypassing a guard here gets you an empty
 * page, not someone else's data.
 *
 * Route map:
 *   /login             public
 *   /admin/*           admin only
 *   /coordinator/*     group IT coordinator only
 *   /employee/*        employee only
 *   /403               role not permitted
 *   *                  404 fallback
 */

import { Routes, Route, Navigate } from "react-router-dom";

import ProtectedRoute from "../components/common/ProtectedRoute";
import DashboardLayout from "../components/common/DashboardLayout";
import FullPageLoader from "../components/common/FullPageLoader";
import { useAuth } from "../hooks/useAuth";
import { homePathForRole } from "../utils/navigation";

import Login from "../pages/Login";
import Forbidden from "../pages/Forbidden";
import NotFound from "../pages/NotFound";

import AdminDashboard from "../pages/admin/AdminDashboard";
import ManageAssets from "../pages/admin/ManageAssets";
import ManageEmployees from "../pages/admin/ManageEmployees";
import AssignmentHistory from "../pages/admin/AssignmentHistory";
import ManageRequests from "../pages/admin/ManageRequests";

import CoordinatorDashboard from "../pages/coordinator/CoordinatorDashboard";
import GroupInventory from "../pages/coordinator/GroupInventory";
import GroupRequests from "../pages/coordinator/GroupRequests";

import EmployeeDashboard from "../pages/employee/EmployeeDashboard";
import MyAssets from "../pages/employee/MyAssets";
import AssetDetails from "../pages/employee/AssetDetails";
import MyRequests from "../pages/employee/MyRequests";
import Profile from "../pages/employee/Profile";

/** Sends an already-authenticated user to their correct home page. */
function RoleBasedRedirect() {
  const { isAuthenticated, role, loading } = useAuth();

  if (loading) return <FullPageLoader message="Checking your session…" />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return <Navigate to={homePathForRole(role)} replace />;
}

export default function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<Login />} />
      <Route path="/403" element={<Forbidden />} />

      {/* Root — redirect based on role */}
      <Route path="/" element={<RoleBasedRedirect />} />

      {/* Admin */}
      <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
        <Route element={<DashboardLayout />}>
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/assets" element={<ManageAssets />} />
          <Route path="/admin/employees" element={<ManageEmployees />} />
          <Route path="/admin/assignments" element={<AssignmentHistory />} />
          <Route path="/admin/requests" element={<ManageRequests />} />
        </Route>
      </Route>

      {/* Group IT Coordinator — same view-only shape as an employee, but
          scoped to their group instead of to themselves. */}
      <Route element={<ProtectedRoute allowedRoles={["group_it_coordinator"]} />}>
        <Route element={<DashboardLayout />}>
          <Route path="/coordinator/dashboard" element={<CoordinatorDashboard />} />
          {/* Same screen the admin uses — it adapts to the signed-in role.
              A coordinator can maintain their own group's staff there. */}
          <Route path="/coordinator/employees" element={<ManageEmployees />} />
          <Route path="/coordinator/assignments" element={<GroupInventory />} />
          <Route path="/coordinator/requests" element={<GroupRequests />} />
        </Route>
      </Route>

      {/* Employee */}
      <Route element={<ProtectedRoute allowedRoles={["employee"]} />}>
        <Route element={<DashboardLayout />}>
          <Route path="/employee/dashboard" element={<EmployeeDashboard />} />
          <Route path="/employee/my-assets" element={<MyAssets />} />
          <Route path="/employee/assets/:assignmentId" element={<AssetDetails />} />
          <Route path="/employee/requests" element={<MyRequests />} />
          <Route path="/employee/profile" element={<Profile />} />
        </Route>
      </Route>

      {/* Fallback */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
