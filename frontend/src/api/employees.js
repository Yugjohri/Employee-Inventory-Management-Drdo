/**
 * Employee (profile) queries.
 *
 * Note there is no create() here. Accounts are created in Supabase Auth --
 * signing someone up requires the auth admin API and a service_role key,
 * which must never reach the browser. The app manages the *profile* half:
 * name, department, role and the active toggle.
 */

import { supabase } from "./supabaseClient";

const PROFILE_SELECT = "id, name, email, role, department, is_active, created_at";

export async function listProfiles() {
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_SELECT)
    .order("name", { ascending: true });

  if (error) throw error;
  return data || [];
}

/** Active employees only -- powers the Assign Asset dropdown. */
export async function listAssignableEmployees() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, email, department")
    .eq("is_active", true)
    .eq("role", "employee")
    .order("name", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function updateProfile(id, values) {
  const { data, error } = await supabase
    .from("profiles")
    .update(values)
    .eq("id", id)
    .select(PROFILE_SELECT)
    .single();

  if (error) throw error;
  return data;
}
