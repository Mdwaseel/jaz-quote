import { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Box, CircularProgress, Alert, Typography, IconButton, Tooltip, Snackbar } from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DeleteUserDialog from '../../components/workflow/DeleteUserDialog';
import { userRole, ROLES } from '../../utils/roles';
import PageHeader from '../../components/PageHeader';
import MainCard from '../../components/MainCard';
import OrgTree from '../../components/workflow/OrgTree';
import { teamTree, errMsg } from '../../api/workflow';

const countAll = (n) => (n.Children || []).reduce((s, c) => s + 1 + countAll(c), 0);

export default function MyTeam() {
  const [tree, setTree] = useState(null);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(null);
  const [toast, setToast] = useState('');
  const me = useSelector((s) => s.auth.user);
  const canDelete = [ROLES.ADMIN, ROLES.DIRECTOR].includes(userRole(me));

  const load = useCallback(() => {
    teamTree().then(setTree).catch((e) => setError(errMsg(e, 'Could not load your team.')));
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <Box>
      <PageHeader title="My Team" crumbs={['Team']} />
      {error && <Alert severity="error">{error}</Alert>}
      {!tree && !error && <Box sx={{ py: 8, textAlign: 'center' }}><CircularProgress /></Box>}
      {tree && (
        <MainCard title="Reporting tree">
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            {countAll(tree)} people report into you. Approval requests from this team are routed to their assigned managers.
          </Typography>
          <OrgTree
            nodes={[tree]}
            renderMeta={(n) => `${n.Quotations} quotation${n.Quotations === 1 ? '' : 's'}${n.PendingQuotations ? ` · ${n.PendingQuotations} awaiting approval` : ''}`}
            renderActions={canDelete ? (n) => (n.Id === tree.Id ? null : (
              <Tooltip title="Delete user">
                <IconButton size="small" color="error" aria-label={`Delete ${n.Name}`} onClick={() => setDeleting({ Id: n.Id, Name: n.Name })}>
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )) : undefined}
          />
        </MainCard>
      )}
      <DeleteUserDialog open={!!deleting} user={deleting} onClose={() => setDeleting(null)}
        onDeleted={(msg) => { setDeleting(null); setToast(msg); load(); }} />
      <Snackbar open={!!toast} autoHideDuration={3000} onClose={() => setToast('')} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert severity="success" onClose={() => setToast('')}>{toast}</Alert>
      </Snackbar>
    </Box>
  );
}
