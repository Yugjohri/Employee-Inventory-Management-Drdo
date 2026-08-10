/**
 * GroupInventory
 *
 * Hardware held by the coordinator's group, and the history of what was held
 * before. Read-only — the same ledger an admin sees on the Assignments page,
 * without the assign and return actions.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Grid from "@mui/material/Grid";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";
import SearchIcon from "@mui/icons-material/Search";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";

import PageHeader from "../../components/common/PageHeader";
import DataTable from "../../components/common/DataTable";
import StatusBadge from "../../components/common/StatusBadge";
import TwoLineCell from "../../components/common/TwoLineCell";
import EmptyState from "../../components/common/EmptyState";

import { listAssignments } from "../../api/assignments";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../hooks/useAuth";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { formatDate, EMPTY } from "../../utils/formatters";
import { colors } from "../../theme/theme";

export default function GroupInventory() {
  useDocumentTitle("Group Inventory");
  const toast = useToast();
  const { user } = useAuth();

  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setAssignments(await listAssignments());
    } catch (err) {
      toast.error(err?.message || "Couldn't load group inventory.");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();

    return assignments
      .filter((item) => {
        if (statusFilter !== "all" && item.status !== statusFilter) return false;
        if (!term) return true;

        return [
          item.asset?.asset_tag,
          item.asset?.name,
          item.asset?.serial_number,
          item.employee?.name,
        ].some((field) => field?.toLowerCase().includes(term));
      })
      .map((item) => ({
        id: item.id,
        assetTag: item.asset?.asset_tag || EMPTY,
        assetName: item.asset?.name || EMPTY,
        serialNumber: item.asset?.serial_number || EMPTY,
        employeeName: item.employee?.name || EMPTY,
        employeeEmail: item.employee?.email || "",
        assignedDate: item.assigned_date,
        status: item.status,
      }));
  }, [assignments, search, statusFilter]);

  const activeCount = useMemo(
    () => assignments.filter((item) => item.status === "active").length,
    [assignments]
  );

  const columns = [
    {
      field: "assetTag",
      headerName: "Asset",
      flex: 1.1,
      minWidth: 170,
      renderCell: (params) => (
        <TwoLineCell primary={params.value} secondary={params.row.assetName} />
      ),
    },
    {
      field: "serialNumber",
      headerName: "Serial Number",
      flex: 1,
      minWidth: 150,
      renderCell: (params) => (
        <Typography
          sx={{
            fontFamily: "ui-monospace, Consolas, monospace",
            fontSize: 13,
            color: params.value === EMPTY ? colors.muted : colors.body,
          }}
        >
          {params.value}
        </Typography>
      ),
    },
    {
      field: "employeeName",
      headerName: "Held By",
      flex: 1.1,
      minWidth: 170,
      renderCell: (params) => (
        <TwoLineCell primary={params.value} secondary={params.row.employeeEmail} />
      ),
    },
    {
      field: "assignedDate",
      headerName: "Assigned",
      flex: 0.8,
      minWidth: 130,
      valueFormatter: (value) => formatDate(value),
    },
    {
      field: "status",
      headerName: "Status",
      flex: 0.6,
      minWidth: 110,
      renderCell: (params) => <StatusBadge status={params.value} kind="assignment" />,
    },
  ];

  const hasFilters = search.trim() !== "" || statusFilter !== "all";

  return (
    <Box>
      <PageHeader
        title="Group Inventory"
        description={
          loading
            ? "Hardware held by your group."
            : `${activeCount} currently held · ${assignments.length} total records${
                user?.group_name ? ` · ${user.group_name}` : ""
              }`
        }
      />

      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: "20px !important" }}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={8}>
              <TextField
                fullWidth size="small"
                placeholder="Search by asset tag, name, serial number or holder"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                select fullWidth size="small" label="Status"
                value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              >
                <MenuItem value="all">All Statuses</MenuItem>
                <MenuItem value="active">Currently Held</MenuItem>
                <MenuItem value="returned">Returned</MenuItem>
              </TextField>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <DataTable
        rows={rows}
        columns={columns}
        loading={loading}
        emptyState={
          <EmptyState
            icon={hasFilters ? <SearchIcon /> : <Inventory2OutlinedIcon />}
            title={hasFilters ? "No matching records" : "No hardware assigned yet"}
            description={
              hasFilters
                ? "Try a different search term or clear the filters."
                : "Assets issued to your group's personnel will appear here."
            }
          />
        }
      />
    </Box>
  );
}
