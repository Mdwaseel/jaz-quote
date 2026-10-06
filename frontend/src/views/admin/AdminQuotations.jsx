import { useEffect, useMemo, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Box, Typography, TextField, InputAdornment, Select, MenuItem, Snackbar, Alert } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import MainCard from '../../components/MainCard';
import WorkflowStatusChip from '../../components/workflow/WorkflowStatusChip';
import { fetchAdminQuotations, updateQuotationStatus } from '../../store/slices/adminSlice';

const money = (n) => '₹ ' + Number(n || 0).toLocaleString('en-IN');
const STATUSES = ['Pending', 'Confirmed', 'Rebate', 'Inactive'];

export default function AdminQuotations() {
  const dispatch = useDispatch();
  const rows = useSelector((s) => s.admin.quotations);
  const [quick, setQuick] = useState('');
  const [toast, setToast] = useState('');

  useEffect(() => { dispatch(fetchAdminQuotations()); }, [dispatch]);

  const changeStatus = useCallback(async (number, status) => {
    await dispatch(updateQuotationStatus({ QuotationNumber: number, Status: status }));
    setToast('Status updated');
    dispatch(fetchAdminQuotations());
  }, [dispatch]);

  const columnDefs = useMemo(() => [
    { headerName: 'Quotation #', field: 'QuotationNumber', minWidth: 180, filter: true, pinned: 'left' },
    { headerName: 'Customer', field: 'CustomerName', minWidth: 160, filter: true },
    { headerName: 'Mobile', field: 'Mobile', width: 130 },
    { headerName: 'Package', field: 'Package', minWidth: 200 },
    { headerName: 'Config', field: 'Configuration', width: 100 },
    { headerName: 'City', field: 'City', width: 120 },
    { headerName: 'Ex-Tax', field: 'ExcludeTax', width: 140, valueFormatter: (p) => money(p.value) },
    { headerName: 'Total', field: 'IncludeTax', width: 150, valueFormatter: (p) => money(p.value) },
    { headerName: 'Discount', field: 'DiscountPercent', width: 110, valueFormatter: (p) => `${p.value || 0}%` },
    { headerName: 'By', field: 'CreatedBy', width: 150, valueFormatter: (p) => (p.value ? `${p.value} (${p.data.CreatedByRole || '—'})` : '') },
    {
      headerName: 'Approval', field: 'WorkflowStatus', minWidth: 190, tooltipField: 'PendingLabel',
      cellRenderer: (p) => <WorkflowStatusChip status={p.value} />
    },
    { headerName: 'Created', field: 'CreatedDate', width: 120, valueFormatter: (p) => (p.value ? new Date(p.value).toLocaleDateString() : '') },
    {
      headerName: 'Sales status', field: 'Status', width: 150, pinned: 'right',
      cellRenderer: (p) => (
        <Select
          size="small" value={p.value} variant="standard" disableUnderline
          onChange={(e) => changeStatus(p.data.QuotationNumber, e.target.value)}
          sx={{ fontSize: 13, fontWeight: 600 }}
        >
          {STATUSES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
        </Select>
      )
    }
  ], [changeStatus]);

  return (
    <Box>
      <Typography variant="h2" sx={{ mb: 3 }}>Quotations</Typography>
      <MainCard
        title="All Quotations"
        secondary={
          <TextField size="small" placeholder="Search…" value={quick} onChange={(e) => setQuick(e.target.value)}
            InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>) }} />
        }
      >
        <div className="ag-theme-quartz" style={{ height: 600, width: '100%' }}>
          <AgGridReact rowData={rows} columnDefs={columnDefs} defaultColDef={{ sortable: true, resizable: true }} quickFilterText={quick} pagination paginationPageSize={25} animateRows tooltipShowDelay={300} />
        </div>
      </MainCard>
      <Snackbar open={!!toast} autoHideDuration={2000} onClose={() => setToast('')}><Alert severity="success">{toast}</Alert></Snackbar>
    </Box>
  );
}
