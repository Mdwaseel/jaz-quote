import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  TextField,
  MenuItem,
  Divider,
  Snackbar,
  Alert
} from '@mui/material';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import AddIcon from '@mui/icons-material/Add';
import axios from '../../api/axios';
import { Endpoints } from '../../api/endpoints';
import PageHeader from '../../components/PageHeader';
import MainCard from '../../components/MainCard';
import { fetchBranchList, fetchFranchize } from '../../store/slices/userSlice';

const emptyBranch = { FranchizeId: '', BranchName: '', Address: '', City: '', State: '', Pincode: '' };

export default function ListOfBranches() {
  const dispatch = useDispatch();
  const { branchList, franchize } = useSelector((s) => s.user);
  const [open, setOpen] = useState(false);
  const [nb, setNb] = useState(emptyBranch);
  const [toast, setToast] = useState('');

  useEffect(() => {
    dispatch(fetchBranchList());
    dispatch(fetchFranchize());
  }, [dispatch]);

  const columnDefs = useMemo(
    () => [
      { headerName: 'Branch', field: 'BranchName', minWidth: 180, filter: true, pinned: 'left' },
      { headerName: 'Franchise', field: 'Franchize', minWidth: 160, filter: true },
      { headerName: 'Address', field: 'Address', minWidth: 220 },
      { headerName: 'City', field: 'City', width: 140 },
      { headerName: 'State', field: 'State', width: 140 },
      { headerName: 'Pincode', field: 'Pincode', width: 120 }
    ],
    []
  );

  const submit = async () => {
    await axios.post(Endpoints.Add_Branch, nb);
    setOpen(false);
    setNb(emptyBranch);
    setToast('Branch created');
    dispatch(fetchBranchList());
  };

  return (
    <Box>
      <PageHeader
        title="Branches"
        crumbs={['User Profile', 'Branches']}
        action={<Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>Add Branch</Button>}
      />
      <MainCard title="All Branches">
        <div className="ag-theme-quartz" style={{ height: 520, width: '100%' }}>
          <AgGridReact rowData={branchList} columnDefs={columnDefs} defaultColDef={{ sortable: true, resizable: true }} pagination paginationPageSize={20} animateRows />
        </div>
      </MainCard>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Branch</DialogTitle>
        <Divider />
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid item xs={12} sm={6}>
              <TextField select fullWidth label="Franchise" value={nb.FranchizeId} onChange={(e) => setNb({ ...nb, FranchizeId: e.target.value })}>
                {franchize.map((f) => (<MenuItem key={f.Id} value={f.Id}>{f.FranchizeName}</MenuItem>))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth label="Branch Name" value={nb.BranchName} onChange={(e) => setNb({ ...nb, BranchName: e.target.value })} /></Grid>
            <Grid item xs={12}><TextField fullWidth label="Address" value={nb.Address} onChange={(e) => setNb({ ...nb, Address: e.target.value })} /></Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth label="City" value={nb.City} onChange={(e) => setNb({ ...nb, City: e.target.value })} /></Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth label="State" value={nb.State} onChange={(e) => setNb({ ...nb, State: e.target.value })} /></Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth label="Pincode" value={nb.Pincode} onChange={(e) => setNb({ ...nb, Pincode: e.target.value })} /></Grid>
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
