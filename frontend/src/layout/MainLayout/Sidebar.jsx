import { useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Drawer, Box, List, ListItemButton, ListItemIcon, ListItemText, Typography, Toolbar, Chip
} from '@mui/material';
import { getSections } from './menuItems';
import { userRole } from '../../utils/roles';
import { logout } from '../../store/slices/authSlice';
import { brand } from '../../theme';

export const drawerWidth = 252;

export default function Sidebar({ open, isMobile, onClose }) {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const user = useSelector((st) => st.auth.user);
  const counts = useSelector((st) => st.approval.counts);
  const sections = getSections(userRole(user));
  const here = location.pathname + location.search;
  const exact = sections.some((sec) => sec.items.some((it) => it.path === here));
  const isActive = (item) => {
    if (!item.path) return false;
    if (item.path === here) return true;
    return !exact && !item.path.includes('?') && item.path === location.pathname;
  };

  const handleClick = async (item) => {
    if (item.action === 'logout') {
      await dispatch(logout());
      navigate('/login');
      return;
    }
    if (item.href) {
      window.open(item.href, '_blank', 'noopener');
      return;
    }
    navigate(item.path);
    if (isMobile) onClose?.();
  };

  const content = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: brand.night }}>
      {/* spacer under the fixed header */}
      <Toolbar sx={{ minHeight: { xs: 64, sm: 68 } }} />

      <Box sx={{ px: 1.75, py: 2, flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {sections.map((section, si) => (
          <Box key={section.title} sx={{ mb: 2.5, mt: si === sections.length - 1 ? 'auto' : 0 }}>
            <Typography sx={{ pl: 1.25, mb: 0.75, color: '#7d7466', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
              {section.title}
            </Typography>
            <List dense disablePadding>
              {section.items.map((item) => {
                const active = isActive(item);
                const badge = item.badge ? counts?.[item.badge] || 0 : 0;
                const Icon = item.icon;
                return (
                  <ListItemButton
                    key={item.label}
                    selected={active}
                    onClick={() => handleClick(item)}
                    sx={{
                      borderRadius: 1.5, mb: 0.35, py: 0.85, color: '#c2b8a6',
                      transition: 'background-color .2s ease, color .2s ease',
                      '& .MuiListItemIcon-root': { color: '#8a806f' },
                      '&:hover': { bgcolor: 'rgba(243,234,216,.05)', color: brand.ivory },
                      '&.Mui-selected': {
                        bgcolor: 'rgba(212,171,85,.12)',
                        color: brand.ivory,
                        boxShadow: `inset 2px 0 0 ${brand.goldBright}`,
                        '& .MuiListItemIcon-root': { color: brand.goldBright },
                        '&:hover': { bgcolor: 'rgba(212,171,85,.16)' }
                      }
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <Icon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: 14, fontWeight: active ? 650 : 500 }} />
                    {badge > 0 && (
                      <Chip size="small" label={badge > 99 ? '99+' : badge}
                        sx={{ height: 20, fontSize: 11, bgcolor: brand.gold, color: '#fff', '& .MuiChip-label': { px: 0.75 } }} />
                    )}
                  </ListItemButton>
                );
              })}
            </List>
          </Box>
        ))}
      </Box>
      <Typography sx={{ px: 3, pb: 2, color: '#5e5649', fontSize: 10, letterSpacing: '0.18em' }}>
        YOUR SPACE · OUR EXPERTISE
      </Typography>
    </Box>
  );

  return (
    <Drawer
      variant={isMobile ? 'temporary' : 'persistent'}
      open={open}
      onClose={onClose}
      ModalProps={{ keepMounted: true }}
      sx={{
        width: drawerWidth, flexShrink: 0,
        '& .MuiDrawer-paper': { width: drawerWidth, boxSizing: 'border-box', border: 'none', bgcolor: brand.night }
      }}
    >
      {content}
    </Drawer>
  );
}
