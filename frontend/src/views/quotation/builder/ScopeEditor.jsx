import { useState } from 'react';
import { Box, Checkbox, FormControlLabel, TextField, Button, Stack, IconButton, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';

/** System & interior scope: tick the standard JAZ scope lines, add project-specific ones. */
export default function ScopeEditor({ scope, onChange, defaults = [] }) {
  const [draft, setDraft] = useState('');
  const custom = scope.filter((s) => !defaults.includes(s));
  const toggle = (line) => {
    const on = scope.includes(line);
    // keep the standard order, customs after
    const next = on ? scope.filter((s) => s !== line) : [...defaults.filter((d) => d === line || scope.includes(d)), ...custom];
    onChange(next);
  };
  const add = () => {
    const t = draft.trim();
    if (t && !scope.includes(t)) onChange([...scope, t]);
    setDraft('');
  };
  return (
    <Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, columnGap: 2 }}>
        {defaults.map((line) => (
          <FormControlLabel key={line} sx={{ alignItems: 'flex-start', mr: 0, mb: 0.5, '& .MuiCheckbox-root': { pt: 0.25 } }}
            control={<Checkbox size="small" checked={scope.includes(line)} onChange={() => toggle(line)} color="secondary" />}
            label={<Typography variant="body2">{line}</Typography>} />
        ))}
      </Box>
      {custom.length > 0 && (
        <Stack spacing={0.5} sx={{ mt: 1.5 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 650 }}>Project-specific</Typography>
          {custom.map((line) => (
            <Box key={line} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" sx={{ flex: 1 }}>{line}</Typography>
              <IconButton size="small" aria-label="Remove scope line" onClick={() => onChange(scope.filter((s) => s !== line))}><CloseIcon fontSize="small" /></IconButton>
            </Box>
          ))}
        </Stack>
      )}
      <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
        <TextField size="small" fullWidth placeholder="Add a scope line, e.g. Motorised masking integration" value={draft}
          onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
        <Button startIcon={<AddIcon />} onClick={add} disabled={!draft.trim()}>Add</Button>
      </Stack>
    </Box>
  );
}
