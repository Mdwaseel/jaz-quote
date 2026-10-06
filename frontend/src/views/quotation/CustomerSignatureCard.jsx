import { useState } from 'react';
import {
  Box, Button, Stack, Typography, Alert, Chip, Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  CircularProgress, Grid
} from '@mui/material';
import MarkEmailReadOutlinedIcon from '@mui/icons-material/MarkEmailReadOutlined';
import DrawOutlinedIcon from '@mui/icons-material/DrawOutlined';
import MainCard from '../../components/MainCard';
import OnsiteSignDialog from './OnsiteSignDialog';
import { sendEsign, errMsg } from '../../api/workflow';
import { fmtDate } from '../../components/workflow/format';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ImageBox = ({ src, alt, height = 96, onClick }) => (
  <Box onClick={onClick} sx={{
    height, border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: '#fafbfc', display: 'grid',
    placeItems: 'center', p: 0.75, cursor: onClick ? 'zoom-in' : 'default'
  }}>
    {src ? <Box component="img" src={src} alt={alt} sx={{ maxWidth: '100%', maxHeight: height - 12, objectFit: 'contain' }} />
      : <Typography variant="caption" color="text.secondary">Not signed yet</Typography>}
  </Box>
);

/** Customer signature: e-signature (email link) or onsite (this device + live photo). */
export default function CustomerSignatureCard({ quote, onChanged, toast }) {
  const sig = quote.Signatures || {};
  const cur = sig.Current;
  const tech = quote.SalesInfo?.SignatorySign;
  const [send, setSend] = useState({ open: false, email: '', confirm: false, busy: false, error: '' });
  const [onsite, setOnsite] = useState(false);
  const [zoom, setZoom] = useState('');

  const doSend = async () => {
    setSend((x) => ({ ...x, busy: true, error: '' }));
    try {
      const r = await sendEsign(quote.QuotationNumber, send.email.trim());
      setSend({ open: false, email: '', confirm: false, busy: false, error: '' });
      toast(r.Message);
      onChanged();
    } catch (e) {
      setSend((x) => ({ ...x, busy: false, confirm: false, error: errMsg(e, 'Could not send the signing link.') }));
    }
  };

  const emailOk = EMAIL_RE.test(send.email.trim());

  return (
    <MainCard title="Customer signature" sx={{ mb: 2.5 }}>
      {cur ? (
        <>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5, flexWrap: 'wrap', rowGap: 1 }}>
            <Chip size="small" color="success" label={`Signed · ${cur.MethodLabel}`} />
            <Typography variant="body2" color="text.secondary">
              {cur.SignerName} · {fmtDate(cur.SignedAt)}{cur.Email ? ` · ${cur.Email}` : ''} · v{cur.Version}
            </Typography>
          </Stack>
          <Grid container spacing={1.5}>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>Signature</Typography>
              <ImageBox src={cur.Signature} alt="Customer signature" />
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                {cur.Method === 'ESIGN' ? 'Verification selfie' : 'Photo with customer'}
              </Typography>
              <ImageBox src={cur.Photo} alt="Verification photo" onClick={() => setZoom(cur.Photo)} />
            </Grid>
          </Grid>
          <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 1 }}>
            The photo is kept only to verify this signature.
          </Typography>
        </>
      ) : (
        <>
          {sig.Outdated && (
            <Alert severity="warning" sx={{ mb: 1.5 }}>
              The customer signed version {sig.Outdated.Version}. The quotation has changed since, so it needs a new signature.
            </Alert>
          )}
          {sig.Pending && (
            <Alert severity="info" icon={<MarkEmailReadOutlinedIcon />} sx={{ mb: 1.5 }}>
              E-signature link sent to <b>{sig.Pending.Email}</b> on {fmtDate(sig.Pending.SentAt)}
              {sig.Pending.ViewedAt ? ` · opened ${fmtDate(sig.Pending.ViewedAt)}` : ' · not opened yet'}.
              It expires {fmtDate(sig.Pending.ExpiresAt)}.
            </Alert>
          )}
          {!sig.CanSign ? (
            <Typography variant="body2" color="text.secondary">{sig.BlockedReason}</Typography>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              Choose how the customer will sign this quotation.
            </Typography>
          )}
        </>
      )}

      {sig.CanSign && (
        <Stack spacing={1} alignItems="flex-start" sx={{ mt: 2 }}>
          <Button variant={cur ? 'text' : 'contained'} startIcon={<MarkEmailReadOutlinedIcon />}
            onClick={() => setSend({ open: true, email: sig.Pending?.Email || sig.CustomerEmail || '', confirm: false, busy: false, error: '' })}>
            {sig.Pending ? 'Resend e-signature link' : cur ? 'Re-send for e-signature' : 'Send for e-signature'}
          </Button>
          <Button variant={cur ? 'text' : 'outlined'} startIcon={<DrawOutlinedIcon />} onClick={() => setOnsite(true)}>
            {cur ? 'Sign onsite again' : 'Sign onsite now'}
          </Button>
        </Stack>
      )}

      <Box sx={{ mt: 2.5 }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>Authorised signatory (JAZ)</Typography>
        <ImageBox src={tech} alt="Authorised signatory signature" height={72} />
      </Box>

      {/* E-signature: confirm the address before sending */}
      <Dialog open={send.open} onClose={() => !send.busy && setSend((x) => ({ ...x, open: false }))} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>{send.confirm ? 'Confirm the email address' : 'Send for e-signature'}</DialogTitle>
        <DialogContent dividers>
          {send.error && <Alert severity="error" sx={{ mb: 2 }}>{send.error}</Alert>}
          {!send.confirm ? (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                The customer gets a secure link to review the quotation, sign it and take a verification selfie.
                You can send it to a different address if the customer prefers.
              </Typography>
              <TextField label="Customer's email" type="email" value={send.email} autoFocus fullWidth
                onChange={(e) => setSend((x) => ({ ...x, email: e.target.value }))}
                error={!!send.email && !emailOk} helperText={send.email && !emailOk ? 'Enter a valid email address' : ' '} />
            </>
          ) : (
            <Typography>
              Send quotation <b>{quote.QuotationNumber}</b> for signature to:
              <Box component="span" sx={{ display: 'block', mt: 1, fontSize: '1.15rem', fontWeight: 700, overflowWrap: 'anywhere' }}>{send.email.trim()}</Box>
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => (send.confirm ? setSend((x) => ({ ...x, confirm: false })) : setSend((x) => ({ ...x, open: false })))} disabled={send.busy}>
            {send.confirm ? 'Change email' : 'Cancel'}
          </Button>
          {!send.confirm ? (
            <Button variant="contained" disabled={!emailOk} onClick={() => setSend((x) => ({ ...x, confirm: true }))}>Continue</Button>
          ) : (
            <Button variant="contained" onClick={doSend} disabled={send.busy}>
              {send.busy ? <CircularProgress size={20} color="inherit" /> : 'Confirm & send'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <OnsiteSignDialog open={onsite} quote={quote} onClose={() => setOnsite(false)}
        onDone={() => { setOnsite(false); toast('Customer signature saved'); onChanged(); }} />

      <Dialog open={!!zoom} onClose={() => setZoom('')} maxWidth="md">
        <Box component="img" src={zoom} alt="Verification photo" sx={{ display: 'block', maxWidth: '100%', maxHeight: '80vh' }} onClick={() => setZoom('')} />
      </Dialog>
    </MainCard>
  );
}
