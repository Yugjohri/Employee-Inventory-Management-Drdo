/**
 * PageHeader
 *
 * The title row that opens every page: heading + one-line description on the
 * left, primary action button on the right. Having it in one component is
 * what keeps the vertical rhythm identical from page to page.
 */

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";

export default function PageHeader({ title, description, actionLabel, actionIcon, onAction, children }) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: { xs: "stretch", sm: "flex-start" },
        justifyContent: "space-between",
        flexDirection: { xs: "column", sm: "row" },
        gap: 2,
        mb: 3,
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="h5">{title}</Typography>
        {description && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {description}
          </Typography>
        )}
      </Box>

      {children}

      {actionLabel && onAction && (
        <Button
          variant="contained"
          startIcon={actionIcon}
          onClick={onAction}
          sx={{ flexShrink: 0, alignSelf: { xs: "flex-start", sm: "auto" } }}
        >
          {actionLabel}
        </Button>
      )}
    </Box>
  );
}
