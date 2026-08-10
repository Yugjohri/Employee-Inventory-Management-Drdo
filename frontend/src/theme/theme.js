/**
 * Design system.
 *
 * Every visual decision lives here rather than in component sx props, so
 * cards, tables, badges and buttons stay identical across all pages. If you
 * want to restyle the app, this is the only file you should need to touch.
 *
 * The palette is drawn from the DRDO emblem — its deep institutional blue as
 * the primary, its red reserved as a sparing accent for the masthead rule and
 * the seal. Restrained on purpose: this is an internal government system, not
 * a product landing page. No gradients, no tinted shadows, no colour used
 * decoratively where it isn't carrying meaning.
 *
 * Typography is a system font stack rather than a web font. That is a
 * deliberate offline decision: a downloaded font is one more thing that fails
 * silently on an air-gapped network. Segoe UI leads the stack, so on the
 * Windows machines this will run on the result is consistent and native.
 *
 * Spacing is MUI's default 8px scale — `p: 3` means 24px.
 */

import { createTheme } from "@mui/material/styles";

// ---------------------------------------------------------------------------
// Raw tokens
// ---------------------------------------------------------------------------

export const colors = {
  // DRDO institutional blue
  primary: "#14487F",
  primaryDark: "#0E3560",
  primaryLight: "#3E6FA8",
  primarySoft: "#E8F0F9",

  // Emblem red. Used only for the masthead rule and official marks — never
  // for ordinary UI chrome, or it stops reading as significant.
  accent: "#A32B2B",
  accentSoft: "#FBEDED",

  sidebar: "#0D2B4E",
  sidebarHover: "#1A3E68",
  sidebarActive: "#14487F",
  sidebarText: "#C7D5E6",
  sidebarMuted: "#8AA0BC",

  canvas: "#F4F6F9",
  surface: "#FFFFFF",
  border: "#D8DEE7",
  borderStrong: "#BAC5D3",

  heading: "#0F1F33",
  body: "#42506B",
  muted: "#6B7A93",

  // Table header treatment. Deliberately much darker than the body text it
  // sits above: the previous #94A3B8 on #F8FAFC was about 1.9:1, which fails
  // WCAG AA and is why column headings didn't read as headings.
  tableHeaderBg: "#EDF1F6",
  tableHeaderText: "#0F1F33",
};

/**
 * Asset status colour coding — the single source of truth. StatusBadge and
 * the charts both read from here, so adding a status means editing one object.
 */
export const statusColors = {
  available:    { main: "#15803D", bg: "#DCFCE7", label: "Available" },
  assigned:     { main: "#14487F", bg: "#E0EAF6", label: "Assigned" },
  under_repair: { main: "#B45309", bg: "#FEF3C7", label: "Under Repair" },
  retired:      { main: "#B91C1C", bg: "#FEE2E2", label: "Retired" },
};

/** Assignment lifecycle states, styled the same way as asset statuses. */
export const assignmentStatusColors = {
  active:   { main: "#14487F", bg: "#E0EAF6", label: "Active" },
  returned: { main: "#5B6B85", bg: "#EEF1F5", label: "Returned" },
};

/** Request lifecycle states. */
export const requestStatusColors = {
  pending:   { main: "#B45309", bg: "#FEF3C7", label: "Pending" },
  approved:  { main: "#14487F", bg: "#E0EAF6", label: "Approved" },
  rejected:  { main: "#B91C1C", bg: "#FEE2E2", label: "Rejected" },
  completed: { main: "#15803D", bg: "#DCFCE7", label: "Completed" },
};

/** Warranty badges aren't a status, so they sit alongside. */
export const warrantyColors = {
  expired:      { main: "#B91C1C", bg: "#FEE2E2" },
  expiringSoon: { main: "#B45309", bg: "#FEF3C7" },
};

/** Tinted icon tiles on stat cards. */
export const statTileColors = {
  blue:   { main: "#14487F", bg: "#E0EAF6" },
  green:  { main: "#15803D", bg: "#DCFCE7" },
  orange: { main: "#B45309", bg: "#FEF3C7" },
  purple: { main: "#5B3E96", bg: "#EDE9FE" },
};

