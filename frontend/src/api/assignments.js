/**
 * Assignment queries.
 *
 * The API nests `asset` and `employee` objects into each row, matching the
 * shape the pages already read.
 */

import { api } from "./client";

/** Every assignment the caller is allowed to see, newest first. */
export async function listAssignments() {
  return api.get("/assignments");
}

/** The signed-in employee's currently-held assets. */
export async function listMyAssignments() {
  return api.get("/assignments?scope=mine");
}

/**
 * One assignment by id, or null when it isn't theirs to see.
 *
 * A 404 here is the expected outcome whenever the access rules filter out
 * someone else's assignment, so it becomes null and the page shows its own
 * message. Anything else is a real failure and is re-thrown.
 */
export async function getAssignment(assignmentId) {
  try {
    return await api.get(`/assignments/${assignmentId}`);
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
}

/** Atomic: inserts the assignment and flips the asset to 'assigned'. */
export async function assignAsset({ assetId, employeeId, remarks }) {
  return api.post("/assignments", {
    asset_id: assetId,
    employee_id: employeeId,
    remarks: remarks || null,
  });
}

/** Atomic: marks the assignment returned and frees the asset. */
export async function returnAssignment(assignmentId) {
  return api.post(`/assignments/${assignmentId}/return`, {});
}
