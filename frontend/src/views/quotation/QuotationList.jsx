import { useEffect, useMemo, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Box, Button, IconButton, Tooltip, TextField, InputAdornment, Stack, Tabs, Tab, Typography, Alert, Chip, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import PageHeader from '../../components/PageHeader';
import MainCard from '../../components/MainCard';
import PdfPreviewDialog from '../../components/PdfPreviewDialog';
import WorkflowStatusChip from '../../components/workflow/WorkflowStatusChip';
import { inr, pct } from '../../components/workflow/format';
import axios from '../../api/axios';
import { Endpoints } from '../../api/endpoints';
import { downloadQuotePdf, errMsg } from '../../api/workflow';
import { userRole, ROLES } from '../../utils/roles';

const SCOPES = {
  [ROLES.BDM]: [['mine', 'My quotations']],
  [ROLES.SR_BDM]: [['mine', 'My quotations']],
  [ROLES.RM]: [['mine', 'My quotations'], ['team', 'Team quotations']],
  [ROLES.RSD]: [['team', 'Regional quotations'], ['mine', 'My quotations']],
  [ROLES.DIRECTOR]: [['all', 'Overall quotations'], ['mine', 'My quotations']],
  [ROLES.ADMIN]: [['all', 'All quotations'], ['mine', 'My quotations']]
};

export default function QuotationList() {
  const navigate = useNavigate();
  const user = useSelector((s) => s.auth.user);
  const scopes = SCOPES[userRole(user)] || SCOPES[ROLES.BDM];
  const [params, setParams] = useSearchParams();
  const scope = scopes.find(([k]) => k === params.get('scope'))?.[0] || scopes[0][0];
  // Cancelled quotations are kept; this only filters the view.
  const state = ['active', 'cancelled'].includes(params.get('state')) ? params.get('state') : 'all';
  const setParam = (k, v) => setParams((prev) => { const n = new URLSearchParams(prev); if (v) n.set(k, v); else n.delete(k); return n; });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [quickFilter, setQuickFilter] = useState('');
  const [preview, setPreview] = useState({ open: false, url: '', filename: 'quotation.pdf', loading: false, error: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows((await axios.post(Endpoints.Get_QuoteList, { scope, state })).data.data || []);
      setError('');
    } catch (e) {
      setError(errMsg(e, 'Could not load quotations.'));
    } finally {
      setLoading(false);
    }
  }, [scope, state]);

  useEffect(() => { load(); }, [load]);

  const handleDownload = useCallback(async (number) => {
    setPreview({ open: true, url: '', filename: 'quotation.pdf', loading: true, error: '' });
    try {
      const { url, filename } = await downloadQuotePdf(number);
      setPreview({ open: true, url, filename, loading: false, error: '' });
      load();
    } catch (e) {
      setPreview({ open: true, url: '', filename: 'quotation.pdf', loading: false, error: e.message });
    }
  }, [load]);

  const closePreview = useCallback(() => {
    setPreview((p) => {
      if (p.url) URL.revokeObjectURL(p.url);
      return { ...p, open: false };
    });
  }, []);

  const showCreator = scope !== 'mine';
  const columnDefs = useMemo(
    () => [
      { headerName: 'Quotation #', field: 'QuotationNumber', minWidth: 170, filter: true, pinned: 'left' },
      { headerName: 'Customer', field: 'CustomerName', minWidth: 160, filter: true },
      ...(showCreator ? [{
        headerName: 'Created by', field: 'CreatedBy', minWidth: 150, filter: true,
        valueFormatter: (p) => (p.value ? `${p.value} (${p.data.CreatedByRole || '—'})` : '')
      }] : []),
      { headerName: 'Package', field: 'Package', minWidth: 200, filter: true },
      { headerName: 'Room', field: 'Room', minWidth: 150 },
      {
        headerName: 'Final amount', field: 'FinalAmount', width: 150, type: 'rightAligned',
        valueFormatter: (p) => inr(p.value)
      },
      { headerName: 'Discount', field: 'DiscountPercent', width: 110, type: 'rightAligned', valueFormatter: (p) => pct(p.value) },
      {
        headerName: 'Approval status', field: 'WorkflowStatus', width: 200, pinned: 'right',
        cellRenderer: (p) => (p.value === 'CANCELLED' ? (
          <Tooltip title={p.data.CancelReason ? `Cancelled — ${p.data.CancelReason}` : 'Cancelled'}>
            <span><WorkflowStatusChip status={p.value} /></span>
          </Tooltip>
        ) : <WorkflowStatusChip status={p.value} locked={p.data.IsLocked} />)
      },
      {
        headerName: 'Deal', field: 'DealStatus', width: 130,
        cellRenderer: (p) => {
          const [label, color] = { WON: ['Done', 'success'], LOST: ['Not done', 'error'] }[p.value] || ['Open', 'default'];
          return <Chip size="small" variant="outlined" color={color} label={label} title={p.data.DealReason || ''} />;
        }
      },
      { headerName: 'Ver.', field: 'Version', width: 80 },
      {
        headerName: 'Created', field: 'CreatedDate', width: 120,
        valueFormatter: (p) => (p.value ? new Date(p.value).toLocaleDateString('en-IN') : '')
      },
      {
        headerName: 'Actions', field: 'actions', width: 120, pinned: 'right', sortable: false, filter: false,
        cellRenderer: (p) => {
          const row = p.data;
          return (
            <Stack direction="row" spacing={0.5}>
              <Tooltip title="View">
                <IconButton size="small" color="primary" aria-label="View quotation" onClick={() => navigate(`/quotation/view/${row.QuotationNumber}`)}>
                  <VisibilityOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title={row.CanDownload ? 'Download PDF' : `Locked: ${row.DownloadBlockedReason}`}>
                <span>
                  <IconButton size="small" aria-label="Download PDF" disabled={!row.CanDownload} onClick={() => handleDownload(row.QuotationNumber)}>
                    {row.CanDownload ? <FileDownloadOutlinedIcon fontSize="small" /> : <LockOutlinedIcon fontSize="small" />}
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
          );
        }
      }
    ],
    [handleDownload, navigate, showCreator]
  );

  const defaultColDef = useMemo(() => ({ sortable: true, resizable: true, filter: false }), []);

  return (
    <Box>
      <PageHeader
        title="Quotations"
        crumbs={['Quotation', 'List']}
        action={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/quotation/create')}>
            Create Quote
          </Button>
        }
      />
      {scopes.length > 1 && (
        <Tabs value={scope} onChange={(_, v) => setParam('scope', v)} sx={{ mb: 2 }}>
          {scopes.map(([k, label]) => <Tab key={k} value={k} label={label} />)}
        </Tabs>
      )}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <MainCard
        title={<Typography variant="h3">{scopes.find(([k]) => k === scope)?.[1]}</Typography>}
        secondary={
          <Stack direction="row" spacing={1.5} alignItems="center">
          <ToggleButtonGroup size="small" exclusive value={state} onChange={(_, v) => v && setParam('state', v === 'all' ? '' : v)}
            aria-label="Filter by status">
            <ToggleButton value="all">All</ToggleButton>
            <ToggleButton value="active">Active</ToggleButton>
            <ToggleButton value="cancelled">Cancelled</ToggleButton>
          </ToggleButtonGroup>
          <TextField
            size="small"
            placeholder="Search..."
            value={quickFilter}
            onChange={(e) => setQuickFilter(e.target.value)}
            InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>) }}
          />
          </Stack>
        }
      >
        <div className="ag-theme-quartz" style={{ height: 560, width: '100%' }}>
          <AgGridReact
            rowData={rows}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            quickFilterText={quickFilter}
            pagination
            paginationPageSize={20}
            animateRows
            loading={loading}
            onRowDoubleClicked={(e) => navigate(`/quotation/view/${e.data.QuotationNumber}`)}
            getRowStyle={(p) => (p.data?.WorkflowStatus === 'CANCELLED' ? { opacity: 0.62 } : undefined)}
          />
        </div>
      </MainCard>

      <PdfPreviewDialog
        open={preview.open}
        onClose={closePreview}
        url={preview.url}
        filename={preview.filename}
        loading={preview.loading}
        error={preview.error}
      />
    </Box>
  );
}
