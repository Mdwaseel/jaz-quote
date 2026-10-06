import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  AppBar, Toolbar, IconButton, Box, Avatar, Menu, MenuItem, Typography, Divider,
  ListItemIcon, Link, Badge, Tooltip
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import LogoutIcon from '@mui/icons-material/Logout';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import NotificationsNoneOutlinedIcon from '@mui/icons-material/NotificationsNoneOutlined';
import BugReportOutlinedIcon from '@mui/icons-material/BugReportOutlined';
import Logo from '../../components/Logo';
import { logout } from '../../store/slices/authSlice';
import { userRole } from '../../utils/roles';
import { brand } from '../../theme';
import { SUPPORT_EMAIL } from '../../config';

const iconSx = { color: '#cfc5b3', '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,.06)' } };

export default function Header({ onToggleSidebar }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector((s) => s.auth.user);
  const unread = useSelector((s) => s.approval.counts?.UnreadNotifications || 0);
  const [anchor, setAnchor] = useState(null);

  const handleLogout = async () => {
    setAnchor(null);
    await dispatch(logout());
    navigate('/login');
  };

  const initials = (user?.profileName || 'U').split(' ').map((w) => w[0]).slice(0, 2).join('');

  return (
    <AppBar position="fixed" elevation={0}
      sx={{ bgcolor: brand.night, color: brand.ivory, borderBottom: '1px solid rgba(212,171,85,.18)', zIndex: (t) => t.zIndex.drawer + 1 }}>
      <Toolbar sx={{ gap: 1, minHeight: { xs: 64, sm: 68 } }}>
        <IconButton edge="start" aria-label="Toggle menu" onClick={onToggleSidebar} sx={{ mr: 0.5, ...iconSx }}><MenuIcon /></IconButton>

        <Box component={RouterLink} to="/sales-dashboard" aria-label="JAZ Home Theatres — dashboard" sx={{ display: 'inline-flex', alignItems: 'center' }}>
          <Logo height={46} />
        </Box>

        <Box sx={{ flexGrow: 1 }} />

        <Link
          component="button"
          onClick={() => window.open(`mailto:${SUPPORT_EMAIL}?subject=Quotation%20software%20issue`, '_blank')}
          underline="none"
          sx={{ display: { xs: 'none', sm: 'inline-flex' }, alignItems: 'center', gap: 0.6, color: '#a99f8d', fontSize: 14, mr: 1, '&:hover': { color: brand.ivory } }}
        >
          Report a bug
          <BugReportOutlinedIcon sx={{ fontSize: 18 }} />
        </Link>

        <Tooltip title="Notifications">
          <IconButton aria-label="Notifications" onClick={() => navigate('/notifications')} sx={iconSx}>
            <Badge color="secondary" badgeContent={unread} max={99}><NotificationsNoneOutlinedIcon /></Badge>
          </IconButton>
        </Tooltip>

        <Box sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer', ml: 0.5 }} onClick={(e) => setAnchor(e.currentTarget)}>
          <Avatar sx={{ bgcolor: 'transparent', border: `1px solid ${brand.gold}`, color: brand.goldBright, width: 34, height: 34, fontSize: 14 }}>{initials}</Avatar>
          <KeyboardArrowDownIcon sx={{ color: '#a99f8d', fontSize: 20, ml: 0.25 }} />
        </Box>
        <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          slotProps={{ paper: { sx: { minWidth: 220, mt: 0.5 } } }}>
          <Box sx={{ px: 2, py: 1 }}>
            <Typography variant="subtitle2">{user?.profileName || 'User'}</Typography>
            <Typography variant="caption" color="text.secondary">{userRole(user)}{user?.region ? ` · ${user.region}` : ''}{user?.franchize ? ` · ${user.franchize}` : ''}</Typography>
          </Box>
          <Divider />
          <MenuItem onClick={() => { setAnchor(null); navigate('/user-profile/profile-view'); }}>
            <ListItemIcon><PersonOutlineIcon fontSize="small" /></ListItemIcon> My Profile
          </MenuItem>
          <Divider />
          <MenuItem onClick={handleLogout}>
            <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon> Logout
          </MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  );
}
