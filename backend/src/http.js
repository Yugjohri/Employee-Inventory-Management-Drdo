/**
 * Shared HTTP plumbing: error type, async wrapper, validation helpers and the
 * central error handler.
 *
 * Kept deliberately small — a handful of functions rather than a validation
 * framework, since the API has a dozen endpoints and fixed shapes.
 */

/** An error with an intended HTTP status. Anything else becomes a 500. */
export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const badRequest = (message) => new ApiError(400, message);
export const unauthorized = (message = "Not signed in.") => new ApiError(401, message);
export const forbidden = (message = "You don't have access to this.") => new ApiError(403, message);
export const notFound = (message = "Not found.") => new ApiError(404, message);

/**
 * Wraps an async route so a rejected promise reaches the error handler.
 * Without this, Express 4 leaves the request hanging until it times out.
 */
export function route(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

// --- validation -------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A uuid path param, or a 404 — a malformed id is indistinguishable from a
 *  missing row as far as the caller should be concerned. */
export function uuidParam(value, name = "id") {
  if (typeof value !== "string" || !UUID_RE.test(value)) {
    throw notFound(`No such ${name}.`);
  }
  return value;
}

/** Trimmed non-empty string. */
export function requireText(value, label, { max = 500 } = {}) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) throw badRequest(`${label} is required.`);
  if (text.length > max) throw badRequest(`${label} must be ${max} characters or fewer.`);
  return text;
}

/** Trimmed string, or null when blank. Blank must become NULL, not "" —
 *  an empty serial number saved as "" collides with the next one on the
 *  unique index. */
export function optionalText(value, { max = 500 } = {}) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  if (!text) return null;
  if (text.length > max) throw badRequest(`Value must be ${max} characters or fewer.`);
  return text;
}

export function optionalUuid(value, name) {
  const text = optionalText(value);
  if (text === null) return null;
  if (!UUID_RE.test(text)) throw badRequest(`Invalid ${name}.`);
  return text;
}

export function optionalDate(value, label) {
  const text = optionalText(value);
  if (text === null) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(Date.parse(text))) {
    throw badRequest(`${label} must be a valid date.`);
  }
  return text;
}

export function oneOf(value, allowed, label) {
  if (!allowed.includes(value)) {
    throw badRequest(`${label} must be one of: ${allowed.join(", ")}.`);
  }
  return value;
}

// --- error handling ---------------------------------------------------------

/**
 * Turns database errors into messages a user can act on.
 *
 * Postgres codes we expect to surface:
 *   23505 unique violation      — duplicate asset tag / serial / username
 *   23514 check violation       — a status or request shape the schema rejects
 *   23503 foreign key violation — referencing something that isn't there
 *   42501 insufficient privilege— raised by our own functions' admin checks
 */
function translateDbError(error) {
  const constraint = error.constraint || "";

  if (error.code === "23505") {
    if (constraint.includes("asset_tag")) return badRequest("That asset tag is already in use.");
    if (constraint.includes("serial_number")) return badRequest("That serial number is already recorded against another asset.");
    if (constraint.includes("username")) return badRequest("That username is already taken.");
    if (constraint.includes("email")) return badRequest("That email address is already registered.");
    if (constraint.includes("pis_number")) return badRequest("That PIS number is already registered.");
    if (constraint.includes("one_active_per_asset")) return badRequest("That asset is already assigned to someone.");
    if (constraint.includes("one_open_repair")) return badRequest("You already have an open repair request for this asset.");
    return badRequest("That value is already in use.");
  }

  if (error.code === "23514") {
    if (constraint === "coordinator_needs_group") return badRequest("A Group IT Coordinator must be assigned to a group.");
    if (constraint === "request_shape") return badRequest("That request is missing the asset it refers to.");
    return badRequest("Some of those values aren't valid.");
  }

  if (error.code === "23503") return badRequest("That references a record which no longer exists.");
  if (error.code === "42501") return forbidden(error.message);

  return null;
}

export function errorHandler(error, _req, res, _next) {
  const translated = error.code ? translateDbError(error) : null;
  const finalError = translated || error;

  if (finalError instanceof ApiError) {
    res.status(finalError.status).json({ error: finalError.message });
    return;
  }

  // Errors raised by our own plpgsql functions (RAISE EXCEPTION) carry a
  // message written for the user, so pass it through rather than hiding it.
  if (error.code === "P0001" && error.message) {
    res.status(400).json({ error: error.message });
    return;
  }

  console.error("[api] unhandled error:", error);
  res.status(500).json({ error: "Something went wrong. Please try again." });
}
