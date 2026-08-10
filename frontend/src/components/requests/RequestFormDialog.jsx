/**
 * RequestFormDialog
 *
 * Where an employee raises a request. Two kinds, chosen at the top, because
 * they need genuinely different information:
 *
 *   Repair    — pick one of the assets you currently hold. The serial number
 *               and tag come from the record, so nobody has to type them and
 *               nobody can mistype them.
 *   New item  — pick the kind of item you need. There's no asset record yet,
 *               so a category is the most specific thing that can be given.
 */

import { useEffect, useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import BuildOutlinedIcon from "@mui/icons-material/BuildOutlined";
import AddShoppingCartOutlinedIcon from "@mui/icons-material/AddShoppingCartOutlined";

import { colors } from "../../theme/theme";
import { EMPTY } from "../../utils/formatters";

const EMPTY_FORM = { requestType: "repair", assetId: "", categoryId: "", description: "" };

export default function RequestFormDialog({
  open, onClose, onSubmit, myAssets = [], categories = [],
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Reset each time it opens, so a previous draft never leaks into a new one.
  // When there's only one asset to choose from — opened from a single asset's
  // page, or the employee only holds one — pick it rather than making them
  // select from a list of one.
  useEffect(() => {
    if (!open) return;

    const onlyAsset = myAssets.length === 1 ? myAssets[0].asset?.id : "";
    setForm({
      ...EMPTY_FORM,
      requestType: myAssets.length ? "repair" : "new_asset",
      assetId: onlyAsset || "",
    });
    setError("");
  }, [open, myAssets]);

  const set = (field) => (event) => setForm((f) => ({ ...f, [field]: event.target.value }));

  const selectedAsset = myAssets.find((item) => item.asset?.id === form.assetId)?.asset;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (form.requestType === "repair" && !form.assetId) {
      setError("Choose which asset needs repair.");
      return;
    }
    if (form.requestType === "new_asset" && !form.categoryId) {
      setError("Choose the kind of item you need.");
      return;
    }
    if (!form.description.trim()) {
      setError("Describe what you need, so IT can act on it.");
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(form);
      onClose();
    } catch (err) {
      setError(err?.message || "Couldn't submit this request.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={submitting ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Raise a Request</DialogTitle>

      <form onSubmit={handleSubmit}>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
            Your request goes to the IT administrator for review.
          </Typography>

          <ToggleButtonGroup
            exclusive
            fullWidth
            size="small"
            value={form.requestType}
            onChange={(_e, value) => value && setForm((f) => ({ ...f, requestType: value }))}
            sx={{ mb: 3 }}
          >
            <ToggleButton value="repair" disabled={myAssets.length === 0}>
              <BuildOutlinedIcon fontSize="small" sx={{ mr: 1 }} />
              Repair
            </ToggleButton>
            <ToggleButton value="new_asset">
              <AddShoppingCartOutlinedIcon fontSize="small" sx={{ mr: 1 }} />
              New Item
            </ToggleButton>
          </ToggleButtonGroup>

          {error && <Alert severity="error" sx={{ mb: 2.5 }}>{error}</Alert>}

          {form.requestType === "repair" ? (
            <>
              {myAssets.length === 0 ? (
                <Alert severity="info" sx={{ mb: 2.5 }}>
                  You don't currently hold any assets, so there's nothing to
                  report for repair.
                </Alert>
              ) : (
                <TextField
                  select fullWidth size="small" required
                  label="Which asset?"
                  value={form.assetId}
                  onChange={set("assetId")}
                  sx={{ mb: 2.5 }}
                >
                  {myAssets.map((item) => (
                    <MenuItem key={item.asset.id} value={item.asset.id}>
                      {item.asset.asset_tag} — {item.asset.name}
                    </MenuItem>
                  ))}
                </TextField>
              )}

              {/* Serial number shown back, so the user can confirm they picked
                  the right machine before describing the fault. */}
              {selectedAsset && (
                <Box
                  sx={{
                    mb: 2.5, p: 1.75,
                    bgcolor: colors.canvas,
                    border: `1px solid ${colors.border}`,
                    borderRadius: 1,
                  }}
                >
                  <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", color: colors.heading, mb: 0.75 }}>
                    SERIAL NUMBER
                  </Typography>
                  <Typography sx={{ fontFamily: "ui-monospace, Consolas, monospace", fontSize: 13.5, color: colors.body }}>
                    {selectedAsset.serial_number || EMPTY}
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: colors.muted, mt: 0.75 }}>
                    {[selectedAsset.brand, selectedAsset.model].filter(Boolean).join(" ") || EMPTY}
                  </Typography>
                </Box>
              )}
            </>
          ) : (
            <TextField
              select fullWidth size="small" required
              label="What kind of item?"
              value={form.categoryId}
              onChange={set("categoryId")}
              sx={{ mb: 2.5 }}
            >
              {categories.map((category) => (
                <MenuItem key={category.id} value={category.id}>
                  {category.name}
                </MenuItem>
              ))}
            </TextField>
          )}

          <TextField
            fullWidth multiline minRows={3} required
            size="small"
            label={form.requestType === "repair" ? "What's wrong with it?" : "Why do you need it?"
            }
            placeholder={
              form.requestType === "repair"
                ? "e.g. The keyboard's E and R keys have stopped responding."
                : "e.g. Required for testing on a second monitor during trials."
            }
            value={form.description}
            onChange={set("description")}
          />
        </DialogContent>

        <DialogActions>
          <Button onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={submitting}>
            {submitting ? <CircularProgress size={20} color="inherit" /> : "Submit Request"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
