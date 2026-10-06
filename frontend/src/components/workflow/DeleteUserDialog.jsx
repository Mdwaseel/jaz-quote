import { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Alert, Typography, CircularProgress, Box
} from '@mui/material';
import { deleteUserPreview, deleteUser, errMsg } from '../../api/workflow';

/** Confirm deleting a user, showing exactly what moves to the person above them. */
export default function DeleteUserDialog({ open, user, onClose, onDeleted }) {
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !user) return;
    setPreview(null);
    setError('');
    deleteUserPreview(user.Id).then(setPreview).catch((e) => setError(errMsg(e, 'Could not load the details.')));
  }, [open, user]);

  const confirm = async () => {
    setBusy(true);
    setError('');
    try {
      const r = await deleteUser(user.Id);
      onDeleted?.(r.Message);
    } catch (e) {
      setError(errMsg(e, 'Could not delete the user.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => !busy && onClose()} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Delete {user?.Name}?</DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {!preview && !error && <Box sx={{ py: 3, textAlign: 'center' }}><CircularProgress size={28} /></Box>}
        {preview && (
          <>
            <Typography variant="body2" sx={{ mb: 1.5 }}>
              Everything {preview.Name} owns moves to <b>{preview.Successor.Name}</b> ({preview.Successor.Role}):
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, my: 0, '& li': { mb: 0.5 } }}>
              <li><Typography variant="body2">{preview.Quotations} quotation{preview.Quotations === 1 ? '' : 's'}</Typography></li>
              <li><Typography variant="body2">{preview.DirectReports} team member{preview.DirectReports === 1 ? '' : 's'} who report to them</Typography></li>
              <li><Typography variant="body2">{preview.OpenApprovals} approval{preview.OpenApprovals === 1 ? '' : 's'} waiting on them (sent up the chain)</Typography></li>
            </Box>
            <Alert severity="warning" sx={{ mt: 2 }}>
              They will no longer be able to sign in. Their name stays on past quotation history.
            </Alert>
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={busy}>Cancel</Button>
        <Button variant="contained" color="error" onClick={confirm} disabled={!preview || busy}>
          {busy ? <CircularProgress size={20} color="inherit" /> : 'Delete user'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
