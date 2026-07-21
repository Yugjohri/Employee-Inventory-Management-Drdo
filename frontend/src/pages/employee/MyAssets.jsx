/**
 * MyAssets
 *
 * The employee's full asset list with search and a category filter. Same
 * DataTable + StatusBadge primitives as the admin tables, so both roles get
 * an identical table experience.
 *
 * Read-only by design -- employees never mutate inventory. Filtering runs
 * client-side over the handful of rows RLS returns for them.
 */

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Grid from "@mui/material/Grid";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import SearchIcon from "@mui/icons-material/Search";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";

import PageHeader from "../../components/common/PageHeader";
import DataTable from "../../components/common/DataTable";
import StatusBadge from "../../components/common/StatusBadge";
import TwoLineCell from "../../components/common/TwoLineCell";
import EmptyState from "../../components/common/EmptyState";

import { listMyAssignments } from "../../api/assignments";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../context/ToastContext";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { formatDate, isExpiringSoon, isExpired, EMPTY } from "../../utils/formatters";
import { warrantyColors } from "../../theme/theme";

export default function MyAssets() {
  useDocumentTitle("My Assets");
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

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

  const categories = useMemo(() => {
    const unique = new Set(
      assignments.map((item) => item.asset?.category?.name).filter(Boolean)
    );
    return Array.from(unique).sort();
  }, [assignments]);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();

    return assignments
      .filter((item) => {
        const asset = item.asset || {};
        if (categoryFilter !== "all" && asset.category?.name !== categoryFilter) return false;
        if (!term) return true;

        return [asset.name, asset.asset_tag, asset.brand, asset.serial_number]
          .some((field) => field?.toLowerCase().includes(term));
      })
      .map((item) => {
        const asset = item.asset || {};
        return {
          id: item.id,
          assetTag: asset.asset_tag || EMPTY,
          name: asset.name || EMPTY,
          category: asset.category?.name || EMPTY,
          brand: asset.brand || EMPTY,
          assignedDate: item.assigned_date,
          warrantyExpiry: asset.warranty_expiry,
          status: asset.status || "assigned",
        };
      });
  }, [assignments, search, categoryFilter]);

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
    {
      field: "assignedDate",
      headerName: "Assigned",
      flex: 0.8,
      minWidth: 120,
      valueFormatter: (value) => formatDate(value),
    },
    {
      field: "warrantyExpiry",
      headerName: "Warranty",
      flex: 0.9,
      minWidth: 130,
      renderCell: (params) => {
        const expired = isExpired(params.value);
        const soon = isExpiringSoon(params.value);
        const tone = expired ? warrantyColors.expired : soon ? warrantyColors.expiringSoon : null;

        return (
          <Box sx={{ height: "100%", display: "flex", alignItems: "center", minWidth: 0 }}>
            <Typography
              variant="body2"
              noWrap
              sx={{ color: tone ? tone.main : "text.secondary", fontWeight: tone ? 600 : 400, lineHeight: 1.35, display: "block" }}
            >
              {formatDate(params.value)}
            </Typography>
          </Box>
        );
      },
    },

    {
      field: "status",
      headerName: "Status",
      flex: 0.7,
      minWidth: 120,
      renderCell: (params) => <StatusBadge status={params.value} />,
    },
    {
      field: "actions",
      headerName: "Actions",
      flex: 0.7,
      minWidth: 130,
      sortable: false,
      filterable: false,
      align: "right",
      headerAlign: "right",
      renderCell: (params) => (
        <Button
          size="small"
          startIcon={<VisibilityOutlinedIcon fontSize="small" />}
          onClick={() => navigate(`/employee/assets/${params.row.id}`)}
        >
          Details
        </Button>
      ),
    },
  ];

  const hasFilters = search.trim() !== "" || categoryFilter !== "all";

  return (
    <Box>
      <PageHeader
        title="My Assets"
        description="Hardware currently assigned to you. This list is view-only."
      />

      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: "20px !important" }}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={8}>
              <TextField
                fullWidth size="small"
                placeholder="Search by name, tag, brand or serial number"
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
                select fullWidth size="small" label="Category"
                value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <MenuItem value="all">All Categories</MenuItem>
                {categories.map((category) => (
                  <MenuItem key={category} value={category}>
                    {category}
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
          <EmptyState
            icon={hasFilters ? <SearchIcon /> : <Inventory2OutlinedIcon />}
            title={hasFilters ? "No matching assets" : "No assets assigned"}
            description={
              hasFilters
                ? "Try a different search term or clear the filters."
                : "When IT assigns you hardware, it'll show up here."
            }
          />
        }
      />
    </Box>
  );
}
