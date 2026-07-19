/**
 * AssignAssetDialog
 *
 * Hands an available asset to an active employee. Both dropdowns are loaded
 * fresh each time the dialog opens, so an asset assigned by someone else a
 * minute ago won't still be offered here.
 *
 * The write itself goes through the assign_asset() Postgres function, which
 * inserts the assignment and flips the asset status in one transaction.
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
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import { listAvailableAssets } from "../../api/assets";
import { listAssignableEmployees } from "../../api/employees";

export default function AssignAssetDialog({ open, onClose, onSubmit }) {
  const [assets, setAssets] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(true);

  const [assetId, setAssetId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [remarks, setRemarks] = useState("");

  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;

    let isMounted = true;
    setAssetId("");
    setEmployeeId("");
    setRemarks("");
    setFormError("");

    async function loadOptions() {
      setLoadingOptions(true);
      try {
        const [availableAssets, activeEmployees] = await Promise.all([
          listAvailableAssets(),
          listAssignableEmployees(),
        ]);
        if (isMounted) {
          setAssets(availableAssets);
          setEmployees(activeEmployees);
        }
      } catch (err) {
        if (isMounted) setFormError(err?.message || "Couldn't load the options.");
      } finally {
        if (isMounted) setLoadingOptions(false);
      }
    }

    loadOptions();
    return () => {
      isMounted = false;
    };
  }, [open]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError("");

    if (!assetId || !employeeId) {
      setFormError("Pick both an asset and an employee.");
      return;
    }

    setSaving(true);
    try {
      await onSubmit({ assetId, employeeId, remarks });
      onClose();
    } catch (err) {
      setFormError(err?.message || "Couldn't assign this asset.");
    } finally {
      setSaving(false);
    }
  };

  const nothingToAssign = !loadingOptions && assets.length === 0;
  const nobodyToAssignTo = !loadingOptions && employees.length === 0;

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Assign Asset</DialogTitle>

      <form onSubmit={handleSubmit} noValidate>
        <DialogContent>
          {formError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {formError}
            </Alert>
          )}

          {nothingToAssign && (
            <Alert severity="info" sx={{ mb: 2 }}>
              No assets are currently available. Add one, or return an assigned
              asset first.
            </Alert>
          )}

          {nobodyToAssignTo && (
            <Alert severity="info" sx={{ mb: 2 }}>
              There are no active employees to assign to.
            </Alert>
          )}

          {loadingOptions ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress size={28} />
            </Box>
          ) : (
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid item xs={12} sm={6}>
                <TextField
                  select fullWidth size="small" label="Asset" required
                  value={assetId} onChange={(e) => setAssetId(e.target.value)}
                  disabled={nothingToAssign}
                  helperText={`${assets.length} available`}
                >
                  {assets.map((asset) => (
                    <MenuItem key={asset.id} value={asset.id}>
                      {asset.asset_tag} — {asset.name}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  select fullWidth size="small" label="Employee" required
                  value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}
                  disabled={nobodyToAssignTo}
                  helperText={`${employees.length} active`}
                >
                  {employees.map((employee) => (
                    <MenuItem key={employee.id} value={employee.id}>
                      <Box>
                        <Typography variant="body2" fontWeight={600}>
                          {employee.name || employee.email}
                        </Typography>
                        {employee.department && (
                          <Typography variant="caption">{employee.department}</Typography>
                        )}
                      </Box>
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth size="small" label="Remarks" multiline rows={2}
                  value={remarks} onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Issued at onboarding."
                />
              </Grid>
            </Grid>
          )}
        </DialogContent>

        <DialogActions>
          <Button variant="outlined" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            type="submit" variant="contained"
            disabled={saving || loadingOptions || nothingToAssign || nobodyToAssignTo}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : null}
          >
            Assign
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
