/**
 * StatCard
 *
 * A single metric: tinted rounded icon tile, big bold number, muted label.
 * Used on both dashboards so the two roles feel like one product.
 *
 *   <StatCard tone="green" icon={<CheckIcon />} label="Available" value={12} />
 *
 * `tone` picks from statTileColors in theme.js (blue / green / orange / purple).
 * While `loading`, the number is replaced by a skeleton of the same height so
 * the card doesn't resize when data lands.
 */

import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Skeleton from "@mui/material/Skeleton";

import { statTileColors } from "../../theme/theme";

export default function StatCard({ icon, label, value, tone = "blue", loading = false, hint }) {
  const palette = statTileColors[tone] || statTileColors.blue;

  return (
    <Card sx={{ height: "100%" }}>
      <CardContent sx={{ display: "flex", alignItems: "center", gap: 2 }}>
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: "12px",
            bgcolor: palette.bg,
            color: palette.main,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {icon}
        </Box>

        <Box sx={{ minWidth: 0 }}>
          {loading ? (
            <Skeleton variant="text" width={56} height={40} />
          ) : (
            <Typography variant="h4" lineHeight={1.15}>
              {value}
            </Typography>
          )}
          <Typography variant="caption" sx={{ fontWeight: 600, letterSpacing: "0.01em" }} noWrap>
            {label}
          </Typography>
          {hint && (
            <Typography variant="caption" display="block" color="text.disabled">
              {hint}
            </Typography>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}
