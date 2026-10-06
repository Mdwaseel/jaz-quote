import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box, Card, Typography, Button, Stack, Alert, CircularProgress, Divider, Stepper, Step, StepLabel,
  Checkbox, FormControlLabel, TextField, Table, TableBody, TableRow, TableCell
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import Logo from '../../components/Logo';
import SignaturePad from '../../components/SignaturePad';
import CameraCapture from '../../components/CameraCapture';
import FinancialSummary from '../../components/workflow/FinancialSummary';
import { publicEsign, publicEsignPdf, publicEsignSign } from '../../api/workflow';

const STEPS = ['Review', 'Sign', 'Verify', 'Done'];

const KV = ({ rows }) => (
  <Table size="small">
    <TableBody>
      {rows.filter(([, v]) => v).map(([k, v]) => (
        <TableRow key={k}>
          <TableCell sx={{ border: 0, py: 0.5, pl: 0, color: 'text.secondary', width: '42%' }}>{k}</TableCell>
          <TableCell sx={{ border: 0, py: 0.5, fontWeight: 500, overflowWrap: 'anywhere' }}>{v}</TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
);

/** Customer-facing e-signature page, opened from the emailed link (no login). */
export default function PublicSign() {
  const { token } = useParams();
  const [q, setQ] = useState(null);
  const [fatal, setFatal] = useState('');
  const [step, setStep] = useState(0);
  const [pdf, setPdf] = useState({ loading: false, error: '' });
  const [signature, setSignature] = useState('');
  const [name, setName] = useState('');
  const [consent, setConsent] = useState(false);
  const [photo, setPhoto] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    publicEsign(token).then((d) => { setQ(d); setName(d.CustomerName || ''); }).catch((e) => setFatal(e.message));
  }, [token]);

  const openPdf = async () => {
    // Open the tab during the click (pop-up blockers allow that), fill it when ready.
    const tab = window.open('', '_blank');
    setPdf({ loading: true, error: '' });
    try {
      const url = await publicEsignPdf(token);
      if (tab) tab.location.href = url;
      else {
        const a = document.createElement('a');
        a.href = url;
        a.download = `${q.QuotationNumber}.pdf`;
        a.click();
      }
      setPdf({ loading: false, error: '' });
    } catch (e) {
      tab?.close();
      setPdf({ loading: false, error: e.message });
    }
  };

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      await publicEsignSign(token, { Signature: signature, Photo: photo, Consent: consent, SignerName: name.trim() });
      setStep(3);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const shell = (children) => (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <Box sx={{ bgcolor: '#14110d', borderBottom: '1px solid rgba(212,171,85,.25)', px: 2, py: 1.5 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ maxWidth: 760, mx: 'auto' }}>
          <Logo height={48} />
          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ color: '#cfc5b3' }}>
            <LockOutlinedIcon sx={{ fontSize: 16 }} />
            <Typography variant="caption">Secure signing link</Typography>
          </Stack>
        </Stack>
      </Box>
      <Box sx={{ maxWidth: 760, mx: 'auto', py: { xs: 2, md: 4 }, px: 2 }}>
        {children}
      </Box>
    </Box>
  );

  if (fatal) return shell(<Card sx={{ p: 4, textAlign: 'center' }}><Typography variant="h3" sx={{ mb: 1 }}>Link unavailable</Typography><Typography color="text.secondary">{fatal}</Typography></Card>);
  if (!q) return shell(<Box sx={{ py: 10, textAlign: 'center' }}><CircularProgress /></Box>);
  const p = q.Project || {};
  const items = q.Items || [];

  return shell(
    <Card sx={{ p: { xs: 2.5, md: 4 } }}>
      <Typography variant="overline" sx={{ color: 'secondary.main', fontWeight: 700, letterSpacing: 1.5 }}>Quotation {q.QuotationNumber}</Typography>
      <Typography variant="h2" sx={{ mb: 0.5 }}>Hello {q.CustomerName}</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>Please review your quotation, then sign it below. It takes about two minutes.</Typography>
      <Stepper activeStep={step} alternativeLabel sx={{ mb: 3.5 }}>
        {STEPS.map((s) => <Step key={s}><StepLabel>{s}</StepLabel></Step>)}
      </Stepper>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {step === 0 && (
        <>
          <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'background.default', border: '1px solid', borderColor: 'divider', mb: 2.5 }}>
            <FinancialSummary f={q.Financials} />
          </Box>
          <Typography variant="h4" sx={{ mb: 1 }}>Your cinema</Typography>
          <KV rows={[
            ['Package', p.Package], ['Configuration', p.Configuration], ['Room', p.Room],
            ['Room size', [p.RoomLength, p.RoomWidth, p.RoomHeight].filter(Boolean).join(' × ') && `${[p.RoomLength, p.RoomWidth, p.RoomHeight].filter(Boolean).join(' × ')} ft`],
            ['Seating', p.Seats && `${p.Seats} seats`]
          ]} />
          {items.length > 0 && (
            <>
              <Typography variant="subtitle2" sx={{ mt: 2, mb: 0.5 }}>What's included</Typography>
              <KV rows={items.map((i) => [i.Category, `${i.Name}${Number(i.Qty) !== 1 ? ` × ${i.Qty} ${i.Unit || ''}` : ''}`])} />
            </>
          )}
          <Divider sx={{ my: 2 }} />
          <Typography variant="h4" sx={{ mb: 1 }}>Payment terms</Typography>
          <KV rows={(q.PaymentTerms || []).map((t) => [t.TermName, `${t.TermValue}%`])} />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 3 }}>
            <Button variant="outlined" startIcon={<PictureAsPdfOutlinedIcon />} onClick={openPdf} disabled={pdf.loading}>
              {pdf.loading ? 'Preparing PDF…' : 'Open full quotation (PDF)'}
            </Button>
            <Button variant="contained" size="large" onClick={() => setStep(1)}>Sign quotation</Button>
          </Stack>
          {pdf.error && <Alert severity="error" sx={{ mt: 1.5 }}>{pdf.error}</Alert>}
        </>
      )}

      {step === 1 && (
        <>
          <TextField label="Your full name" value={name} onChange={(e) => setName(e.target.value)} fullWidth sx={{ mb: 2 }} required />
          <SignaturePad label="Draw your signature" onChange={setSignature} height={180} />
          <Stack direction="row" justifyContent="space-between" sx={{ mt: 3 }}>
            <Button onClick={() => setStep(0)}>Back</Button>
            <Button variant="contained" disabled={!signature || !name.trim()} onClick={() => setStep(2)}>Continue</Button>
          </Stack>
        </>
      )}

      {step === 2 && (
        <>
          <Alert severity="info" icon={<LockOutlinedIcon />} sx={{ mb: 2 }}>
            <b>About your photo.</b> To confirm it really is you signing, we take one live photo now. It is used <b>solely to verify
            this signature</b> and will not be used for any other purpose.
          </Alert>
          <FormControlLabel sx={{ mb: 2, alignItems: 'flex-start' }}
            control={<Checkbox checked={consent} onChange={(e) => setConsent(e.target.checked)} sx={{ pt: 0.25 }} />}
            label={<Typography variant="body2">{q.Consent}</Typography>} />
          {consent && <CameraCapture value={photo} onChange={setPhoto} facing="user" />}
          <Stack direction="row" justifyContent="space-between" sx={{ mt: 3 }}>
            <Button onClick={() => setStep(1)} disabled={busy}>Back</Button>
            <Button variant="contained" color="success" size="large" disabled={!consent || !photo || busy} onClick={submit}>
              {busy ? <CircularProgress size={22} color="inherit" /> : 'Sign quotation'}
            </Button>
          </Stack>
        </>
      )}

      {step === 3 && (
        <Box sx={{ textAlign: 'center', py: 3 }}>
          <CheckCircleOutlineIcon sx={{ fontSize: 64, color: 'success.main' }} />
          <Typography variant="h2" sx={{ mt: 1 }}>Thank you, {name.split(' ')[0]}</Typography>
          <Typography color="text.secondary" sx={{ mt: 1, maxWidth: 460, mx: 'auto' }}>
            Your quotation {q.QuotationNumber} is signed. Your JAZ representative has been notified and will be in touch.
            You can close this page.
          </Typography>
        </Box>
      )}
    </Card>
  );
}
