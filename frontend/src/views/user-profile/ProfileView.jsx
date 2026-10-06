import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Grid,
  Card,
  CardContent,
  Avatar,
  Typography,
  Box,
  Divider,
  TextField,
  Button,
  Chip,
  Alert,
  Snackbar
} from '@mui/material';
import PageHeader from '../../components/PageHeader';
import MainCard from '../../components/MainCard';
import { fetchUserProfile, updateProfile, changePassword } from '../../store/slices/userSlice';

export default function ProfileView() {
  const dispatch = useDispatch();
  const authUser = useSelector((s) => s.auth.user);
  const profile = useSelector((s) => s.user.profile);
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [pw, setPw] = useState({ OldPassword: '', NewPassword: '' });
  const [toast, setToast] = useState('');

  useEffect(() => {
    dispatch(fetchUserProfile());
  }, [dispatch]);

  useEffect(() => {
    if (profile) {
      setName(profile.Name || '');
      setMobile(profile.Mobile || '');
    }
  }, [profile]);

  const saveInfo = async () => {
    await dispatch(updateProfile({ Name: name, Mobile: mobile }));
    setToast('Profile updated');
  };
  const savePw = async () => {
    const res = await dispatch(changePassword(pw));
    if (changePassword.fulfilled.match(res)) {
      setToast('Password changed');
      setPw({ OldPassword: '', NewPassword: '' });
    }
  };

  const initials = (authUser?.profileName || 'U').split(' ').map((w) => w[0]).slice(0, 2).join('');

  return (
    <Box>
      <PageHeader title="My Profile" crumbs={['User Profile', 'Profile']} />
      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Card sx={{ border: '1px solid', borderColor: 'divider', textAlign: 'center' }}>
            <CardContent sx={{ py: 4 }}>
              <Avatar sx={{ bgcolor: 'primary.main', width: 88, height: 88, mx: 'auto', fontSize: 32 }}>{initials}</Avatar>
              <Typography variant="h3" sx={{ mt: 2 }}>{authUser?.profileName}</Typography>
              <Typography variant="body2" color="text.secondary">{profile?.Email}</Typography>
              <Box sx={{ mt: 1 }}>
                {(authUser?.roles || []).map((r) => (<Chip key={r} label={r} size="small" color="primary" sx={{ mx: 0.3 }} />))}
              </Box>
              <Divider sx={{ my: 2 }} />
              <Box sx={{ textAlign: 'left', px: 2 }}>
                <Info label="Employee Code" value={authUser?.employeeCode} />
                <Info label="Franchise" value={authUser?.franchize} />
                <Info label="Branch" value={profile?.Branch} />
                <Info label="Reporting Manager" value={profile?.ReportingManager} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={8}>
          <MainCard title="Edit Personal Information" sx={{ mb: 3 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}><TextField fullWidth label="Name" value={name} onChange={(e) => setName(e.target.value)} /></Grid>
              <Grid item xs={12} sm={6}><TextField fullWidth label="Mobile" value={mobile} onChange={(e) => setMobile(e.target.value)} /></Grid>
              <Grid item xs={12}><Button variant="contained" onClick={saveInfo}>Save Changes</Button></Grid>
            </Grid>
          </MainCard>
          <MainCard title="Change Password">
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}><TextField fullWidth type="password" label="Current Password" value={pw.OldPassword} onChange={(e) => setPw((p) => ({ ...p, OldPassword: e.target.value }))} /></Grid>
              <Grid item xs={12} sm={6}><TextField fullWidth type="password" label="New Password" value={pw.NewPassword} onChange={(e) => setPw((p) => ({ ...p, NewPassword: e.target.value }))} /></Grid>
              <Grid item xs={12}><Button variant="contained" color="secondary" onClick={savePw}>Update Password</Button></Grid>
            </Grid>
          </MainCard>
        </Grid>
      </Grid>
      <Snackbar open={!!toast} autoHideDuration={2000} onClose={() => setToast('')}>
        <Alert severity="success">{toast}</Alert>
      </Snackbar>
    </Box>
  );
}

const Info = ({ label, value }) => (
  <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.6 }}>
    <Typography variant="body2" color="text.secondary">{label}</Typography>
    <Typography variant="body2" sx={{ fontWeight: 500 }}>{value || '—'}</Typography>
  </Box>
);
