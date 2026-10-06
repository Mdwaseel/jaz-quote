import { useState } from 'react';
import { useNavigate, useSearchParams, Link as RouterLink } from 'react-router-dom';
import { Typography, TextField, Button, Box, Alert, Link, CircularProgress } from '@mui/material';
import AuthCard from './AuthCard';
import axios from '../../api/axios';
import { Endpoints } from '../../api/endpoints';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const email = params.get('email') || '';

  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState('');
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(false);

  const invalidLink = !token || !email;

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (pw.length < 8) {
      setErr('Password must be at least 8 characters.');
      return;
    }
    if (pw !== confirm) {
      setErr('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await axios.post(Endpoints.ResetPassword, { email, token, password: pw });
      setOk(true);
      setTimeout(() => navigate('/login'), 1800);
    } catch (error) {
      setErr(error.response?.data?.message || 'This reset link is invalid or has expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard>
      <Box sx={{ textAlign: 'center', mb: 3 }}>
        <Typography variant="h2" sx={{ mb: 0.5 }}>
          Reset Password
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {invalidLink ? 'This reset link is incomplete' : 'Choose a new password for your account'}
        </Typography>
      </Box>

      {ok ? (
        <Alert severity="success" sx={{ mb: 2 }}>
          Password updated. Redirecting you to sign in…
        </Alert>
      ) : invalidLink ? (
        <>
          <Alert severity="error" sx={{ mb: 2 }}>
            The reset link is missing or invalid. Please request a new one.
          </Alert>
          <Button component={RouterLink} to="/forgot" fullWidth variant="contained" size="large" sx={{ py: 1.2 }}>
            Request a new link
          </Button>
        </>
      ) : (
        <>
          {err && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr('')}>
              {err}
            </Alert>
          )}
          <Box component="form" onSubmit={submit}>
            <TextField fullWidth label="New Password" type="password" value={pw} onChange={(e) => setPw(e.target.value)} required margin="normal" helperText="At least 8 characters" />
            <TextField fullWidth label="Confirm Password" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required margin="normal" />
            <Button type="submit" fullWidth variant="contained" size="large" disabled={loading} sx={{ mt: 2, py: 1.2 }}>
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Change Password'}
            </Button>
          </Box>
          <Box sx={{ textAlign: 'center', mt: 2 }}>
            <Link component={RouterLink} to="/login" variant="body2" underline="hover">
              Back to Login
            </Link>
          </Box>
        </>
      )}
    </AuthCard>
  );
}
