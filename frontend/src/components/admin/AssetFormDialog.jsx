/**
 * AssetFormDialog
 *
 * Add/Edit form for an asset, in a centred modal with a 2-column input grid.
 * The same component handles both modes -- passing an `asset` switches it to
 * edit and pre-fills the fields.
 *
 * Validation is deliberately light (tag and name required); the database is
 * the real authority, and its errors -- duplicate asset tag, duplicate serial
 * -- are caught and shown against the relevant field.
 */

import { useEffect, useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Grid from "@mui/material/Grid";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";

import { statusColors } from "../../theme/theme";

const EMPTY_FORM = {
  asset_tag: "",
  name: "",
  brand: "",
  model: "",
  serial_number: "",
  category_id: "",
  status: "available",
  purchase_date: "",
  warranty_expiry: "",
};

const STATUS_OPTIONS = Object.entries(statusColors).map(([value, { label }]) => ({ value, label }));

export default function AssetFormDialog({ open, asset, categories = [], onClose, onSubmit }) {
  const isEdit = Boolean(asset);

  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  // Refill whenever the dialog opens, so a previous edit never leaks into the
  // next one.
  useEffect(() => {
    if (!open) return;

    setForm(
      asset
        ? {
            asset_tag: asset.asset_tag || "",
            name: asset.name || "",
            brand: asset.brand || "",
            model: asset.model || "",
            serial_number: asset.serial_number || "",
            category_id: asset.category_id || "",
            status: asset.status || "available",
            purchase_date: asset.purchase_date || "",
            warranty_expiry: asset.warranty_expiry || "",
          }
        : EMPTY_FORM
    );
    setErrors({});
    setFormError("");
  }, [open, asset]);

  const setField = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const validate = () => {
    const found = {};
    if (!form.asset_tag.trim()) found.asset_tag = "Asset tag is required.";
    if (!form.name.trim()) found.name = "Name is required.";

    if (
      form.purchase_date &&
      form.warranty_expiry &&
      form.warranty_expiry < form.purchase_date
    ) {
      found.warranty_expiry = "Warranty can't end before the purchase date.";
    }

    setErrors(found);
    return Object.keys(found).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError("");
    if (!validate()) return;

    setSaving(true);
    try {
      await onSubmit({
        ...form,
        category_id: form.category_id || null,
      });
      onClose();
    } catch (err) {
      // Postgres 23505 = unique violation. Point it at the field that clashed
      // instead of showing a raw constraint name.
      const message = err?.message || "Couldn't save this asset.";
      if (err?.code === "23505") {
        if (message.includes("asset_tag")) {
          setErrors((c) => ({ ...c, asset_tag: "That asset tag is already in use." }));
        } else if (message.includes("serial_number")) {
          setErrors((c) => ({ ...c, serial_number: "That serial number is already in use." }));
        } else {
          setFormError(message);
        }
      } else {
        setFormError(message);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{isEdit ? "Edit Asset" : "Add Asset"}</DialogTitle>

      <form onSubmit={handleSubmit} noValidate>
        <DialogContent>
          {formError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {formError}
            </Alert>
          )}

          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth size="small" label="Asset Tag" required autoFocus
                value={form.asset_tag} onChange={setField("asset_tag")}
                error={Boolean(errors.asset_tag)} helperText={errors.asset_tag}
                placeholder="AT-0004"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth size="small" label="Name" required
                value={form.name} onChange={setField("name")}
                error={Boolean(errors.name)} helperText={errors.name}
                placeholder='MacBook Pro 14"'
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Brand" value={form.brand} onChange={setField("brand")} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Model" value={form.model} onChange={setField("model")} />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth size="small" label="Serial Number"
                value={form.serial_number} onChange={setField("serial_number")}
                error={Boolean(errors.serial_number)} helperText={errors.serial_number}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                select fullWidth size="small" label="Category"
                value={form.category_id} onChange={setField("category_id")}
              >
                <MenuItem value="">
                  <em>Uncategorised</em>
                </MenuItem>
                {categories.map((category) => (
                  <MenuItem key={category.id} value={category.id}>
                    {category.name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                select fullWidth size="small" label="Status"
                value={form.status} onChange={setField("status")}
                helperText={
                  isEdit ? undefined : "New assets normally start as Available."
                }
              >
                {STATUS_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} />

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth size="small" type="date" label="Purchase Date"
                InputLabelProps={{ shrink: true }}
                value={form.purchase_date} onChange={setField("purchase_date")}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth size="small" type="date" label="Warranty Expiry"
                InputLabelProps={{ shrink: true }}
                value={form.warranty_expiry} onChange={setField("warranty_expiry")}
                error={Boolean(errors.warranty_expiry)} helperText={errors.warranty_expiry}
              />
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions>
          <Button variant="outlined" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            type="submit" variant="contained" disabled={saving}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {isEdit ? "Save Changes" : "Add Asset"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
