/**
 * AppRoutes
 *
 * Central route definitions. Role-based access is enforced by wrapping route
 * groups in <ProtectedRoute allowedRoles={[...]} />, and both role groups sit
 * inside the same <DashboardLayout /> so admins and employees get an
 * identical shell with different nav links.
 *
 * Route map:
 *   /login                          public
 *   /admin/*                        admin only
 *   /employee/*                     employee only
 *   /403                            role not permitted
 *   *                               404 fallback
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

import EmployeeDashboard from "../pages/employee/EmployeeDashboard";
import MyAssets from "../pages/employee/MyAssets";
import AssetDetails from "../pages/employee/AssetDetails";
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

      {/* Root -- redirect based on role */}
      <Route path="/" element={<RoleBasedRedirect />} />

      {/* Admin */}
      <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
        <Route element={<DashboardLayout />}>
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/assets" element={<ManageAssets />} />
          <Route path="/admin/employees" element={<ManageEmployees />} />
          <Route path="/admin/assignments" element={<AssignmentHistory />} />
        </Route>
      </Route>

      {/* Employee */}
      <Route element={<ProtectedRoute allowedRoles={["employee"]} />}>
        <Route element={<DashboardLayout />}>
          <Route path="/employee/dashboard" element={<EmployeeDashboard />} />
          <Route path="/employee/my-assets" element={<MyAssets />} />
          <Route path="/employee/assets/:assignmentId" element={<AssetDetails />} />
          <Route path="/employee/profile" element={<Profile />} />
        </Route>
      </Route>

      {/* Fallback */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
