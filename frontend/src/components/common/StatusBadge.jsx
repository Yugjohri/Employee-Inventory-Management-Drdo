/**
 * StatusBadge
 *
 * The pill used for every status in the app -- asset statuses on the asset
 * tables, assignment statuses on the history table. Colours come from
 * theme.js so all of them change together.
 *
 *   <StatusBadge status="under_repair" />          -> orange "Under Repair"
 *   <StatusBadge status="returned" kind="assignment" /> -> gray "Returned"
 */

import Chip from "@mui/material/Chip";
import { getStatusStyle, getAssignmentStatusStyle } from "../../theme/theme";

export default function StatusBadge({ status, kind = "asset", size = "small" }) {
  if (!status) return null;

  const style = kind === "assignment" ? getAssignmentStatusStyle(status) : getStatusStyle(status);

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
        borderRadius: "6px",
        "& .MuiChip-label": { px: 1.25 },
      }}
    />
  );
}
