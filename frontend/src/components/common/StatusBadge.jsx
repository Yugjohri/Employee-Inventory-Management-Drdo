/**
 * StatusBadge
 *
 * The pill used for every status in the app — asset statuses on the asset
 * tables, assignment statuses on the history table, request statuses on the
 * request queues. Colours come from theme.js so all of them change together.
 *
 *   <StatusBadge status="under_repair" />                -> amber "Under Repair"
 *   <StatusBadge status="returned" kind="assignment" />  -> grey  "Returned"
 *   <StatusBadge status="pending"  kind="request" />     -> amber "Pending"
 */

import Chip from "@mui/material/Chip";
import {
  getStatusStyle,
  getAssignmentStatusStyle,
  getRequestStatusStyle,
} from "../../theme/theme";

const STYLE_BY_KIND = {
  asset: getStatusStyle,
  assignment: getAssignmentStatusStyle,
  request: getRequestStatusStyle,
};

export default function StatusBadge({ status, kind = "asset", size = "small" }) {
  if (!status) return null;

  const resolve = STYLE_BY_KIND[kind] || getStatusStyle;
  const style = resolve(status);

  return (
    <Chip
      label={style.label}
      size={size}
      sx={{
        bgcolor: style.bg,
        color: style.main,
        fontWeight: 600,
        fontSize: 12,
        height: 24,
        borderRadius: "4px",
        "& .MuiChip-label": { px: 1.25 },
      }}
    />
  );
}
