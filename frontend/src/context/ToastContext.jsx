/**
 * ToastContext
 *
 * App-wide snackbar feedback. Every write in the app reports through here --
 * there are no alert() calls anywhere.
 *
 * Usage:
 *   const toast = useToast();
 *   toast.success("Asset created.");
 *   toast.error(err.message);
 *
 * Mounted once in App.jsx above the router, so any page can call it without
 * rendering its own <Snackbar>.
 */

import { createContext, useContext, useCallback, useMemo, useState } from "react";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";

const ToastContext = createContext(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a <ToastProvider>.");
  }
  return context;
}

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null); // { message, severity }

  const show = useCallback((message, severity = "info") => {
    setToast({ message, severity });
  }, []);

  const value = useMemo(
    () => ({
      show,
      success: (message) => show(message, "success"),
      error: (message) => show(message, "error"),
      info: (message) => show(message, "info"),
      warning: (message) => show(message, "warning"),
    }),
    [show]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}

      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        {/* Snackbar needs a single child that can hold a ref; keeping the
            Alert mounted only while `toast` exists avoids a null-severity
            render during the exit transition. */}
        {toast ? (
          <Alert
            severity={toast.severity}
            variant="filled"
            onClose={() => setToast(null)}
            sx={{ borderRadius: 2, boxShadow: "0 8px 24px rgba(15,23,42,0.18)" }}
          >
            {toast.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </ToastContext.Provider>
  );
}
