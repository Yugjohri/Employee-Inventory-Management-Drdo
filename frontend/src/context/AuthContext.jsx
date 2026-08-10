/**
 * AuthContext
 *
 * The session lives in an httpOnly cookie set by the API, so there's nothing
 * to persist or refresh here — the browser attaches it automatically and the
 * server decides whether it's still valid.
 *
 * On load we ask /auth/me who's signed in. That call also re-reads the user's
 * role and group from the database, so a role change by an admin takes effect
 * on the next request rather than lingering until the session expires.
 */

import { createContext, useState, useEffect, useCallback } from "react";
import { api } from "../api/client";

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function restore() {
      try {
        const { user: current } = await api.get("/auth/me");
        if (isMounted) setUser(current);
      } catch {
        // 401 simply means "not signed in", which is a normal first visit.
        if (isMounted) setUser(null);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    restore();
    return () => {
      isMounted = false;
    };
  }, []);

  /** Returns the signed-in profile so callers can read the role immediately
   *  rather than waiting for a re-render. */
  const login = useCallback(async (username, password) => {
    const { user: signedIn } = await api.post("/auth/login", { username, password });
    setUser(signedIn);
    return signedIn;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout", {});
    } finally {
      // Clear locally even if the request failed — the user asked to leave.
      setUser(null);
    }
  }, []);

  const value = {
    user,
    isAuthenticated: !!user,
    role: user?.role || null,
    loading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
