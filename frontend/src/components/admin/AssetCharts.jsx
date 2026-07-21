/**
 * Dashboard charts: assets by category (donut) and assets by status (bar).
 *
 * Both take the already-fetched asset list and aggregate in memory -- the
 * dashboard loads assets once and shares them across the stat cards and both
 * charts rather than issuing three separate queries.
 *
 * Recharts needs a parent with a real height, hence the fixed-height Box
 * around each ResponsiveContainer.
 */

import { useMemo } from "react";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Skeleton from "@mui/material/Skeleton";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";

import EmptyState from "../common/EmptyState";
import DonutLargeOutlinedIcon from "@mui/icons-material/DonutLargeOutlined";
import { chartPalette, statusColors, colors } from "../../theme/theme";

const CHART_HEIGHT = 280;

/** Shared card wrapper so both charts sit in identical containers. */
function ChartCard({ title, description, loading, isEmpty, children }) {
  return (
    <Card sx={{ height: "100%" }}>
      <CardContent>
        <Typography variant="subtitle1">{title}</Typography>
        {description && (
          <Typography variant="caption" display="block" sx={{ mb: 1 }}>
            {description}
          </Typography>
        )}

        <Box sx={{ height: CHART_HEIGHT, mt: 1 }}>
          {loading ? (
            <Skeleton variant="rounded" height={CHART_HEIGHT} />
          ) : isEmpty ? (
            <EmptyState
              icon={<DonutLargeOutlinedIcon />}
              title="No data to chart"
              description="Add assets to see this breakdown."
              compact
            />
          ) : (
            children
          )}
        </Box>
      </CardContent>
    </Card>
  );
}

const tooltipStyle = {
  borderRadius: 8,
  border: `1px solid ${colors.border}`,
  fontSize: 13,
  boxShadow: "0 8px 24px rgba(15,23,42,0.1)",
};

export function AssetsByCategoryChart({ assets = [], loading = false }) {
  const data = useMemo(() => {
    const counts = new Map();
    assets.forEach((asset) => {
      const name = asset.category?.name || "Uncategorised";
      counts.set(name, (counts.get(name) || 0) + 1);
    });
    return Array.from(counts, ([name, value]) => ({ name, value })).sort(
      (a, b) => b.value - a.value
    );
  }, [assets]);

  return (
    <ChartCard
      title="Assets by Category"
      description="How the inventory splits across hardware types"
      loading={loading}
      isEmpty={data.length === 0}
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={62}
            outerRadius={95}
            paddingAngle={2}
            stroke="none"
          >
            {data.map((entry, index) => (
              <Cell key={entry.name} fill={chartPalette[index % chartPalette.length]} />
            ))}
          </Pie>
          <RechartsTooltip contentStyle={tooltipStyle} />
          <Legend
            verticalAlign="bottom"
            height={36}
            iconType="circle"
            formatter={(value) => (
              <span style={{ color: colors.body, fontSize: 13 }}>{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function AssetsByStatusChart({ assets = [], loading = false }) {
  const data = useMemo(() => {
    // Start from statusColors so every status shows a bar even at zero --
    // an empty "Under Repair" column is information too.
    return Object.entries(statusColors).map(([key, { label, main }]) => ({
      name: label,
      value: assets.filter((asset) => asset.status === key).length,
      fill: main,
    }));
  }, [assets]);

  return (
    <ChartCard
      title="Assets by Status"
      description="Current state of every tracked item"
      loading={loading}
      isEmpty={assets.length === 0}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={colors.border} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 12, fill: colors.muted }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 12, fill: colors.muted }}
            axisLine={false}
            tickLine={false}
          />
          <RechartsTooltip
            contentStyle={tooltipStyle}
            cursor={{ fill: "rgba(79, 70, 229, 0.06)" }}
          />
          <Bar dataKey="value" name="Assets" radius={[6, 6, 0, 0]} maxBarSize={64}>
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
