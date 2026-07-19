/**
 * Forbidden (403) — where ProtectedRoute sends a signed-in user whose role
 * doesn't cover the page they asked for.
 */

import StatusPage from "../components/common/StatusPage";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

export default function Forbidden() {
  useDocumentTitle("Access denied");

  return (
    <StatusPage
      code="403"
      title="Access denied"
      description="You don't have permission to view this page. If you think that's wrong, contact your administrator."
    />
  );
}
