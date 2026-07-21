/**
 * AssetTrack design system.
 *
 * Every visual decision lives here rather than in component sx props, so
 * cards, tables, badges and buttons stay identical across all pages. If you
 * want to restyle the app, this is the only file you should need to touch.
 *
 * Palette:
 *   primary   indigo  #4F46E5   actions, active nav, links
 *   sidebar   navy    #1E293B   fixed left rail
 *   canvas    slate   #F1F5F9   page background behind white cards
 *   text      near-black headings / gray-600 body / gray-400 muted
 *
 * Spacing is MUI's default 8px scale -- `p: 3` means 24px. Stick to whole
 * or half steps so rhythm stays consistent.
 */

import { createTheme } from "@mui/material/styles";

// ---------------------------------------------------------------------------
// Raw tokens
// ---------------------------------------------------------------------------

export const colors = {
  primary: "#4F46E5",
  primaryDark: "#4338CA",
  primaryLight: "#818CF8",
  primarySoft: "#EEF2FF",

  sidebar: "#1E293B",
  sidebarHover: "#334155",
  sidebarText: "#CBD5E1",
  sidebarMuted: "#94A3B8",

  canvas: "#F1F5F9",
  surface: "#FFFFFF",
  border: "#E2E8F0",

  heading: "#0F172A",
  body: "#475569",
  muted: "#94A3B8",
};

/**
 * Asset status colour coding -- the single source of truth. StatusBadge and
 * the charts both read from here, so adding a status means editing one object.
 */
export const statusColors = {
  available:    { main: "#16A34A", bg: "#DCFCE7", label: "Available" },
  assigned:     { main: "#2563EB", bg: "#DBEAFE", label: "Assigned" },
  under_repair: { main: "#EA580C", bg: "#FFEDD5", label: "Under Repair" },
  retired:      { main: "#DC2626", bg: "#FEE2E2", label: "Retired" },
};

/** Assignment lifecycle states, styled the same way as asset statuses. */
export const assignmentStatusColors = {
  active:   { main: "#2563EB", bg: "#DBEAFE", label: "Active" },
  returned: { main: "#64748B", bg: "#F1F5F9", label: "Returned" },
};

/** Warranty badges aren't a status, so they sit alongside. */
export const warrantyColors = {
  expired:      { main: "#DC2626", bg: "#FEE2E2" },
  expiringSoon: { main: "#D97706", bg: "#FEF3C7" },
};

/** Tinted icon tiles on stat cards: blue, green, orange, purple. */
export const statTileColors = {
  blue:   { main: "#2563EB", bg: "#DBEAFE" },
  green:  { main: "#16A34A", bg: "#DCFCE7" },
  orange: { main: "#EA580C", bg: "#FFEDD5" },
  purple: { main: "#7C3AED", bg: "#EDE9FE" },
};

/** Categorical series colours for the donut chart. */
export const chartPalette = [
  "#4F46E5", "#2563EB", "#0891B2", "#16A34A",
  "#CA8A04", "#EA580C", "#DC2626", "#7C3AED",
];

// The "expiring soon" window (60 days) is a domain rule rather than a design
// token, so it lives in utils/formatters.js as WARRANTY_SOON_DAYS.

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Colours for an asset status, falling back to "assigned" if unrecognised. */
export function getStatusStyle(status) {
  return statusColors[status] || statusColors.assigned;
}

/** Colours for an assignment status. */
export function getAssignmentStatusStyle(status) {
  return assignmentStatusColors[status] || assignmentStatusColors.active;
}

// ---------------------------------------------------------------------------
// Theme
// ---------------------------------------------------------------------------

const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: colors.primary,
      dark: colors.primaryDark,
      light: colors.primaryLight,
      contrastText: "#FFFFFF",
    },
    background: {
      default: colors.canvas,
      paper: colors.surface,
    },
    text: {
      primary: colors.heading,
      secondary: colors.body,
      disabled: colors.muted,
    },
    divider: colors.border,
  },

  shape: { borderRadius: 12 },

  typography: {
    fontFamily:
      '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    h4: { fontWeight: 700, color: colors.heading, letterSpacing: "-0.02em" },
    h5: { fontWeight: 700, color: colors.heading, letterSpacing: "-0.01em" },
    h6: { fontWeight: 600, color: colors.heading },
    subtitle1: { fontWeight: 600, color: colors.heading },
    subtitle2: { fontWeight: 600, color: colors.heading },
    body2: { color: colors.body },
    caption: { color: colors.muted },
    button: { textTransform: "none", fontWeight: 600 },
  },

  components: {
    // --- Surfaces ----------------------------------------------------------
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          borderRadius: 12,
          border: `1px solid ${colors.border}`,
          boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.06)",
        },
      },
    },
    MuiCardContent: {
      styleOverrides: {
        root: { padding: 24, "&:last-child": { paddingBottom: 24 } },
      },
    },
    MuiPaper: {
      styleOverrides: { rounded: { borderRadius: 12 } },
    },

    // --- Controls ----------------------------------------------------------
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 8, paddingInline: 16, paddingBlock: 8 },
        containedPrimary: { "&:hover": { backgroundColor: colors.primaryDark } },
        outlined: { borderColor: colors.border, color: colors.body },
      },
    },
    MuiIconButton: {
      styleOverrides: { root: { borderRadius: 8 } },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          backgroundColor: colors.surface,
          "& fieldset": { borderColor: colors.border },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 600, borderRadius: 8 },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: { backgroundColor: colors.heading, fontSize: 12, borderRadius: 6 },
      },
    },

    // --- Dialogs -----------------------------------------------------------
    MuiDialog: {
      styleOverrides: {
        paper: { borderRadius: 16, boxShadow: "0 20px 50px rgba(15, 23, 42, 0.18)" },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: { fontSize: 18, fontWeight: 700, color: colors.heading, padding: "24px 24px 8px" },
      },
    },
    MuiDialogContent: { styleOverrides: { root: { padding: "8px 24px" } } },
    MuiDialogActions: { styleOverrides: { root: { padding: 24, gap: 8 } } },

    // --- Sidebar nav -------------------------------------------------------
    MuiListItemButton: {
      styleOverrides: {
        root: { borderRadius: 8, marginBottom: 4 },
      },
    },

    // --- Tables ------------------------------------------------------------
    // Applied globally so every DataGrid in the app looks identical: light
    // gray uppercase header, hover highlight, no cell focus outline.
    MuiDataGrid: {
      styleOverrides: {
        root: {
          border: "none",
          "--DataGrid-rowBorderColor": colors.border,
          "& .MuiDataGrid-cell:focus, & .MuiDataGrid-cell:focus-within": { outline: "none" },
          "& .MuiDataGrid-columnHeader:focus, & .MuiDataGrid-columnHeader:focus-within": {
            outline: "none",
          },
        },
        columnHeaders: { borderBottom: `1px solid ${colors.border}` },
        columnHeader: { backgroundColor: "#F8FAFC" },
        columnHeaderTitle: {
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: colors.muted,
        },
        row: {
          "&:hover": { backgroundColor: "#F8FAFC" },
        },
        cell: { fontSize: 14, color: colors.body, borderTop: `1px solid ${colors.border}` },
        footerContainer: { borderTop: `1px solid ${colors.border}` },
      },
    },
  },
});

export default theme;
