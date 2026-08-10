/**
 * Employee queries.
 *
 * Accounts can now be created from inside the app. Under Supabase this needed
 * the service_role key, which could never ship to a browser; the API hashes
 * the password server-side instead, so nothing privileged reaches the client.
 *
 * Which employees come back is decided by the server: admins see everyone,
 * coordinators see their own group, employees see only themselves.
 */

import { api } from "./client";

export async function listEmployees() {
  return api.get("/employees");
}

/** Active employees eligible to receive an asset — the assign dropdown. */
export async function listAssignableEmployees() {
  return api.get("/employees/assignable");
}

export async function getEmployee(id) {
  return api.get(`/employees/${id}`);
}

export async function createEmployee(values) {
  return api.post("/employees", values);
}

export async function updateEmployee(id, values) {
  return api.put(`/employees/${id}`, values);
}

/** Resets to the server's configured default when no password is given. */
export async function resetPassword(id, password) {
  return api.post(`/employees/${id}/reset-password`, { password });
}

export async function listGroups() {
  return api.get("/groups");
}

export async function listDesignations() {
  return api.get("/designations");
}

export async function listCadres() {
  return api.get("/cadres");
}

export async function listInternalDesignations() {
  return api.get("/internal-designations");
}
