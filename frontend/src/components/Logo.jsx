import { Box } from '@mui/material';

// JAZ Home Theatres mark (gold on transparent) — reads on both the dark sidebar and light surfaces.
// `size` is accepted as an alias of `height`.
export default function Logo({ height, size, sx }) {
  const h = height || size || 34;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', ...sx }}>
      <img src="/jaz-logo.png" alt="JAZ Home Theatres" style={{ height: h, width: 'auto', display: 'block' }} />
    </Box>
  );
}
