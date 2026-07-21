/**
 * DashboardLayout
 *
 * The single app shell used by BOTH roles -- a fixed dark navy sidebar plus a
 * light content area. Admins get five nav links, employees get three; nothing
 * else differs, so the two sides feel like one product.
 *
 * Replaces the old split where admins had Sidebar+Navbar and employees had a
 * separate EmployeeLayout with a white top bar.
 *
 * Mobile: the sidebar becomes a temporary drawer behind a hamburger button,
 * since founders/reviewers will open this on a phone.
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
import LogoutIcon from "@mui/icons-material/Logout";
import MenuIcon from "@mui/icons-material/Menu";
import MemoryOutlinedIcon from "@mui/icons-material/MemoryOutlined";

import { useAuth } from "../../hooks/useAuth";
import { SIDEBAR_WIDTH } from "../../utils/layoutConstants";
import { getInitials } from "../../utils/formatters";
import { colors } from "../../theme/theme";

const ADMIN_NAV = [
  { label: "Dashboard", path: "/admin/dashboard", icon: <DashboardOutlinedIcon /> },
  { label: "Assets", path: "/admin/assets", icon: <InventoryOutlinedIcon /> },
  { label: "Employees", path: "/admin/employees", icon: <GroupOutlinedIcon /> },
  { label: "Assignments", path: "/admin/assignments", icon: <AssignmentOutlinedIcon /> },
];

const EMPLOYEE_NAV = [
  { label: "Dashboard", path: "/employee/dashboard", icon: <DashboardOutlinedIcon /> },
  { label: "My Assets", path: "/employee/my-assets", icon: <InventoryOutlinedIcon /> },
  { label: "Profile", path: "/employee/profile", icon: <PersonOutlineIcon /> },
];

export default function DashboardLayout() {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = role === "admin" ? ADMIN_NAV : EMPLOYEE_NAV;

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
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, px: 2.5, py: 3 }}>
        <Box
          sx={{
            width: 38,
            height: 38,
            borderRadius: "10px",
            bgcolor: "primary.main",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <MemoryOutlinedIcon fontSize="small" />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ color: "#fff", fontWeight: 700, fontSize: 16, lineHeight: 1.2 }}>
            AssetTrack
          </Typography>
          <Typography sx={{ color: colors.sidebarMuted, fontSize: 12 }}>
            {role === "admin" ? "Admin Console" : "Employee Portal"}
          </Typography>
        </Box>
      </Box>

      {/* Nav */}
      <List sx={{ px: 1.5, flexGrow: 1 }}>
        {navItems.map((item) => (
          <ListItemButton
            key={item.path}
            component={NavLink}
            to={item.path}
            onClick={() => setMobileOpen(false)}
            sx={{
              color: colors.sidebarText,
              py: 1.1,
              "&:hover": { bgcolor: colors.sidebarHover },
              // NavLink sets .active on the matching route.
              "&.active": {
                bgcolor: "primary.main",
                color: "#fff",
                "&:hover": { bgcolor: "primary.dark" },
                "& .MuiListItemIcon-root": { color: "#fff" },
              },
            }}
          >
            <ListItemIcon sx={{ minWidth: 36, color: colors.sidebarMuted }}>
              {item.icon}
            </ListItemIcon>
            <ListItemText
              primary={item.label}
              primaryTypographyProps={{ fontSize: 14, fontWeight: 600 }}
            />
          </ListItemButton>
        ))}
      </List>

      {/* User block pinned to the bottom */}
      <Divider sx={{ borderColor: colors.sidebarHover }} />
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, p: 2 }}>
        <Avatar sx={{ width: 36, height: 36, bgcolor: "primary.main", fontSize: 14 }}>
          {getInitials(user?.name)}
        </Avatar>
        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
          <Typography sx={{ color: "#fff", fontSize: 13, fontWeight: 600 }} noWrap>
            {user?.name || "User"}
          </Typography>
          <Typography sx={{ color: colors.sidebarMuted, fontSize: 12 }} noWrap>
            {user?.email}
          </Typography>
        </Box>
        <Tooltip title="Log out">
          <IconButton
            onClick={handleLogout}
            size="small"
            sx={{ color: colors.sidebarMuted, "&:hover": { color: "#fff", bgcolor: colors.sidebarHover } }}
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
            <IconButton edge="start" onClick={() => setMobileOpen(true)} sx={{ color: "text.primary" }}>
              <MenuIcon />
            </IconButton>
            <Typography variant="subtitle1">AssetTrack</Typography>
          </Toolbar>
        </AppBar>

        <Box sx={{ p: { xs: 2, sm: 3, md: 4 }, maxWidth: 1400, mx: "auto" }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
