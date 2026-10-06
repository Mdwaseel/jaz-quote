import { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Alert, Stepper, Step, StepLabel,
  Typography, Box, Stack, CircularProgress
} from '@mui/material';
import SignaturePad from '../../components/SignaturePad';
import CameraCapture from '../../components/CameraCapture';
import { signOnsite, errMsg } from '../../api/workflow';

const STEPS = ['Customer signs', 'Photo tips', 'Photo together'];
const TIPS = [
  'Stand next to the customer so both of your faces fit in the frame.',
  'Use the front camera and hold the phone at arm’s length, at eye level.',
  'Face a window or a light — avoid bright light behind you.',
  'Make sure both faces are clear and unobstructed (no sunglasses or masks).',
  'Take the photo at the customer’s site, holding the signed quotation if possible.'
];

/** Onsite signing on the salesperson's device: signature + a live photo together. */
export default function OnsiteSignDialog({ open, quote, onClose, onDone }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [signature, setSignature] = useState('');
  const [photo, setPhoto] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setStep(0); setName(quote?.CustomerName || ''); setSignature(''); setPhoto(''); setError('');
    }
  }, [open, quote]);

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      await signOnsite({ QuotationNumber: quote.QuotationNumber, SignerName: name.trim(), Signature: signature, Photo: photo });
      onDone?.();
    } catch (e) {
      setError(errMsg(e, 'Could not save the signature.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => !busy && onClose()} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Sign onsite — {quote?.QuotationNumber}</DialogTitle>
      <DialogContent dividers>
        <Stepper activeStep={step} alternativeLabel sx={{ mb: 3 }}>
          {STEPS.map((s) => <Step key={s}><StepLabel>{s}</StepLabel></Step>)}
        </Stepper>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {step === 0 && (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Hand the device to the customer. They confirm their name and sign with their finger.
            </Typography>
            <TextField label="Customer's full name" value={name} onChange={(e) => setName(e.target.value)} fullWidth required sx={{ mb: 2 }} />
            <SignaturePad label="Customer signature" onChange={setSignature} height={180} />
          </>
        )}

        {step === 1 && (
          <>
            <Typography variant="h4" sx={{ mb: 1.5 }}>Before you take the photo</Typography>
            <Box component="ol" sx={{ pl: 2.5, m: 0, '& li': { mb: 1 } }}>
              {TIPS.map((t) => <li key={t}><Typography variant="body2">{t}</Typography></li>)}
            </Box>
            <Alert severity="info" sx={{ mt: 2 }}>
              Tell the customer the photo is used only to verify this signature and for no other purpose.
            </Alert>
          </>
        )}

        {step === 2 && <CameraCapture value={photo} onChange={setPhoto} facing="user" />}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={() => (step ? setStep(step - 1) : onClose())} disabled={busy}>{step ? 'Back' : 'Cancel'}</Button>
        {step < 2 ? (
          <Button variant="contained" onClick={() => setStep(step + 1)} disabled={step === 0 && (!signature || !name.trim())}>
            {step === 1 ? 'Open camera' : 'Continue'}
          </Button>
        ) : (
          <Button variant="contained" color="success" onClick={submit} disabled={!photo || busy}>
            {busy ? <CircularProgress size={20} color="inherit" /> : 'Save signature'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

export { TIPS };
