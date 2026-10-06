import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import {
  Box, Grid, Card, Typography, Button, Stack, Alert, Tabs, Tab, Table, TableBody, TableRow, TableCell,
  CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Snackbar, Chip, Divider, Tooltip
} from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined';
import RestoreOutlinedIcon from '@mui/icons-material/RestoreOutlined';
import PageHeader from '../../components/PageHeader';
import MainCard from '../../components/MainCard';
import PdfPreviewDialog from '../../components/PdfPreviewDialog';
import CustomerSignatureCard from './CustomerSignatureCard';
import DealOutcomeCard from './DealOutcomeCard';
import BoqTable from './BoqTable';
import { CancelQuoteDialog, RestoreQuoteDialog } from './CancelQuoteDialog';
import FinancialSummary from '../../components/workflow/FinancialSummary';
import ApprovalChain from '../../components/workflow/ApprovalChain';
import WorkflowStatusChip, { RequestStatusChip, OutsideLimitChip } from '../../components/workflow/WorkflowStatusChip';
import ApprovalActionDialog from '../../components/workflow/ApprovalActionDialog';
import { describeValue, fmtDate, inr, pct } from '../../components/workflow/format';
import {
  getQuote, getHistory, requestEdit, downloadQuotePdf, errMsg
} from '../../api/workflow';
import { fetchCounts } from '../../store/slices/approvalSlice';

