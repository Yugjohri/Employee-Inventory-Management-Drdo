/**
 * NotFound (404) — catch-all for unknown URLs.
 */

import StatusPage from "../components/common/StatusPage";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

export default function NotFound() {
  useDocumentTitle("Page not found");

  return (
    <StatusPage
      code="404"
      title="Page not found"
      description="That page doesn't exist. It may have been moved, or the link might be out of date."
    />
  );
}
