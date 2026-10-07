import { useMemo, useState } from 'react';
import {
  Box, ButtonBase, Button, Typography, Chip, Stack, Collapse, Alert, Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableHead, TableBody, TableRow, TableCell, Link
} from '@mui/material';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import { inr } from '../../../components/workflow/format';
import { brand } from '../../../theme';
import { configDistance } from './roomGuide';

const SERIES_TONE = {
  CinePrime: { bgcolor: brand.goldLight, color: brand.goldDark },
  CineLuxe: { bgcolor: brand.gold, color: '#fff' },
  CineRoyale: { bgcolor: brand.night, color: brand.goldBright }
};
const versionLabel = (pkg) => pkg.Name.split(' · ').slice(1).join(' · ') || pkg.Name;

export const SeriesChip = ({ series, size = 'small' }) => (
  <Chip size={size} label={series || 'Version'} sx={{ fontWeight: 700, letterSpacing: '.04em', ...(SERIES_TONE[series] || {}) }} />
);

/** The recommended configuration for the room, with the guide's reasoning. */
function Recommendation({ rec, guide, current, onUse, onGuide }) {
  if (!rec) {
    return (
      <Alert severity="info" icon={<AutoAwesomeOutlinedIcon />} sx={{ mb: 2.5 }}
        action={<Button size="small" onClick={onGuide}>Room guide</Button>}>
        Enter the room&apos;s length and width — the configuration is recommended automatically.
      </Alert>
    );
  }
  const info = guide.find((c) => c.Code === rec.pick);
  const others = rec.row.Options.filter((o) => o !== rec.pick);
  return (
    <Box sx={{ mb: 2.5 }}>
      <Box sx={{
        display: 'flex', gap: 2.5, alignItems: 'center', flexWrap: 'wrap', p: 2.25, borderRadius: 2,
        bgcolor: brand.night, color: brand.ivory, border: '1px solid rgba(212,171,85,.35)'
      }}>
        <Typography sx={{ fontFamily: 'serif', fontSize: '2.6rem', lineHeight: 1, color: brand.goldBright, fontWeight: 600 }}>{rec.pick}</Typography>
        <Box sx={{ flex: 1, minWidth: 220 }}>
          <Typography sx={{ fontSize: 10.5, letterSpacing: '.18em', textTransform: 'uppercase', color: '#a99f8d' }}>Recommended for this room</Typography>
          <Typography sx={{ fontWeight: 700, fontSize: 16 }}>JAZ {rec.pick} {info?.Name}</Typography>
          <Typography variant="body2" sx={{ color: '#cfc5b2' }}>{info?.Meaning}</Typography>
          {rec.reasons.map((r) => <Typography key={r} variant="caption" component="div" sx={{ color: '#a99f8d' }}>{r}</Typography>)}
        </Box>
        <Stack spacing={1} alignItems={{ xs: 'flex-start', sm: 'flex-end' }}>
          <Stack direction="row" spacing={0.75}>
            <Chip size="small" label={`${rec.row.Seats} seats`} sx={{ bgcolor: 'rgba(243,234,216,.1)', color: brand.ivory }} />
            <Chip size="small" label={rec.row.Rating} sx={{ bgcolor: 'rgba(212,171,85,.18)', color: brand.goldBright, fontWeight: 700 }} />
          </Stack>
          {others.length > 0 && <Typography variant="caption" sx={{ color: '#cfc5b2' }}>Also suits {others.join(' / ')}</Typography>}
          {current !== rec.pick && (
            <Button size="small" variant="outlined" onClick={onUse} sx={{ color: brand.goldBright, borderColor: 'rgba(212,171,85,.6)' }}>
              Use {rec.pick}
            </Button>
          )}
          <Link component="button" type="button" variant="caption" onClick={onGuide} sx={{ color: '#cfc5b2' }}>Room guide</Link>
        </Stack>
      </Box>
      {rec.notes.map((n) => <Alert key={n} severity="warning" sx={{ mt: 1, py: 0 }}>{n}</Alert>)}
    </Box>
  );
}

