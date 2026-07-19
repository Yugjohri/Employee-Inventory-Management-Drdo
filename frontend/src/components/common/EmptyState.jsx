/**
 * EmptyState
 *
 * Shown instead of a blank card whenever a table or list has no rows.
 * Always gives the user something to do next where an action makes sense.
 *
 *   <EmptyState
 *     icon={<InventoryOutlinedIcon />}
 *     title="No assets yet"
 *     description="Add your first asset to start tracking inventory."
 *     actionLabel="Add Asset"
 *     onAction={openForm}
 *   />
 */

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import AddIcon from "@mui/icons-material/Add";
import { colors } from "../../theme/theme";

export default function EmptyState({
  icon,
  title = "Nothing here yet",
  description,
  actionLabel,
  onAction,
  compact = false,
}) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        gap: 1,
        px: 3,
        py: compact ? 4 : 7,
        height: "100%",
      }}
    >
      {icon && (
        <Box
          sx={{
            width: 56,
            height: 56,
            borderRadius: "14px",
            bgcolor: colors.canvas,
            color: colors.muted,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            mb: 1,
            "& svg": { fontSize: 28 },
          }}
        >
          {icon}
        </Box>
      )}

      <Typography variant="subtitle1">{title}</Typography>

      {description && (
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 360 }}>
          {description}
        </Typography>
      )}

      {actionLabel && onAction && (
        <Button variant="contained" startIcon={<AddIcon />} onClick={onAction} sx={{ mt: 2 }}>
          {actionLabel}
        </Button>
      )}
    </Box>
  );
}
