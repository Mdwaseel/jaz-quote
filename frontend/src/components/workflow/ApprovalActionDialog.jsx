import { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Alert, Typography, Box,
  FormControlLabel, Checkbox, CircularProgress, InputAdornment
} from '@mui/material';
import { actOnApproval, errMsg } from '../../api/workflow';
import { inr, pct, describeValue } from './format';

// Approve (optional note, optional lower discount) or Reject (reason required).
export default function ApprovalActionDialog({ open, request, action, onClose, onDone }) {
  const [note, setNote] = useState('');
  const [modify, setModify] = useState(false);
  const [approvedPct, setApprovedPct] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) { setNote(''); setModify(false); setApprovedPct(''); setError(''); }
  }, [open]);

  if (!request) return null;
  const reject = action === 'reject';
  const isDiscount = request.Category === 'DISCOUNT';
  const requested = request.RequestedValue || {};
  const base = requested.base || request.Quotation?.Financials?.BaseAmount || 0;
  const newPct = Number(approvedPct);
  const previewFinal = modify && approvedPct !== '' ? Math.round(base * (1 - newPct / 100) * 1.18) : null;

  const submit = async () => {
    if (reject && !note.trim()) { setError('A rejection reason is required.'); return; }
    if (modify && !(approvedPct !== '' && newPct >= 0 && newPct < Number(requested.percent))) {
      setError(`Approved discount must be lower than the requested ${pct(requested.percent)}.`);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await actOnApproval({
        requestId: request.Id, action, note: note.trim(),
        ...(modify ? { approvedPercent: newPct } : {})
      });
      onDone?.(res);
    } catch (e) {
      setError(errMsg(e, 'Could not record the decision.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => !busy && onClose()} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>
        {reject ? 'Reject' : 'Approve'} {request.CategoryLabel?.toLowerCase()} request
      </DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          {request.Quotation?.QuotationNumber} · {request.Quotation?.CustomerName} · requested {describeValue(request.Category, request.RequestedValue)}
        </Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {!reject && isDiscount && (
          <Box sx={{ mb: 2 }}>
            <FormControlLabel
              control={<Checkbox checked={modify} onChange={(e) => setModify(e.target.checked)} />}
              label="Approve a lower discount instead"
            />
            {modify && (
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                <TextField
                  type="number" size="small" label="Approved discount" value={approvedPct} autoFocus
                  onChange={(e) => setApprovedPct(e.target.value)} sx={{ width: 180 }}
                  inputProps={{ min: 0, max: requested.percent, step: 0.5 }}
                  InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
                />
                {previewFinal != null && (
                  <Typography variant="body2">
                    New final amount <b>{inr(previewFinal)}</b>
                  </Typography>
                )}
              </Box>
            )}
          </Box>
        )}
        <TextField
          label={reject ? 'Rejection reason' : 'Approval note (optional)'}
          required={reject} fullWidth multiline minRows={3} value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={reject ? 'e.g. Customer confirmation required before modification.' : 'e.g. Approved based on customer negotiation.'}
          error={reject && !!error && !note.trim()}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={busy}>Cancel</Button>
        <Button variant="contained" color={reject ? 'error' : 'success'} onClick={submit} disabled={busy}>
          {busy ? <CircularProgress size={20} color="inherit" /> : reject ? 'Reject' : 'Approve'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