function VersionCard({ pkg, selected, onPick }) {
  const [open, setOpen] = useState(false);
  return (
    <Box sx={{
      display: 'flex', flexDirection: 'column', borderRadius: 2, p: 2, border: '1px solid',
      borderColor: selected ? brand.gold : 'divider', bgcolor: selected ? '#fffaf0' : 'background.paper',
      boxShadow: selected ? `inset 0 0 0 1px ${brand.gold}` : 'none'
    }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, mb: 1 }}>
        <Stack direction="row" spacing={0.75}>
          <SeriesChip series={pkg.Tier} />
          <Chip size="small" variant="outlined" label={pkg.Configuration} sx={{ fontWeight: 650 }} />
        </Stack>
        {selected && <CheckCircleRoundedIcon sx={{ color: brand.gold }} fontSize="small" />}
      </Box>
      <Typography sx={{ fontWeight: 700, fontSize: 15.5, lineHeight: 1.25 }}>{versionLabel(pkg)}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 1.5 }}>{pkg.Description}</Typography>
      <Box sx={{ mt: 'auto' }}>
        <Typography sx={{ fontWeight: 750, fontSize: '1.3rem', fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>
          {inr(pkg.ListValue)} <Box component="span" sx={{ fontSize: 12, fontWeight: 500, color: 'text.secondary' }}>+ GST</Box>
        </Typography>
        <Typography variant="caption" color="text.secondary" component="div" sx={{ fontVariantNumeric: 'tabular-nums' }}>
          {inr(pkg.Total)} incl. GST · {pkg.Items.length} items · installation included
        </Typography>
        <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
          <Button size="small" variant={selected ? 'outlined' : 'contained'} color={selected ? 'secondary' : 'primary'} onClick={() => onPick(pkg)}>
            {selected ? 'Chosen — reload items' : 'Choose this version'}
          </Button>
          <Button size="small" onClick={() => setOpen((o) => !o)}>{open ? 'Hide items' : 'View items'}</Button>
        </Stack>
      </Box>
      <Collapse in={open} unmountOnExit>
        <Table size="small" sx={{ mt: 1.5, '& td': { px: 0.5, py: 0.5, fontSize: 12.5 } }}>
          <TableBody>
            {pkg.Items.map((i) => (
              <TableRow key={`${i.ProductId}-${i.Name}`}>
                <TableCell>{i.Brand && !i.Name.includes(i.Brand) && i.Brand !== 'Custom' ? `${i.Brand} ` : ''}{i.Name}</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap', color: 'text.secondary' }}>{i.Qty} {i.Unit}</TableCell>
                <TableCell align="right" sx={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{inr(i.Qty * i.Price)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Collapse>
    </Box>
  );
}

/**
 * Room → configuration → version. The room guide recommends a configuration (changeable);
 * the handbook versions of that configuration are shown with their prices, and choosing
 * one fills the BOQ.
 */
export default function SystemPicker({
  catalog, configuration, rec, selected, onConfig, onPick, onCustom, acoustics
}) {
  const [showAll, setShowAll] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const guide = catalog.ConfigGuide || [];
  const packages = useMemo(() => [...(catalog.Packages || [])].sort((a, b) => a.ListValue - b.ListValue), [catalog]);
  const counts = useMemo(() => packages.reduce((m, p) => ({ ...m, [p.Configuration]: (m[p.Configuration] || 0) + 1 }), {}), [packages]);
  const info = guide.find((c) => c.Code === configuration);

  const exact = packages.filter((p) => p.Configuration === configuration);
  const priced = Object.keys(counts);
  const nearest = !exact.length && configuration && priced.length
    ? Math.min(...priced.map((c) => configDistance(c, configuration))) : null;
  const closest = nearest == null ? [] : packages.filter((p) => configDistance(p.Configuration, configuration) === nearest);
  const closestCodes = [...new Set(closest.map((p) => p.Configuration))];
  const shown = showAll ? packages : exact.length ? exact : closest;

  return (
    <Box>
      <Recommendation rec={rec} guide={guide} current={configuration} onUse={() => onConfig(rec.pick, true)} onGuide={() => setGuideOpen(true)} />

      <Typography variant="subtitle2" sx={{ mb: 1 }}>Configuration</Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)', lg: 'repeat(8, 1fr)' }, gap: 1 }}>
        {guide.map((c) => {
          const on = c.Code === configuration;
          const recommended = rec?.pick === c.Code;
          const suits = rec && !recommended && rec.row.Options.includes(c.Code);
          return (
            <ButtonBase key={c.Code} focusRipple onClick={() => onConfig(c.Code, recommended)} aria-pressed={on}
              sx={{
                display: 'block', textAlign: 'left', borderRadius: 1.5, px: 1.25, py: 1, border: '1px solid',
                borderColor: on ? brand.gold : recommended ? 'rgba(168,129,61,.55)' : 'divider',
                bgcolor: on ? brand.night : 'background.paper', color: on ? brand.ivory : 'text.primary',
                transition: 'background-color .15s ease, border-color .15s ease',
                '&:hover': { borderColor: brand.gold }
              }}>
              <Typography sx={{ fontWeight: 750, fontSize: 17, color: on ? brand.goldBright : 'text.primary', lineHeight: 1.2 }}>{c.Code}</Typography>
              <Typography sx={{ fontSize: 11, lineHeight: 1.25, minHeight: 28, color: on ? '#cfc5b2' : 'text.secondary' }}>{c.Name}</Typography>
              <Typography sx={{ fontSize: 10.5, fontWeight: 650, mt: 0.5, color: recommended ? (on ? brand.goldBright : brand.goldDark) : on ? '#a99f8d' : 'text.secondary' }}>
                {recommended ? '★ Recommended' : suits ? 'Also suits' : counts[c.Code] ? `${counts[c.Code]} version${counts[c.Code] === 1 ? '' : 's'}` : 'No prices yet'}
              </Typography>
            </ButtonBase>
          );
        })}
      </Box>
      {info && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          <b>{info.Code}</b> — {info.Meaning}. Recommended room: {info.Room}.
        </Typography>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 1, flexWrap: 'wrap', mt: 3.5, mb: 1.5 }}>
        <Box>
          <Typography variant="h4" sx={{ fontSize: '1.1rem' }}>
            {showAll ? 'All versions' : exact.length ? `Versions for ${configuration}` : 'Versions'}
          </Typography>
          <Typography variant="body2" color="text.secondary">Handbook prices, ex-GST, installation &amp; calibration included. Choosing one fills the BOQ — everything stays editable.</Typography>
        </Box>
        {packages.length > 0 && (
          <Button size="small" onClick={() => setShowAll((v) => !v)}>{showAll ? `Only ${configuration || 'this configuration'}` : `Compare all ${packages.length} versions`}</Button>
        )}
      </Box>

      {selected && selected.Configuration !== configuration && (
        <Alert severity="warning" sx={{ mb: 1.5 }}>
          The BOQ holds <b>{selected.Name}</b> ({selected.Configuration}). Choose a {configuration} version to replace it, or keep it and adjust the BOQ.
        </Alert>
      )}
      {!showAll && configuration && !exact.length && (
        <Alert severity="info" sx={{ mb: 1.5 }}>
          No handbook prices for <b>{configuration}</b> yet.
          {closest.length > 0 && <> Closest priced: <b>{closestCodes.join(' / ')}</b> — choose one and add the extra speakers in the BOQ, </>}
          {closest.length > 0 ? 'or start from scratch.' : ' Start from scratch.'} An admin can add {configuration} versions in Prices &amp; Catalog.
        </Alert>
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr', xl: 'repeat(3, 1fr)' }, gap: 1.5, alignItems: 'start' }}>
        {shown.map((p) => <VersionCard key={p.Id} pkg={p} selected={selected?.Id === p.Id} onPick={onPick} />)}
        <ButtonBase focusRipple onClick={onCustom} sx={{
          display: 'block', textAlign: 'left', borderRadius: 2, p: 2, border: '1px dashed',
          borderColor: !selected ? brand.gold : 'divider', '&:hover': { borderColor: brand.gold }
        }}>
          <Chip size="small" label="Custom" variant="outlined" sx={{ mb: 1 }} />
          <Typography sx={{ fontWeight: 700, fontSize: 15.5 }}>Start from scratch</Typography>
          <Typography variant="body2" color="text.secondary">Build the BOQ item by item — for configurations without handbook prices, upgrades or add-ons.</Typography>
        </ButtonBase>
      </Box>

      {acoustics && (
        <Alert severity="info" sx={{ mt: 2.5 }}
          action={acoustics.present ? <Chip size="small" color="success" variant="outlined" label="In the BOQ" /> : <Button size="small" onClick={acoustics.onAdd} sx={{ whiteSpace: 'nowrap' }}>Add to BOQ</Button>}>
          <b>Acoustics &amp; recliners</b> — {acoustics.note}
        </Alert>
      )}

      <Dialog open={guideOpen} onClose={() => setGuideOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>JAZ room guide</DialogTitle>
        <DialogContent dividers>
          <Table size="small" sx={{ mb: 2.5 }}>
            <TableHead>
              <TableRow sx={{ '& th': { fontWeight: 700, bgcolor: '#f8f5ee' } }}>
                <TableCell>Room (ft)</TableCell><TableCell align="right">Area</TableCell><TableCell>Configuration</TableCell><TableCell>Seats</TableCell><TableCell>Rating</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(catalog.RoomGuide || []).map((r) => (
                <TableRow key={`${r.Length}x${r.Width}`} selected={rec?.row === r}>
                  <TableCell>{r.Length} × {r.Width}</TableCell>
                  <TableCell align="right">{r.Length * r.Width} sq.ft</TableCell>
                  <TableCell>{r.Options.join(' / ')}</TableCell>
                  <TableCell>{r.Seats}</TableCell>
                  <TableCell>{r.Rating}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Table size="small" sx={{ mb: 2 }}>
            <TableHead>
              <TableRow sx={{ '& th': { fontWeight: 700, bgcolor: '#f8f5ee' } }}>
                <TableCell>Configuration</TableCell><TableCell>Meaning</TableCell><TableCell>Recommended room</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {guide.map((c) => (
                <TableRow key={c.Code}>
                  <TableCell sx={{ fontWeight: 700 }}>{c.Code} <Typography component="span" variant="caption" color="text.secondary">{c.Name}</Typography></TableCell>
                  <TableCell>{c.Meaning}</TableCell>
                  <TableCell>{c.Room}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {(catalog.RoomTips || []).map((t) => <Typography key={t} variant="body2" sx={{ mb: 0.5 }}>• {t}</Typography>)}
        </DialogContent>
        <DialogActions><Button onClick={() => setGuideOpen(false)}>Close</Button></DialogActions>
      </Dialog>
    </Box>
  );
}
