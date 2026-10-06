import { Box, ButtonBase, Typography, Chip } from '@mui/material';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import { inr } from '../../../components/workflow/format';
import { brand } from '../../../theme';

/** Starting configurations. Choosing one pre-fills the spec and BOQ; everything stays editable. */
export default function PackagePicker({ packages = [], selectedId, onPick, onCustom }) {
  const card = (key, selected, onClick, children) => (
    <ButtonBase key={key} onClick={onClick} focusRipple
      sx={{
        display: 'block', textAlign: 'left', borderRadius: 2, p: 2, height: '100%',
        border: '1px solid', borderColor: selected ? brand.gold : 'divider',
        bgcolor: selected ? '#fffaf0' : 'background.paper',
        boxShadow: selected ? `inset 0 0 0 1px ${brand.gold}` : 'none',
        transition: 'border-color .2s ease, background-color .2s ease',
        '&:hover': { borderColor: selected ? brand.gold : '#cbbf9f' }
      }}>
      {children}
    </ButtonBase>
  );
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: `repeat(${Math.min(packages.length + 1, 4)}, 1fr)` }, gap: 1.5 }}>
      {packages.map((p) => {
        const selected = String(selectedId) === String(p.Id);
        return card(p.Id, selected, () => onPick(p), (
          <>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1, mb: 0.75 }}>
              <Chip size="small" label={p.Configuration || '—'} sx={{ bgcolor: brand.night, color: brand.goldBright, fontWeight: 700 }} />
              {selected && <CheckCircleRoundedIcon sx={{ color: brand.gold }} fontSize="small" />}
            </Box>
            <Typography sx={{ fontWeight: 700, fontSize: 15, lineHeight: 1.25, mb: 0.25 }}>{p.Name}</Typography>
            <Typography variant="caption" sx={{ color: 'secondary.dark', fontWeight: 650, letterSpacing: '.04em' }}>{p.Tier}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, mb: 1, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {p.Description}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 650 }}>
              {p.Items.length} items · from {inr(p.ListValue)} <Box component="span" sx={{ color: 'text.secondary', fontWeight: 500 }}>+ GST</Box>
            </Typography>
          </>
        ));
      })}
      {card('custom', selectedId === '' || selectedId == null, onCustom, (
        <>
          <Chip size="small" label="Custom" variant="outlined" sx={{ mb: 0.75 }} />
          <Typography sx={{ fontWeight: 700, fontSize: 15, lineHeight: 1.25, mb: 0.25 }}>Start from scratch</Typography>
          <Typography variant="body2" color="text.secondary">
            Build the BOQ item by item — for sound-only upgrades, add-ons or anything outside the packages.
          </Typography>
        </>
      ))}
    </Box>
  );
}
