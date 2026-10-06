import { useEffect, useRef, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Alert, Box, Stack, Chip, Table, TableHead,
  TableBody, TableRow, TableCell, TableContainer, CircularProgress, Divider, FormControlLabel, Switch
} from '@mui/material';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import { importProductsCsv, exportProductsCsv, errMsg } from '../../api/workflow';
import { inr } from '../../components/workflow/format';

const COLUMNS = [
  ['id', 'Optional', 'Product id from “Download current catalog”. Leave blank for new products.'],
  ['category', 'New products', 'e.g. Video, Front LCR, Cinema Seating. A new category is created if needed.'],
  ['name', 'Yes', 'Existing products are matched by id, or by name.'],
  ['specification', 'Optional', 'Shown under the item on the quotation.'],
  ['brands', 'Optional', 'Suggested brand / model class.'],
  ['unit', 'Optional', 'Nos, Lot, Set, Pair, Sq.ft, Rft or Mtr (default Nos).'],
  ['list_price', 'New products', 'Ex-GST list price in ₹. “₹ 2,85,000” is fine.'],
  ['gst_percent', 'Optional', '0–28. Blank = the category’s default GST.'],
  ['active', 'Optional', 'yes / no. “no” hides the product from new quotations.']
];

const ACTION = {
  create: ['New', 'success'], update: ['Changes', 'warning'], unchanged: ['No change', 'default'], error: ['Error', 'error']
};
const FIELD = { list_price: 'Price', gst_percent: 'GST %', category: 'Category', name: 'Name', specification: 'Specification',
  brands: 'Brands', unit: 'Unit', active: 'Active' };

const readAsDataUrl = (file) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.onerror = () => reject(new Error('Could not read the file.'));
  r.readAsDataURL(file);
});

const details = (r) => {
  if (r.Action === 'error') return r.Error;
  if (r.Action === 'create') return `${r.Category || '—'} · ${r.Price ? inr(r.Price) : ''}`;
  if (r.Action === 'unchanged') return '—';
  return Object.entries(r.Changes || {}).map(([f, [a, b]]) => (
    f === 'list_price' ? `${FIELD[f]} ${inr(a)} → ${inr(b)}` : `${FIELD[f] || f}: ${a || '—'} → ${b || '—'}`
  )).join(' · ');
};

