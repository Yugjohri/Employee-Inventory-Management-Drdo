/**
 * App
 *
 * Provider stack, outermost first. Order matters:
 *   ThemeProvider  design tokens for everything below
 *   CssBaseline    browser style reset
 *   ToastProvider  snackbar feedback, above the router so any page can call it
 *   BrowserRouter  URL handling
 *   AuthProvider   session state (needs the router, since it triggers redirects)
 */

import { BrowserRouter } from "react-router-dom";
import ThemeProvider from "@mui/material/styles/ThemeProvider";
import CssBaseline from "@mui/material/CssBaseline";

import theme from "./theme/theme";
import { AuthProvider } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import AppRoutes from "./routes/AppRoutes";

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ToastProvider>
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
      </ToastProvider>
    </ThemeProvider>
  );
}
