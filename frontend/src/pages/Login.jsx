/**
 * Login — the application's front page.
 *
 * Presented as an official internal system rather than a product page: a
 * tricolour rule and emblem masthead, the system name as the page heading,
 * a plain sign-in form, and an authorised-use notice. Deliberately restrained
 * — no marketing copy, no gradient hero, no feature list. Someone opening this
 * on the intranet should immediately recognise it as a departmental record
 * system.
 *
 * Sign-in uses the email-style identifier on the employee record. The field
 * it maps to is still `username` in the database — accounts happen to be
 * named with an email address, which keeps plain usernames working for any
 * account created that way.
 */

import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import InputAdornment from "@mui/material/InputAdornment";
import IconButton from "@mui/material/IconButton";
import Divider from "@mui/material/Divider";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";

import { useAuth } from "../hooks/useAuth";
import { resolveLandingPath } from "../utils/navigation";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { colors } from "../theme/theme";

export default function Login() {
  useDocumentTitle("Sign in");

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const attemptedPath = location.state?.from?.pathname;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const profile = await login(username.trim(), password);
      navigate(resolveLandingPath(profile.role, attemptedPath), { replace: true });
    } catch (err) {
      setError(err.message || "Unable to sign in. Check your credentials and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        bgcolor: colors.canvas,
      }}
    >
      {/* Tricolour rule — the one piece of decoration on the page. */}
      <Box sx={{ display: "flex", height: 4, flexShrink: 0 }}>
        <Box sx={{ flex: 1, bgcolor: "#FF9933" }} />
        <Box sx={{ flex: 1, bgcolor: "#FFFFFF" }} />
        <Box sx={{ flex: 1, bgcolor: "#138808" }} />
      </Box>

      {/* Masthead */}
      <Box
        component="header"
        sx={{
          bgcolor: colors.surface,
          borderBottom: `1px solid ${colors.border}`,
          px: { xs: 2.5, md: 5 },
          py: 2,
        }}
      >
        {/*
          Centred, not left-aligned. Everything else on this page — the
          heading, the rule, the sign-in card — is centred on the viewport, so
          a masthead pinned to the left edge of its own container read as
          misaligned against them. `justifyContent: center` keeps the emblem
          and wordmark on the same vertical axis as the content below at every
          width; the maxWidth only stops the line growing indefinitely on very
          wide screens.
        */}
        <Box
          sx={{
            maxWidth: 1120,
            mx: "auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            gap: 2,
          }}
        >
          <Box
            component="img"
            src="/drdo-logo.png"
            alt="Defence Research and Development Organisation emblem"
            sx={{ height: 56, width: 56, objectFit: "contain", flexShrink: 0 }}
          />
          <Box sx={{ minWidth: 0, textAlign: "left" }}>
            <Typography
              sx={{
                fontWeight: 700,
                fontSize: { xs: 14, sm: 16 },
                color: colors.heading,
                lineHeight: 1.3,
              }}
            >
              Defence Research &amp; Development Organisation
            </Typography>
            <Typography sx={{ fontSize: { xs: 12, sm: 13 }, color: colors.muted }}>
              Ministry of Defence, Government of India
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Body */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          px: { xs: 2.5, md: 5 },
          py: { xs: 5, md: 8 },
        }}
      >
        <Box sx={{ width: "100%", maxWidth: 460 }}>
          {/* Page heading */}
          <Box sx={{ textAlign: "center", mb: 4 }}>
            <Typography
              component="h1"
              sx={{
                fontWeight: 700,
                fontSize: { xs: 26, sm: 32 },
                color: colors.heading,
                letterSpacing: "-0.01em",
                lineHeight: 1.2,
              }}
            >
              Employee Inventory Management
            </Typography>

            {/* Short accent rule, echoing the emblem's red. */}
            <Box
              sx={{
                width: 56,
                height: 3,
                bgcolor: colors.accent,
                mx: "auto",
                mt: 2,
                mb: 2,
              }}
            />

            <Typography sx={{ fontSize: 15, color: colors.body, maxWidth: 380, mx: "auto" }}>
              Hardware inventory, custody records and asset requests for
              departmental personnel.
            </Typography>
          </Box>

          {/* Sign-in */}
          <Paper
            variant="outlined"
            sx={{ borderColor: colors.border, p: { xs: 3, sm: 4 }, bgcolor: colors.surface }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
              <LockOutlinedIcon sx={{ fontSize: 18, color: colors.primary }} />
              <Typography variant="h6" sx={{ fontSize: 17 }}>
                Sign in
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Use the credentials issued to you by your administrator.
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 2.5 }}>
                {error}
              </Alert>
            )}

            <form onSubmit={handleSubmit}>
              <TextField
                fullWidth
                size="small"
                label="Email address"
                placeholder="name@company.com"
                required
                autoFocus
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                sx={{ mb: 2.5 }}
              />

              <TextField
                fullWidth
                size="small"
                label="Password"
                required
                autoComplete="current-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                sx={{ mb: 3 }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword((shown) => !shown)}
                        edge="end"
                        size="small"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? (
                          <VisibilityOff fontSize="small" />
                        ) : (
                          <Visibility fontSize="small" />
                        )}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                disabled={submitting}
                sx={{ py: 1.25 }}
              >
                {submitting ? <CircularProgress size={22} color="inherit" /> : "Sign in"}
              </Button>
            </form>

            <Divider sx={{ my: 3 }} />

            <Typography variant="caption" display="block" sx={{ textAlign: "center" }}>
              Trouble signing in? Contact your system administrator.
            </Typography>
          </Paper>

          {/* Authorised-use notice */}
          <Box
            sx={{
              mt: 3,
              p: 2,
              border: `1px solid ${colors.border}`,
              borderLeft: `3px solid ${colors.accent}`,
              bgcolor: colors.surface,
            }}
          >
            <Typography sx={{ fontSize: 12.5, color: colors.body, lineHeight: 1.6 }}>
              <strong style={{ color: colors.heading }}>Authorised access only.</strong>{" "}
              This is a restricted departmental system. Activity may be monitored
              and recorded. Unauthorised use is prohibited.
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Footer */}
      <Box
        component="footer"
        sx={{
          borderTop: `1px solid ${colors.border}`,
          bgcolor: colors.surface,
          px: { xs: 2.5, md: 5 },
          py: 2,
        }}
      >
        <Typography
          sx={{ maxWidth: 1120, mx: "auto", fontSize: 12, color: colors.muted, textAlign: "center" }}
        >
          Internal system — Defence Research &amp; Development Organisation
        </Typography>
      </Box>
    </Box>
  );
}
