/**
 * ConfirmDialog
 *
 * Used before every destructive or hard-to-undo action -- deleting an asset,
 * deactivating an employee, returning an assignment. Nothing in the app
 * mutates data without one of these first.
 *
 * Keeps its own `working` state so the confirm button can show a spinner and
 * stay disabled while the write is in flight (double-clicking a delete button
 * shouldn't fire two requests).
 */

import { useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";

export default function ConfirmDialog({
  open,
  title = "Are you sure?",
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
  onClose,
}) {
  const [working, setWorking] = useState(false);

  const handleConfirm = async () => {
    setWorking(true);
    try {
      await onConfirm();
    } finally {
      setWorking(false);
    }
  };

  return (
    <Dialog open={open} onClose={working ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>

      {description && (
        <DialogContent>
          <DialogContentText sx={{ fontSize: 14 }}>{description}</DialogContentText>
        </DialogContent>
      )}

      <DialogActions>
        <Button variant="outlined" onClick={onClose} disabled={working}>
          {cancelLabel}
        </Button>
        <Button
          variant="contained"
          color={destructive ? "error" : "primary"}
          onClick={handleConfirm}
          disabled={working}
          startIcon={working ? <CircularProgress size={16} color="inherit" /> : null}
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
