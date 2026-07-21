/**
 * Assignment queries.
 *
 * assign() and returnAssignment() call Postgres functions rather than writing
 * two tables from the browser -- see backend/supabase/functions.sql for why.
 */

import { supabase } from "./supabaseClient";

const ASSIGNMENT_SELECT = `
  id, assigned_date, returned_date, status, remarks,
  asset:assets (
    id, asset_tag, name, brand, model, serial_number, status, warranty_expiry,
    category:asset_categories ( name )
  ),
  employee:profiles ( id, name, email, department )
`;

/** Every assignment, newest first. Admin only (RLS returns [] otherwise). */
export async function listAssignments() {
  const { data, error } = await supabase
    .from("assignments")
    .select(ASSIGNMENT_SELECT)
    .order("assigned_date", { ascending: false });

  if (error) throw error;
  return data || [];
}

/** The signed-in employee's currently-held assets. */
export async function listMyAssignments(employeeId) {
  const { data, error } = await supabase
    .from("assignments")
    .select(ASSIGNMENT_SELECT)
    .eq("employee_id", employeeId)
    .eq("status", "active")
    .order("assigned_date", { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * One assignment by id, or null if it doesn't exist / isn't yours.
 *
 * Uses maybeSingle() rather than single(). single() treats "zero rows" as an
 * error and surfaces PostgREST's raw "Cannot coerce the result to a single
 * JSON object", which is meaningless to a user -- and zero rows is the
 * expected outcome here whenever RLS filters out someone else's assignment.
 * maybeSingle() returns null instead, letting the page show a real message.
 */
export async function getAssignment(assignmentId) {
  const { data, error } = await supabase
    .from("assignments")
    .select(ASSIGNMENT_SELECT)
    .eq("id", assignmentId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/** Atomic: inserts the assignment and flips the asset to 'assigned'. */
export async function assignAsset({ assetId, employeeId, remarks }) {
  const { data, error } = await supabase.rpc("assign_asset", {
    p_asset_id: assetId,
    p_employee_id: employeeId,
    p_remarks: remarks || null,
  });

  if (error) throw error;
  return data;
}

/** Atomic: marks the assignment returned and frees the asset. */
export async function returnAssignment(assignmentId) {
  const { data, error } = await supabase.rpc("return_assignment", {
    p_assignment_id: assignmentId,
    p_remarks: null,
  });

  if (error) throw error;
  return data;
}
