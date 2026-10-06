import { Box, Typography } from '@mui/material';
import Logo from './Logo';
import { brand } from '../theme';

/**
 * Full-screen sign-in backdrop: the JAZ theatre photograph, darkened so the card and the
 * gold mark read cleanly, with the brand line from the quotation cover underneath.
 */
export default function CinemaBackdrop({ children, badge }) {
  return (
    <Box
      sx={{
        position: 'relative', minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', px: 2, py: 5, overflow: 'hidden',
        bgcolor: brand.night,
        backgroundImage: `linear-gradient(180deg, rgba(20,17,13,.78) 0%, rgba(20,17,13,.55) 40%, rgba(20,17,13,.92) 100%), url(/jaz-cinema.jpg)`,
        backgroundSize: 'cover', backgroundPosition: 'center 40%'
      }}
    >
      <Box sx={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }} className="brio-fade-in">
        <Logo height={96} />
        {badge && (
          <Typography sx={{ mt: 1.5, color: brand.goldBright, fontSize: 11, fontWeight: 700, letterSpacing: '0.24em' }}>{badge}</Typography>
        )}
      </Box>
      <Box sx={{ position: 'relative', zIndex: 1, width: '100%', display: 'flex', justifyContent: 'center' }}>
        {children}
      </Box>
      <Typography sx={{ position: 'relative', zIndex: 1, mt: 4, color: 'rgba(243,234,216,.55)', fontSize: 11, letterSpacing: '0.24em', textAlign: 'center' }}>
        PREMIUM BRANDS · CUSTOM DESIGNS · EXPERT INSTALLATION
      </Typography>
    </Box>
  );
}
