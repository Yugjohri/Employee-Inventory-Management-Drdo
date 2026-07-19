/**
 * useAuth
 *
 * Convenience hook so components can do:
 *   const { user, role, login, logout, isAuthenticated } = useAuth();
 * instead of importing useContext + AuthContext everywhere.
 */

import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an <AuthProvider>.");
  }

  return context;
}
