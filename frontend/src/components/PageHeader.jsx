import { Box, Typography, Breadcrumbs, Link } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';

export default function PageHeader({ title, crumbs = [], action }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
      <Box>
        <Typography variant="h2" sx={{ mb: 0.5 }}>
          {title}
        </Typography>
        <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} aria-label="breadcrumb">
          <Link component={RouterLink} to="/sales-dashboard" underline="hover" color="inherit" variant="body2">
            Home
          </Link>
          {crumbs.map((c) => (
            <Typography key={c} variant="body2" color="text.primary">
              {c}
            </Typography>
          ))}
        </Breadcrumbs>
      </Box>
      {action}
    </Box>
  );
}
