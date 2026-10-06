import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Button, Stack, CircularProgress, Alert } from '@mui/material';
import PageHeader from '../../components/PageHeader';
import MainCard from '../../components/MainCard';
import { listNotifications, markNotificationsRead, errMsg } from '../../api/workflow';
import { fetchCounts } from '../../store/slices/approvalSlice';
import { fmtDate } from '../../components/workflow/format';

export default function Notifications() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');

  const load = () => listNotifications().then(setRows).catch((e) => setError(errMsg(e, 'Could not load notifications.')));
  useEffect(() => { load(); }, []);

  const readAll = async () => {
    await markNotificationsRead();
    dispatch(fetchCounts());
    load();
  };

  const open = async (n) => {
    if (!n.IsRead) {
      await markNotificationsRead([n.Id]);
      dispatch(fetchCounts());
    }
    if (n.QuotationNumber) navigate(`/quotation/view/${n.QuotationNumber}`);
  };

  const unread = (rows || []).filter((n) => !n.IsRead).length;

  return (
    <Box>
      <PageHeader
        title="Notifications"
        crumbs={['Notifications']}
        action={unread > 0 && <Button onClick={readAll}>Mark all as read</Button>}
      />
      {error && <Alert severity="error">{error}</Alert>}
      {!rows && !error && <Box sx={{ py: 8, textAlign: 'center' }}><CircularProgress /></Box>}
      {rows && rows.length === 0 && (
        <MainCard contentSx={{ py: 5, textAlign: 'center' }}>
          <Typography variant="h4" sx={{ mb: 0.5 }}>You’re all caught up</Typography>
          <Typography variant="body2" color="text.secondary">Approval requests, decisions and escalations will show up here and in your email.</Typography>
        </MainCard>
      )}
      {rows && rows.length > 0 && (
        <MainCard title={unread ? `${unread} unread` : 'All read'} contentSx={{ p: 0, '&:last-child': { pb: 0 } }}>
          {rows.map((n, i) => (
            <Box
              key={n.Id} onClick={() => open(n)} role="button" tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && open(n)}
              sx={{
                display: 'flex', gap: 1.5, px: { xs: 2, md: 3 }, py: 1.75, cursor: 'pointer',
                borderTop: i ? '1px solid' : 'none', borderColor: 'divider',
                bgcolor: n.IsRead ? 'transparent' : 'primary.light', '&:hover': { bgcolor: 'action.hover' }
              }}
            >
              <Box sx={{ width: 8, height: 8, mt: 0.9, borderRadius: '50%', flexShrink: 0, bgcolor: n.IsRead ? 'transparent' : 'secondary.main' }} />
              <Stack sx={{ minWidth: 0 }}>
                <Typography variant="subtitle2">{n.Subject}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>{n.Body}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>{fmtDate(n.CreatedAt)}</Typography>
              </Stack>
            </Box>
          ))}
        </MainCard>
      )}
    </Box>
  );
}
