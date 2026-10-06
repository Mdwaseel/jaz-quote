import { useState } from 'react';
import {
  Box, Button, Stack, Typography, Alert, Chip, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
  CircularProgress
} from '@mui/material';
import ThumbUpAltOutlinedIcon from '@mui/icons-material/ThumbUpAltOutlined';
import ThumbDownAltOutlinedIcon from '@mui/icons-material/ThumbDownAltOutlined';
import MainCard from '../../components/MainCard';
import { setDealOutcome, errMsg } from '../../api/workflow';
import { fmtDate } from '../../components/workflow/format';

const LABEL = { OPEN: ['Open', 'default'], WON: ['Deal done', 'success'], LOST: ['Deal not done', 'error'] };

/** Deal done / not done (with a reason) — feeds the Director's deal analysis. */
export default function DealOutcomeCard({ quote, canWin, onChanged, toast }) {
  const deal = quote.Deal || { Status: 'OPEN' };
  const [dlg, setDlg] = useState({ open: false, outcome: 'WON', reason: '', note: '', busy: false, error: '' });
  const [label, color] = LABEL[deal.Status] || LABEL.OPEN;

  const save = async (outcome, reason = '', note = '') => {
    setDlg((d) => ({ ...d, busy: true, error: '' }));
    try {
      await setDealOutcome({ QuotationNumber: quote.QuotationNumber, Outcome: outcome, Reason: reason, Note: note });
      setDlg((d) => ({ ...d, open: false, busy: false }));
      toast(outcome === 'WON' ? 'Marked as deal done' : outcome === 'LOST' ? 'Marked as deal not done' : 'Deal reopened');
      onChanged();
    } catch (e) {
      setDlg((d) => ({ ...d, busy: false, error: errMsg(e, 'Could not save.') }));
    }
  };

  const open = (outcome) => setDlg({ open: true, outcome, reason: '', note: '', busy: false, error: '' });
  const lost = dlg.outcome === 'LOST';
  const canSave = !lost || (dlg.reason && (dlg.reason !== 'Other' || dlg.note.trim()));
  const cancelled = quote.Workflow?.WorkflowStatus === 'CANCELLED';

  return (
    <MainCard title="Deal outcome" sx={{ mb: 2.5 }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
        <Chip size="small" color={color} variant={deal.Status === 'OPEN' ? 'outlined' : 'filled'} label={label} />
        {deal.ClosedAt && (
          <Typography variant="caption" color="text.secondary">{deal.ClosedBy} · {fmtDate(deal.ClosedAt)}</Typography>
        )}
      </Stack>
      {deal.Status === 'LOST' && (
        <Box sx={{ mb: 1.5 }}>
          <Typography variant="body2"><b>Reason:</b> {deal.Reason}</Typography>
          {deal.Note && <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>“{deal.Note}”</Typography>}
        </Box>
      )}
      {deal.Status === 'WON' && deal.Note && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, fontStyle: 'italic' }}>“{deal.Note}”</Typography>
      )}
      {cancelled ? (
        <Typography variant="body2" color="text.secondary">
          The quotation is cancelled, so the deal outcome can't be changed. Restore it to update the outcome.
        </Typography>
      ) : deal.Status === 'OPEN' ? (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <Button variant="contained" color="success" startIcon={<ThumbUpAltOutlinedIcon />} disabled={!canWin} onClick={() => open('WON')}>
            Deal done
          </Button>
          <Button variant="outlined" color="error" startIcon={<ThumbDownAltOutlinedIcon />} onClick={() => open('LOST')}>
            Deal not done
          </Button>
        </Stack>
      ) : (
        <Button size="small" onClick={() => save('OPEN')}>Reopen</Button>
      )}
      {!cancelled && deal.Status === 'OPEN' && !canWin && (
        <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 1 }}>
          “Deal done” is available once the quotation is approved.
        </Typography>
      )}

      <Dialog open={dlg.open} onClose={() => !dlg.busy && setDlg((d) => ({ ...d, open: false }))} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>{lost ? 'Deal not done' : 'Deal done'}</DialogTitle>
        <DialogContent dividers>
          {dlg.error && <Alert severity="error" sx={{ mb: 2 }}>{dlg.error}</Alert>}
          {lost && (
            <TextField select label="Why wasn't the deal done?" value={dlg.reason} fullWidth required sx={{ mb: 2 }}
              onChange={(e) => setDlg((d) => ({ ...d, reason: e.target.value }))}>
              {(deal.LostReasons || []).map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
            </TextField>
          )}
          <TextField
            label={lost ? (dlg.reason === 'Other' ? 'Describe the reason' : 'Details (optional)') : 'Note (optional)'}
            required={lost && dlg.reason === 'Other'} value={dlg.note} multiline minRows={3} fullWidth
            onChange={(e) => setDlg((d) => ({ ...d, note: e.target.value }))}
            placeholder={lost ? 'e.g. Competitor offered 8% lower with a faster delivery date.' : 'e.g. Advance received, order booked.'}
          />
          {lost && <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 1 }}>Reasons are analysed in the Director's deal analysis.</Typography>}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setDlg((d) => ({ ...d, open: false }))} disabled={dlg.busy}>Cancel</Button>
          <Button variant="contained" color={lost ? 'error' : 'success'} disabled={!canSave || dlg.busy}
            onClick={() => save(dlg.outcome, dlg.reason, dlg.note.trim())}>
            {dlg.busy ? <CircularProgress size={20} color="inherit" /> : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </MainCard>
  );
}
