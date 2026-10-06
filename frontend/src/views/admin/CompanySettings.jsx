import { useEffect, useState } from 'react';
import { Box, Grid, TextField, Typography, Button, Alert, Snackbar, Skeleton, CircularProgress } from '@mui/material';
import MainCard from '../../components/MainCard';
import { getCompany, saveCompany, errMsg } from '../../api/workflow';

const COMPANY = [
  ['name', 'Company name', 6], ['tagline', 'Tagline', 6], ['address', 'Office address', 12],
  ['city', 'City', 4], ['state', 'State', 4], ['phone', 'Phone', 4],
  ['email', 'E-mail', 6], ['website', 'Website', 6], ['gstin', 'GSTIN', 6], ['pan', 'PAN', 6]
];
const BANK = [
  ['accountHolderName', 'Account name', 6], ['bankName', 'Bank', 6], ['accountNumber', 'Account number', 6],
  ['ifscCode', 'IFSC', 3], ['branchName', 'Branch', 3]
];

/** Company details printed on every quotation (footer, bank page, acceptance block). */
export default function CompanySettings() {
  const [data, setData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  useEffect(() => { getCompany().then(setData).catch((e) => setError(errMsg(e, 'Could not load the company profile.'))); }, []);

  const set = (group, k, v) => setData((d) => ({ ...d, [group]: { ...d[group], [k]: v } }));
  const save = async () => {
    setSaving(true);
    setError('');
    try {
      setData(await saveCompany(data));
      setToast('Saved — new PDFs use these details');
    } catch (e) {
      setError(errMsg(e, 'Could not save.'));
    } finally {
      setSaving(false);
    }
  };

  const fields = (group, list) => (
    <Grid container spacing={2}>
      {list.map(([k, label, w]) => (
        <Grid item xs={12} sm={w} key={k}>
          <TextField fullWidth label={label} value={data[group][k] || ''} multiline={k === 'address'} minRows={k === 'address' ? 2 : undefined}
            onChange={(e) => set(group, k, e.target.value)} />
        </Grid>
      ))}
    </Grid>
  );

  return (
    <Box sx={{ maxWidth: 980 }}>
      <Typography variant="h2" sx={{ mb: 0.5 }}>Company &amp; Bank</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Printed on every quotation PDF — the page footer, the bank details page and the acceptance block. The bank page only appears once an account number is filled in.
      </Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {!data ? <Skeleton variant="rounded" height={420} /> : (
        <>
          <MainCard title="Company" sx={{ mb: 2.5 }}>{fields('company', COMPANY)}</MainCard>
          <MainCard title="Bank account" sx={{ mb: 2.5 }}>{fields('bank', BANK)}</MainCard>
          <Button variant="contained" size="large" onClick={save} disabled={saving}>
            {saving ? <CircularProgress size={22} color="inherit" /> : 'Save'}
          </Button>
        </>
      )}
      <Snackbar open={!!toast} autoHideDuration={2600} onClose={() => setToast('')} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert severity="success" onClose={() => setToast('')}>{toast}</Alert>
      </Snackbar>
    </Box>
  );
}
