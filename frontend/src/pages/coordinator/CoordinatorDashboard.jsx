/**
 * CoordinatorDashboard
 *
 * A summary of one group: how many people, how much hardware they hold, and
 * anything outstanding. Every number is derived from what the server returned,
 * which for this role is already limited to their own group — there is no
 * client-side filtering by group here, and there mustn't be, or the figures
 * would depend on the UI rather than on the access rules.
 */

import { useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import GroupOutlinedIcon from "@mui/icons-material/GroupOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import BuildOutlinedIcon from "@mui/icons-material/BuildOutlined";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";

import PageHeader from "../../components/common/PageHeader";
import StatCard from "../../components/common/StatCard";
import StatusBadge from "../../components/common/StatusBadge";
import EmptyState from "../../components/common/EmptyState";

import { listEmployees } from "../../api/employees";
import { listAssignments } from "../../api/assignments";
import { listRequests } from "../../api/requests";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../context/ToastContext";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { formatDate, isExpiringSoon, isExpired, EMPTY } from "../../utils/formatters";
import { colors } from "../../theme/theme";

export default function CoordinatorDashboard() {
  useDocumentTitle("Dashboard");
  const { user } = useAuth();
  const toast = useToast();

  const [employees, setEmployees] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    Promise.all([listEmployees(), listAssignments(), listRequests()])
      .then(([people, ledger, queue]) => {
        if (!isMounted) return;
        setEmployees(people);
        setAssignments(ledger);
        setRequests(queue);
      })
      .catch((err) => {
        if (isMounted) toast.error(err?.message || "Couldn't load your dashboard.");
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [toast]);

  const active = useMemo(
    () => assignments.filter((item) => item.status === "active"),
    [assignments]
  );

  const pendingRequests = useMemo(
    () => requests.filter((item) => item.status === "pending"),
    [requests]
  );

  // Warranties worth chasing before they lapse.
  const warrantyAlerts = useMemo(
    () =>
      active.filter(
        (item) =>
          isExpired(item.asset?.warranty_expiry) || isExpiringSoon(item.asset?.warranty_expiry)
      ),
    [active]
  );

  return (
    <Box>
      <PageHeader
        title="Group Dashboard"
        description={
          user?.group_name
            ? `${user.group_name} — personnel and hardware in your remit.`
            : "Personnel and hardware in your remit."
        }
      />

      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            tone="blue" loading={loading}
            icon={<GroupOutlinedIcon />}
            label="Employees" value={employees.length}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            tone="green" loading={loading}
            icon={<Inventory2OutlinedIcon />}
            label="Assets Held" value={active.length}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            tone="orange" loading={loading}
            icon={<BuildOutlinedIcon />}
            label="Pending Requests" value={pendingRequests.length}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            tone="purple" loading={loading}
            icon={<WarningAmberOutlinedIcon />}
            label="Warranty Alerts" value={warrantyAlerts.length}
            hint="Expired or due within 60 days"
          />
        </Grid>
      </Grid>

      <Grid container spacing={2.5}>
        {/* Recently issued */}
        <Grid item xs={12} md={7}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Typography variant="subtitle1" sx={{ mb: 0.5 }}>
                Recently Issued
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                The latest hardware handed to your group.
              </Typography>
              <Divider sx={{ mb: 1 }} />

              {!loading && active.length === 0 ? (
                <EmptyState
                  compact
                  icon={<Inventory2OutlinedIcon />}
                  title="Nothing issued yet"
                  description="Assets given to your group's personnel will appear here."
                />
              ) : (
                active.slice(0, 6).map((item) => (
                  <Box
                    key={item.id}
                    sx={{
                      display: "flex", alignItems: "center", gap: 2,
                      py: 1.5, borderBottom: `1px solid ${colors.border}`,
                      "&:last-of-type": { borderBottom: "none" },
                    }}
                  >
                    <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                      <Typography sx={{ fontSize: 14, fontWeight: 600, color: colors.heading }} noWrap>
                        {item.asset?.asset_tag} — {item.asset?.name}
                      </Typography>
                      <Typography sx={{ fontSize: 12.5, color: colors.muted }} noWrap>
                        {item.employee?.name} · {formatDate(item.assigned_date)}
                      </Typography>
                    </Box>
                    <StatusBadge status={item.asset?.status} />
                  </Box>
                ))
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Outstanding requests */}
        <Grid item xs={12} md={5}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Typography variant="subtitle1" sx={{ mb: 0.5 }}>
                Outstanding Requests
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Awaiting action from IT.
              </Typography>
              <Divider sx={{ mb: 1 }} />

              {!loading && pendingRequests.length === 0 ? (
                <EmptyState
                  compact
                  icon={<BuildOutlinedIcon />}
                  title="Nothing outstanding"
                  description="Requests from your group will appear here."
                />
              ) : (
                pendingRequests.slice(0, 6).map((item) => (
                  <Box
                    key={item.id}
                    sx={{
                      py: 1.5, borderBottom: `1px solid ${colors.border}`,
                      "&:last-of-type": { borderBottom: "none" },
                    }}
                  >
                    <Typography sx={{ fontSize: 14, fontWeight: 600, color: colors.heading }} noWrap>
                      {item.asset?.asset_tag || item.category_name || EMPTY}
                    </Typography>
                    <Typography sx={{ fontSize: 12.5, color: colors.muted }} noWrap>
                      {item.employee?.name} · {formatDate(item.created_at)}
                    </Typography>
                  </Box>
                ))
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
