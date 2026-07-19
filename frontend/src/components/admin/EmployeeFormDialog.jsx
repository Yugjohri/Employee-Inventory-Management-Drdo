/**
 * EmployeeFormDialog
 *
 * Edits the profile half of an employee: name, department, role and the
 * active toggle. Email is shown read-only because it belongs to the Supabase
 * Auth record, not the profile row -- changing it here would silently
 * de-sync the two.
 *
 * There is no "add" mode. Creating a login requires the auth admin API and a
 * service_role key, which must never reach the browser; accounts are created
 * in the Supabase dashboard instead.
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
import Switch from "@mui/material/Switch";
import FormControlLabel from "@mui/material/FormControlLabel";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import Typography from "@mui/material/Typography";

export default function EmployeeFormDialog({ open, employee, currentUserId, onClose, onSubmit }) {
  const [form, setForm] = useState({ name: "", department: "", role: "employee", is_active: true });
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !employee) return;
    setForm({
      name: employee.name || "",
      department: employee.department || "",
      role: employee.role || "employee",
      is_active: employee.is_active !== false,
    });
    setFormError("");
  }, [open, employee]);

  // Guard against an admin locking themselves out of their own console.
  const isSelf = employee?.id === currentUserId;

  const setField = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError("");
    setSaving(true);

    try {
      await onSubmit({
        name: form.name.trim(),
        department: form.department.trim() || null,
        role: form.role,
        is_active: form.is_active,
      });
      onClose();
    } catch (err) {
      setFormError(err?.message || "Couldn't save this employee.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Edit Employee</DialogTitle>

      <form onSubmit={handleSubmit} noValidate>
        <DialogContent>
          {formError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {formError}
            </Alert>
          )}

          {isSelf && (
            <Alert severity="info" sx={{ mb: 2 }}>
              This is your own account. Role and status are locked so you can't
              remove your own admin access.
            </Alert>
          )}

          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth size="small" label="Full Name" autoFocus
                value={form.name} onChange={setField("name")}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth size="small" label="Email" value={employee?.email || ""}
                disabled helperText="Managed in Supabase Auth"
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth size="small" label="Department"
                value={form.department} onChange={setField("department")}
                placeholder="Engineering"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                select fullWidth size="small" label="Role"
                value={form.role} onChange={setField("role")} disabled={isSelf}
              >
                <MenuItem value="employee">Employee</MenuItem>
                <MenuItem value="admin">Admin</MenuItem>
              </TextField>
            </Grid>

            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={form.is_active}
                    disabled={isSelf}
                    onChange={(e) =>
                      setForm((current) => ({ ...current, is_active: e.target.checked }))
                    }
                  />
                }
                label={
                  <Typography variant="body2">
                    Active — inactive users are signed out and can't log back in
                  </Typography>
                }
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
            Save Changes
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
