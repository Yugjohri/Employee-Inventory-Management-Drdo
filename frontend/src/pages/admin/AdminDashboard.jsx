/**
 * AdminDashboard
 *
 * Overview screen: four stat cards, two charts, and a recent-assignments
 * table. Assets and assignments are each fetched once here and shared across
 * all the widgets rather than every widget running its own query.
 *
 * Rows whose warranty ends within 60 days get an amber tint so expiring
 * hardware is visible without opening anything.
 */

import { useEffect, useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Skeleton from "@mui/material/Skeleton";
import Tooltip from "@mui/material/Tooltip";

import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import AssignmentIndOutlinedIcon from "@mui/icons-material/AssignmentIndOutlined";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import AssignmentOutlinedIcon from "@mui/icons-material/AssignmentOutlined";

import PageHeader from "../../components/common/PageHeader";
import StatCard from "../../components/common/StatCard";
import StatusBadge from "../../components/common/StatusBadge";
import EmptyState from "../../components/common/EmptyState";
import { AssetsByCategoryChart, AssetsByStatusChart } from "../../components/admin/AssetCharts";

import { listAssets } from "../../api/assets";
import { listAssignments } from "../../api/assignments";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../context/ToastContext";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { formatDate, isExpiringSoon, WARRANTY_SOON_DAYS, EMPTY } from "../../utils/formatters";
import { warrantyColors } from "../../theme/theme";

export default function AdminDashboard() {
  useDocumentTitle("Dashboard");
  const { user } = useAuth();
  const toast = useToast();

  const [assets, setAssets] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setLoading(true);
      try {
        const [assetRows, assignmentRows] = await Promise.all([listAssets(), listAssignments()]);
        if (isMounted) {
          setAssets(assetRows);
          setAssignments(assignmentRows);
        }
      } catch (err) {
        if (isMounted) toast.error(err?.message || "Couldn't load dashboard data.");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    load();
    return () => {
      isMounted = false;
    };
  }, [toast]);

  const stats = useMemo(
    () => ({
      total: assets.length,
      available: assets.filter((a) => a.status === "available").length,
      assigned: assets.filter((a) => a.status === "assigned").length,
      expiringSoon: assets.filter((a) => isExpiringSoon(a.warranty_expiry)).length,
    }),
    [assets]
  );

  const recentAssignments = useMemo(() => assignments.slice(0, 6), [assignments]);

  return (
    <Box>
      <PageHeader
        title={`Welcome back${user?.name ? `, ${user.name.split(" ")[0]}` : ""}`}
        description="Here's the current state of your hardware inventory."
      />

      {/* Stat row */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            tone="blue" icon={<Inventory2OutlinedIcon />}
            label="Total Assets" value={stats.total} loading={loading}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            tone="green" icon={<CheckCircleOutlineIcon />}
            label="Available" value={stats.available} loading={loading}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            tone="purple" icon={<AssignmentIndOutlinedIcon />}
            label="Assigned" value={stats.assigned} loading={loading}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            tone="orange" icon={<WarningAmberOutlinedIcon />}
            label="Warranty Expiring" value={stats.expiringSoon} loading={loading}
            hint={`within ${WARRANTY_SOON_DAYS} days`}
          />
        </Grid>
      </Grid>

      {/* Charts */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={5}>
          <AssetsByCategoryChart assets={assets} loading={loading} />
        </Grid>
        <Grid item xs={12} md={7}>
          <AssetsByStatusChart assets={assets} loading={loading} />
        </Grid>
      </Grid>

      {/* Recent assignments */}
      <Card>
        <CardContent sx={{ pb: "8px !important" }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              mb: 1,
            }}
          >
            <Box>
              <Typography variant="subtitle1">Recent Assignments</Typography>
              <Typography variant="caption">Latest hardware handed out</Typography>
            </Box>
            <Button component={RouterLink} to="/admin/assignments" size="small">
              View all
            </Button>
          </Box>
        </CardContent>

        <Box sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                {["Asset", "Assigned To", "Assigned", "Warranty", "Status"].map((heading) => (
                  <TableCell
                    key={heading}
                    sx={{
                      bgcolor: "#F8FAFC",
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "text.disabled",
                    }}
                  >
                    {heading}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>

            <TableBody>
              {loading &&
                [1, 2, 3, 4].map((row) => (
                  <TableRow key={row}>
                    <TableCell colSpan={5}>
                      <Skeleton variant="text" height={28} />
                    </TableCell>
                  </TableRow>
                ))}

              {!loading && recentAssignments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} sx={{ border: "none" }}>
                    <EmptyState
                      icon={<AssignmentOutlinedIcon />}
                      title="No assignments yet"
                      description="Assign an asset to an employee to see it here."
                      compact
                    />
                  </TableCell>
                </TableRow>
              )}

              {!loading &&
                recentAssignments.map((item) => {
                  const warrantySoon = isExpiringSoon(item.asset?.warranty_expiry);
                  return (
                    <TableRow
                      key={item.id}
                      sx={{
                        // Amber tint flags hardware going out of warranty.
                        bgcolor: warrantySoon ? warrantyColors.expiringSoon.bg : "transparent",
                        "&:hover": { bgcolor: warrantySoon ? "#FDE9C8" : "#F8FAFC" },
                      }}
                    >
                      <TableCell>
                        <Typography variant="body2" fontWeight={600} color="text.primary">
                          {item.asset?.asset_tag || EMPTY}
                        </Typography>
                        <Typography variant="caption">{item.asset?.name || EMPTY}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.primary">
                          {item.employee?.name || item.employee?.email || EMPTY}
                        </Typography>
                      </TableCell>
                      <TableCell>{formatDate(item.assigned_date)}</TableCell>
                      <TableCell>
                        {warrantySoon ? (
                          <Tooltip title={`Expires within ${WARRANTY_SOON_DAYS} days`}>
                            <Typography
                              variant="body2"
                              sx={{ color: warrantyColors.expiringSoon.main, fontWeight: 600 }}
                            >
                              {formatDate(item.asset?.warranty_expiry)}
                            </Typography>
                          </Tooltip>
                        ) : (
                          formatDate(item.asset?.warranty_expiry)
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={item.status} kind="assignment" />
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </Box>
      </Card>
    </Box>
  );
}
