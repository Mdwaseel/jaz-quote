import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box, Tabs, Tab, Stack, Chip, Typography, CircularProgress, Alert, Snackbar, Card, CardActionArea,
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem
} from '@mui/material';
import PageHeader from '../../components/PageHeader';
import ApprovalCard from './ApprovalCard';
import ApprovalActionDialog from '../../components/workflow/ApprovalActionDialog';
import { listApprovals, reassignApproval, errMsg } from '../../api/workflow';
import { fetchCounts } from '../../store/slices/approvalSlice';
import { userRole, isApprover, ROLES } from '../../utils/roles';
import axios from '../../api/axios';
import { Endpoints } from '../../api/endpoints';

const CATEGORIES = [
  ['DISCOUNT', 'Discount'], ['WARRANTY', 'Warranty'], ['AMC', 'AMC'], ['PAYMENT_TERMS', 'Payment terms'], ['EDIT', 'Edit']
];

const tabsFor = (role, admin) => {
  if (admin) return [['pending', 'Pending'], ['all', 'All approvals']];
  if (role === ROLES.DIRECTOR) return [['pending', 'Pending'], ['team', 'Overall status'], ['history', 'Approval history']];
  if ([ROLES.RSD, ROLES.RM].includes(role)) {
    return [['pending', 'Pending'], ['team', 'Team requests'], ['history', 'Approval history'], ['mine', 'My requests']];
  }
  if (role === ROLES.ADMIN) return [['pending', 'Pending'], ['team', 'All requests'], ['history', 'Approval history']];
  return [['mine', 'My requests']];
};