const KV = ({ rows }) => (
  <Table size="small">
    <TableBody>
      {rows.map(([k, v]) => (
        <TableRow key={k}>
          <TableCell sx={{ border: 0, py: 0.5, pl: 0, color: 'text.secondary', width: '44%' }}>{k}</TableCell>
          <TableCell sx={{ border: 0, py: 0.5, fontWeight: 500, overflowWrap: 'anywhere' }}>{v || '—'}</TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
);

// Same card shell as the rest of the app (h3 header + divider).
const Section = ({ title, children, action }) => (
  <MainCard title={title} secondary={action} sx={{ mb: 2.5 }}>
    {children}
  </MainCard>
);

export default function QuoteView() {
  const { number } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [q, setQ] = useState(null);
  const [history, setHistory] = useState(null);
  const [tab, setTab] = useState('overview');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [editReq, setEditReq] = useState({ open: false, reason: '', changes: '', busy: false, error: '' });
  const [act, setAct] = useState({ open: false, req: null, action: 'approve' });
  const [pdf, setPdf] = useState({ open: false, url: '', filename: '', loading: false, error: '' });
  const [cancelOpen, setCancelOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await getQuote(number);
      if (!data) { setError('Quotation not found or you do not have access to it.'); return; }
      setQ(data);
      setHistory(await getHistory(number));
    } catch (e) {
      setError(errMsg(e, 'Could not load the quotation.'));
    }
  }, [number]);

  useEffect(() => { load(); }, [load]);

  if (error) return <Box><PageHeader title="Quotation" crumbs={['Quotation', number]} /><Alert severity="error">{error}</Alert></Box>;
  if (!q) return <Box sx={{ py: 10, textAlign: 'center' }}><CircularProgress /></Box>;

  const wf = q.Workflow;
  const perm = wf.Permissions;
  const p = q.ProductInfo || {};
  const s = q.SalesInfo || {};
  const fieldApprovals = wf.Approvals.filter((a) => a.Category !== 'EDIT');
  const editApprovals = wf.Approvals.filter((a) => a.Category === 'EDIT');
  const outside = fieldApprovals.some((a) => a.OutsideLimit && a.Status === 'PENDING');

  const doDownload = async () => {
    setPdf({ open: true, url: '', filename: '', loading: true, error: '' });
    try {
      const { url, filename } = await downloadQuotePdf(number);
      setPdf({ open: true, url, filename, loading: false, error: '' });
      load();
    } catch (e) {
      setPdf({ open: true, url: '', filename: '', loading: false, error: e.message });
    }
  };

  const submitEditRequest = async () => {
    setEditReq((r) => ({ ...r, busy: true, error: '' }));
    try {
      await requestEdit(number, editReq.reason.trim(), editReq.changes.trim());
      setEditReq({ open: false, reason: '', changes: '', busy: false, error: '' });
      setToast('Edit request sent to your RM');
      load();
    } catch (e) {
      setEditReq((r) => ({ ...r, busy: false, error: errMsg(e, 'Could not send the request.') }));
    }
  };

  const banner = (() => {
    if (wf.WorkflowStatus === 'CANCELLED') {
      const c = wf.Cancellation || {};
      return (
        <Alert severity="error" icon={<BlockOutlinedIcon />}
          action={perm.canRestore && (
            <Button color="inherit" size="small" startIcon={<RestoreOutlinedIcon />} onClick={() => setRestoreOpen(true)}>Restore</Button>
          )}>
          <b>Cancelled</b>{c.By ? ` by ${c.By}` : ''}{c.At ? ` on ${fmtDate(c.At)}` : ''}{c.Reason ? ` — ${c.Reason}` : ''}.
          {c.Note && <Box component="span" sx={{ display: 'block', mt: 0.5, fontStyle: 'italic' }}>“{c.Note}”</Box>}
          <Box component="span" sx={{ display: 'block', mt: 0.5 }}>
            The quotation is kept for reference{perm.canRestore ? ' and can be restored.' : '. A manager or Admin can restore it.'}
          </Box>
        </Alert>
      );
    }
    if (wf.WorkflowStatus === 'EDITING') {
      return <Alert icon={<EditOutlinedIcon />} severity="info">Editing enabled — your RM approved a modification. Re-submit to lock the quotation again; approvals will be re-evaluated.</Alert>;
    }
    if (wf.WorkflowStatus === 'EDIT_REQUESTED') {
      return <Alert icon={<LockOutlinedIcon />} severity="warning">Locked — edit request awaiting RM approval.</Alert>;
    }
    if (wf.WorkflowStatus === 'REJECTED') {
      return <Alert severity="error">Approval rejected. {perm.canEdit ? 'Revise the quotation and re-submit it.' : 'The quotation remains blocked.'}</Alert>;
    }
    if (!perm.canDownload && wf.WorkflowStatus !== 'DRAFT' && wf.WorkflowStatus !== 'CANCELLED') {
      return <Alert icon={<LockOutlinedIcon />} severity="warning"><b>Approval required.</b> {perm.downloadBlockedReason}</Alert>;
    }
    if (wf.IsLocked) {
      return <Alert icon={<LockOutlinedIcon />} severity="success">Locked — all approvals complete. This version can be downloaded.</Alert>;
    }
    return null;
  })();

  return (
    <Box>
      <PageHeader
        title={`Quotation ${number}`}
        crumbs={['Quotation', number]}
        action={
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
            {perm.canEdit && (
              <Button variant="outlined" startIcon={<EditOutlinedIcon />} onClick={() => navigate(`/quotation/edit/${number}`)}>
                {wf.WorkflowStatus === 'DRAFT' ? 'Continue draft' : 'Edit'}
              </Button>
            )}
            {perm.canRequestEdit && (
              <Button variant="outlined" onClick={() => setEditReq((r) => ({ ...r, open: true }))}>Request edit</Button>
            )}
            <Tooltip title={perm.canDownload ? '' : perm.downloadBlockedReason}>
              <span>
                <Button variant="contained" startIcon={perm.canDownload ? <FileDownloadOutlinedIcon /> : <LockOutlinedIcon />}
                  disabled={!perm.canDownload} onClick={doDownload}>
                  Download
                </Button>
              </span>
            </Tooltip>
          </Stack>
        }
      />

      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2, flexWrap: 'wrap', rowGap: 1 }}>
        <WorkflowStatusChip status={wf.WorkflowStatus} locked={wf.IsLocked} size="medium" />
        <Chip label={`Version ${wf.CurrentVersion || '—'}`} variant="outlined" />
        {q.Status === 'Confirmed' && <Chip label="Customer confirmed" color="success" variant="outlined" />}
        <Typography variant="body2" color="text.secondary">
          by {wf.CreatedBy?.Name} ({wf.CreatedByRole}) · {fmtDate(q.CreatedAt)}
        </Typography>
      </Stack>
      {banner && <Box sx={{ mb: 2.5 }}>{banner}</Box>}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2.5 }}>
        <Tab value="overview" label="Overview" />
        <Tab value="history" label={`History${history ? ` (${history.Events.length})` : ''}`} />
        <Tab value="versions" label={`Versions${history ? ` (${history.Versions.length})` : ''}`} />
      </Tabs>

      {tab === 'overview' && (
        <Grid container spacing={2.5}>
          <Grid item xs={12} md={5} lg={4}>
            <Section title="Quotation value">
              <FinancialSummary f={wf.Financials} outsideLimit={outside} />
              {Object.keys(wf.Financials.AmcAnnual || {}).length > 0 && (
                <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 1 }}>
                  AMC from year 2: {Object.entries(wf.Financials.AmcAnnual).map(([k, v]) => `${k} ${inr(v)}/yr`).join(' · ')}
                </Typography>
              )}
            </Section>
            <Section title="Terms">
              <KV rows={[
                ['Total discount vs list', pct(q.DiscountPercent)],
                ...(q.WarrentyDetails || []).map((w) => [`Warranty — ${w.TypeOfParts}`, `${w.Duration} yr`]),
                ...(q.Amc || []).map((a) => [`AMC — ${a.AmcType}`, `${a.Duration}%`])
              ]} />
              <Divider sx={{ my: 1 }} />
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Payment terms</Typography>
              <KV rows={(q.PaymentTerms || []).map((t) => [t.TermName, `${t.TermValue}%`])} />
            </Section>
            <DealOutcomeCard quote={q} canWin={perm.canDownload} onChanged={load} toast={setToast} />
            {wf.Hierarchy?.length > 0 && (
              <Section title="Reporting hierarchy">
                <KV rows={wf.Hierarchy.map((h) => [h.role, h.name])} />
              </Section>
            )}
            {perm.canCancel && (
              <Stack direction="row" spacing={1}>
                <Button color="error" startIcon={<BlockOutlinedIcon />} onClick={() => setCancelOpen(true)}>Cancel quotation</Button>
              </Stack>
            )}
          </Grid>

          <Grid item xs={12} md={7} lg={8}>
            <Section title="Approvals">
              {fieldApprovals.length === 0 && editApprovals.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  {wf.WorkflowStatus === 'DRAFT' ? 'Approvals are evaluated when the draft is submitted.' : 'No approval was required — every value is within the creator’s authority.'}
                </Typography>
              ) : (
                <Grid container spacing={2}>
                  {[...editApprovals, ...fieldApprovals].map((a) => (
                    <Grid item xs={12} sm={6} key={a.Id}>
                      <Box sx={{ p: 1.75, border: '1px solid', borderColor: a.OutsideLimit ? 'error.main' : 'divider', borderRadius: 1, height: '100%' }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                          <Typography variant="subtitle1">{a.CategoryLabel}</Typography>
                          <RequestStatusChip status={a.Status} />
                        </Stack>
                        <Typography variant="body2" sx={{ mb: 0.5 }}>
                          <Box component="span" sx={{ color: 'text.secondary' }}>Requested: </Box>
                          <Box component="span" sx={{ fontWeight: 650, color: a.OutsideLimit ? 'error.main' : 'inherit' }}>
                            {describeValue(a.Category, a.RequestedValue)}
                          </Box>
                        </Typography>
                        {a.ApprovedValue && (
                          <Typography variant="body2" sx={{ mb: 0.5 }}>
                            <Box component="span" sx={{ color: 'text.secondary' }}>Approved: </Box>
                            <b>{describeValue(a.Category, a.ApprovedValue)}</b>
                          </Typography>
                        )}
                        {a.OutsideLimit && <Box sx={{ mb: 0.75 }}><OutsideLimitChip /></Box>}
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.25, fontStyle: 'italic' }}>“{a.Reason}”</Typography>
                        <ApprovalChain ladder={a.Ladder} dense />
                        {a.CanAct && (
                          <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                            <Button size="small" variant="outlined" color="error" onClick={() => setAct({ open: true, req: { ...a, Quotation: { QuotationNumber: number, CustomerName: q.CustomerName, Financials: wf.Financials } }, action: 'reject' })}>Reject</Button>
                            <Button size="small" variant="contained" color="success" onClick={() => setAct({ open: true, req: { ...a, Quotation: { QuotationNumber: number, CustomerName: q.CustomerName, Financials: wf.Financials } }, action: 'approve' })}>Approve</Button>
                          </Stack>
                        )}
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              )}
            </Section>

            <Grid container spacing={2.5}>
              <Grid item xs={12} lg={6}>
                <Section title="Customer">
                  <KV rows={[
                    ['Name', q.CustomerName], ['Mobile', q.CustomerMobile], ['Email', q.CustomerEmail],
                    ['Address', q.CustomerAddress], ['District / State', [q.CityName, q.StateName].filter(Boolean).join(', ')], ['Pincode', q.ZipCode]
                  ]} />
                </Section>
                <Section title="Sales">
                  <KV rows={[['Sales person', s.SalesBy], ['Timeline', s.DeliveryAt], ['Valid for', s.ValidityDays ? `${s.ValidityDays} days` : ''], ['Note', s.Remarks]]} />
                </Section>
                <CustomerSignatureCard quote={q} onChanged={load} toast={setToast} />
              </Grid>
              <Grid item xs={12} lg={6}>
                <Section title="Project">
                  <KV rows={[
                    ['Package', q.Package || p.Package], ['Configuration', q.Configuration || p.Configuration], ['Investment', p.Tier],
                    ['Room', p.Room], ['Project type', p.ProjectType],
                    ['Room size', [p.RoomLength, p.RoomWidth, p.RoomHeight].filter(Boolean).join(' × ') && `${[p.RoomLength, p.RoomWidth, p.RoomHeight].filter(Boolean).join(' × ')} ft`],
                    ['Seating', [p.Seats && `${p.Seats} seats`, p.Rows && `${p.Rows} rows`].filter(Boolean).join(' · ')],
                    ['Screen', p.Screen], ['Site stage', p.ConstructionStage]
                  ]} />
                </Section>
                {(p.Spec || []).length > 0 && (
                  <Section title="Specification">
                    <KV rows={(p.Spec || []).map((r) => [r.Label, r.Value])} />
                  </Section>
                )}
              </Grid>
            </Grid>
            <Section title={`Bill of quantities · ${(p.Items || []).filter((i) => !i.Optional).length} lines`}>
              <BoqTable items={p.Items || []} />
            </Section>
          </Grid>
        </Grid>
      )}

      {tab === 'history' && history && (
        <MainCard title="Activity">
          {history.Events.map((e, i) => (
            <Box key={e.Id} sx={{ display: 'flex', gap: 2 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Box sx={{ width: 10, height: 10, mt: 0.75, borderRadius: '50%', bgcolor: /Rejected/.test(e.Action) ? 'error.main' : /Approved|Ready|Carried/.test(e.Action) ? 'success.main' : 'primary.main' }} />
                {i < history.Events.length - 1 && <Box sx={{ width: 1.5, flex: 1, bgcolor: 'divider' }} />}
              </Box>
              <Box sx={{ pb: 2.25, minWidth: 0 }}>
                <Typography variant="subtitle2">{e.Action}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {e.Actor}{e.ActorRole && ` (${e.ActorRole})`} · {fmtDate(e.CreatedAt)} · v{e.Version}{e.Status && ` · ${e.Status.replaceAll('_', ' ').toLowerCase()}`}
                </Typography>
                {(e.PreviousValue != null || e.NewValue != null) && e.Field && (
                  <Typography variant="body2" sx={{ mt: 0.25, overflowWrap: 'anywhere' }}>
                    {e.PreviousValue != null && <><Box component="span" sx={{ color: 'text.secondary' }}>{describeValue(e.Field, e.PreviousValue)}</Box> → </>}
                    <b>{describeValue(e.Field, e.NewValue)}</b>
                  </Typography>
                )}
                {e.Note && <Typography variant="body2" sx={{ mt: 0.25, fontStyle: 'italic', color: 'text.secondary' }}>“{e.Note}”</Typography>}
              </Box>
            </Box>
          ))}
        </MainCard>
      )}

      {tab === 'versions' && history && (
        <Grid container spacing={2}>
          {[...history.Versions].reverse().map((v) => (
            <Grid item xs={12} sm={6} lg={4} key={v.Number}>
              <Card sx={{ p: 2.25, borderColor: v.IsApproved ? 'success.main' : 'divider' }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                  <Typography variant="h4">Version {v.Number}</Typography>
                  {v.IsApproved && <Chip size="small" color="success" label="Approved version" />}
                </Stack>
                <Typography variant="caption" color="text.secondary">{v.Note} · {v.CreatedBy} · {fmtDate(v.CreatedAt)}</Typography>
                <Box sx={{ mt: 1.5 }}><FinancialSummary f={v.Financials} compact /></Box>
              </Card>
            </Grid>
          ))}
          {history.Versions.length === 0 && (
            <Grid item xs={12}><Typography color="text.secondary">No submitted versions yet.</Typography></Grid>
          )}
        </Grid>
      )}

      <Dialog open={editReq.open} onClose={() => !editReq.busy && setEditReq((r) => ({ ...r, open: false }))} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Request quotation edit</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Submitted quotations are locked. Your RM{wf.Hierarchy?.find((h) => h.role === 'RM')?.name ? ` (${wf.Hierarchy.find((h) => h.role === 'RM').name})` : ''} must approve before you can make changes. After editing, approvals are re-evaluated.
          </Typography>
          {editReq.error && <Alert severity="error" sx={{ mb: 2 }}>{editReq.error}</Alert>}
          <TextField label="Reason" required fullWidth multiline minRows={2} sx={{ mb: 2 }} value={editReq.reason}
            placeholder="e.g. Customer wants to upgrade the projector and add two seats."
            onChange={(e) => setEditReq((r) => ({ ...r, reason: e.target.value }))} />
          <TextField label="Requested changes (optional)" fullWidth multiline minRows={2} value={editReq.changes}
            placeholder="e.g. Projector: Premium Value → High Performance; seats 6 → 8"
            onChange={(e) => setEditReq((r) => ({ ...r, changes: e.target.value }))} />
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setEditReq((r) => ({ ...r, open: false }))} disabled={editReq.busy}>Cancel</Button>
          <Button variant="contained" onClick={submitEditRequest} disabled={!editReq.reason.trim() || editReq.busy}>Submit edit request</Button>
        </DialogActions>
      </Dialog>

      <ApprovalActionDialog
        open={act.open} request={act.req} action={act.action}
        onClose={() => setAct((a) => ({ ...a, open: false }))}
        onDone={() => { setAct((a) => ({ ...a, open: false })); setToast('Decision recorded'); dispatch(fetchCounts()); load(); }}
      />

      <CancelQuoteDialog open={cancelOpen} number={number} reasons={wf.CancelReasons}
        onClose={() => setCancelOpen(false)}
        onDone={() => { setCancelOpen(false); setToast('Quotation cancelled — it is kept under Cancelled'); dispatch(fetchCounts()); load(); }} />
      <RestoreQuoteDialog open={restoreOpen} number={number}
        onClose={() => setRestoreOpen(false)}
        onDone={(res) => { setRestoreOpen(false); setToast(`Quotation restored — ${res.WorkflowLabel}`); load(); }} />

      <PdfPreviewDialog
        open={pdf.open} url={pdf.url} filename={pdf.filename} loading={pdf.loading} error={pdf.error}
        onClose={() => setPdf((x) => { if (x.url) URL.revokeObjectURL(x.url); return { ...x, open: false }; })}
      />

      <Snackbar open={!!toast} autoHideDuration={2500} onClose={() => setToast('')} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert severity="info" onClose={() => setToast('')}>{toast}</Alert>
      </Snackbar>
    </Box>
  );
}
