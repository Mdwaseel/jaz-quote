import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  Typography,
  TextField,
  InputAdornment,
  IconButton,
  Button,
  Box,
  Alert,
  Link,
  CircularProgress,
  FormControlLabel,
  Checkbox
} from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import MarkEmailReadOutlinedIcon from '@mui/icons-material/MarkEmailReadOutlined';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AuthCard from './AuthCard';
import { login, verifyOtp, resendOtp, clearError } from '../../store/slices/authSlice';

export default function Login() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading, error } = useSelector((s) => s.auth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);

  const [step, setStep] = useState('credentials'); // 'credentials' | 'otp'
  const [maskedEmail, setMaskedEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [resent, setResent] = useState(false);

  const submitCredentials = async (e) => {
    e.preventDefault();
    const res = await dispatch(login({ email, password }));
    if (login.fulfilled.match(res)) {
      if (res.payload.otpRequired) {
        setMaskedEmail(res.payload.maskedEmail || email);
        setStep('otp');
      } else {
        navigate('/sales-dashboard');
      }
    }
  };

  const submitOtp = async (e) => {
    e.preventDefault();
    const res = await dispatch(verifyOtp({ email, otp }));
    if (verifyOtp.fulfilled.match(res)) navigate('/sales-dashboard');
  };

  const handleResend = async () => {
    setResent(false);
    const res = await dispatch(resendOtp({ email }));
    if (resendOtp.fulfilled.match(res)) setResent(true);
  };

  const backToCredentials = () => {
    dispatch(clearError());
    setOtp('');
    setResent(false);
    setStep('credentials');
  };

  return (
    <AuthCard>
      {step === 'credentials' ? (
        <>
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Typography variant="h2" sx={{ mb: 0.5 }}>
              Welcome back
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Sign in to build and track your cinema quotations
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => dispatch(clearError())}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={submitCredentials}>
            <TextField
              fullWidth
              label="Email Address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              margin="normal"
            />
            <TextField
              fullWidth
              label="Password"
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              margin="normal"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPw((v) => !v)} edge="end">
                      {showPw ? <Visibility /> : <VisibilityOff />}
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
              <FormControlLabel control={<Checkbox defaultChecked size="small" />} label={<Typography variant="body2">Keep me logged in</Typography>} />
              <Link component={RouterLink} to="/forgot" variant="body2" underline="hover">
                Forgot Password?
              </Link>
            </Box>

            <Button type="submit" fullWidth variant="contained" size="large" disabled={loading} sx={{ mt: 2, py: 1.2 }}>
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Sign In'}
            </Button>
          </Box>
        </>
      ) : (
        <>
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Box sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 56, height: 56, borderRadius: '50%', bgcolor: 'secondary.light', color: 'secondary.dark', mb: 1.5 }}>
              <MarkEmailReadOutlinedIcon />
            </Box>
            <Typography variant="h2" sx={{ mb: 0.5 }}>
              Verify it&apos;s you
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Enter the 6-digit code sent to {maskedEmail}
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => dispatch(clearError())}>
              {error}
            </Alert>
          )}
          {resent && !error && (
            <Alert severity="success" sx={{ mb: 2 }} onClose={() => setResent(false)}>
              A new code has been sent.
            </Alert>
          )}

          <Box component="form" onSubmit={submitOtp}>
            <TextField
              fullWidth
              label="Verification code"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              required
              autoFocus
              margin="normal"
              inputProps={{ inputMode: 'numeric', maxLength: 6, style: { letterSpacing: '0.5em', fontSize: '1.3rem', textAlign: 'center' } }}
              placeholder="••••••"
            />

            <Button type="submit" fullWidth variant="contained" size="large" disabled={loading || otp.length < 6} sx={{ mt: 2, py: 1.2 }}>
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Verify & Sign In'}
            </Button>
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
            <Button startIcon={<ArrowBackIcon />} onClick={backToCredentials} size="small" sx={{ color: 'text.secondary' }}>
              Back
            </Button>
            <Link component="button" type="button" variant="body2" underline="hover" onClick={handleResend} disabled={loading}>
              Resend code
            </Link>
          </Box>
        </>
      )}
    </AuthCard>
  );
}
