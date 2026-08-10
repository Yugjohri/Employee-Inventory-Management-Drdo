/**
 * ManageEmployees
 *
 * The staff list, used by both admins and coordinators — they need the same
 * screen, just with different reach, so this adapts rather than existing twice:
 *
 *   admin        every employee in every group; sets roles and group placement
 *   coordinator  their own group's staff, editable; the admin and other
 *                coordinators are visible but read-only
 *
 * Rows are ordered by standing — administrator, then coordinators, then
 * employees — so the people responsible for a group appear above the group
 * itself rather than being scattered through it alphabetically.
 *
 * What a coordinator is allowed to do is decided by the API and the database.
 * Hiding a button here is a courtesy so they aren't offered actions that would
 * be refused.
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
import Avatar from "@mui/material/Avatar";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import SearchIcon from "@mui/icons-material/Search";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import LockResetIcon from "@mui/icons-material/LockReset";
import GroupOutlinedIcon from "@mui/icons-material/GroupOutlined";

import PageHeader from "../../components/common/PageHeader";
import DataTable from "../../components/common/DataTable";
import TwoLineCell from "../../components/common/TwoLineCell";
import EmptyState from "../../components/common/EmptyState";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import EmployeeFormDialog from "../../components/admin/EmployeeFormDialog";

import {
  listEmployees, createEmployee, updateEmployee, resetPassword,
  listGroups, listDesignations, listInternalDesignations,
} from "../../api/employees";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../hooks/useAuth";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { getInitials, EMPTY } from "../../utils/formatters";
import { ROLE_LABELS } from "../../utils/navigation";
import { colors } from "../../theme/theme";

/** Role chip colours — admin strongest, employee neutral. */
const ROLE_CHIP = {
  admin: { bg: colors.primarySoft, fg: colors.primary },
  group_it_coordinator: { bg: "#FEF3C7", fg: "#B45309" },
  employee: { bg: "#EEF1F5", fg: colors.body },
};

/** Administrator first, then coordinators, then everyone else. */
const ROLE_RANK = { admin: 0, group_it_coordinator: 1, employee: 2 };

