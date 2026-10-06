import { useEffect, useMemo, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useSearchParams } from 'react-router-dom';
import {
  Box, Typography, Chip, Switch, Snackbar, Alert, TextField, InputAdornment, Tooltip, IconButton, Tabs, Tab,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, MenuItem, Stack, CircularProgress
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import PersonAddAltOutlinedIcon from '@mui/icons-material/PersonAddAltOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import MainCard from '../../components/MainCard';
import OrgTree from '../../components/workflow/OrgTree';
import UserAssignmentDialog from './UserAssignmentDialog';
import DeleteUserDialog from '../../components/workflow/DeleteUserDialog';
import axios from '../../api/axios';
import { Endpoints } from '../../api/endpoints';
import { fetchAdminUsers, toggleUser, createAdminUser, fetchUserRefs } from '../../store/slices/adminSlice';

const emptyForm = { name: '', email: '', mobile: '', employeeCode: '', role: 'BDM', franchiseId: '', password: '', managerId: '', region: '' };
const LEVEL = { Admin: 1, Director: 2, RSD: 3, RM: 4, 'Sr. BDM': 5, BDM: 6 };
// Role suggested for someone added directly under a person with this role.
const NEXT_ROLE = { Admin: 'RSD', Director: 'RSD', RSD: 'RM', RM: 'BDM', 'Sr. BDM': 'BDM' };

// Keep only branches that contain a name / email / role / region match.
const filterTree = (nodes, q) => {
  if (!q) return nodes;
  const t = q.toLowerCase();
  return nodes.flatMap((n) => {
    const kids = filterTree(n.Children || [], q);
    const hit = [n.Name, n.Email, n.Role, n.Region].some((v) => (v || '').toLowerCase().includes(t));
    return hit || kids.length ? [{ ...n, Children: hit ? n.Children : kids }] : [];
  });
};

export default function AdminUsers() {
  const dispatch = useDispatch();
  const rows = useSelector((s) => s.admin.users);
  const [params, setParams] = useSearchParams();
  const view = params.get('view') === 'list' ? 'list' : 'tree';
  const [forest, setForest] = useState(null);
  const [quick, setQuick] = useState('');
  const [toast, setToast] = useState('');
  const [err, setErr] = useState('');

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [parent, setParent] = useState(null); // node the new user will report to
  const [refs, setRefs] = useState({ Roles: [], Franchises: [], Managers: [] });
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const reload = useCallback(() => {
    dispatch(fetchAdminUsers());
    axios.post(Endpoints.Admin_Org_Tree, {}).then((r) => setForest(r.data.data)).catch(() => setForest([]));
  }, [dispatch]);

  useEffect(() => { reload(); }, [reload]);

  const byId = useMemo(() => Object.fromEntries(rows.map((u) => [u.UserId, u])), [rows]);
  const setF = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const openDialog = async (under = null) => {
    setParent(under);
    setForm({ ...emptyForm, managerId: under?.Id || '', role: under ? NEXT_ROLE[under.Role] || 'BDM' : 'BDM', region: under?.Region || '' });
    setError('');
    setOpen(true);
    try {
      setRefs(await dispatch(fetchUserRefs()).unwrap());
    } catch { /* keep defaults */ }
  };

  const submit = async () => {
    setError('');
    setSaving(true);
    const res = await dispatch(createAdminUser(form));
    setSaving(false);
    if (createAdminUser.fulfilled.match(res)) {
      setOpen(false);
      const mailed = res.payload?.EmailSent ? ` — login details emailed to ${form.email}` : ' — login details could not be emailed';
      setToast((parent ? `${form.name} added under ${parent.Name}` : 'User created') + mailed);
      reload();
    } else {
      setError(res.payload || 'Could not create user.');
    }
  };

  const toggle = useCallback(async (id, active) => {
    const res = await dispatch(toggleUser({ userId: id, active }));
    if (toggleUser.fulfilled.match(res)) {
      setToast(active ? 'User activated' : 'User deactivated');
    } else {
      setErr(res.payload || 'Could not update user.');
    }
    reload();
  }, [dispatch, reload]);

  const activeSwitch = (u, label) => (
    u?.IsSelf ? (
      <Tooltip title="You can't deactivate your own account">
        <span><Switch size="small" checked={u.Status === 'Active'} disabled inputProps={{ 'aria-label': label }} /></span>
      </Tooltip>
    ) : (
      <Tooltip title={u?.Status === 'Active' ? 'Active — click to deactivate' : 'Inactive — click to activate'}>
        <Switch size="small" checked={u?.Status === 'Active'} onChange={(e) => toggle(u.UserId, e.target.checked)} inputProps={{ 'aria-label': label }} />
      </Tooltip>
    )
  );

  const columnDefs = useMemo(() => [
    { headerName: 'Name', field: 'Name', minWidth: 170, filter: true, pinned: 'left' },
    { headerName: 'Email', field: 'Email', minWidth: 210, filter: true },
    { headerName: 'Mobile', field: 'Mobile', width: 140 },
    { headerName: 'Emp Code', field: 'EmployeeCode', width: 120 },
    { headerName: 'Role', field: 'Role', width: 120, filter: true, cellRenderer: (p) => (p.value ? <Chip size="small" variant="outlined" color="primary" label={p.value} /> : '') },
    { headerName: 'Reports to', field: 'Manager', width: 150, filter: true },
    { headerName: 'Region', field: 'Region', width: 120, filter: true },
    { headerName: 'Open approvals', field: 'OpenApprovals', width: 130 },
    { headerName: 'Franchise', field: 'Franchize', width: 150 },
    {
      headerName: '', field: 'edit', width: 70, sortable: false, pinned: 'right',
      cellRenderer: (p) => (
        <Tooltip title="Edit role & reporting">
          <IconButton size="small" color="primary" aria-label={`Edit ${p.data.Name}`} onClick={() => setEditing(p.data)}>
            <EditOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )
    },
    { headerName: 'Active', field: 'Status', width: 100, pinned: 'right', cellRenderer: (p) => activeSwitch(p.data, `Active: ${p.data.Name}`) },
    {
      headerName: '', field: 'delete', width: 64, sortable: false, pinned: 'right',
      cellRenderer: (p) => (p.data.IsSelf ? null : (
        <Tooltip title="Delete user">
          <IconButton size="small" color="error" aria-label={`Delete ${p.data.Name}`} onClick={() => setDeleting({ Id: p.data.UserId, Name: p.data.Name })}>
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [toggle]);

  const roleOptions = (refs.Roles?.length ? refs.Roles.map((r) => r.Name) : Object.keys(LEVEL))
    .filter((name) => !parent || (LEVEL[name] || 9) >= (LEVEL[parent.Role] || 0));
  const managerOptions = (refs.Managers || []).filter((m) => (LEVEL[m.Role] || 9) <= (LEVEL[form.role] || 9));
  const canSubmit = form.name.trim() && form.email.trim() && form.password.length >= 8;
  const tree = useMemo(() => filterTree(forest || [], quick.trim()), [forest, quick]);
  // Tree roots other than Admins have no reporting manager.
  const unassigned = (forest || []).filter((n) => n.Role !== 'Admin' && n.Active !== false);
  const search = (
    <TextField size="small" placeholder="Search…" value={quick} onChange={(e) => setQuick(e.target.value)}
      InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>) }} />
  );

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, gap: 2, flexWrap: 'wrap' }}>
        <Typography variant="h2">Users</Typography>
        <Button variant="contained" startIcon={<PersonAddAltOutlinedIcon />} onClick={() => openDialog()}>
          Add User
        </Button>
      </Box>

      <Tabs value={view} onChange={(_, v) => setParams(v === 'list' ? { view: 'list' } : {})} sx={{ mb: 2 }}>
        <Tab value="tree" label="Organisation tree" />
        <Tab value="list" label="List" />
      </Tabs>

      {view === 'tree' ? (
        <MainCard title="Organisation tree" secondary={search}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Use <PersonAddAltOutlinedIcon sx={{ fontSize: 16, verticalAlign: 'text-bottom' }} /> on anyone to add a person
            who reports to them. Approval requests travel up these lines: BDM → RM → RSD → Admin.
          </Typography>
          {unassigned.length > 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              No reporting manager: {unassigned.map((u) => u.Name).join(', ')}. Their approval requests fall back to an
              Admin — use Edit to place them in the tree.
            </Alert>
          )}
          {!forest ? (
            <Box sx={{ py: 6, textAlign: 'center' }}><CircularProgress /></Box>
          ) : tree.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>No users match “{quick}”.</Typography>
          ) : (
            <OrgTree
              nodes={tree}
              renderMeta={(n) => `${n.Email}${n.Quotations ? ` · ${n.Quotations} quotations` : ''}`}
              renderActions={(n) => (
                <>
                  {n.Role !== 'BDM' && (
                    <Tooltip title={`Add someone reporting to ${n.Name}`}>
                      <IconButton size="small" color="primary" aria-label={`Add user under ${n.Name}`} onClick={() => openDialog(n)}>
                        <PersonAddAltOutlinedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                  <Tooltip title="Edit role & reporting">
                    <IconButton size="small" color="primary" aria-label={`Edit ${n.Name}`} onClick={() => setEditing(byId[n.Id])}>
                      <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  {byId[n.Id] && activeSwitch(byId[n.Id], `Active: ${n.Name}`)}
                  {byId[n.Id] && !byId[n.Id].IsSelf && (
                    <Tooltip title="Delete user">
                      <IconButton size="small" color="error" aria-label={`Delete ${n.Name}`} onClick={() => setDeleting({ Id: n.Id, Name: n.Name })}>
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </>
              )}
            />
          )}
        </MainCard>
      ) : (
        <MainCard title="All Users" secondary={search}>
          <div className="ag-theme-quartz" style={{ height: 560, width: '100%' }}>
            <AgGridReact rowData={rows} columnDefs={columnDefs} defaultColDef={{ sortable: true, resizable: true }} quickFilterText={quick} pagination paginationPageSize={25} animateRows />
          </div>
        </MainCard>
      )}

      <Dialog open={open} onClose={() => !saving && setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>{parent ? `Add user under ${parent.Name}` : 'Add User'}</DialogTitle>
        <DialogContent dividers>
          {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
          {parent && (
            <Alert severity="info" variant="outlined" sx={{ mb: 2 }}>
              Will report to <b>{parent.Name}</b> ({parent.Role}{parent.Region ? ` · ${parent.Region}` : ''}).
            </Alert>
          )}
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            <TextField label="Full name" value={form.name} onChange={(e) => setF('name', e.target.value)} required fullWidth autoFocus />
            <TextField label="Email" type="email" value={form.email} onChange={(e) => setF('email', e.target.value)} required fullWidth />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField label="Mobile" value={form.mobile} onChange={(e) => setF('mobile', e.target.value)} fullWidth />
              <TextField label="Employee code" value={form.employeeCode} onChange={(e) => setF('employeeCode', e.target.value)} fullWidth />
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField select label="Role" value={form.role} onChange={(e) => setF('role', e.target.value)} fullWidth>
                {roleOptions.map((name) => (
                  <MenuItem key={name} value={name}>{name}</MenuItem>
                ))}
              </TextField>
              <TextField select label="Franchise" value={form.franchiseId} onChange={(e) => setF('franchiseId', e.target.value)} fullWidth>
                <MenuItem value="">Default (JAZ)</MenuItem>
                {(refs.Franchises || []).map((f) => (
                  <MenuItem key={f.Id} value={f.Id}>{f.Name}</MenuItem>
                ))}
              </TextField>
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              {!parent && (
                <TextField select label="Reports to" value={form.managerId} onChange={(e) => setF('managerId', e.target.value)} fullWidth
                  helperText="Approvals route up this line">
                  <MenuItem value="">— None —</MenuItem>
                  {managerOptions.map((m) => (<MenuItem key={m.Id} value={m.Id}>{m.Name} — {m.Role}</MenuItem>))}
                </TextField>
              )}
              <TextField label="Region" value={form.region} onChange={(e) => setF('region', e.target.value)} fullWidth placeholder="e.g. Telangana" />
            </Stack>
            <TextField label="Password" type="password" value={form.password} onChange={(e) => setF('password', e.target.value)} required fullWidth helperText="At least 8 characters" />
            {form.role === 'Admin' && (
              <Alert severity="info" variant="outlined">Admins manage users, the hierarchy and prices, and give final approval on escalated requests.</Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
          <Button variant="contained" onClick={submit} disabled={!canSubmit || saving}>
            {saving ? <CircularProgress size={22} color="inherit" /> : 'Create User'}
          </Button>
        </DialogActions>
      </Dialog>

      <DeleteUserDialog open={!!deleting} user={deleting} onClose={() => setDeleting(null)}
        onDeleted={(msg) => { setDeleting(null); setToast(msg); reload(); }} />

      <UserAssignmentDialog open={!!editing} user={editing} onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); setToast('User updated'); reload(); }} />

      <Snackbar open={!!toast} autoHideDuration={2500} onClose={() => setToast('')}><Alert severity="success">{toast}</Alert></Snackbar>
      <Snackbar open={!!err} autoHideDuration={3500} onClose={() => setErr('')} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert severity="error" onClose={() => setErr('')}>{err}</Alert>
      </Snackbar>
    </Box>
  );
}
