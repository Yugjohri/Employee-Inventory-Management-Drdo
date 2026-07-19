/**
 * FullPageLoader
 *
 * Shown while the auth session is being restored on first load.
 *
 * ProtectedRoute and RoleBasedRedirect used to `return null` here, which
 * meant a blank white page -- and if the profile query ever hung, the user
 * had no way to tell the difference between "loading" and "broken". A
 * spinner plus a label makes the waiting state visible.
 */

import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";

export default function FullPageLoader({ message = "Loading…" }) {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        bgcolor: "background.default",
      }}
    >
      <CircularProgress />
      <Typography variant="body2" color="text.secondary">
        {message}
      </Typography>
    </Box>
  );
}
