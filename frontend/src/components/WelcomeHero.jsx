import { Box, Typography, Button, Stack } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import AddIcon from '@mui/icons-material/Add';
import FormatListBulletedOutlinedIcon from '@mui/icons-material/FormatListBulletedOutlined';
import { brand, serif } from '../theme';

const partOfDay = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

// Rotating line, in the JAZ voice.
const lines = [
  "Let's design a cinema today.",
  'Room first. Equipment second. Calibration last.',
  'Every quotation is a private cinema in the making.',
  'Installation makes it work. Calibration makes it cinema.'
];

export default function WelcomeHero({ name, role, count }) {
  const navigate = useNavigate();
  const first = (name || 'there').split(' ')[0];
  const line = lines[new Date().getDate() % lines.length];

  return (
    <Box
      className="brio-fade-up"
      sx={{
        position: 'relative', overflow: 'hidden', borderRadius: 2.5, p: { xs: 3, md: 4.5 }, mb: 3, color: brand.ivory,
        bgcolor: brand.night,
        backgroundImage: {
          xs: `linear-gradient(90deg, rgba(20,17,13,.96), rgba(20,17,13,.86)), url(/jaz-cinema.jpg)`,
          md: `linear-gradient(90deg, ${brand.night} 0%, rgba(20,17,13,.94) 42%, rgba(20,17,13,.45) 100%), url(/jaz-cinema.jpg)`
        },
        backgroundSize: 'cover', backgroundPosition: 'center 45%',
        boxShadow: '0 24px 50px -30px rgba(20,17,13,.9)'
      }}
    >
      <Box sx={{ position: 'relative', maxWidth: 640 }}>
        <Typography sx={{ color: brand.goldBright, fontSize: 11, fontWeight: 700, letterSpacing: '0.22em', mb: 1.25 }}>
          {partOfDay().toUpperCase()}, {first.toUpperCase()}
        </Typography>
        <Typography sx={{ fontFamily: serif, fontWeight: 600, fontSize: { xs: '2rem', md: '2.6rem' }, lineHeight: 1.08, color: '#fff', mb: 1.25 }}>
          {line}
        </Typography>
        <Box sx={{ width: 56, height: '1px', bgcolor: brand.goldBright, mb: 1.5 }} />
        <Typography sx={{ color: 'rgba(243,234,216,.78)', maxWidth: 520 }}>
          {role ? `Signed in as ${role}. ` : ''}
          {typeof count === 'number' ? `You have ${count} quotation${count === 1 ? '' : 's'} in your pipeline.` : 'Build a new quotation to get started.'}
        </Typography>

        <Stack direction="row" spacing={1.5} sx={{ mt: 3, flexWrap: 'wrap', rowGap: 1 }}>
          <Button variant="contained" color="secondary" startIcon={<AddIcon />} onClick={() => navigate('/quotation/create')}>
            Create Quote
          </Button>
          <Button
            variant="outlined" startIcon={<FormatListBulletedOutlinedIcon />}
            onClick={() => navigate('/quotation/list')}
            sx={{ color: brand.ivory, borderColor: 'rgba(243,234,216,.35)', '&:hover': { borderColor: brand.ivory, bgcolor: 'rgba(243,234,216,.06)' } }}
          >
            View Quotations
          </Button>
        </Stack>
      </Box>
    </Box>
  );
}
