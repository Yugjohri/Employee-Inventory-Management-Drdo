/**
 * AuthContext
 *
 * Rewritten to use Supabase Auth instead of the old Flask /api/auth
 * endpoints. Supabase handles the session/token/refresh cycle for us
 * (persisted in localStorage under the hood, autoRefreshToken: true in
 * supabaseClient.js) -- we just need to:
 *   1. Ask Supabase who's currently signed in on load
 *   2. Look up their role/name/department from public.profiles
 *   3. Keep both in sync whenever Supabase reports an auth change
 */

import { createContext, useState, useEffect, useCallback } from "react";
import { supabase } from "../api/supabaseClient";

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);       // { id, name, email, role, department }
  const [loading, setLoading] = useState(true);

  // Returns the loaded profile (or null) so callers like login() can read
  // the role straight away instead of waiting for a re-render.
  const loadProfile = useCallback(async (authUser) => {
    if (!authUser) {
      setUser(null);
      return null;
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id, name, email, role, department, is_active")
      .eq("id", authUser.id)
      .single();

    if (error || !profile) {
      // Profile row missing (shouldn't happen if the handle_new_user
      // trigger from schema.sql ran) -- sign the user back out.
      await supabase.auth.signOut();
      setUser(null);
      return null;
    }

    if (!profile.is_active) {
      await supabase.auth.signOut();
      setUser(null);
      return null;
    }

    setUser(profile);
    return profile;
  }, []);

  useEffect(() => {
    let isMounted = true;

    // 1. Check for an existing session on first load (page refresh, etc.)
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!isMounted) return;
      await loadProfile(session?.user || null);
      setLoading(false);
    });

    // 2. Keep in sync with sign-in/sign-out events from anywhere in the app
    // (including other browser tabs).
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!isMounted) return;
      await loadProfile(session?.user || null);
    });

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, [loadProfile]);

  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new Error(error.message || "Invalid email or password.");
    }

    const profile = await loadProfile(data.user);

    if (!profile) {
      // loadProfile already signed them back out -- either the profile row
      // is missing or the account has been deactivated.
      throw new Error(
        "Your account isn't set up or has been deactivated. Contact your administrator."
      );
    }

    return profile;
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

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
