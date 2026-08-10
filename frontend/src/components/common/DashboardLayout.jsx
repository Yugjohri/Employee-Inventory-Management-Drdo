/**
 * DashboardLayout
 *
 * The single app shell used by all three roles — a fixed navy sidebar plus a
 * light content area. Only the nav links differ, so the product feels like one
 * system regardless of who signs in.
 *
 * The links a role sees are cosmetic. Access is decided by the API and the
 * database rules; hiding a link is a courtesy, not a control.
 *
 * Mobile: the sidebar becomes a temporary drawer behind a hamburger button.
 */

import { useState } from "react";
import { NavLink, useNavigate, Outlet } from "react-router-dom";
import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Typography from "@mui/material/Typography";
import Avatar from "@mui/material/Avatar";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";

import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import InventoryOutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import GroupOutlinedIcon from "@mui/icons-material/GroupOutlined";
import AssignmentOutlinedIcon from "@mui/icons-material/AssignmentOutlined";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import BuildOutlinedIcon from "@mui/icons-material/BuildOutlined";
import LogoutIcon from "@mui/icons-material/Logout";
import MenuIcon from "@mui/icons-material/Menu";

import { useAuth } from "../../hooks/useAuth";
import { SIDEBAR_WIDTH } from "../../utils/layoutConstants";
import { getInitials } from "../../utils/formatters";
import { ROLE_AREAS, ROLE_LABELS } from "../../utils/navigation";
import { colors } from "../../theme/theme";

const NAV_BY_ROLE = {
  admin: [
    { label: "Dashboard", path: "/admin/dashboard", icon: <DashboardOutlinedIcon /> },
    { label: "Assets", path: "/admin/assets", icon: <InventoryOutlinedIcon /> },
    { label: "Employees", path: "/admin/employees", icon: <GroupOutlinedIcon /> },
    { label: "Assignments", path: "/admin/assignments", icon: <AssignmentOutlinedIcon /> },
    { label: "Requests", path: "/admin/requests", icon: <BuildOutlinedIcon /> },
  ],
  group_it_coordinator: [
    { label: "Dashboard", path: "/coordinator/dashboard", icon: <DashboardOutlinedIcon /> },
    { label: "Group Employees", path: "/coordinator/employees", icon: <GroupOutlinedIcon /> },
    { label: "Group Inventory", path: "/coordinator/assignments", icon: <InventoryOutlinedIcon /> },
    { label: "Requests", path: "/coordinator/requests", icon: <BuildOutlinedIcon /> },
  ],
  employee: [
    { label: "Dashboard", path: "/employee/dashboard", icon: <DashboardOutlinedIcon /> },
    { label: "My Assets", path: "/employee/my-assets", icon: <InventoryOutlinedIcon /> },
    { label: "My Requests", path: "/employee/requests", icon: <BuildOutlinedIcon /> },
    { label: "Profile", path: "/employee/profile", icon: <PersonOutlineIcon /> },
  ],
};

