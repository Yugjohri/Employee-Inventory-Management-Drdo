/**
 * Asset queries.
 *
 * What each caller gets back is decided by the server: an admin sees the whole
 * inventory, a Group IT Coordinator sees what their group holds, and an
 * employee sees only what's assigned to them. No filtering happens here.
 */

import { api } from "./client";

/**
 * The API returns the joined category as a flat `category_name`. Pages read
 * `asset.category.name`, so re-nest it here rather than touching every page.
 */
function withCategory(asset) {
  return {
    ...asset,
    category: asset.category_id
      ? { id: asset.category_id, name: asset.category_name }
      : null,
  };
}

export async function listAssets() {
  const rows = await api.get("/assets");
  return rows.map(withCategory);
}

/** Only assets free to hand out — powers the Assign Asset dropdown. */
export async function listAvailableAssets() {
  const rows = await api.get("/assets/available");
  return rows.map(withCategory);
}

export async function listCategories() {
  return api.get("/categories");
}

export async function createAsset(values) {
  return withCategory(await api.post("/assets", values));
}

export async function updateAsset(id, values) {
  return withCategory(await api.put(`/assets/${id}`, values));
}

export async function deleteAsset(id) {
  await api.del(`/assets/${id}`);
}
