/**
 * Asset queries.
 *
 * All Supabase calls for assets live here rather than inside components, so
 * the select shapes stay consistent and pages only deal with plain data.
 *
 * Each function throws on failure; callers wrap in try/catch and surface the
 * message through the toast system.
 */

import { supabase } from "./supabaseClient";

/** Columns every asset view needs, including the joined category name. */
const ASSET_SELECT = `
  id, asset_tag, name, brand, model, serial_number, status,
  purchase_date, warranty_expiry, category_id,
  category:asset_categories ( id, name )
`;

export async function listAssets() {
  const { data, error } = await supabase
    .from("assets")
    .select(ASSET_SELECT)
    .order("asset_tag", { ascending: true });

  if (error) throw error;
  return data || [];
}

/** Only assets free to hand out -- powers the Assign Asset dropdown. */
export async function listAvailableAssets() {
  const { data, error } = await supabase
    .from("assets")
    .select(ASSET_SELECT)
    .eq("status", "available")
    .order("asset_tag", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function listCategories() {
  const { data, error } = await supabase
    .from("asset_categories")
    .select("id, name")
    .order("name", { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Empty strings from a form must become NULL, not "". A blank serial_number
 * saved as "" would collide with the next blank one on the unique index.
 */
function normalize(values) {
  const cleaned = {};
  Object.entries(values).forEach(([key, value]) => {
    cleaned[key] = typeof value === "string" && value.trim() === "" ? null : value;
  });
  return cleaned;
}

export async function createAsset(values) {
  const { data, error } = await supabase
    .from("assets")
    .insert(normalize(values))
    .select(ASSET_SELECT)
    .single();

  if (error) throw error;
  return data;
}

export async function updateAsset(id, values) {
  const { data, error } = await supabase
    .from("assets")
    .update(normalize(values))
    .eq("id", id)
    .select(ASSET_SELECT)
    .single();

  if (error) throw error;
  return data;
}

export async function deleteAsset(id) {
  const { error } = await supabase.from("assets").delete().eq("id", id);
  if (error) throw error;
}
