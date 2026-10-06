import { Outlet } from 'react-router-dom';
import { Box } from '@mui/material';
import CinemaBackdrop from '../components/CinemaBackdrop';

export default function MinimalLayout() {
  return (
    <CinemaBackdrop>
      <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center' }} className="brio-fade-up">
        <Outlet />
      </Box>
    </CinemaBackdrop>
  );
}
