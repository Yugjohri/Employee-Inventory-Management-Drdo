/**
 * ManageEmployees
 *
 * Lists every profile with search and role/status filters, and lets an admin
 * edit department, role and the active toggle.
 *
 * There's no "Add Employee" button on purpose -- see the note card below and
 * EmployeeFormDialog's header comment. Creating a login needs the service_role
 * key, which can't ship to the browser.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Grid from "@mui/material/Grid";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import Avatar from "@mui/material/Avatar";
import Chip from "@mui/material/Chip";
import Alert from "@mui/material/Alert";
import SearchIcon from "@mui/icons-material/Search";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import GroupOutlinedIcon from "@mui/icons-material/GroupOutlined";

import PageHeader from "../../components/common/PageHeader";
import DataTable from "../../components/common/DataTable";
import TwoLineCell from "../../components/common/TwoLineCell";
import EmptyState from "../../components/common/EmptyState";
import EmployeeFormDialog from "../../components/admin/EmployeeFormDialog";

import { listProfiles, updateProfile } from "../../api/employees";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../hooks/useAuth";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { getInitials, EMPTY } from "../../utils/formatters";
import { colors } from "../../theme/theme";

export default function ManageEmployees() {
  useDocumentTitle("Manage Employees");
  const toast = useToast();
  const { user } = useAuth();

  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [editingEmployee, setEditingEmployee] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setProfiles(await listProfiles());
    } catch (err) {
      toast.error(err?.message || "Couldn't load employees.");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();

    return profiles
      .filter((profile) => {
        if (roleFilter !== "all" && profile.role !== roleFilter) return false;
        if (statusFilter === "active" && !profile.is_active) return false;
        if (statusFilter === "inactive" && profile.is_active) return false;
        if (!term) return true;

        return [profile.name, profile.email, profile.department]
          .some((field) => field?.toLowerCase().includes(term));
      })
      .map((profile) => ({
        id: profile.id,
        name: profile.name || "Unnamed",
        email: profile.email,
        department: profile.department || EMPTY,
        role: profile.role,
        isActive: profile.is_active,
        raw: profile,
      }));
  }, [profiles, search, roleFilter, statusFilter]);

  const handleUpdate = async (values) => {
    await updateProfile(editingEmployee.id, values);
    toast.success("Employee updated.");
    load();
  };

  const columns = [
    {
      field: "name",
      headerName: "Employee",
      flex: 1.4,
      minWidth: 220,
      renderCell: (params) => (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0 }}>
          <Avatar sx={{ width: 34, height: 34, bgcolor: colors.primarySoft, color: "primary.main", fontSize: 13, fontWeight: 700 }}>
            {getInitials(params.value)}
          </Avatar>
          <TwoLineCell primary={params.value} secondary={params.row.email} />
        </Box>
      ),
    },
    { field: "department", headerName: "Department", flex: 0.9, minWidth: 140 },
    {
      field: "role",
      headerName: "Role",
      flex: 0.6,
      minWidth: 110,
      renderCell: (params) => (
        <Chip
          label={params.value === "admin" ? "Admin" : "Employee"}
          size="small"
          sx={{
            height: 24,
            borderRadius: "6px",
            fontSize: 12,
            bgcolor: params.value === "admin" ? colors.primarySoft : "#F1F5F9",
            color: params.value === "admin" ? colors.primary : colors.body,
          }}
        />
      ),
    },
    {
      field: "isActive",
      headerName: "Status",
      flex: 0.6,
      minWidth: 110,
      renderCell: (params) => (
        <Chip
          label={params.value ? "Active" : "Inactive"}
          size="small"
          sx={{
            height: 24,
            borderRadius: "6px",
            fontSize: 12,
            bgcolor: params.value ? "#DCFCE7" : "#FEE2E2",
            color: params.value ? "#16A34A" : "#DC2626",
          }}
        />
      ),
    },
    {
      field: "actions",
      headerName: "Actions",
      flex: 0.4,
      minWidth: 90,
      sortable: false,
      filterable: false,
      align: "right",
      headerAlign: "right",
      renderCell: (params) => (
        <Tooltip title="Edit">
          <IconButton size="small" onClick={() => setEditingEmployee(params.row.raw)}>
            <EditOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ),
    },
  ];

  const hasFilters = search.trim() !== "" || roleFilter !== "all" || statusFilter !== "all";

  return (
    <Box>
      <PageHeader
        title="Manage Employees"
        description="Review everyone with an account and manage their department, role and access."
      />

      <Alert severity="info" sx={{ mb: 3 }}>
        New accounts are created in <strong>Supabase → Authentication → Users</strong>.
        A profile row appears here automatically the moment an account is added,
        ready for you to set their department and role.
      </Alert>

      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: "20px !important" }}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth size="small"
                placeholder="Search by name, email or department"
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
                select fullWidth size="small" label="Role"
                value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}
              >
                <MenuItem value="all">All Roles</MenuItem>
                <MenuItem value="admin">Admin</MenuItem>
                <MenuItem value="employee">Employee</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                select fullWidth size="small" label="Status"
                value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              >
                <MenuItem value="all">All Statuses</MenuItem>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="inactive">Inactive</MenuItem>
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
            icon={hasFilters ? <SearchIcon /> : <GroupOutlinedIcon />}
            title={hasFilters ? "No matching employees" : "No employees yet"}
            description={
              hasFilters
                ? "Try a different search term or clear the filters."
                : "Add an account in Supabase → Authentication → Users and it will appear here."
            }
          />
        }
      />

      <EmployeeFormDialog
        open={Boolean(editingEmployee)}
        employee={editingEmployee}
        currentUserId={user?.id}
        onClose={() => setEditingEmployee(null)}
        onSubmit={handleUpdate}
      />
    </Box>
  );
}
