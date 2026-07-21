/**
 * Small display helpers shared across pages.
 *
 * formatDate/daysUntil were previously copy-pasted into EmployeeDashboard,
 * MyAssets and AssetDetails (with AssetDetails using a slightly different
 * date style), and getInitials lived inside Navbar where nothing else could
 * reach it. One copy each, imported everywhere.
 */

/** The dash shown in place of a missing value. */
export const EMPTY = "—";

/**
 * Format an ISO date for display.
 *   formatDate("2025-03-14")           -> "Mar 14, 2025"
 *   formatDate("2025-03-14", "long")   -> "March 14, 2025"
 *   formatDate(null)                   -> "—"
 */
export function formatDate(isoDate, monthStyle = "short") {
  if (!isoDate) return EMPTY;

  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return EMPTY;

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: monthStyle,
    day: "numeric",
  });
}

/**
 * Whole days from now until an ISO date. Negative means it's already past,
 * null means there was no date to measure.
 *
 *   daysUntil("2025-12-31") -> 45
 *   daysUntil(null)         -> null
 */
export function daysUntil(isoDate) {
  if (!isoDate) return null;

  const time = new Date(isoDate).getTime();
  if (Number.isNaN(time)) return null;

  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  return Math.ceil((time - Date.now()) / MS_PER_DAY);
}

/**
 * How many days out counts as "expiring soon" for warranty badges and the
 * amber row highlight on the dashboards.
 */
export const WARRANTY_SOON_DAYS = 60;

/** True when a warranty is still valid but expires within the window. */
export function isExpiringSoon(isoDate, withinDays = WARRANTY_SOON_DAYS) {
  const days = daysUntil(isoDate);
  return days !== null && days >= 0 && days <= withinDays;
}

/** True when a warranty date has already passed. */
export function isExpired(isoDate) {
  const days = daysUntil(isoDate);
  return days !== null && days < 0;
}

/**
 * Initials for an avatar, capped at two letters.
 *   getInitials("Alice Kumar") -> "AK"
 *   getInitials(null)          -> "?"
 */
export function getInitials(name) {
  if (!name) return "?";

  const initials = name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return initials || "?";
}
