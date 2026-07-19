/**
 * StatusPage
 *
 * Shared layout for 403 and 404: oversized status code, one line of
 * explanation, and a role-aware "go home" button. Keeping both pages on one
 * component is what stops them drifting apart visually.
 */

import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

import { useAuth } from "../../hooks/useAuth";
import { homePathForRole } from "../../utils/navigation";
import { colors } from "../../theme/theme";

export default function StatusPage({ code, title, description }) {
  const navigate = useNavigate();
  const { isAuthenticated, role } = useAuth();

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        px: 3,
        bgcolor: "background.default",
      }}
    >
      <Typography
        sx={{
          fontSize: { xs: 96, sm: 132 },
          fontWeight: 800,
          lineHeight: 1,
          letterSpacing: "-0.04em",
          background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryLight} 100%)`,
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        {code}
      </Typography>

      <Typography variant="h5" sx={{ mt: 2 }}>
        {title}
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ mt: 1, maxWidth: 420 }}>
        {description}
      </Typography>

      <Button
        variant="contained"
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate(isAuthenticated ? homePathForRole(role) : "/login")}
        sx={{ mt: 4 }}
      >
        {isAuthenticated ? "Go home" : "Go to sign in"}
      </Button>
    </Box>
  );
}
