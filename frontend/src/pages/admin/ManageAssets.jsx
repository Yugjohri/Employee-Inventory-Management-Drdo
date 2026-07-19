/**
 * ManageAssets
 *
 * Full inventory CRUD: searchable/filterable table of every asset, an Add
 * Asset modal, plus per-row edit and delete (behind a confirmation).
 *
 * Search and filtering run client-side over the loaded rows. That's the right
 * trade-off at this scale -- an internal hardware inventory is hundreds of
 * rows, not millions -- and it keeps filtering instant with no round trip.
 * If this ever holds tens of thousands of assets, move the filters into the
 * Supabase query instead.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Grid from "@mui/material/Grid";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import SearchIcon from "@mui/icons-material/Search";
import AddIcon from "@mui/icons-material/Add";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";

import PageHeader from "../../components/common/PageHeader";
import DataTable from "../../components/common/DataTable";
import StatusBadge from "../../components/common/StatusBadge";
import TwoLineCell from "../../components/common/TwoLineCell";
import EmptyState from "../../components/common/EmptyState";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import AssetFormDialog from "../../components/admin/AssetFormDialog";

import { listAssets, listCategories, createAsset, updateAsset, deleteAsset } from "../../api/assets";
import { useToast } from "../../context/ToastContext";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { formatDate, isExpiringSoon, isExpired, EMPTY } from "../../utils/formatters";
import { statusColors, warrantyColors } from "../../theme/theme";

export default function ManageAssets() {
  useDocumentTitle("Manage Assets");
  const toast = useToast();

  const [assets, setAssets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const [formOpen, setFormOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState(null);
  const [deletingAsset, setDeletingAsset] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [assetRows, categoryRows] = await Promise.all([listAssets(), listCategories()]);
      setAssets(assetRows);
      setCategories(categoryRows);
    } catch (err) {
      toast.error(err?.message || "Couldn't load assets.");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();

    return assets
      .filter((asset) => {
        if (statusFilter !== "all" && asset.status !== statusFilter) return false;
        if (categoryFilter !== "all" && asset.category?.id !== categoryFilter) return false;
        if (!term) return true;

        return [asset.asset_tag, asset.name, asset.brand, asset.model, asset.serial_number]
          .some((field) => field?.toLowerCase().includes(term));
      })
      .map((asset) => ({
        id: asset.id,
        assetTag: asset.asset_tag,
        name: asset.name,
        category: asset.category?.name || EMPTY,
        brand: asset.brand || EMPTY,
        serial: asset.serial_number || EMPTY,
        status: asset.status,
        warrantyExpiry: asset.warranty_expiry,
        raw: asset,
      }));
  }, [assets, search, statusFilter, categoryFilter]);

  const handleCreate = async (values) => {
    await createAsset(values);
    toast.success("Asset added.");
    load();
  };

  const handleUpdate = async (values) => {
    await updateAsset(editingAsset.id, values);
    toast.success("Asset updated.");
    load();
  };

  const handleDelete = async () => {
    try {
      await deleteAsset(deletingAsset.id);
      toast.success(`${deletingAsset.assetTag} deleted.`);
      load();
    } catch (err) {
      toast.error(err?.message || "Couldn't delete this asset.");
    } finally {
      setDeletingAsset(null);
    }
  };

  const columns = [
    { field: "assetTag", headerName: "Asset Tag", flex: 0.8, minWidth: 110 },
    {
      field: "name",
      headerName: "Name",
      flex: 1.3,
      minWidth: 180,
      renderCell: (params) => (
        <TwoLineCell
          primary={params.value}
          secondary={params.row.brand !== EMPTY ? params.row.brand : null}
        />
      ),
    },
    { field: "category", headerName: "Category", flex: 0.8, minWidth: 120 },
    { field: "serial", headerName: "Serial No.", flex: 1, minWidth: 140 },
    {
      field: "warrantyExpiry",
      headerName: "Warranty",
      flex: 0.9,
      minWidth: 140,
      renderCell: (params) => {
        const expired = isExpired(params.value);
        const soon = isExpiringSoon(params.value);
        const tone = expired ? warrantyColors.expired : soon ? warrantyColors.expiringSoon : null;

        return (
          <Typography
            variant="body2"
            sx={{
              color: tone ? tone.main : "text.secondary",
              fontWeight: tone ? 600 : 400,
            }}
          >
            {formatDate(params.value)}
          </Typography>
        );
      },
    },
    {
      field: "status",
      headerName: "Status",
      flex: 0.8,
      minWidth: 130,
      renderCell: (params) => <StatusBadge status={params.value} />,
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
      renderCell: (params) => (
        <Box>
          <Tooltip title="Edit">
            <IconButton
              size="small"
              onClick={() => {
                setEditingAsset(params.row.raw);
                setFormOpen(true);
              }}
            >
              <EditOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton size="small" color="error" onClick={() => setDeletingAsset(params.row)}>
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ];

  const openAddForm = () => {
    setEditingAsset(null);
    setFormOpen(true);
  };

  // Distinguish "no assets at all" from "no matches for these filters" -- the
  // useful next action is different for each.
  const hasFilters = search.trim() !== "" || statusFilter !== "all" || categoryFilter !== "all";

  return (
    <Box>
      <PageHeader
        title="Manage Assets"
        description="Add, edit and track every piece of hardware in the inventory."
        actionLabel="Add Asset"
        actionIcon={<AddIcon />}
        onAction={openAddForm}
      />

      <Card sx={{ mb: 3 }}>
        <Box sx={{ p: 2.5 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth size="small"
                placeholder="Search by tag, name, brand, model or serial"
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
                {Object.entries(statusColors).map(([value, { label }]) => (
                  <MenuItem key={value} value={value}>
                    {label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                select fullWidth size="small" label="Category"
                value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <MenuItem value="all">All Categories</MenuItem>
                {categories.map((category) => (
                  <MenuItem key={category.id} value={category.id}>
                    {category.name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
          </Grid>
        </Box>
      </Card>

      <DataTable
        rows={rows}
        columns={columns}
        loading={loading}
        emptyState={
          hasFilters ? (
            <EmptyState
              icon={<SearchIcon />}
              title="No matching assets"
              description="Try a different search term or clear the filters."
            />
          ) : (
            <EmptyState
              icon={<Inventory2OutlinedIcon />}
              title="No assets yet"
              description="Add your first piece of hardware to start tracking inventory."
              actionLabel="Add Asset"
              onAction={openAddForm}
            />
          )
        }
      />

      <AssetFormDialog
        open={formOpen}
        asset={editingAsset}
        categories={categories}
        onClose={() => setFormOpen(false)}
        onSubmit={editingAsset ? handleUpdate : handleCreate}
      />

      <ConfirmDialog
        open={Boolean(deletingAsset)}
        title="Delete this asset?"
        description={
          deletingAsset
            ? `${deletingAsset.assetTag} — ${deletingAsset.name} will be permanently removed, along with its assignment history. This can't be undone.`
            : ""
        }
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
        onClose={() => setDeletingAsset(null)}
      />
    </Box>
  );
}
