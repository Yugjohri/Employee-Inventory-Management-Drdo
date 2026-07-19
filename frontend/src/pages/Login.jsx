/**
 * Login
 *
 * Split screen: an indigo gradient brand panel on the left, the form on the
 * right. The panel collapses on mobile, where it would eat the whole screen.
 *
 * Wired to AuthContext.login(), which calls supabase.auth.signInWithPassword()
 * underneath. Where the user lands afterwards is decided by
 * resolveLandingPath() -- see utils/navigation.js for why we don't simply
 * return them to the page they were bounced from.
 */

import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import InputAdornment from "@mui/material/InputAdornment";
import IconButton from "@mui/material/IconButton";
import MemoryOutlinedIcon from "@mui/icons-material/MemoryOutlined";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";

import { useAuth } from "../hooks/useAuth";
import { resolveLandingPath } from "../utils/navigation";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { colors } from "../theme/theme";

const HIGHLIGHTS = [
  "Track every laptop, monitor and peripheral in one place",
  "See who holds what, and the full assignment history",
  "Warranty alerts before hardware falls out of cover",
];

export default function Login() {
  useDocumentTitle("Sign in");

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
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
      const profile = await login(email.trim(), password);
      navigate(resolveLandingPath(profile.role, attemptedPath), { replace: true });
    } catch (err) {
      setError(err.message || "Unable to sign in. Check your credentials and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      {/* Brand panel -- hidden below md, where it would push the form off screen */}
      <Box
        sx={{
          display: { xs: "none", md: "flex" },
          flex: "1 1 50%",
          flexDirection: "column",
          justifyContent: "space-between",
          p: 7,
          color: "#fff",
          background: `linear-gradient(135deg, ${colors.primaryDark} 0%, ${colors.primary} 55%, #6366F1 100%)`,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box
            sx={{
              width: 42, height: 42, borderRadius: "11px",
              bgcolor: "rgba(255,255,255,0.16)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <MemoryOutlinedIcon />
          </Box>
          <Typography sx={{ fontWeight: 700, fontSize: 20, color: "#fff" }}>
            AssetTrack
          </Typography>
        </Box>

        <Box>
          <Typography
            sx={{ color: "#fff", fontWeight: 700, fontSize: 40, lineHeight: 1.15, letterSpacing: "-0.02em" }}
          >
            Hardware inventory,
            <br />
            under control.
          </Typography>
          <Typography sx={{ color: "rgba(255,255,255,0.82)", mt: 2, fontSize: 17, maxWidth: 420 }}>
            One place to track every asset, who's holding it, and when its
            warranty runs out.
          </Typography>

          <Box sx={{ mt: 5, display: "flex", flexDirection: "column", gap: 1.75 }}>
            {HIGHLIGHTS.map((line) => (
              <Box key={line} sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <CheckCircleOutlineIcon sx={{ fontSize: 20, color: "rgba(255,255,255,0.9)" }} />
                <Typography sx={{ color: "rgba(255,255,255,0.9)", fontSize: 15 }}>
                  {line}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>

        <Typography sx={{ color: "rgba(255,255,255,0.6)", fontSize: 13 }}>
          Internal asset management system
        </Typography>
      </Box>

      {/* Form panel */}
      <Box
        sx={{
          flex: "1 1 50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: "background.paper",
          p: { xs: 3, sm: 6 },
        }}
      >
        <Box sx={{ width: "100%", maxWidth: 380 }}>
          {/* Compact brand mark, shown only when the left panel is hidden */}
          <Box
            sx={{
              display: { xs: "flex", md: "none" },
              alignItems: "center",
              gap: 1.5,
              mb: 4,
            }}
          >
            <Box
              sx={{
                width: 40, height: 40, borderRadius: "10px",
                bgcolor: "primary.main", color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <MemoryOutlinedIcon fontSize="small" />
            </Box>
            <Typography variant="h6">AssetTrack</Typography>
          </Box>

          <Typography variant="h5" sx={{ mb: 0.5 }}>
            Sign in
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Enter your credentials to access your dashboard.
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2.5 }}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth size="small" label="Email" type="email" required autoFocus
              value={email} onChange={(e) => setEmail(e.target.value)}
              sx={{ mb: 2.5 }}
            />

            <TextField
              fullWidth size="small" label="Password" required
              type={showPassword ? "text" : "password"}
              value={password} onChange={(e) => setPassword(e.target.value)}
              sx={{ mb: 3 }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword((shown) => !shown)}
                      edge="end" size="small"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <Button
              type="submit" fullWidth variant="contained" size="large" disabled={submitting}
              sx={{ py: 1.25 }}
            >
              {submitting ? <CircularProgress size={22} color="inherit" /> : "Sign in"}
            </Button>
          </form>

          <Typography variant="caption" display="block" sx={{ mt: 3, textAlign: "center" }}>
            Trouble signing in? Contact your system administrator.
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
