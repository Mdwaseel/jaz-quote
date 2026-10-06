import { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { Typography, TextField, Button, Box, Link, Alert, CircularProgress } from '@mui/material';
import AuthCard from './AuthCard';
import axios from '../../api/axios';
import { Endpoints } from '../../api/endpoints';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await axios.post(Endpoints.ForgotPassword, { email });
      navigate('/check-mail', { state: { email } });
    } catch (err) {
      setError(err.response?.data?.message || 'Could not send the reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard>
      <Box sx={{ textAlign: 'center', mb: 3 }}>
        <Typography variant="h2" sx={{ mb: 0.5 }}>
          Forgot Password?
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Enter your email address and we&apos;ll send you a reset link
        </Typography>
      </Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      <Box component="form" onSubmit={submit}>
        <TextField fullWidth label="Email Address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required margin="normal" />
        <Button type="submit" fullWidth variant="contained" size="large" disabled={loading} sx={{ mt: 2, py: 1.2 }}>
          {loading ? <CircularProgress size={24} color="inherit" /> : 'Send Reset Link'}
        </Button>
      </Box>
      <Box sx={{ textAlign: 'center', mt: 2 }}>
        <Link component={RouterLink} to="/login" variant="body2" underline="hover">
          Back to Login
        </Link>
      </Box>
    </AuthCard>
  );
}
