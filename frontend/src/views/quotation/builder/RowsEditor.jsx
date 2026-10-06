import { Box, TextField, Autocomplete, IconButton, Button, Stack, Tooltip } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import RestartAltIcon from '@mui/icons-material/RestartAlt';

/** Editable "Label — Value" rows (recommended specification, design & finishes). */
export default function RowsEditor({ rows, onChange, labels = [], onReset, resetLabel = 'Reset', addLabel = 'Add row', labelTitle = 'Item' }) {
  const set = (i, patch) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <Box>
      <Stack spacing={1.25}>
        {rows.map((r, i) => (
          // eslint-disable-next-line react/no-array-index-key
          <Box key={i} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '220px 1fr auto' }, gap: 1.25, alignItems: 'start' }}>
            <Autocomplete freeSolo size="small" options={labels} inputValue={r.Label || ''}
              onInputChange={(_, v, reason) => { if (reason !== 'reset') set(i, { Label: v }); }}
              renderInput={(params) => <TextField {...params} label={labelTitle} />} />
            <TextField size="small" fullWidth multiline label="Details" value={r.Value || ''} onChange={(e) => set(i, { Value: e.target.value })} />
            <Tooltip title="Remove">
              <IconButton aria-label="Remove row" onClick={() => onChange(rows.filter((_, j) => j !== i))} sx={{ mt: 0.25 }}>
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        ))}
      </Stack>
      <Stack direction="row" spacing={1} sx={{ mt: 1.25 }}>
        <Button size="small" startIcon={<AddIcon />} onClick={() => onChange([...rows, { Label: '', Value: '' }])}>{addLabel}</Button>
        {onReset && <Button size="small" startIcon={<RestartAltIcon />} onClick={onReset}>{resetLabel}</Button>}
      </Stack>
    </Box>
  );
}
