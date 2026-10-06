import { useEffect, useMemo, useState } from 'react';
import { Box, Typography, TextField, InputAdornment, Alert } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import MainCard from '../../components/MainCard';
import axios from '../../api/axios';
import { Endpoints } from '../../api/endpoints';
import { errMsg } from '../../api/workflow';
import { describeValue, fmtDate } from '../../components/workflow/format';

export default function AdminAudit() {
  const [rows, setRows] = useState([]);
  const [quick, setQuick] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    axios.post(Endpoints.Admin_Audit, {}).then((r) => setRows(r.data.data)).catch((e) => setError(errMsg(e, 'Could not load the audit log.')));
  }, []);

  const columnDefs = useMemo(() => [
    { headerName: 'When', field: 'CreatedAt', width: 180, valueFormatter: (p) => fmtDate(p.value), sort: 'desc' },
    { headerName: 'Quotation', field: 'QuotationNumber', width: 160, filter: true },
    { headerName: 'Ver.', field: 'Version', width: 75 },
    { headerName: 'Action', field: 'Action', minWidth: 240, filter: true },
    { headerName: 'User', field: 'Actor', width: 150, filter: true, valueFormatter: (p) => `${p.value}${p.data.ActorRole ? ` (${p.data.ActorRole})` : ''}` },
    { headerName: 'Previous', field: 'PreviousValue', minWidth: 170, valueFormatter: (p) => (p.value == null ? '' : describeValue(p.data.Field, p.value)) },
    { headerName: 'New', field: 'NewValue', minWidth: 170, valueFormatter: (p) => (p.value == null ? '' : describeValue(p.data.Field, p.value)) },
    { headerName: 'Note', field: 'Note', minWidth: 220, tooltipField: 'Note' },
    { headerName: 'Status', field: 'Status', width: 170, valueFormatter: (p) => (p.value || '').replaceAll('_', ' ').toLowerCase() }
  ], []);

  return (
    <Box>
      <Typography variant="h2" sx={{ mb: 1 }}>Audit log</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Append-only record of every quotation, approval and edit event. Entries are never changed or removed.
      </Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <MainCard
        title="Events"
        secondary={
          <TextField size="small" placeholder="Search…" value={quick} onChange={(e) => setQuick(e.target.value)}
            InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>) }} />
        }
      >
        <div className="ag-theme-quartz" style={{ height: 620, width: '100%' }}>
          <AgGridReact rowData={rows} columnDefs={columnDefs} defaultColDef={{ sortable: true, resizable: true }}
            quickFilterText={quick} pagination paginationPageSize={50} tooltipShowDelay={300} />
        </div>
      </MainCard>
    </Box>
  );
}
