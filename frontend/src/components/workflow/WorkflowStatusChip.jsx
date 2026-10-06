import { Chip } from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import { STATUS_META, REQUEST_STATUS_META } from './format';

// Same outlined chip style the quotation list has always used for statuses.
export default function WorkflowStatusChip({ status, locked, size = 'small' }) {
  const meta = STATUS_META[status] || { label: status || '—', color: 'default' };
  return (
    <Chip
      size={size}
      label={meta.label}
      color={meta.color}
      variant="outlined"
      icon={locked ? <LockOutlinedIcon sx={{ fontSize: '14px !important' }} /> : undefined}
    />
  );
}

// Status of a single approval request (Pending / Approved / Rejected / Superseded).
export function RequestStatusChip({ status }) {
  const meta = REQUEST_STATUS_META[status] || REQUEST_STATUS_META.PENDING;
  return <Chip size="small" label={meta.label} color={meta.color} variant="outlined" />;
}

// Discount above the company limit (35%) — always shown in the error colour.
export function OutsideLimitChip({ label = 'Outside company limit' }) {
  return (
    <Chip size="small" color="error" variant="outlined" label={label}
      icon={<WarningAmberOutlinedIcon sx={{ fontSize: '15px !important' }} />} />
  );
}
