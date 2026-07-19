/**
 * useDocumentTitle
 *
 * Sets the browser tab title per page, e.g. "AssetTrack — Manage Assets".
 * Restores the previous title on unmount so navigating away never leaves a
 * stale one behind.
 *
 *   useDocumentTitle("Dashboard");
 */

import { useEffect } from "react";

const BASE_TITLE = "AssetTrack";

export function useDocumentTitle(pageTitle) {
  useEffect(() => {
    const previous = document.title;
    document.title = pageTitle ? `${BASE_TITLE} — ${pageTitle}` : BASE_TITLE;

    return () => {
      document.title = previous;
    };
  }, [pageTitle]);
}
