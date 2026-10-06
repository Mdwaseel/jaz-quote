import { useState } from 'react';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { Typography, Button, Box, Link, Alert } from '@mui/material';
import MarkEmailReadOutlinedIcon from '@mui/icons-material/MarkEmailReadOutlined';
import AuthCard from './AuthCard';
import axios from '../../api/axios';
import { Endpoints } from '../../api/endpoints';

export default function CheckMail() {
  const { state } = useLocation();
  const email = state?.email || '';
  const [resent, setResent] = useState(false);
  const [busy, setBusy] = useState(false);

  const resend = async () => {
    if (!email) return;
    setBusy(true);
    try {
      await axios.post(Endpoints.ForgotPassword, { email });
      setResent(true);
    } catch {
      /* generic response either way */
      setResent(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard>
      <Box sx={{ textAlign: 'center' }}>
        <MarkEmailReadOutlinedIcon sx={{ fontSize: 64, color: 'primary.main', mb: 1 }} />
        <Typography variant="h2" sx={{ mb: 1 }}>
          Check your Mail
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {email
            ? <>We&apos;ve sent a password reset link to <b>{email}</b>. Open it to choose a new password. The link expires in 30 minutes.</>
            : <>We&apos;ve sent a password reset link to your email. Open it to choose a new password.</>}
        </Typography>
        {resent && (
          <Alert severity="success" sx={{ mb: 2, textAlign: 'left' }} onClose={() => setResent(false)}>
            Reset link sent again.
          </Alert>
        )}
        <Button component={RouterLink} to="/login" fullWidth variant="contained" size="large" sx={{ py: 1.2 }}>
          Back to Login
        </Button>
        {email && (
          <Box sx={{ mt: 2 }}>
            <Link component="button" type="button" variant="body2" underline="hover" disabled={busy} onClick={resend}>
              Didn&apos;t get it? Resend link
            </Link>
          </Box>
        )}
      </Box>
    </AuthCard>
  );
}
