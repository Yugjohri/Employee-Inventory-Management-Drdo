/**
 * RequestsView
 *
 * The request list, shared by all three roles. They differ only in what they
 * may do with it, so one component takes a `mode` rather than three pages
 * repeating the same table:
 *
 *   "mine"    employee  — their own requests, plus the button to raise one
 *   "manage"  admin     — the whole queue, with approve/reject/complete
 *   "view"    coordinator — their group's requests, read-only
 *
 * The server decides which rows come back in each case; `mode` only controls
 * what's rendered.
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
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import CircularProgress from "@mui/material/CircularProgress";
import SearchIcon from "@mui/icons-material/Search";
import AddIcon from "@mui/icons-material/Add";
import BuildOutlinedIcon from "@mui/icons-material/BuildOutlined";

import PageHeader from "../common/PageHeader";
import DataTable from "../common/DataTable";
import StatusBadge from "../common/StatusBadge";
import TwoLineCell from "../common/TwoLineCell";
import EmptyState from "../common/EmptyState";
import RequestFormDialog from "./RequestFormDialog";

import {
  listRequests, listMyRequests, createRequest, resolveRequest, REQUEST_TYPES,
} from "../../api/requests";
import { listMyAssignments } from "../../api/assignments";
import { listCategories } from "../../api/assets";
import { useToast } from "../../context/ToastContext";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { formatDate, EMPTY } from "../../utils/formatters";
import { colors } from "../../theme/theme";

/** Approve/reject/complete, with an optional note back to the employee. */
function ResolveDialog({ request, onClose, onResolve }) {
  const [status, setStatus] = useState("approved");
  const [remarks, setRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await onResolve(request.id, { status, adminRemarks: remarks });
      onClose();
    } catch (err) {
      setError(err?.message || "Couldn't update this request.");
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={Boolean(request)} onClose={submitting ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Resolve Request</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent>
          {request && (
            <Box sx={{ mb: 2.5, p: 2, bgcolor: colors.canvas, border: `1px solid ${colors.border}` }}>
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: colors.heading }}>
                {REQUEST_TYPES[request.request_type]}
                {request.asset ? ` — ${request.asset.asset_tag}` : ""}
                {request.category_name ? ` — ${request.category_name}` : ""}
              </Typography>
              <Typography sx={{ fontSize: 13, color: colors.body, mt: 0.75 }}>
                {request.description}
              </Typography>
              <Typography sx={{ fontSize: 12, color: colors.muted, mt: 1 }}>
                Raised by {request.employee?.name} · {formatDate(request.created_at)}
              </Typography>
            </Box>
          )}

          {error && (
            <Typography sx={{ color: colors.accent, fontSize: 13, mb: 2 }}>{error}</Typography>
          )}

          <TextField
            select fullWidth size="small" label="Decision"
            value={status} onChange={(e) => setStatus(e.target.value)} sx={{ mb: 2.5 }}
          >
            <MenuItem value="approved">Approve</MenuItem>
            <MenuItem value="completed">Mark Completed</MenuItem>
            <MenuItem value="rejected">Reject</MenuItem>
          </TextField>

          {/* Approving a repair parks the asset in "Under Repair" so it stops
              showing as a working machine on the inventory screens. */}
          {status === "approved" && request?.request_type === "repair" && (
            <Typography sx={{ fontSize: 12.5, color: colors.muted, mb: 2.5 }}>
              Approving this will set {request.asset?.asset_tag} to “Under Repair”.
            </Typography>
          )}

          <TextField
            fullWidth multiline minRows={2} size="small"
            label="Remarks (optional)"
            placeholder="Visible to the employee who raised this."
            value={remarks} onChange={(e) => setRemarks(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={submitting}>
            {submitting ? <CircularProgress size={20} color="inherit" /> : "Save"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

export default function RequestsView({ mode, title, description }) {
  useDocumentTitle(title);
  const toast = useToast();

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  // Only needed for the raise-a-request form.
  const [myAssets, setMyAssets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [resolving, setResolving] = useState(null);

  const canRaise = mode === "mine";
  const canResolve = mode === "manage";
  const showEmployee = mode !== "mine";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRequests(canRaise ? await listMyRequests() : await listRequests());
    } catch (err) {
      toast.error(err?.message || "Couldn't load requests.");
    } finally {
      setLoading(false);
    }
  }, [canRaise, toast]);

  useEffect(() => {
    load();
  }, [load]);

  // The form needs the employee's own assets and the category list. Fetched
  // once alongside the list rather than when the dialog opens, so the dialog
  // appears already populated.
  useEffect(() => {
    if (!canRaise) return;

    Promise.all([listMyAssignments(), listCategories()])
      .then(([assignments, cats]) => {
        setMyAssets(assignments);
        setCategories(cats);
      })
      .catch(() => {
        // Non-fatal: the list still renders, the form just has fewer options.
      });
  }, [canRaise]);

  const handleCreate = async (form) => {
    await createRequest({
      requestType: form.requestType,
      assetId: form.assetId,
      categoryId: form.categoryId,
      description: form.description,
    });
    toast.success("Request submitted.");
    load();
  };

  const handleResolve = async (id, values) => {
    await resolveRequest(id, values);
    toast.success("Request updated.");
    load();
  };

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();

    return requests
      .filter((item) => {
        if (statusFilter !== "all" && item.status !== statusFilter) return false;
        if (typeFilter !== "all" && item.request_type !== typeFilter) return false;
        if (!term) return true;

        return [
          item.description,
          item.asset?.asset_tag,
          item.asset?.name,
          item.asset?.serial_number,
          item.category_name,
          item.employee?.name,
        ].some((field) => field?.toLowerCase().includes(term));
      })
      .map((item) => ({
        id: item.id,
        type: item.request_type,
        item: item.asset?.asset_tag || item.category_name || EMPTY,
        itemSecondary: item.asset?.name || (item.category_name ? "New item" : ""),
        serialNumber: item.asset?.serial_number || EMPTY,
        employeeName: item.employee?.name || EMPTY,
        employeeGroup: item.employee?.group_name || "",
        description: item.description,
        createdAt: item.created_at,
        status: item.status,
        raw: item,
      }));
  }, [requests, search, statusFilter, typeFilter]);

  const pendingCount = useMemo(
    () => requests.filter((item) => item.status === "pending").length,
    [requests]
  );

  const columns = [
    {
      field: "type",
      headerName: "Type",
      flex: 0.6,
      minWidth: 110,
      renderCell: (params) => (
        <Chip
          label={REQUEST_TYPES[params.value] || params.value}
          size="small"
          sx={{
            height: 24,
            fontSize: 12,
            bgcolor: params.value === "repair" ? "#FEF3C7" : colors.primarySoft,
            color: params.value === "repair" ? "#B45309" : colors.primary,
          }}
        />
      ),
    },
    {
      field: "item",
      headerName: "Item",
      flex: 1.1,
      minWidth: 170,
      renderCell: (params) => (
        <TwoLineCell primary={params.value} secondary={params.row.itemSecondary} />
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
    ...(showEmployee
      ? [{
          field: "employeeName",
          headerName: "Raised By",
          flex: 1.1,
          minWidth: 170,
          renderCell: (params) => (
            <TwoLineCell primary={params.value} secondary={params.row.employeeGroup} />
          ),
        }]
      : []),
    {
      field: "createdAt",
      headerName: "Date Raised",
      flex: 0.8,
      minWidth: 130,
      valueFormatter: (value) => formatDate(value),
    },
    {
      field: "status",
      headerName: "Status",
      flex: 0.6,
      minWidth: 120,
      renderCell: (params) => <StatusBadge status={params.value} kind="request" />,
    },
    ...(canResolve
      ? [{
          field: "actions",
          headerName: "Actions",
          flex: 0.6,
          minWidth: 120,
          sortable: false,
          filterable: false,
          align: "right",
          headerAlign: "right",
          renderCell: (params) =>
            params.row.status === "pending" ? (
              <Button size="small" onClick={() => setResolving(params.row.raw)}>
                Resolve
              </Button>
            ) : null,
        }]
      : []),
  ];

  const hasFilters = search.trim() !== "" || statusFilter !== "all" || typeFilter !== "all";

  return (
    <Box>
      <PageHeader
        title={title}
        description={
          loading
            ? description
            : `${pendingCount} pending · ${requests.length} total`
        }
        actionLabel={canRaise ? "New Request" : undefined}
        actionIcon={canRaise ? <AddIcon /> : undefined}
        onAction={canRaise ? () => setFormOpen(true) : undefined}
      />

      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: "20px !important" }}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth size="small"
                placeholder="Search by item, serial number or description"
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
                select fullWidth size="small" label="Type"
                value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
              >
                <MenuItem value="all">All Types</MenuItem>
                <MenuItem value="repair">Repair</MenuItem>
                <MenuItem value="new_asset">New Item</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                select fullWidth size="small" label="Status"
                value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              >
                <MenuItem value="all">All Statuses</MenuItem>
                <MenuItem value="pending">Pending</MenuItem>
                <MenuItem value="approved">Approved</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
                <MenuItem value="rejected">Rejected</MenuItem>
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
            icon={hasFilters ? <SearchIcon /> : <BuildOutlinedIcon />}
            title={hasFilters ? "No matching requests" : "No requests yet"}
            description={
              hasFilters
                ? "Try a different search term or clear the filters."
                : canRaise
                  ? "Raise a request when hardware needs repair or you need something new."
                  : "Requests raised by employees will appear here."
            }
            actionLabel={canRaise && !hasFilters ? "New Request" : undefined}
            onAction={canRaise && !hasFilters ? () => setFormOpen(true) : undefined}
          />
        }
      />

      {canRaise && (
        <RequestFormDialog
          open={formOpen}
          onClose={() => setFormOpen(false)}
          onSubmit={handleCreate}
          myAssets={myAssets}
          categories={categories}
        />
      )}

      {canResolve && resolving && (
        <ResolveDialog
          request={resolving}
          onClose={() => setResolving(null)}
          onResolve={handleResolve}
        />
      )}
    </Box>
  );
}
