import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // In development the app and the API are on different ports, so /api is
    // proxied to the API server. Requests stay same-origin from the browser's
    // point of view, which keeps the session cookie working and means there's
    // no CORS configuration to maintain.
    //
    // In production Express serves the built app itself, so there is no proxy
    // and no second origin at all.
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: false,
      },
    },
  },
  build: {
    // MUI + DataGrid + Recharts in one file is ~1.5 MB. Splitting the big
    // third-party libraries out means a page load fetches them in parallel and
    // they stay cached when application code changes.
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          mui: ["@mui/material", "@mui/icons-material"],
          datagrid: ["@mui/x-data-grid"],
          charts: ["recharts"],
        },
      },
    },
  },
});
