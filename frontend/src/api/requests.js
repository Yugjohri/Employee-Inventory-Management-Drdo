/**
 * Asset requests — repairs and new-item requests.
 *
 * Employees raise them, admins resolve them, coordinators watch their group's.
 */

import { api } from "./client";

export const REQUEST_TYPES = {
  repair: "Repair",
  new_asset: "New Item",
};

export const REQUEST_STATUSES = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  completed: "Completed",
};

/** Everything the caller may see — admins get the whole queue. */
export async function listRequests() {
  return api.get("/requests");
}

/** Only the requests the signed-in employee raised. */
export async function listMyRequests() {
  return api.get("/requests?scope=mine");
}

/**
 * Raise a request.
 *   repair    — needs assetId (something they currently hold)
 *   new_asset — needs categoryId (the kind of item they want)
 */
export async function createRequest({ requestType, assetId, categoryId, description }) {
  return api.post("/requests", {
    request_type: requestType,
    asset_id: requestType === "repair" ? assetId : null,
    category_id: requestType === "new_asset" ? categoryId : null,
    description,
  });
}

export async function resolveRequest(id, { status, adminRemarks }) {
  return api.post(`/requests/${id}/resolve`, {
    status,
    admin_remarks: adminRemarks || null,
  });
}
