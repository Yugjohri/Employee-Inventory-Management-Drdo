/**
 * AssetDetails
 *
 * One assignment in full, reached from My Assets. Reads the `assignmentId`
 * route param and fetches that single row joined with its asset + category.
 *
 * There's no ownership check in this component -- RLS enforces it. An
 * employee requesting someone else's assignment id gets zero rows back, and
 * .single() turns that into the error rendered below.
 */

import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Skeleton from "@mui/material/Skeleton";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import MemoryOutlinedIcon from "@mui/icons-material/MemoryOutlined";

import StatusBadge from "../../components/common/StatusBadge";
import { getAssignment } from "../../api/assignments";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { formatDate, daysUntil, isExpired, isExpiringSoon, EMPTY } from "../../utils/formatters";
import { warrantyColors, getStatusStyle } from "../../theme/theme";

function InfoRow({ label, value }) {
  return (
    <Grid item xs={12} sm={6}>
      <Typography variant="caption" color="text.disabled" display="block" sx={{ mb: 0.25 }}>
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={500} color="text.primary">
        {value || EMPTY}
      </Typography>
    </Grid>
  );
}

export default function AssetDetails() {
  const { assignmentId } = useParams();
  const navigate = useNavigate();

  const [assignment, setAssignment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const asset = assignment?.asset || {};
  useDocumentTitle(asset.name ? `${asset.asset_tag} — ${asset.name}` : "Asset Details");

  useEffect(() => {
    let isMounted = true;

    // From the user's side this page has exactly one failure mode: the asset
    // isn't theirs to see. Whether that's a missing row, an id RLS filtered
    // out, or a malformed uuid in the URL, the raw Postgres text ("Cannot
    // coerce the result to a single JSON object", "invalid input syntax for
    // type uuid") tells them nothing. Show one clear message and keep the
    // real error in the console for debugging.
    const NOT_FOUND = "This asset wasn't found, or you don't have access to it.";

    async function load() {
      setLoading(true);
      try {
        const data = await getAssignment(assignmentId);

        if (!isMounted) return;

        if (data) {
          setAssignment(data);
          setError("");
        } else {
          setAssignment(null);
          setError(NOT_FOUND);
        }
      } catch (err) {
        console.error("Failed to load assignment:", err);
        if (isMounted) setError(NOT_FOUND);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    load();
    return () => {
      isMounted = false;
    };
  }, [assignmentId]);

  const statusStyle = getStatusStyle(asset.status);
  const warrantyDays = daysUntil(asset.warranty_expiry);
  const expired = isExpired(asset.warranty_expiry);
  const expiringSoon = isExpiringSoon(asset.warranty_expiry);

  return (
    <Box sx={{ maxWidth: 860 }}>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate("/employee/my-assets")}
        sx={{ mb: 2 }}
      >
        Back to My Assets
      </Button>

      <Typography variant="h5" sx={{ mb: 0.5 }}>
        Asset Details
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Read-only information about this asset.
      </Typography>

      {error && <Alert severity="error">{error}</Alert>}

      {loading && !error && (
        <Card>
          <CardContent>
            <Skeleton variant="text" width={240} height={36} />
            <Skeleton variant="text" width={160} />
            <Skeleton variant="rounded" height={220} sx={{ mt: 2 }} />
          </CardContent>
        </Card>
      )}

      {!loading && !error && assignment && (
        <Card>
          <CardContent>
            <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2.5 }}>
              <Box
                sx={{
                  width: 58, height: 58, borderRadius: "14px",
                  bgcolor: statusStyle.bg, color: statusStyle.main,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <MemoryOutlinedIcon fontSize="large" />
              </Box>

              <Box sx={{ minWidth: 0 }}>
                <Typography variant="h6" noWrap>
                  {asset.name || "Unnamed asset"}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {asset.asset_tag}
                </Typography>
              </Box>

              <Box sx={{ ml: "auto" }}>
                <StatusBadge status={asset.status} />
              </Box>
            </Box>

            {expired && (
              <Alert severity="error" sx={{ mb: 2.5 }}>
                This asset's warranty expired on {formatDate(asset.warranty_expiry, "long")}.
              </Alert>
            )}
            {expiringSoon && (
              <Alert severity="warning" sx={{ mb: 2.5 }}>
                Warranty expires in {warrantyDays} days — consider raising a renewal request.
              </Alert>
            )}

            <Divider sx={{ mb: 2.5 }} />

            <Grid container spacing={2.5}>
              <InfoRow label="Category" value={asset.category?.name} />
              <InfoRow label="Brand" value={asset.brand} />
              <InfoRow label="Model" value={asset.model} />
              <InfoRow label="Serial Number" value={asset.serial_number} />
              <InfoRow label="Purchase Date" value={formatDate(asset.purchase_date, "long")} />
              <InfoRow
                label="Warranty Expiry"
                value={
                  <>
                    {formatDate(asset.warranty_expiry, "long")}
                    {expired && (
                      <Chip
                        label="Expired" size="small"
                        sx={{
                          ml: 1, height: 20, fontSize: 11,
                          bgcolor: warrantyColors.expired.bg,
                          color: warrantyColors.expired.main,
                        }}
                      />
                    )}
                    {expiringSoon && (
                      <Chip
                        label={`${warrantyDays}d left`} size="small"
                        sx={{
                          ml: 1, height: 20, fontSize: 11,
                          bgcolor: warrantyColors.expiringSoon.bg,
                          color: warrantyColors.expiringSoon.main,
                        }}
                      />
                    )}
                  </>
                }
              />
              <InfoRow
                label="Assigned to you since"
                value={formatDate(assignment.assigned_date, "long")}
              />
              {assignment.remarks && <InfoRow label="Remarks" value={assignment.remarks} />}
            </Grid>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