export default function Approvals({ adminMode = false }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector((s) => s.auth.user);
  const counts = useSelector((s) => s.approval.counts);
  const role = userRole(user);
  const tabs = useMemo(() => tabsFor(role, adminMode), [role, adminMode]);
  const [params, setParams] = useSearchParams();
  const tab = tabs.find(([k]) => k === params.get('tab'))?.[0] || tabs[0][0];
  const [category, setCategory] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [dialog, setDialog] = useState({ open: false, req: null, action: 'approve' });
  const [reassign, setReassign] = useState({ open: false, req: null, step: null, userId: '', managers: [], busy: false, error: '' });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setRows(await listApprovals(tab, category ? { category } : {}));
    } catch (e) {
      setError(errMsg(e, 'Could not load approvals.'));
    } finally {
      setLoading(false);
    }
    dispatch(fetchCounts());
  }, [tab, category, dispatch]);

  useEffect(() => { load(); }, [load]);

  const openReassign = async (req, step) => {
    setReassign({ open: true, req, step, userId: '', managers: [], busy: false, error: '' });
    try {
      const refs = (await axios.post(Endpoints.Admin_User_Refs, {})).data.data;
      setReassign((r) => ({ ...r, managers: refs.Managers || [] }));
    } catch { /* keep empty */ }
  };

  const doReassign = async () => {
    setReassign((r) => ({ ...r, busy: true, error: '' }));
    try {
      await reassignApproval({ stepId: reassign.step.Id, userId: reassign.userId });
      setReassign((r) => ({ ...r, open: false, busy: false }));
      setToast('Approval reassigned');
      load();
    } catch (e) {
      setReassign((r) => ({ ...r, busy: false, error: errMsg(e, 'Could not reassign.') }));
    }
  };

  const pending = counts?.Pending || {};

  return (
    <Box>
      {!adminMode && <PageHeader title={isApprover(user) ? 'Approvals' : 'My Requests'} crumbs={['Approvals']} />}
      {adminMode && <Typography variant="h2" sx={{ mb: 3 }}>Approvals</Typography>}

      {tab === 'pending' && (
        <Box sx={{ display: 'grid', gap: 1.5, mb: 2.5, gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(5, 1fr)' } }}>
          {CATEGORIES.map(([k, label]) => (
            <Card key={k} sx={{ borderColor: category === k ? 'primary.main' : 'divider' }}>
              <CardActionArea onClick={() => setCategory((c) => (c === k ? '' : k))} aria-pressed={category === k} sx={{ px: 2, py: 1.5 }}>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }} noWrap>{label} requests</Typography>
                <Typography variant="h2" component="p" sx={{ fontVariantNumeric: 'tabular-nums' }}>{pending[k] || 0}</Typography>
              </CardActionArea>
            </Card>
          ))}
        </Box>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, flexWrap: 'wrap', mb: 2 }}>
        {tabs.length > 1 ? (
          <Tabs value={tab} onChange={(_, v) => setParams({ tab: v })} variant="scrollable" allowScrollButtonsMobile>
            {tabs.map(([k, label]) => (
              <Tab key={k} value={k} label={k === 'pending' && counts?.PendingTotal ? `${label} (${counts.PendingTotal})` : label} />
            ))}
          </Tabs>
        ) : <span />}
        <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', rowGap: 0.75 }}>
          <Chip label="All types" onClick={() => setCategory('')} color={!category ? 'primary' : 'default'} variant={!category ? 'filled' : 'outlined'} />
          {CATEGORIES.map(([k, label]) => (
            <Chip key={k} label={label} onClick={() => setCategory(k)} color={category === k ? 'primary' : 'default'} variant={category === k ? 'filled' : 'outlined'} />
          ))}
        </Stack>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {loading ? (
        <Box sx={{ py: 8, textAlign: 'center' }}><CircularProgress /></Box>
      ) : rows.length === 0 ? (
        <Card sx={{ p: 5, textAlign: 'center' }}>
          <Typography variant="h4" sx={{ mb: 0.5 }}>
            {tab === 'pending' ? 'Nothing waiting on you' : 'No requests here yet'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {tab === 'pending'
              ? 'Requests routed to you through the reporting hierarchy will appear here.'
              : 'Discount, warranty, AMC, payment-term and edit requests will be listed with their full history.'}
          </Typography>
        </Card>
      ) : (
        <Stack spacing={2}>
          {rows.map((r) => (
            <ApprovalCard
              key={r.Id}
              req={r}
              onView={(n) => navigate(`/quotation/view/${n}`)}
              onAct={(req, action) => setDialog({ open: true, req, action })}
              onReassign={adminMode ? openReassign : undefined}
            />
          ))}
        </Stack>
      )}

      <ApprovalActionDialog
        open={dialog.open}
        request={dialog.req}
        action={dialog.action}
        onClose={() => setDialog((d) => ({ ...d, open: false }))}
        onDone={() => {
          setDialog((d) => ({ ...d, open: false }));
          setToast(dialog.action === 'reject' ? 'Request rejected' : 'Request approved');
          load();
        }}
      />

      <Dialog open={reassign.open} onClose={() => !reassign.busy && setReassign((r) => ({ ...r, open: false }))} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Reassign approval</DialogTitle>
        <DialogContent dividers>
          {reassign.error && <Alert severity="error" sx={{ mb: 2 }}>{reassign.error}</Alert>}
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {reassign.step?.Role} stage, currently {reassign.step?.AssignedTo?.Name || 'unassigned'}. The new approver needs
            {' '}{reassign.step?.Role} authority or higher.
          </Typography>
          <TextField select fullWidth label="New approver" value={reassign.userId}
            onChange={(e) => setReassign((r) => ({ ...r, userId: e.target.value }))}>
            {reassign.managers.map((m) => (
              <MenuItem key={m.Id} value={m.Id}>{m.Name} — {m.Role}{m.Region ? ` · ${m.Region}` : ''}</MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setReassign((r) => ({ ...r, open: false }))} disabled={reassign.busy}>Cancel</Button>
          <Button variant="contained" onClick={doReassign} disabled={!reassign.userId || reassign.busy}>Reassign</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!toast} autoHideDuration={2500} onClose={() => setToast('')} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert severity="success" onClose={() => setToast('')}>{toast}</Alert>
      </Snackbar>
    </Box>
  );
}
