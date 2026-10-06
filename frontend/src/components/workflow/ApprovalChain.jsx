import { Box, Typography, Tooltip } from '@mui/material';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import HourglassEmptyOutlinedIcon from '@mui/icons-material/HourglassEmptyOutlined';
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded';
import RemoveRoundedIcon from '@mui/icons-material/RemoveRounded';
import { fmtDate } from './format';

// Approved · Pending · Rejected · Not required — one row per level.
const STYLE = {
  SUBMITTED: { Icon: CheckRoundedIcon, color: 'primary.main', bg: 'primary.light', label: 'Requested' },
  APPROVED: { Icon: CheckRoundedIcon, color: 'success.dark', bg: 'success.light', label: 'Approved' },
  PENDING: { Icon: HourglassEmptyOutlinedIcon, color: 'warning.dark', bg: 'warning.light', label: 'Pending' },
  REJECTED: { Icon: CloseRoundedIcon, color: 'error.dark', bg: 'error.light', label: 'Rejected' },
  WAITING: { Icon: MoreHorizRoundedIcon, color: 'text.secondary', bg: 'grey.200', label: 'Next' },
  NOT_REQUIRED: { Icon: null, color: 'grey.500', bg: 'transparent', label: 'Not required' },
  SKIPPED: { Icon: null, color: 'grey.500', bg: 'transparent', label: 'Not required' },
  CANCELLED: { Icon: RemoveRoundedIcon, color: 'grey.500', bg: 'transparent', label: 'Cancelled' }
};

export default function ApprovalChain({ ladder = [], dense }) {
  const size = dense ? 22 : 26;
  return (
    <Box role="list" aria-label="Approval chain">
      {ladder.map((step, i) => {
        const st = STYLE[step.Status] || STYLE.WAITING;
        const faded = step.Status === 'NOT_REQUIRED' || step.Status === 'SKIPPED' || step.Status === 'CANCELLED';
        const { Icon } = st;
        return (
          <Box key={`${step.Role}-${i}`} role="listitem" sx={{ display: 'flex', gap: 1.25, opacity: faded ? 0.6 : 1 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Box
                aria-hidden
                sx={{
                  width: size, height: size, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center',
                  color: st.color, bgcolor: st.bg, border: '1.5px solid', borderColor: faded ? 'grey.300' : st.color
                }}
              >
                {Icon && <Icon sx={{ fontSize: dense ? 13 : 15 }} />}
              </Box>
              {i < ladder.length - 1 && <Box sx={{ width: 1.5, flex: 1, minHeight: dense ? 8 : 14, bgcolor: 'divider' }} />}
            </Box>
            <Box sx={{ pb: i < ladder.length - 1 ? (dense ? 0.75 : 1.25) : 0, minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.6 }}>
                {step.Role}
                {step.Name && <Typography component="span" variant="body2" color="text.secondary"> · {step.Name}</Typography>}
              </Typography>
              <Typography variant="caption" sx={{ color: st.color, fontWeight: 600 }}>
                {st.label}
                {step.ActedAt && step.Status !== 'SUBMITTED' && (
                  <Typography component="span" variant="caption" color="text.secondary"> · {fmtDate(step.ActedAt)}</Typography>
                )}
              </Typography>
              {step.Note && !dense && (
                <Tooltip title={step.ActedBy ? `by ${step.ActedBy}` : ''}>
                  <Typography variant="body2" sx={{ mt: 0.25, color: 'text.secondary', fontStyle: 'italic', overflowWrap: 'anywhere' }}>
                    “{step.Note}”
                  </Typography>
                </Tooltip>
              )}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