/** Products & prices CSV: download sample / current catalog, upload, preview, apply. */
export default function CsvImportDialog({ open, onClose, onImported }) {
  const input = useRef(null);
  const results = useRef(null);
  const [file, setFile] = useState(null); // { name, data }
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [showUnchanged, setShowUnchanged] = useState(false);

  useEffect(() => { if (open) { setFile(null); setPreview(null); setError(''); setBusy(''); } }, [open]);
  // Bring the check results into view once a file has been read.
  useEffect(() => { if (preview) results.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, [preview]);

  const choose = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setError('');
    setPreview(null);
    setBusy('preview');
    try {
      const data = await readAsDataUrl(f);
      setFile({ name: f.name, data });
      setPreview(await importProductsCsv(data, false));
    } catch (err) {
      setError(errMsg(err, err.message || 'Could not read the file.'));
    } finally {
      setBusy('');
    }
  };

  const apply = async () => {
    setBusy('apply');
    setError('');
    try {
      const res = await importProductsCsv(file.data, true);
      onImported(res);
    } catch (err) {
      setError(errMsg(err, 'Import failed.'));
    } finally {
      setBusy('');
    }
  };

  const download = async () => {
    setBusy('export');
    try {
      await exportProductsCsv();
    } catch (err) {
      setError(errMsg(err, 'Could not download the catalog.'));
    } finally {
      setBusy('');
    }
  };

  const rows = (preview?.Rows || [])
    .filter((r) => showUnchanged || r.Action !== 'unchanged')
    .sort((a, b) => (a.Action === 'error' ? -1 : 0) - (b.Action === 'error' ? -1 : 0));
  const changes = preview ? preview.Created + preview.Updated : 0;

  return (
    <Dialog open={open} onClose={() => !busy && onClose()} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Import products &amp; prices (CSV)</DialogTitle>
      <DialogContent dividers>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>1. Get a file to fill in</Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 1.5 }}>
          <Button variant="outlined" startIcon={<FileDownloadOutlinedIcon />} component="a" href="/jaz-products-sample.csv"
            download="jaz-products-sample.csv">
            Download sample CSV
          </Button>
          <Button variant="outlined" startIcon={busy === 'export' ? <CircularProgress size={16} /> : <FileDownloadOutlinedIcon />}
            onClick={download} disabled={!!busy}>
            Download current catalog
          </Button>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          To change prices, download the current catalog, edit it in Excel or Google Sheets, save as CSV and upload it here.
          Only the products in your file are touched — nothing is deleted.
        </Typography>
        <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, mb: 2.5 }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ '& th': { fontWeight: 700, bgcolor: '#f8f5ee' } }}>
                <TableCell>Column</TableCell><TableCell>Required</TableCell><TableCell>Notes</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {COLUMNS.map(([c, req, note]) => (
                <TableRow key={c}>
                  <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600, whiteSpace: 'nowrap' }}>{c}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{req}</TableCell>
                  <TableCell sx={{ color: 'text.secondary' }}>{note}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <Typography variant="subtitle2" sx={{ mb: 1 }}>2. Upload and check</Typography>
        <input ref={input} type="file" accept=".csv,text/csv" hidden onChange={choose} />
        <Button variant="contained" startIcon={busy === 'preview' ? <CircularProgress size={16} color="inherit" /> : <UploadFileOutlinedIcon />}
          onClick={() => input.current?.click()} disabled={!!busy}>
          {file ? 'Choose another file' : 'Choose CSV file'}
        </Button>
        {file && <Typography variant="body2" component="span" sx={{ ml: 1.5 }}>{file.name}</Typography>}
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}

        {preview && (
          <Box ref={results} sx={{ mt: 2.5 }}>
            <Divider sx={{ mb: 2 }} />
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1, mb: 1.5 }}>
              <Chip color="success" variant="outlined" label={`${preview.Created} new`} />
              <Chip color="warning" variant="outlined" label={`${preview.Updated} with changes`} />
              <Chip variant="outlined" label={`${preview.Unchanged} unchanged`} />
              {preview.Errors > 0 && <Chip color="error" label={`${preview.Errors} with errors`} />}
            </Stack>
            {preview.NewCategories.length > 0 && (
              <Alert severity="info" sx={{ mb: 1.5 }}>New categories will be created: <b>{preview.NewCategories.join(', ')}</b></Alert>
            )}
            {preview.Errors > 0 && (
              <Alert severity="error" sx={{ mb: 1.5 }}>Fix the rows marked Error in your file and upload it again — nothing is imported until every row is valid.</Alert>
            )}
            <FormControlLabel control={<Switch size="small" checked={showUnchanged} onChange={(e) => setShowUnchanged(e.target.checked)} />}
              label={<Typography variant="body2">Show unchanged rows</Typography>} />
            <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, maxHeight: 340, mt: 1 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow sx={{ '& th': { fontWeight: 700, bgcolor: '#f8f5ee' } }}>
                    <TableCell width={56}>Row</TableCell><TableCell>Product</TableCell><TableCell width={110}>Result</TableCell><TableCell>Details</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.slice(0, 500).map((r) => {
                    const [label, color] = ACTION[r.Action];
                    return (
                      <TableRow key={r.Row}>
                        <TableCell>{r.Row}</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>{r.Name || '—'}</TableCell>
                        <TableCell><Chip size="small" color={color} variant={r.Action === 'error' ? 'filled' : 'outlined'} label={label} /></TableCell>
                        <TableCell sx={{ color: r.Action === 'error' ? 'error.main' : 'text.secondary' }}>{details(r)}</TableCell>
                      </TableRow>
                    );
                  })}
                  {rows.length === 0 && (
                    <TableRow><TableCell colSpan={4} sx={{ color: 'text.secondary', textAlign: 'center', py: 3 }}>Everything in the file already matches the catalog.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={!!busy}>Close</Button>
        <Button variant="contained" onClick={apply} disabled={!preview || preview.Errors > 0 || changes === 0 || !!busy}>
          {busy === 'apply' ? <CircularProgress size={20} color="inherit" /> : `Import ${changes || ''} change${changes === 1 ? '' : 's'}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
