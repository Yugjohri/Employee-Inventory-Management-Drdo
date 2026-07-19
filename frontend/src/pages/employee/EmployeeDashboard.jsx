/**
 * EmployeeDashboard
 *
 * The employee's view of what they're holding: stat cards, then a table of
 * their most recent assets. Uses the same StatCard / StatusBadge / EmptyState
 * primitives as the admin dashboard so the two roles feel like one product.
 *
 * RLS (see schema.sql) guarantees the query only ever returns rows where
 * employee_id = the signed-in user, so there's no ownership check here.
 *
 * The shell (dark sidebar, logout) comes from DashboardLayout.
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
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import VerifiedUserOutlinedIcon from "@mui/icons-material/VerifiedUserOutlined";

import PageHeader from "../../components/common/PageHeader";
import StatCard from "../../components/common/StatCard";
import StatusBadge from "../../components/common/StatusBadge";
import EmptyState from "../../components/common/EmptyState";

import { listMyAssignments } from "../../api/assignments";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../context/ToastContext";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { formatDate, isExpiringSoon, isExpired, WARRANTY_SOON_DAYS, EMPTY } from "../../utils/formatters";
import { warrantyColors } from "../../theme/theme";

const HEADINGS = ["Asset Tag", "Name", "Category", "Assigned", "Warranty", "Status"];

export default function EmployeeDashboard() {
  useDocumentTitle("Dashboard");
  const { user } = useAuth();
  const toast = useToast();

  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    if (!user?.id) {
      setLoading(false);
      return undefined;
    }

    async function load() {
      setLoading(true);
      try {
        const rows = await listMyAssignments(user.id);
        if (isMounted) setAssignments(rows);
      } catch (err) {
        if (isMounted) toast.error(err?.message || "Couldn't load your assets.");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    load();
    return () => {
      isMounted = false;
    };
  }, [user?.id, toast]);

  const stats = useMemo(
    () => ({
      total: assignments.length,
      expiringSoon: assignments.filter((item) => isExpiringSoon(item.asset?.warranty_expiry)).length,
      inWarranty: assignments.filter(
        (item) => item.asset?.warranty_expiry && !isExpired(item.asset.warranty_expiry)
      ).length,
    }),
    [assignments]
  );

  const recent = assignments.slice(0, 5);

  return (
    <Box>
      <PageHeader
        title={`Welcome back${user?.name ? `, ${user.name.split(" ")[0]}` : ""}`}
        description="Here's a summary of the hardware currently assigned to you."
      />

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} lg={4}>
          <StatCard
            tone="blue" icon={<Inventory2OutlinedIcon />}
            label="Assigned Assets" value={stats.total} loading={loading}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={4}>
          <StatCard
            tone="green" icon={<VerifiedUserOutlinedIcon />}
            label="Under Warranty" value={stats.inWarranty} loading={loading}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={4}>
          <StatCard
            tone="orange" icon={<WarningAmberOutlinedIcon />}
            label="Warranty Expiring" value={stats.expiringSoon} loading={loading}
            hint={`within ${WARRANTY_SOON_DAYS} days`}
          />
        </Grid>
      </Grid>

      <Card>
        <CardContent sx={{ pb: "8px !important" }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Box>
              <Typography variant="subtitle1">My Recent Assets</Typography>
              <Typography variant="caption">Hardware currently in your name</Typography>
            </Box>
            <Button component={RouterLink} to="/employee/my-assets" size="small">
              View all
            </Button>
          </Box>
        </CardContent>

        <Box sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                {HEADINGS.map((heading) => (
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
                [1, 2, 3].map((row) => (
                  <TableRow key={row}>
                    <TableCell colSpan={HEADINGS.length}>
                      <Skeleton variant="text" height={28} />
                    </TableCell>
                  </TableRow>
                ))}

              {!loading && recent.length === 0 && (
                <TableRow>
                  <TableCell colSpan={HEADINGS.length} sx={{ border: "none" }}>
                    <EmptyState
                      icon={<Inventory2OutlinedIcon />}
                      title="No assets assigned"
                      description="When IT assigns you hardware, it'll show up here."
                      compact
                    />
                  </TableCell>
                </TableRow>
              )}

              {!loading &&
                recent.map((item) => {
                  const asset = item.asset || {};
                  const warrantySoon = isExpiringSoon(asset.warranty_expiry);
                  return (
                    <TableRow
                      key={item.id}
                      sx={{
                        bgcolor: warrantySoon ? warrantyColors.expiringSoon.bg : "transparent",
                        "&:hover": { bgcolor: warrantySoon ? "#FDE9C8" : "#F8FAFC" },
                      }}
                    >
                      <TableCell>
                        <Typography variant="body2" fontWeight={600} color="text.primary">
                          {asset.asset_tag || EMPTY}
                        </Typography>
                      </TableCell>
                      <TableCell>{asset.name || EMPTY}</TableCell>
                      <TableCell>{asset.category?.name || EMPTY}</TableCell>
                      <TableCell>{formatDate(item.assigned_date)}</TableCell>
                      <TableCell>
                        {warrantySoon ? (
                          <Tooltip title={`Expires within ${WARRANTY_SOON_DAYS} days`}>
                            <Typography
                              variant="body2"
                              sx={{ color: warrantyColors.expiringSoon.main, fontWeight: 600 }}
                            >
                              {formatDate(asset.warranty_expiry)}
                            </Typography>
                          </Tooltip>
                        ) : (
                          formatDate(asset.warranty_expiry)
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={asset.status} />
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