/** Categorical series colours for the charts. */
export const chartPalette = [
  "#14487F", "#3E6FA8", "#0F766E", "#15803D",
  "#B45309", "#A32B2B", "#5B3E96", "#64748B",
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

/** Colours for a request status. */
export function getRequestStatusStyle(status) {
  return requestStatusColors[status] || requestStatusColors.pending;
}

// ---------------------------------------------------------------------------
// Theme
// ---------------------------------------------------------------------------

const FONT_STACK =
  '"Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, Roboto, "Helvetica Neue", Arial, sans-serif';

const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: colors.primary,
      dark: colors.primaryDark,
      light: colors.primaryLight,
      contrastText: "#FFFFFF",
    },
    error: { main: colors.accent },
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

  // Squarer than before. Heavily rounded corners read as consumer software;
  // an official record system should look closer to a printed form.
  shape: { borderRadius: 6 },

  typography: {
    fontFamily: FONT_STACK,
    h4: { fontWeight: 700, color: colors.heading, letterSpacing: "-0.01em" },
    h5: { fontWeight: 700, color: colors.heading, letterSpacing: "-0.005em" },
    h6: { fontWeight: 700, color: colors.heading },
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
          borderRadius: 6,
          border: `1px solid ${colors.border}`,
          boxShadow: "0 1px 2px rgba(15, 31, 51, 0.05)",
        },
      },
    },
    MuiCardContent: {
      styleOverrides: {
        root: { padding: 24, "&:last-child": { paddingBottom: 24 } },
      },
    },
    MuiPaper: {
      styleOverrides: { rounded: { borderRadius: 6 } },
    },

    // --- Controls ----------------------------------------------------------
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 4, paddingInline: 16, paddingBlock: 8 },
        containedPrimary: { "&:hover": { backgroundColor: colors.primaryDark } },
        outlined: { borderColor: colors.borderStrong, color: colors.body },
      },
    },
    MuiIconButton: {
      styleOverrides: { root: { borderRadius: 4 } },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          backgroundColor: colors.surface,
          "& fieldset": { borderColor: colors.borderStrong },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 600, borderRadius: 4 },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: { backgroundColor: colors.heading, fontSize: 12, borderRadius: 4 },
      },
    },
    MuiAlert: {
      styleOverrides: { root: { borderRadius: 4 } },
    },

    // --- Dialogs -----------------------------------------------------------
    MuiDialog: {
      styleOverrides: {
        paper: { borderRadius: 8, boxShadow: "0 16px 40px rgba(15, 31, 51, 0.20)" },
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
        root: { borderRadius: 4, marginBottom: 2 },
      },
    },

    // --- Tables ------------------------------------------------------------
    // Applied globally so every DataGrid in the app looks identical, and so
    // the header/data distinction below is fixed in exactly one place.
    //
    // Column headings are near-black, bold, slightly tracked and set on a grey
    // band with a strong rule beneath; data rows are lighter and regular
    // weight. The contrast between the two is the point — a "Serial Number"
    // heading should never be mistakable for a serial number.
    MuiDataGrid: {
      styleOverrides: {
        root: {
          border: "none",
          "--DataGrid-rowBorderColor": colors.border,
          "& .MuiDataGrid-cell:focus, & .MuiDataGrid-cell:focus-within": { outline: "none" },
          "& .MuiDataGrid-columnHeader:focus, & .MuiDataGrid-columnHeader:focus-within": {
            outline: "none",
          },
          // The grid's own separators fight with the header band's rule.
          "& .MuiDataGrid-columnSeparator": { display: "none" },
        },
        columnHeaders: {
          borderBottom: `2px solid ${colors.borderStrong}`,
        },
        columnHeader: {
          backgroundColor: colors.tableHeaderBg,
        },
        columnHeaderTitle: {
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          color: colors.tableHeaderText,
        },
        row: {
          "&:hover": { backgroundColor: colors.primarySoft },
        },
        cell: {
          fontSize: 14,
          color: colors.body,
          borderTop: `1px solid ${colors.border}`,
        },
        footerContainer: { borderTop: `1px solid ${colors.border}` },
      },
    },

    // Plain MUI tables get the same header treatment, so a page built with
    // <Table> instead of <DataGrid> doesn't look like it came from a
    // different application.
    MuiTableHead: {
      styleOverrides: {
        root: {
          backgroundColor: colors.tableHeaderBg,
          "& .MuiTableCell-head": {
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            color: colors.tableHeaderText,
            borderBottom: `2px solid ${colors.borderStrong}`,
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        body: { fontSize: 14, color: colors.body, borderBottomColor: colors.border },
      },
    },
  },
});

export default theme;
