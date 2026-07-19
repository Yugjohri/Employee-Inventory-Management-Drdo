/**
 * AssignmentHistory
 *
 * The full assignment ledger -- who has what now, and who had what before --
 * with status and employee filters, an Assign Asset modal, and a Return
 * action on active rows.
 *
 * Returning goes through the return_assignment() Postgres function so the
 * assignment and the asset's status change together. See
 * backend/supabase/functions.sql.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Grid from "@mui/material/Grid";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import SearchIcon from "@mui/icons-material/Search";
import AddIcon from "@mui/icons-material/Add";
import AssignmentReturnOutlinedIcon from "@mui/icons-material/AssignmentReturnOutlined";
import AssignmentOutlinedIcon from "@mui/icons-material/AssignmentOutlined";

import PageHeader from "../../components/common/PageHeader";
import DataTable from "../../components/common/DataTable";
import StatusBadge from "../../components/common/StatusBadge";
import TwoLineCell from "../../components/common/TwoLineCell";
import EmptyState from "../../components/common/EmptyState";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import AssignAssetDialog from "../../components/admin/AssignAssetDialog";

import { listAssignments, assignAsset, returnAssignment } from "../../api/assignments";
import { useToast } from "../../context/ToastContext";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { formatDate, EMPTY } from "../../utils/formatters";

export default function AssignmentHistory() {
  useDocumentTitle("Assignments");
  const toast = useToast();

  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [employeeFilter, setEmployeeFilter] = useState("all");

  const [assignOpen, setAssignOpen] = useState(false);
  const [returningAssignment, setReturningAssignment] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setAssignments(await listAssignments());
    } catch (err) {
      toast.error(err?.message || "Couldn't load assignments.");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  // Everyone who appears in the ledger, for the employee filter dropdown.
  const employeeOptions = useMemo(() => {
    const byId = new Map();
    assignments.forEach((item) => {
      if (item.employee?.id && !byId.has(item.employee.id)) {
        byId.set(item.employee.id, item.employee);
      }
    });
    return Array.from(byId.values()).sort((a, b) =>
      (a.name || a.email || "").localeCompare(b.name || b.email || "")
    );
  }, [assignments]);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();

    return assignments
      .filter((item) => {
        if (statusFilter !== "all" && item.status !== statusFilter) return false;
        if (employeeFilter !== "all" && item.employee?.id !== employeeFilter) return false;
        if (!term) return true;

        return [
          item.asset?.asset_tag,
          item.asset?.name,
          item.employee?.name,
          item.employee?.email,
        ].some((field) => field?.toLowerCase().includes(term));
      })
      .map((item) => ({
        id: item.id,
        assetTag: item.asset?.asset_tag || EMPTY,
        assetName: item.asset?.name || EMPTY,
        category: item.asset?.category?.name || EMPTY,
        employeeName: item.employee?.name || item.employee?.email || EMPTY,
        employeeEmail: item.employee?.email || "",
        assignedDate: item.assigned_date,
        returnedDate: item.returned_date,
        status: item.status,
        raw: item,
      }));
  }, [assignments, search, statusFilter, employeeFilter]);

  const activeCount = useMemo(
    () => assignments.filter((item) => item.status === "active").length,
    [assignments]
  );

  const handleAssign = async ({ assetId, employeeId, remarks }) => {
    await assignAsset({ assetId, employeeId, remarks });
    toast.success("Asset assigned.");
    load();
  };

  const handleReturn = async () => {
    try {
      await returnAssignment(returningAssignment.id);
      toast.success(`${returningAssignment.assetTag} returned to the available pool.`);
      load();
    } catch (err) {
      toast.error(err?.message || "Couldn't return this asset.");
    } finally {
      setReturningAssignment(null);
    }
  };

  const columns = [
    {
      field: "assetTag",
      headerName: "Asset",
      flex: 1.2,
      minWidth: 180,
      renderCell: (params) => (
        <TwoLineCell primary={params.value} secondary={params.row.assetName} />
      ),
    },
    {
      field: "employeeName",
      headerName: "Assigned To",
      flex: 1.2,
      minWidth: 180,
      renderCell: (params) => (
        <TwoLineCell primary={params.value} secondary={params.row.employeeEmail} />
      ),
    },
    { field: "category", headerName: "Category", flex: 0.7, minWidth: 110 },
    {
      field: "assignedDate",
      headerName: "Assigned",
      flex: 0.8,
      minWidth: 120,
      valueFormatter: (value) => formatDate(value),
    },
    {
      field: "returnedDate",
      headerName: "Returned",
      flex: 0.8,
      minWidth: 120,
      valueFormatter: (value) => formatDate(value),
    },
    {
      field: "status",
      headerName: "Status",
      flex: 0.6,
      minWidth: 110,
      renderCell: (params) => <StatusBadge status={params.value} kind="assignment" />,
    },
    {
      field: "actions",
      headerName: "Actions",
      flex: 0.6,
      minWidth: 120,
      sortable: false,
      filterable: false,
      align: "right",
      headerAlign: "right",
      renderCell: (params) =>
        params.row.status === "active" ? (
          <Tooltip title="Mark returned and free the asset">
            <Button
              size="small"
              startIcon={<AssignmentReturnOutlinedIcon fontSize="small" />}
              onClick={() => setReturningAssignment(params.row)}
            >
              Return
            </Button>
          </Tooltip>
        ) : null,
    },
  ];

  const hasFilters = search.trim() !== "" || statusFilter !== "all" || employeeFilter !== "all";

  return (
    <Box>
      <PageHeader
        title="Assignments"
        description={
          loading
            ? "Who holds what, and the full history of past assignments."
            : `${activeCount} active · ${assignments.length} total records`
        }
        actionLabel="Assign Asset"
        actionIcon={<AddIcon />}
        onAction={() => setAssignOpen(true)}
      />

      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: "20px !important" }}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth size="small"
                placeholder="Search by asset tag, name or employee"
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
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                select fullWidth size="small" label="Status"
                value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              >
                <MenuItem value="all">All Statuses</MenuItem>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="returned">Returned</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                select fullWidth size="small" label="Employee"
                value={employeeFilter} onChange={(e) => setEmployeeFilter(e.target.value)}
              >
                <MenuItem value="all">All Employees</MenuItem>
                {employeeOptions.map((employee) => (
                  <MenuItem key={employee.id} value={employee.id}>
                    {employee.name || employee.email}
                  </MenuItem>
                ))}
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
          hasFilters ? (
            <EmptyState
              icon={<SearchIcon />}
              title="No matching assignments"
              description="Try a different search term or clear the filters."
            />
          ) : (
            <EmptyState
              icon={<AssignmentOutlinedIcon />}
              title="No assignments yet"
              description="Hand an available asset to an employee to create the first record."
              actionLabel="Assign Asset"
              onAction={() => setAssignOpen(true)}
            />
          )
        }
      />

      <AssignAssetDialog
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        onSubmit={handleAssign}
      />

      <ConfirmDialog
        open={Boolean(returningAssignment)}
        title="Return this asset?"
        description={
          returningAssignment
            ? `${returningAssignment.assetTag} will be marked returned from ${returningAssignment.employeeName} and put back in the available pool.`
            : ""
        }
        confirmLabel="Mark Returned"
        onConfirm={handleReturn}
        onClose={() => setReturningAssignment(null)}
      />
    </Box>
  );
}
