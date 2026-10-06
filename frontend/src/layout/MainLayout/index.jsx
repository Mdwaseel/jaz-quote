import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Outlet } from 'react-router-dom';
import { Box, Toolbar, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import Header from './Header';
import Sidebar, { drawerWidth } from './Sidebar';
import { refreshMe } from '../../store/slices/authSlice';
import { fetchCounts } from '../../store/slices/approvalSlice';

export default function MainLayout() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [open, setOpen] = useState(!isMobile);
  const dispatch = useDispatch();

  // Refresh role/hierarchy and approval badges on load, then poll the badges.
  useEffect(() => {
    dispatch(refreshMe());
    dispatch(fetchCounts());
    const t = setInterval(() => dispatch(fetchCounts()), 60000);
    return () => clearInterval(t);
  }, [dispatch]);

  return (
    <Box sx={{ display: 'flex' }}>
      <Header onToggleSidebar={() => setOpen((o) => !o)} />
      <Sidebar open={open} isMobile={isMobile} onClose={() => setOpen(false)} />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minWidth: 0, // let wide children (grids, tabs) scroll inside instead of widening the page
          p: { xs: 2, md: 3 },
          minHeight: '100vh',
          bgcolor: 'background.default',
          ml: !isMobile && open ? 0 : !isMobile ? `-${drawerWidth}px` : 0
        }}
      >
        <Toolbar sx={{ minHeight: { xs: 64, sm: 68 } }} />
        <Outlet />
      </Box>
    </Box>
  );
}
