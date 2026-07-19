/**
 * Profile
 *
 * EmployeeDashboard has always rendered a "Profile" button pointing at
 * /employee/profile, but no such route existed -- clicking it landed on the
 * 404 page. This is that page.
 *
 * Read-only on purpose: everything shown here already lives in AuthContext
 * (loaded from public.profiles at login), so there's no fetch. Editing
 * profiles belongs with the admin Manage Employees screen, which isn't
 * built yet.
 */

import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Avatar from "@mui/material/Avatar";
import Divider from "@mui/material/Divider";
import Chip from "@mui/material/Chip";

import { useAuth } from "../../hooks/useAuth";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { getInitials, EMPTY } from "../../utils/formatters";
import PageHeader from "../../components/common/PageHeader";

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

export default function Profile() {
  useDocumentTitle("My Profile");
  const { user } = useAuth();

  return (
    <Box sx={{ maxWidth: 860 }}>
      <PageHeader
        title="My Profile"
        description="Your account details. Contact an administrator to change anything here."
      />

      <Card>
        <CardContent>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2.5 }}>
            <Avatar sx={{ bgcolor: "primary.main", width: 56, height: 56, fontSize: 20 }}>
              {getInitials(user?.name)}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h6" noWrap>
                {user?.name || "Unnamed user"}
              </Typography>
              <Typography variant="body2" color="text.secondary" noWrap>
                {user?.email}
              </Typography>
            </Box>
            {user?.role && (
              <Chip
                label={user.role}
                size="small"
                sx={{ ml: "auto", textTransform: "capitalize", fontWeight: 600 }}
              />
            )}
          </Box>

          <Divider sx={{ mb: 2.5 }} />

          <Grid container spacing={2.5}>
            <InfoRow label="Full Name" value={user?.name} />
            <InfoRow label="Email" value={user?.email} />
            <InfoRow label="Department" value={user?.department} />
            <InfoRow label="Role" value={user?.role} />
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
}