export default function ManageEmployees() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  useDocumentTitle(isAdmin ? "Manage Employees" : "Group Employees");
  const toast = useToast();

  const [employees, setEmployees] = useState([]);
  const [groups, setGroups] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [internalDesignations, setInternalDesignations] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [coordinatorFilter, setCoordinatorFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [resettingFor, setResettingFor] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setEmployees(await listEmployees());
    } catch (err) {
      toast.error(err?.message || "Couldn't load employees.");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  // Reference data for the form's dropdowns.
  useEffect(() => {
    Promise.all([listGroups(), listDesignations(), listInternalDesignations()])
      .then(([g, d, i]) => {
        setGroups(g);
        setDesignations(d);
        setInternalDesignations(i);
      })
      .catch(() => {
        // Non-fatal — the table still renders, the form just has fewer options.
      });
  }, []);

  /**
   * Which coordinator oversees each group, derived from the list we already
   * have rather than a second request: every role can see the coordinators, so
   * the answer is always present in the rows we were given.
   */
  const coordinators = useMemo(
    () => employees.filter((p) => p.role === "group_it_coordinator" && p.group_id),
    [employees]
  );

  const coordinatorByGroup = useMemo(() => {
    const byGroup = new Map();
    coordinators.forEach((c) => {
      if (!byGroup.has(c.group_id)) byGroup.set(c.group_id, c);
    });
    return byGroup;
  }, [coordinators]);

  /** Can the signed-in user edit this person? */
  const canManage = useCallback(
    (person) => {
      if (isAdmin) return true;
      // A coordinator maintains their own group's employees — not the admin,
      // not other coordinators, not themselves.
      return person.role === "employee" && person.group_id === user?.group_id;
    },
    [isAdmin, user?.group_id]
  );

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();

    return employees
      .filter((person) => {
        if (roleFilter !== "all" && person.role !== roleFilter) return false;

        // "Under coordinator X" means "in the group X looks after".
        if (coordinatorFilter !== "all") {
          const chosen = coordinators.find((c) => c.id === coordinatorFilter);
          if (!chosen || person.group_id !== chosen.group_id) return false;
        }

        if (statusFilter === "active" && !person.is_active) return false;
        if (statusFilter === "inactive" && person.is_active) return false;
        if (!term) return true;

        return [person.name, person.email, person.username, person.pis_number, person.group_name]
          .some((field) => field?.toLowerCase().includes(term));
      })
      .sort((a, b) => {
        const rank = (ROLE_RANK[a.role] ?? 9) - (ROLE_RANK[b.role] ?? 9);
        if (rank !== 0) return rank;
        return (a.name || "").localeCompare(b.name || "");
      })
      .map((person) => {
        const coordinator = coordinatorByGroup.get(person.group_id);
        return {
          id: person.id,
          name: person.name || "Unnamed",
          email: person.email,
          username: person.username,
          pisNumber: person.pis_number || EMPTY,
          group: person.group_short_name || EMPTY,
          groupFull: person.group_name || "",
          // A coordinator oversees the group, so they aren't "under" themselves.
          coordinator:
            person.role === "employee" ? coordinator?.name || "Unassigned" : EMPTY,
          role: person.role,
          isActive: person.is_active,
          editable: canManage(person),
          raw: person,
        };
      });
  }, [
    employees, search, roleFilter, coordinatorFilter, statusFilter,
    coordinators, coordinatorByGroup, canManage,
  ]);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (person) => {
    setEditing(person);
    setFormOpen(true);
  };

  const handleSubmit = async (values) => {
    if (editing) {
      await updateEmployee(editing.id, values);
      toast.success("Employee updated.");
    } else {
      await createEmployee(values);
      toast.success("Employee created.");
    }
    load();
  };

  const handleResetPassword = async () => {
    try {
      await resetPassword(resettingFor.id);
      toast.success(`Password reset for ${resettingFor.name}.`);
    } catch (err) {
      toast.error(err?.message || "Couldn't reset that password.");
    } finally {
      setResettingFor(null);
    }
  };

  const columns = [
    {
      field: "name",
      headerName: "Employee",
      flex: 1.4,
      minWidth: 220,
      renderCell: (params) => (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0 }}>
          <Avatar
            sx={{
              width: 34, height: 34, bgcolor: colors.primarySoft,
              color: "primary.main", fontSize: 13, fontWeight: 700,
            }}
          >
            {getInitials(params.value)}
          </Avatar>
          <TwoLineCell primary={params.value} secondary={params.row.email} />
        </Box>
      ),
    },
    { field: "pisNumber", headerName: "PIS Number", flex: 0.7, minWidth: 120 },
    {
      field: "group",
      headerName: "Group",
      flex: 0.5,
      minWidth: 95,
      renderCell: (params) => (
        <Tooltip title={params.row.groupFull || ""}>
          <span>{params.value}</span>
        </Tooltip>
      ),
    },
    {
      field: "coordinator",
      headerName: "IT Coordinator",
      flex: 1,
      minWidth: 160,
      renderCell: (params) => (
        <Typography
          variant="body2"
          noWrap
          sx={{
            color: params.value === "Unassigned" ? colors.muted : colors.body,
            fontStyle: params.value === "Unassigned" ? "italic" : "normal",
          }}
        >
          {params.value}
        </Typography>
      ),
    },
    {
      field: "role",
      headerName: "Role",
      flex: 1,
      minWidth: 175,
      renderCell: (params) => {
        const tone = ROLE_CHIP[params.value] || ROLE_CHIP.employee;
        return (
          <Chip
            label={ROLE_LABELS[params.value] || params.value}
            size="small"
            sx={{ height: 24, fontSize: 12, bgcolor: tone.bg, color: tone.fg }}
          />
        );
      },
    },
    {
      field: "isActive",
      headerName: "Status",
      flex: 0.55,
      minWidth: 100,
      renderCell: (params) => (
        <Chip
          label={params.value ? "Active" : "Inactive"}
          size="small"
          sx={{
            height: 24, fontSize: 12,
            bgcolor: params.value ? "#DCFCE7" : "#FEE2E2",
            color: params.value ? "#15803D" : "#B91C1C",
          }}
        />
      ),
    },
    {
      field: "actions",
      headerName: "Actions",
      flex: 0.5,
      minWidth: 110,
      sortable: false,
      filterable: false,
      align: "right",
      headerAlign: "right",
      // Rows a coordinator may not touch simply have no buttons, rather than
      // disabled ones that invite a click and then fail.
      renderCell: (params) =>
        params.row.editable ? (
          <Box>
            <Tooltip title="Edit">
              <IconButton size="small" onClick={() => openEdit(params.row.raw)}>
                <EditOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Reset password">
              <IconButton size="small" onClick={() => setResettingFor(params.row)}>
                <LockResetIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        ) : null,
    },
  ];

  const hasFilters =
    search.trim() !== "" ||
    roleFilter !== "all" ||
    coordinatorFilter !== "all" ||
    statusFilter !== "all";

  return (
    <Box>
      <PageHeader
        title={isAdmin ? "Manage Employees" : "Group Employees"}
        description={
          isAdmin
            ? "Everyone with an account, their group placement and their access level."
            : `Staff in ${user?.group_name || "your group"}, plus the administrator and other coordinators.`
        }
        actionLabel="Add Employee"
        actionIcon={<AddIcon />}
        onAction={openCreate}
      />

      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: "20px !important" }}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth size="small"
                placeholder="Search by name, email, login or PIS number"
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

            {/* Show everyone, or just the staff of one coordinator's group. */}
            <Grid item xs={12} sm={4} md={3}>
              <TextField
                select fullWidth size="small" label="IT Coordinator"
                value={coordinatorFilter}
                onChange={(e) => setCoordinatorFilter(e.target.value)}
              >
                <MenuItem value="all">All Employees</MenuItem>
                {coordinators.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.name} — {c.group_short_name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid item xs={12} sm={4} md={2.5}>
              <TextField
                select fullWidth size="small" label="Role"
                value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}
              >
                <MenuItem value="all">All Roles</MenuItem>
                <MenuItem value="admin">{ROLE_LABELS.admin}</MenuItem>
                <MenuItem value="group_it_coordinator">
                  {ROLE_LABELS.group_it_coordinator}
                </MenuItem>
                <MenuItem value="employee">{ROLE_LABELS.employee}</MenuItem>
              </TextField>
            </Grid>

            <Grid item xs={12} sm={4} md={2.5}>
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
                : "Add the first employee account to get started."
            }
            actionLabel={hasFilters ? undefined : "Add Employee"}
            onAction={hasFilters ? undefined : openCreate}
          />
        }
      />

      <EmployeeFormDialog
        open={formOpen}
        employee={editing}
        currentUserId={user?.id}
        currentUserRole={user?.role}
        currentUserGroupId={user?.group_id}
        groups={groups}
        coordinatorByGroup={coordinatorByGroup}
        designations={designations}
        internalDesignations={internalDesignations}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        open={Boolean(resettingFor)}
        title="Reset this password?"
        description={
          resettingFor
            ? `${resettingFor.name}'s password will be set back to the system default. Tell them to change it after signing in.`
            : ""
        }
        confirmLabel="Reset Password"
        onConfirm={handleResetPassword}
        onClose={() => setResettingFor(null)}
      />
    </Box>
  );
}
