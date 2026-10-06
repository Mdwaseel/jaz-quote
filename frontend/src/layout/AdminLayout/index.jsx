import { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box, Drawer, List, ListItemButton, ListItemIcon, ListItemText, Toolbar, AppBar,
  Typography, Avatar, IconButton, useMediaQuery, Menu, MenuItem, Tooltip
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import SellOutlinedIcon from '@mui/icons-material/SellOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import ManageSearchOutlinedIcon from '@mui/icons-material/ManageSearchOutlined';
import ApartmentOutlinedIcon from '@mui/icons-material/ApartmentOutlined';
import MenuIcon from '@mui/icons-material/Menu';
import LogoutIcon from '@mui/icons-material/Logout';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { logout } from '../../store/slices/authSlice';
import Logo from '../../components/Logo';
import { brand } from '../../theme';

const drawerWidth = 250;
const nav = [
  { label: 'Dashboard', path: '/admin', icon: DashboardOutlinedIcon },
  { label: 'Prices & Catalog', path: '/admin/prices', icon: SellOutlinedIcon },
  { label: 'Quotations', path: '/admin/quotations', icon: ReceiptLongOutlinedIcon },
  { label: 'Approvals', path: '/admin/approvals', icon: FactCheckOutlinedIcon },
  { label: 'Users & Hierarchy', path: '/admin/users', icon: AccountTreeOutlinedIcon },
  { label: 'Company & Bank', path: '/admin/company', icon: ApartmentOutlinedIcon },
  { label: 'Audit log', path: '/admin/audit', icon: ManageSearchOutlinedIcon }
];

export default function AdminLayout() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [open, setOpen] = useState(!isMobile);
  const [anchor, setAnchor] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const user = useSelector((s) => s.auth.user);

  const doLogout = async () => {
    setAnchor(null);
    await dispatch(logout());
    navigate('/admin/login');
  };

  const drawer = (
    <Box sx={{ height: '100%', bgcolor: brand.night, color: '#c2b8a6' }}>
      <Toolbar sx={{ minHeight: { xs: 64, sm: 68 } }} />
      <List sx={{ px: 1.5, py: 2 }}>
        {nav.map((item) => {
          const active = location.pathname === item.path;
          const Icon = item.icon;
          return (
            <ListItemButton
              key={item.path}
              selected={active}
              onClick={() => { navigate(item.path); if (isMobile) setOpen(false); }}
              sx={{
                borderRadius: 1.5, mb: 0.5, py: 0.9, color: active ? brand.ivory : '#c2b8a6',
                transition: 'background-color .2s ease, color .2s ease',
                '& .MuiListItemIcon-root': { color: active ? brand.goldBright : '#8a806f', minWidth: 38 },
                '&.Mui-selected': { bgcolor: 'rgba(212,171,85,.12)', boxShadow: `inset 2px 0 0 ${brand.goldBright}` },
                '&.Mui-selected:hover': { bgcolor: 'rgba(212,171,85,.16)' },
                '&:hover': { bgcolor: 'rgba(243,234,216,.05)', color: brand.ivory }
              }}
            >
              <ListItemIcon><Icon fontSize="small" /></ListItemIcon>
              <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: 14, fontWeight: active ? 600 : 500 }} />
            </ListItemButton>
          );
        })}
      </List>
    </Box>
  );

  const initials = (user?.profileName || 'A').split(' ').map((w) => w[0]).slice(0, 2).join('');

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="fixed" elevation={0} sx={{ zIndex: (t) => t.zIndex.drawer + 1, bgcolor: brand.night, color: brand.ivory, borderBottom: '1px solid rgba(212,171,85,.18)' }}>
        <Toolbar sx={{ minHeight: { xs: 64, sm: 68 } }}>
          <IconButton edge="start" aria-label="Toggle menu" onClick={() => setOpen((o) => !o)} sx={{ mr: 1.5, color: '#cfc5b3' }}><MenuIcon /></IconButton>
          <Logo height={46} />
          <Box sx={{ ml: 1.5, px: 1, py: 0.25, borderRadius: 0.75, border: `1px solid ${brand.gold}`, color: brand.goldBright, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.16em' }}>ADMIN</Box>
          <Box sx={{ flexGrow: 1 }} />
          <Tooltip title="Open sales app">
            <IconButton aria-label="Open sales app" onClick={() => navigate('/sales-dashboard')} sx={{ mr: 1, color: '#cfc5b3' }}><OpenInNewIcon /></IconButton>
          </Tooltip>
          <Box sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }} onClick={(e) => setAnchor(e.currentTarget)}>
            <Avatar sx={{ bgcolor: 'transparent', border: `1px solid ${brand.gold}`, color: brand.goldBright, width: 36, height: 36, fontSize: 15 }}>{initials}</Avatar>
            <Box sx={{ ml: 1, display: { xs: 'none', sm: 'block' } }}>
              <Typography variant="subtitle2" sx={{ lineHeight: 1.1, color: brand.ivory }}>{user?.profileName || 'Admin'}</Typography>
              <Typography variant="caption" sx={{ color: '#a99f8d' }}>{user?.employeeCode}</Typography>
            </Box>
          </Box>
          <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
            <MenuItem onClick={doLogout}><LogoutIcon fontSize="small" style={{ marginRight: 8 }} /> Logout</MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Drawer
        variant={isMobile ? 'temporary' : 'persistent'}
        open={open}
        onClose={() => setOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{ width: drawerWidth, flexShrink: 0, '& .MuiDrawer-paper': { width: drawerWidth, boxSizing: 'border-box', border: 'none' } }}
      >
        {drawer}
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, minWidth: 0, p: { xs: 2, md: 3 }, ml: !isMobile && open ? 0 : !isMobile ? `-${drawerWidth}px` : 0 }}>
        <Toolbar sx={{ minHeight: { xs: 64, sm: 68 } }} />
        <Outlet />
      </Box>
    </Box>
  );
}
