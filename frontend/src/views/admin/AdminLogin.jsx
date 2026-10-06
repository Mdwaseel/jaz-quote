import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Typography, TextField, InputAdornment, IconButton,
  Button, Alert, CircularProgress
} from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import AdminPanelSettingsOutlinedIcon from '@mui/icons-material/AdminPanelSettingsOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import MarkEmailReadOutlinedIcon from '@mui/icons-material/MarkEmailReadOutlined';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { login, verifyOtp, resendOtp, logout } from '../../store/slices/authSlice';
import { isAdmin } from '../../utils/roles';
import CinemaBackdrop from '../../components/CinemaBackdrop';

export default function AdminLogin() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [step, setStep] = useState('credentials'); // 'credentials' | 'otp'
  const [maskedEmail, setMaskedEmail] = useState('');
  const [otp, setOtp] = useState('');

  const finishAdmin = (profile) => {
    if (isAdmin(profile)) {
      navigate('/admin');
    } else {
      setError('This account does not have admin access.');
      dispatch(logout());
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const res = await dispatch(login({ email, password }));
    setLoading(false);
    if (login.fulfilled.match(res)) {
      if (res.payload.otpRequired) {
        setMaskedEmail(res.payload.maskedEmail || email);
        setStep('otp');
      } else {
        finishAdmin(res.payload.userProfile);
      }
    } else {
      setError(res.payload || 'Invalid credentials.');
    }
  };

  const submitOtp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const res = await dispatch(verifyOtp({ email, otp }));
    setLoading(false);
    if (verifyOtp.fulfilled.match(res)) {
      finishAdmin(res.payload);
    } else {
      setError(res.payload || 'Invalid or expired code.');
    }
  };

  const backToCredentials = () => {
    setError('');
    setOtp('');
    setStep('credentials');
  };

  return (
    <CinemaBackdrop badge="ADMIN PANEL">
      <Card sx={{ width: '100%', maxWidth: 440, border: 'none', boxShadow: '0 30px 70px -24px rgba(0,0,0,.7)' }}>
        <CardContent sx={{ p: { xs: 3, sm: 4.5 } }}>
          {step === 'credentials' ? (
            <>
              <Box sx={{ textAlign: 'center', mb: 3 }}>
                <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, color: 'primary.dark' }}>
                  <AdminPanelSettingsOutlinedIcon />
                  <Typography variant="h2">Admin Panel</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  Manage products, prices, packages &amp; quotations
                </Typography>
              </Box>

              {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

              <Box component="form" onSubmit={submit}>
                <TextField fullWidth label="Email Address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required margin="normal" />
                <TextField
                  fullWidth label="Password" type={showPw ? 'text' : 'password'} value={password}
                  onChange={(e) => setPassword(e.target.value)} required margin="normal"
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => setShowPw((v) => !v)} edge="end">{showPw ? <Visibility /> : <VisibilityOff />}</IconButton>
                      </InputAdornment>
                    )
                  }}
                />
                <Button type="submit" fullWidth variant="contained" size="large" disabled={loading} sx={{ mt: 2, py: 1.2 }}>
                  {loading ? <CircularProgress size={24} color="inherit" /> : 'Sign In to Admin'}
                </Button>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.6, mt: 2.5, color: 'text.secondary' }}>
                <LockOutlinedIcon sx={{ fontSize: 14 }} />
                <Typography variant="caption">Restricted to administrators</Typography>
              </Box>
            </>
          ) : (
            <>
              <Box sx={{ textAlign: 'center', mb: 3 }}>
                <Box sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 56, height: 56, borderRadius: '50%', bgcolor: 'secondary.light', color: 'secondary.dark', mb: 1.5 }}>
                  <MarkEmailReadOutlinedIcon />
                </Box>
                <Typography variant="h2">Verify it&apos;s you</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  Enter the 6-digit code sent to {maskedEmail}
                </Typography>
              </Box>

              {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

              <Box component="form" onSubmit={submitOtp}>
                <TextField
                  fullWidth label="Verification code" value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  required autoFocus margin="normal"
                  inputProps={{ inputMode: 'numeric', maxLength: 6, style: { letterSpacing: '0.5em', fontSize: '1.3rem', textAlign: 'center' } }}
                  placeholder="••••••"
                />
                <Button type="submit" fullWidth variant="contained" size="large" disabled={loading || otp.length < 6} sx={{ mt: 2, py: 1.2 }}>
                  {loading ? <CircularProgress size={24} color="inherit" /> : 'Verify & Continue'}
                </Button>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
                <Button startIcon={<ArrowBackIcon />} onClick={backToCredentials} size="small" sx={{ color: 'text.secondary' }}>
                  Back
                </Button>
                <Button size="small" onClick={() => dispatch(resendOtp({ email }))} sx={{ color: 'text.secondary' }}>
                  Resend code
                </Button>
              </Box>
            </>
          )}
        </CardContent>
      </Card>
    </CinemaBackdrop>
  );
}