export default function DashboardLayout() {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = NAV_BY_ROLE[role] || [];

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const sidebarContent = (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        bgcolor: colors.sidebar,
        color: colors.sidebarText,
      }}
    >
      {/* Brand */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, px: 2, py: 2.5 }}>
        <Box
          component="img"
          src="/drdo-logo.png"
          alt=""
          sx={{ height: 38, width: 38, objectFit: "cover", borderRadius: "50%", flexShrink: 0 }}
        />
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ color: "#fff", fontWeight: 700, fontSize: 14, lineHeight: 1.25 }}>
            Employee Inventory
          </Typography>
          <Typography sx={{ color: colors.sidebarMuted, fontSize: 11.5 }}>
            {ROLE_AREAS[role] || "Portal"}
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ borderColor: colors.sidebarHover }} />

      {/* A coordinator's whole view is bounded by their group, so name it. */}
      {role === "group_it_coordinator" && user?.group_name && (
        <Box sx={{ px: 2, py: 1.5, bgcolor: "rgba(255,255,255,0.04)" }}>
          <Typography sx={{ color: colors.sidebarMuted, fontSize: 10.5, letterSpacing: "0.08em" }}>
            ASSIGNED GROUP
          </Typography>
          <Typography sx={{ color: "#fff", fontSize: 13, fontWeight: 600 }} noWrap>
            {user.group_name}
          </Typography>
        </Box>
      )}

      {/* Nav */}
      <List sx={{ px: 1.25, py: 1.5, flexGrow: 1 }}>
        {navItems.map((item) => (
          <ListItemButton
            key={item.path}
            component={NavLink}
            to={item.path}
            onClick={() => setMobileOpen(false)}
            sx={{
              color: colors.sidebarText,
              py: 1,
              "&:hover": { bgcolor: colors.sidebarHover },
              // NavLink sets .active on the matching route.
              "&.active": {
                bgcolor: colors.sidebarActive,
                color: "#fff",
                fontWeight: 700,
                "&:hover": { bgcolor: colors.sidebarActive },
                "& .MuiListItemIcon-root": { color: "#fff" },
              },
            }}
          >
            <ListItemIcon sx={{ minWidth: 34, color: colors.sidebarMuted }}>
              {item.icon}
            </ListItemIcon>
            <ListItemText
              primary={item.label}
              primaryTypographyProps={{ fontSize: 13.5, fontWeight: 600 }}
            />
          </ListItemButton>
        ))}
      </List>

      {/* User block pinned to the bottom */}
      <Divider sx={{ borderColor: colors.sidebarHover }} />
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, p: 2 }}>
        <Avatar sx={{ width: 36, height: 36, bgcolor: colors.primaryLight, fontSize: 13 }}>
          {getInitials(user?.name)}
        </Avatar>
        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
          <Typography sx={{ color: "#fff", fontSize: 13, fontWeight: 600 }} noWrap>
            {user?.name || "User"}
          </Typography>
          <Typography sx={{ color: colors.sidebarMuted, fontSize: 11.5 }} noWrap>
            {ROLE_LABELS[role] || ""}
          </Typography>
        </Box>
        <Tooltip title="Sign out">
          <IconButton
            onClick={handleLogout}
            size="small"
            aria-label="Sign out"
            sx={{
              color: colors.sidebarMuted,
              "&:hover": { color: "#fff", bgcolor: colors.sidebarHover },
            }}
          >
            <LogoutIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      {/* Desktop: permanent rail */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: "none", md: "block" },
          width: SIDEBAR_WIDTH,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: SIDEBAR_WIDTH,
            boxSizing: "border-box",
            border: "none",
          },
        }}
      >
        {sidebarContent}
      </Drawer>

      {/* Mobile: temporary drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: "block", md: "none" },
          "& .MuiDrawer-paper": { width: SIDEBAR_WIDTH, boxSizing: "border-box", border: "none" },
        }}
      >
        {sidebarContent}
      </Drawer>

      <Box
        component="main"
        sx={{ flexGrow: 1, width: { md: `calc(100% - ${SIDEBAR_WIDTH}px)` }, minWidth: 0 }}
      >
        {/* Mobile-only bar holding the hamburger. */}
        <AppBar
          position="sticky"
          elevation={0}
          sx={{
            display: { xs: "block", md: "none" },
            bgcolor: "background.paper",
            borderBottom: `1px solid ${colors.border}`,
          }}
        >
          <Toolbar sx={{ gap: 1 }}>
            <IconButton
              edge="start"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
              sx={{ color: "text.primary" }}
            >
              <MenuIcon />
            </IconButton>
            <Typography variant="subtitle1">Employee Inventory Management</Typography>
          </Toolbar>
        </AppBar>

        <Box sx={{ p: { xs: 2, sm: 3, md: 4 }, maxWidth: 1400, mx: "auto" }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
