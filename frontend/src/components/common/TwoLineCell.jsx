/**
 * TwoLineCell
 *
 * A table cell showing a bold primary line with a muted secondary line under
 * it -- asset tag over asset name, employee name over email, and so on.
 *
 * Exists because doing this inline left the two lines drifting apart: MUI's
 * default line-heights (1.43 for body2, 1.66 for caption) plus a stretched
 * container pushed the secondary line toward the bottom of the row. Setting
 * an explicit flex column with tightened line-heights keeps the pair reading
 * as one unit, identically in every table.
 */

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

export default function TwoLineCell({ primary, secondary }) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        minWidth: 0,
        height: "100%",
      }}
    >
      <Typography
        variant="body2"
        fontWeight={600}
        color="text.primary"
        noWrap
        sx={{ lineHeight: 1.35 }}
      >
        {primary}
      </Typography>

      {secondary && (
        <Typography
          variant="caption"
          noWrap
          sx={{ lineHeight: 1.35, display: "block" }}
        >
          {secondary}
        </Typography>
      )}
    </Box>
  );
}
