import { Card, Box, Typography, Chip, Button, Stack, Divider, Grid, Alert } from '@mui/material';
import FinancialSummary from '../../components/workflow/FinancialSummary';
import ApprovalChain from '../../components/workflow/ApprovalChain';
import WorkflowStatusChip, { RequestStatusChip, OutsideLimitChip } from '../../components/workflow/WorkflowStatusChip';
import { describeValue, fmtDate } from '../../components/workflow/format';

const Field = ({ label, children }) => (
  <Box sx={{ mb: 1.25 }}>
    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
      {label}
    </Typography>
    <Typography variant="body2" component="div" sx={{ fontWeight: 500, overflowWrap: 'anywhere' }}>{children}</Typography>
  </Box>
);

export default function ApprovalCard({ req, onView, onAct, onReassign }) {
  const q = req.Quotation || {};
  const hierarchy = (q.Hierarchy || []).filter((h) => h.name).map((h) => `${h.role}: ${h.name}`).join(' → ');
  const pendingStep = (req.Steps || []).find((s) => s.Status === 'PENDING');
  const inactiveApprover = pendingStep && pendingStep.AssignedTo && !pendingStep.AssignedTo.Active;

  return (
    <Card sx={{ p: { xs: 2, md: 2.5 } }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1, flexWrap: 'wrap', mb: 1.5 }}>
        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap', rowGap: 0.5 }}>
            <Typography variant="h4" sx={{ fontVariantNumeric: 'tabular-nums' }}>{q.QuotationNumber}</Typography>
            <Chip size="small" label={req.CategoryLabel} color="primary" />
            <RequestStatusChip status={req.Status} />
            {req.OutsideLimit && <OutsideLimitChip />}
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, overflowWrap: 'anywhere' }}>
            {q.CustomerName} · {q.Package}{q.Room ? ` · ${q.Room}` : ''} · v{req.VersionNumber}
          </Typography>
        </Box>
        <WorkflowStatusChip status={q.WorkflowStatus} />
      </Box>

      {inactiveApprover && (
        <Alert severity="warning" sx={{ mb: 1.5 }}>
          The assigned approver ({pendingStep.AssignedTo.Name}) is deactivated — reassign this approval.
        </Alert>
      )}

      <Grid container spacing={2.5}>
        <Grid item xs={12} md={5}>
          <Field label="Created by">
            {q.CreatedBy?.Name} <Typography component="span" variant="body2" color="text.secondary">({q.CreatedByRole})</Typography>
          </Field>
          {hierarchy && <Field label="Reporting hierarchy">{hierarchy}</Field>}
          <Field label="Requested change">
            <Box component="span" sx={{ color: 'text.secondary', textDecoration: 'line-through', mr: 0.75 }}>
              {describeValue(req.Category, req.ExistingValue)}
            </Box>
            <Box component="span" sx={{ color: req.OutsideLimit ? 'error.main' : 'text.primary', fontWeight: 700 }}>
              {describeValue(req.Category, req.RequestedValue)}
            </Box>
          </Field>
          {req.ApprovedValue && (
            <Field label="Approved value">{describeValue(req.Category, req.ApprovedValue)}</Field>
          )}
          <Field label="Reason">“{req.Reason || '—'}”</Field>
          <Field label="Requested">{req.RequestedBy?.Name} · {fmtDate(req.CreatedAt)}</Field>
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <Box sx={{ p: 1.75, borderRadius: 1, bgcolor: 'background.default', border: '1px solid', borderColor: 'divider' }}>
            <FinancialSummary f={q.Financials} outsideLimit={req.OutsideLimit} compact />
          </Box>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Approval chain
          </Typography>
          <Box sx={{ mt: 0.75 }}><ApprovalChain ladder={req.Ladder} dense /></Box>
        </Grid>
      </Grid>

      <Divider sx={{ my: 1.75 }} />
      <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ flexWrap: 'wrap', rowGap: 1 }}>
        <Button onClick={() => onView(q.QuotationNumber)}>View quote</Button>
        {onReassign && req.Status === 'PENDING' && pendingStep && (
          <Button variant="outlined" onClick={() => onReassign(req, pendingStep)}>Reassign</Button>
        )}
        {req.CanAct && (
          <>
            <Button variant="outlined" color="error" onClick={() => onAct(req, 'reject')}>Reject</Button>
            <Button variant="contained" color="success" onClick={() => onAct(req, 'approve')}>Approve</Button>
          </>
        )}
      </Stack>
    </Card>
  );
}
