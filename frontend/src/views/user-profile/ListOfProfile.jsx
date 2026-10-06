import { useEffect, useMemo, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box,
  Button,
  Chip,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  TextField,
  MenuItem,
  Divider,
  Alert,
  Snackbar
} from '@mui/material';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import PageHeader from '../../components/PageHeader';
import MainCard from '../../components/MainCard';
import {
  fetchUserList,
  fetchRoles,
  fetchFranchize,
  fetchBranches,
  fetchReportingManagers,
  createUser,
  inactivateUser
} from '../../store/slices/userSlice';

const emptyUser = {
  Name: '', Email: '', Mobile: '', EmployeeCode: '', Password: '',
  RoleId: '', FranchizeId: '', BranchId: '', ReportingManagerId: ''
};

export default function ListOfProfile() {
  const dispatch = useDispatch();
  const { list, roles, franchize, branches, reportingManagers, loading, error } = useSelector((s) => s.user);
  const [open, setOpen] = useState(false);
  const [nu, setNu] = useState(emptyUser);
  const [toast, setToast] = useState('');

  useEffect(() => {
    dispatch(fetchUserList());
    dispatch(fetchRoles());
    dispatch(fetchFranchize());
  }, [dispatch]);

  const remove = useCallback(
    async (id) => {
      await dispatch(inactivateUser(id));
      dispatch(fetchUserList());
    },
    [dispatch]
  );

  const columnDefs = useMemo(
    () => [
      { headerName: 'Name', field: 'Name', minWidth: 170, filter: true, pinned: 'left' },
      { headerName: 'Email', field: 'Email', minWidth: 210, filter: true },
      { headerName: 'Mobile', field: 'Mobile', width: 140 },
      { headerName: 'Emp Code', field: 'EmployeeCode', width: 120 },
      { headerName: 'Role', field: 'Role', width: 110, cellRenderer: (p) => (p.value ? <Chip size="small" label={p.value} variant="outlined" color="primary" /> : '') },
      { headerName: 'Franchise', field: 'Franchize', width: 150 },
      { headerName: 'Status', field: 'Status', width: 110, cellRenderer: (p) => <Chip size="small" label={p.value} color={p.value === 'Active' ? 'success' : 'default'} variant="outlined" /> },
      {
        headerName: 'Actions',
        width: 110,
        pinned: 'right',
        sortable: false,
        cellRenderer: (p) => (
          <Tooltip title="Deactivate">
            <IconButton size="small" color="error" onClick={() => remove(p.data.UserId)}>
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )
      }
    ],
    [remove]
  );

  const submit = async () => {
    const res = await dispatch(createUser(nu));
    if (createUser.fulfilled.match(res)) {
      setOpen(false);
      setNu(emptyUser);
      setToast('User created');
      dispatch(fetchUserList());
    }
  };

  return (
    <Box>
      <PageHeader
        title="Users"
        crumbs={['User Profile', 'Users']}
        action={<Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>Add User</Button>}
      />
      <MainCard title="All Users">
        <div className="ag-theme-quartz" style={{ height: 560, width: '100%' }}>
          <AgGridReact rowData={list} columnDefs={columnDefs} defaultColDef={{ sortable: true, resizable: true }} pagination paginationPageSize={20} animateRows loading={loading} />
        </div>
      </MainCard>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add User</DialogTitle>
        <Divider />
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid item xs={12} sm={6}><TextField fullWidth label="Name" value={nu.Name} onChange={(e) => setNu({ ...nu, Name: e.target.value })} /></Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth label="Email" value={nu.Email} onChange={(e) => setNu({ ...nu, Email: e.target.value })} /></Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth label="Mobile" value={nu.Mobile} onChange={(e) => setNu({ ...nu, Mobile: e.target.value })} /></Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth label="Employee Code" value={nu.EmployeeCode} onChange={(e) => setNu({ ...nu, EmployeeCode: e.target.value })} /></Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth type="password" label="Password" value={nu.Password} onChange={(e) => setNu({ ...nu, Password: e.target.value })} /></Grid>
            <Grid item xs={12} sm={6}>
              <TextField select fullWidth label="Role" value={nu.RoleId} onChange={(e) => setNu({ ...nu, RoleId: e.target.value })}>
                {roles.map((r) => (<MenuItem key={r.Id} value={r.Id}>{r.Roles}</MenuItem>))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField select fullWidth label="Franchise" value={nu.FranchizeId}
                onChange={(e) => {
                  setNu({ ...nu, FranchizeId: e.target.value });
                  dispatch(fetchBranches(e.target.value));
                  dispatch(fetchReportingManagers(e.target.value));
                }}>
                {franchize.map((f) => (<MenuItem key={f.Id} value={f.Id}>{f.FranchizeName}</MenuItem>))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField select fullWidth label="Branch" value={nu.BranchId} onChange={(e) => setNu({ ...nu, BranchId: e.target.value })}>
                {branches.map((b) => (<MenuItem key={b.Id} value={b.Id}>{b.BranchName}</MenuItem>))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField select fullWidth label="Reporting Manager" value={nu.ReportingManagerId} onChange={(e) => setNu({ ...nu, ReportingManagerId: e.target.value })}>
                {reportingManagers.map((m) => (<MenuItem key={m.Id} value={m.Id}>{m.Name}</MenuItem>))}
              </TextField>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={submit}>Create</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!toast} autoHideDuration={2000} onClose={() => setToast('')}>
        <Alert severity="success">{toast}</Alert>
      </Snackbar>
    </Box>
  );
}
