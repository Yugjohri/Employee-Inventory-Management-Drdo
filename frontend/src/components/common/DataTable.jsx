/**
 * DataTable
 *
 * Thin wrapper around MUI's DataGrid that every table in the app uses, so
 * they all share the same header style, row height, pagination position,
 * empty state and loading treatment.
 *
 * The visual styling itself lives in theme.js (MuiDataGrid overrides) --
 * this component only supplies behaviour and the two overlay slots:
 *
 *   - no rows      -> <EmptyState /> instead of DataGrid's bare "No rows"
 *   - loading      -> skeleton rows instead of a spinner, so the table keeps
 *                     its shape while data arrives
 */

import Box from "@mui/material/Box";
import Skeleton from "@mui/material/Skeleton";
import Paper from "@mui/material/Paper";
import { DataGrid } from "@mui/x-data-grid";

import EmptyState from "./EmptyState";

/** Skeleton rows sized to the grid, shown while the first fetch is running. */
function LoadingOverlay({ columnCount = 5, rowCount = 6 }) {
  return (
    <Box sx={{ pt: 1, px: 2, bgcolor: "background.paper", height: "100%" }}>
      {Array.from({ length: rowCount }).map((_, rowIndex) => (
        <Box
          key={rowIndex}
          sx={{ display: "flex", gap: 3, alignItems: "center", height: 52 }}
        >
          {Array.from({ length: columnCount }).map((__, colIndex) => (
            <Skeleton
              key={colIndex}
              variant="text"
              height={20}
              sx={{ flex: colIndex === 0 ? 0.7 : 1 }}
            />
          ))}
        </Box>
      ))}
    </Box>
  );
}

export default function DataTable({
  rows,
  columns,
  loading = false,
  emptyState,
  height = 560,
  pageSize = 10,
  ...gridProps
}) {
  return (
    <Paper
      variant="outlined"
      sx={{ height, width: "100%", borderColor: "divider", overflow: "hidden" }}
    >
      <DataGrid
        rows={rows}
        columns={columns}
        loading={loading}
        disableRowSelectionOnClick
        disableColumnMenu
        rowHeight={56}
        columnHeaderHeight={44}
        pageSizeOptions={[10, 25, 50]}
        initialState={{ pagination: { paginationModel: { pageSize, page: 0 } } }}
        slots={{
          noRowsOverlay: () => emptyState || <EmptyState title="No records found" />,
          // DataGrid renders this while `loading` is true. Keeping the row
          // silhouette avoids the layout jump a centred spinner causes.
          loadingOverlay: () => (
            <LoadingOverlay columnCount={columns.length} rowCount={Math.min(pageSize, 6)} />
          ),
        }}
        sx={{
          // Hide the header row while skeletons show, so the two don't fight
          // for attention on first paint.
          "& .MuiDataGrid-overlayWrapper": { zIndex: 2 },
        }}
        {...gridProps}
      />
    </Paper>
  );
}
