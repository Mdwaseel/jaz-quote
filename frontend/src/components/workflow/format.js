export const inr = (n) => '₹' + Math.round(Number(n || 0)).toLocaleString('en-IN');
export const pct = (n) => `${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}%`;
export const fmtDate = (iso) => (iso ? new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

export const STATUS_META = {
  DRAFT: { label: 'Draft', color: 'default' },
  PENDING_APPROVAL: { label: 'Pending Approval', color: 'warning' },
  PARTIALLY_APPROVED: { label: 'Partially Approved', color: 'warning' },
  APPROVED: { label: 'Ready for Download', color: 'success' },
  REJECTED: { label: 'Rejected', color: 'error' },
  EDIT_REQUESTED: { label: 'Edit Requested', color: 'secondary' },
  EDITING: { label: 'Editing', color: 'info' },
  DOWNLOADED: { label: 'Downloaded', color: 'success' },
  EXPIRED: { label: 'Expired', color: 'default' },
  CANCELLED: { label: 'Cancelled', color: 'error' }
};

export const REQUEST_STATUS_META = {
  PENDING: { label: 'Pending', color: 'warning' },
  APPROVED: { label: 'Approved', color: 'success' },
  REJECTED: { label: 'Rejected', color: 'error' },
  CANCELLED: { label: 'Superseded', color: 'default' }
};

export const CATEGORY_LABEL = {
  DISCOUNT: 'Discount', WARRANTY: 'Warranty', AMC: 'AMC', PAYMENT_TERMS: 'Payment Terms', EDIT: 'Quotation Edit'
};

// Human-readable value for an approval request's existing/requested/approved value.
export const describeValue = (category, v) => {
  if (v == null) return '—';
  if (category === 'DISCOUNT') return v.amount != null ? `${pct(v.percent)} (−${inr(v.amount)})` : pct(v.percent);
  if (category === 'WARRANTY') return Object.entries(v).map(([k, y]) => `${k}: ${y} yr`).join(' · ');
  if (category === 'AMC') return Object.entries(v).map(([k, r]) => `${k}: ${r}%`).join(' · ');
  if (category === 'PAYMENT_TERMS') return (v || []).map((t) => `${t.TermValue}% ${t.TermName}`).join(' · ');
  if (category === 'EDIT') return v.changes || v.status || '—';
  return typeof v === 'object' ? JSON.stringify(v) : String(v);
};
