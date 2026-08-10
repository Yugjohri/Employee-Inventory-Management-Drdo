/**
 * API client.
 *
 * Replaces supabaseClient.js. Everything now goes to our own Express server
 * on the same host — there are no external services and no API keys in the
 * browser at all.
 *
 * The session is an httpOnly cookie the server sets at login, so there is no
 * token for this file to store or attach: `credentials: "include"` is the
 * whole of it. JavaScript can't read the cookie, which means an XSS bug can't
 * steal the session.
 */

/**
 * Same-origin in production (Express serves the built app). In development
 * Vite proxies /api to the API server — see vite.config.js — so this stays a
 * relative path either way and no host name is ever hard-coded.
 */
const BASE = "/api";

/** Thrown for any non-2xx response, carrying the server's message. */
export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request(path, { method = "GET", body, signal } = {}) {
  let response;

  try {
    response = await fetch(`${BASE}${path}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      credentials: "include",
      signal,
    });
  } catch (error) {
    // fetch only rejects on a transport failure, which here means the API
    // process isn't running or the machine can't be reached.
    if (error.name === "AbortError") throw error;
    throw new ApiError(0, "Can't reach the server. Check that the application service is running.");
  }

  if (response.status === 204) return null;

  // An error page from a proxy or a crashed process won't be JSON.
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(
      response.status,
      payload?.error || `Request failed (${response.status}).`
    );
  }

  return payload;
}

export const api = {
  get: (path, options) => request(path, options),
  post: (path, body, options) => request(path, { ...options, method: "POST", body }),
  put: (path, body, options) => request(path, { ...options, method: "PUT", body }),
  del: (path, options) => request(path, { ...options, method: "DELETE" }),
};
