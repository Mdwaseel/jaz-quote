import { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Typography, Alert, RadioGroup, Radio,
  FormControlLabel, CircularProgress
} from '@mui/material';
import { cancelQuote, restoreQuote, errMsg } from '../../api/workflow';

/** Cancel a quotation with a reason. The quotation is kept (status "Cancelled"), never deleted. */
export function CancelQuoteDialog({ open, number, reasons = [], onClose, onDone }) {
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { if (open) { setReason(''); setNote(''); setError(''); } }, [open]);

  const needsNote = reason === 'Other';
  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      await cancelQuote(number, reason, note.trim());
      onDone();
    } catch (e) {
      setError(errMsg(e, 'Could not cancel the quotation.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => !busy && onClose()} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Cancel quotation {number}</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          The quotation is <b>not deleted</b>. It moves to <b>Cancelled</b> with its history, versions and PDF, and a
          manager or Admin can restore it later. Pending approvals and open e-signature links are closed.
        </Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Why is it being cancelled?</Typography>
        <RadioGroup value={reason} onChange={(e) => setReason(e.target.value)}>
          {reasons.map((r) => <FormControlLabel key={r} value={r} control={<Radio size="small" color="secondary" />} label={r} />)}
        </RadioGroup>
        <TextField fullWidth multiline minRows={2} sx={{ mt: 1.5 }} value={note} onChange={(e) => setNote(e.target.value)}
          required={needsNote} error={needsNote && !note.trim()}
          label={needsNote ? 'Describe the reason' : 'Note (optional)'}
          placeholder="e.g. Customer postponed the basement work to next year." />
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={busy}>Keep quotation</Button>
        <Button variant="contained" color="error" onClick={submit} disabled={busy || !reason || (needsNote && !note.trim())}>
          {busy ? <CircularProgress size={20} color="inherit" /> : 'Cancel quotation'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/** Restore a cancelled quotation (managers / Admin). */
export function RestoreQuoteDialog({ open, number, onClose, onDone }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { if (open) { setNote(''); setError(''); } }, [open]);

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await restoreQuote(number, note.trim());
      onDone(res);
    } catch (e) {
      setError(errMsg(e, 'Could not restore the quotation.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => !busy && onClose()} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Restore quotation {number}</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          A quotation that was fully approved comes back exactly as it was. Anything else comes back <b>editable</b> and has
          to be re-submitted, so its approvals are checked again.
        </Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <TextField fullWidth multiline minRows={2} label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Customer is going ahead after all." />
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={busy}>Close</Button>
        <Button variant="contained" onClick={submit} disabled={busy}>
          {busy ? <CircularProgress size={20} color="inherit" /> : 'Restore quotation'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
