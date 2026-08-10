/**
 * EmployeeFormDialog
 *
 * Creates and edits employee records, including their login.
 *
 * Accounts can be created here now. Under Supabase this was impossible —
 * signing someone up needed the service_role key, which must never reach a
 * browser — so accounts had to be made by hand in a dashboard. With our own
 * API the password is hashed server-side and a new account is just a form.
 *
 * A new account starts on the server's default password, which the person is
 * expected to change; there's no email delivery on an intranet to send them
 * anything else.
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
import Divider from "@mui/material/Divider";

import { ROLE_LABELS } from "../../utils/navigation";

const BLANK = {
  pis_number: "", first_name: "", middle_name: "", last_name: "",
  email: "", mobile: "", tele_no: "", username: "",
  group_id: "", designation_id: "", internal_designation_id: "",
  role: "employee", is_active: true,
};

export default function EmployeeFormDialog({
  open, employee, currentUserId, currentUserRole, currentUserGroupId,
  groups = [], coordinatorByGroup = new Map(), designations = [],
  internalDesignations = [], onClose, onSubmit,
}) {
  // Only an admin decides who holds which role and which group they sit in.
  // For a coordinator both are fixed: new people join their group as ordinary
  // employees. The API and the database enforce this independently — the
  // disabled fields below just avoid offering a choice that would be refused.
  const isAdmin = currentUserRole === "admin";
  const [form, setForm] = useState(BLANK);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const isCreate = !employee;

  useEffect(() => {
    if (!open) return;

    setForm(
      employee
        ? {
            pis_number: employee.pis_number || "",
            first_name: employee.first_name || "",
            middle_name: employee.middle_name || "",
            last_name: employee.last_name || "",
            email: employee.email || "",
            mobile: employee.mobile || "",
            tele_no: employee.tele_no || "",
            username: employee.username || "",
            group_id: employee.group_id || "",
            designation_id: employee.designation_id || "",
            internal_designation_id: employee.internal_designation_id || "",
            role: employee.role || "employee",
            is_active: employee.is_active !== false,
          }
        : { ...BLANK, group_id: isAdmin ? "" : currentUserGroupId || "" }
    );
    setFormError("");
  }, [open, employee, isAdmin, currentUserGroupId]);

  // Guard against an admin locking themselves out of their own console.
  const isSelf = employee?.id === currentUserId;

  const setField = (field) => (event) =>
    setForm((current) => ({ ...current, [field]: event.target.value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError("");

    if (form.role === "group_it_coordinator" && !form.group_id) {
      setFormError("A Group IT Coordinator must be assigned to a group.");
      return;
    }

    setSaving(true);
    try {
      await onSubmit({
        pis_number: form.pis_number.trim() || null,
        first_name: form.first_name.trim(),
        middle_name: form.middle_name.trim() || null,
        last_name: form.last_name.trim(),
        email: form.email.trim(),
        mobile: form.mobile.trim() || null,
        tele_no: form.tele_no.trim() || null,
        group_id: form.group_id || null,
        designation_id: form.designation_id || null,
        internal_designation_id: form.internal_designation_id || null,
        role: form.role,
        is_active: form.is_active,
        // The login IS the email address. Deriving it here means one less
        // field to fill in, and the two can never drift apart.
        ...(isCreate ? { username: form.email.trim().toLowerCase() } : {}),
      });
      onClose();
    } catch (err) {
      setFormError(err?.message || "Couldn't save this employee.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle>{isCreate ? "Add Employee" : "Edit Employee"}</DialogTitle>

      <form onSubmit={handleSubmit} noValidate>
        <DialogContent>
          {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}

          {isSelf && (
            <Alert severity="info" sx={{ mb: 2 }}>
              This is your own account. Role and status are locked so you can't
              remove your own admin access.
            </Alert>
          )}

          <Typography variant="subtitle2" sx={{ mt: 1, mb: 1.5 }}>
            Identity
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth size="small" label="First Name" required autoFocus
                value={form.first_name} onChange={setField("first_name")}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth size="small" label="Middle Name"
                value={form.middle_name} onChange={setField("middle_name")}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth size="small" label="Last Name" required
                value={form.last_name} onChange={setField("last_name")}
              />
            </Grid>

            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth size="small" label="PIS Number"
                value={form.pis_number} onChange={setField("pis_number")}
                placeholder="PIS0001"
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth size="small" label="Email" required type="email"
                value={form.email} onChange={setField("email")}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth size="small" label="Mobile"
                value={form.mobile} onChange={setField("mobile")}
              />
            </Grid>
          </Grid>

          <Divider sx={{ my: 2.5 }} />
          <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
            Organisation
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <TextField
                select fullWidth size="small" label="Group"
                value={form.group_id} onChange={setField("group_id")}
                disabled={isSelf || !isAdmin}
                helperText={
                  !isAdmin
                    ? "Your group"
                    : form.role === "group_it_coordinator"
                      ? "Defines what this coordinator can see"
                      : "Places them under that group's IT Coordinator"
                }
              >
                <MenuItem value="">— None —</MenuItem>
                {groups.map((group) => {
                  const coordinator = coordinatorByGroup.get(group.id);
                  return (
                    <MenuItem key={group.id} value={group.id}>
                      {group.short_name} — {group.full_name}
                      {coordinator ? `  ·  ${coordinator.name}` : ""}
                    </MenuItem>
                  );
                })}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                select fullWidth size="small" label="Designation"
                value={form.designation_id} onChange={setField("designation_id")}
              >
                <MenuItem value="">— None —</MenuItem>
                {designations.map((item) => (
                  <MenuItem key={item.id} value={item.id}>{item.full_name}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                select fullWidth size="small" label="Internal Designation"
                value={form.internal_designation_id}
                onChange={setField("internal_designation_id")}
              >
                <MenuItem value="">— None —</MenuItem>
                {internalDesignations.map((item) => (
                  <MenuItem key={item.id} value={item.id}>{item.full_name}</MenuItem>
                ))}
              </TextField>
            </Grid>
          </Grid>

          <Divider sx={{ my: 2.5 }} />
          <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
            Access
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              {/* The login is the email address — there's no reason to make an
                  admin type the same string twice. On edit it's shown read-only
                  because changing someone's login would lock them out. */}
              <TextField
                fullWidth size="small" label="Login (email address)"
                value={isCreate ? form.email || "—" : form.username}
                disabled
                helperText={
                  isCreate ? "Taken from the email above" : "Logins can't be changed"
                }
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                select fullWidth size="small" label="Role"
                value={form.role} onChange={setField("role")}
                disabled={isSelf || !isAdmin}
                helperText={isAdmin ? " " : "Only an administrator can change roles"}
              >
                <MenuItem value="employee">{ROLE_LABELS.employee}</MenuItem>
                <MenuItem value="group_it_coordinator">
                  {ROLE_LABELS.group_it_coordinator}
                </MenuItem>
                <MenuItem value="admin">{ROLE_LABELS.admin}</MenuItem>
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
                    Active — inactive users can't sign in
                  </Typography>
                }
              />
            </Grid>
          </Grid>

          {isCreate && (
            <Alert severity="info" sx={{ mt: 2 }}>
              They sign in with their email address and the system default
              password. Use the key icon on the Employees list to reset it later.
            </Alert>
          )}
        </DialogContent>

        <DialogActions>
          <Button variant="outlined" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            type="submit" variant="contained" disabled={saving}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {isCreate ? "Create Employee" : "Save Changes"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
