import { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem, Stack, Alert, CircularProgress, Typography,
  Divider, InputAdornment, IconButton
} from '@mui/material';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import axios from '../../api/axios';
import { Endpoints } from '../../api/endpoints';
import { errMsg } from '../../api/workflow';

const LEVEL = { Admin: 1, Director: 2, RSD: 3, RM: 4, 'Sr. BDM': 5, BDM: 6 };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const Section = ({ children }) => (
  <Typography variant="overline" sx={{ color: 'text.secondary', fontWeight: 700, letterSpacing: 1, lineHeight: 1.6 }}>
    {children}
  </Typography>
);

// Edit everything about a user: personal details, role, reporting manager, franchise
// and (optionally) a new password. The API re-validates all of it.
export default function UserAssignmentDialog({ open, user, onClose, onSaved }) {
  const [refs, setRefs] = useState({ Roles: [], Managers: [], Franchises: [] });
  const [form, setForm] = useState({});
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !user) return;
    setError('');
    setShowPw(false);
    setForm({
      name: user.Name || '', email: user.Email || '', mobile: user.Mobile || '', employeeCode: user.EmployeeCode || '',
      role: user.Role || 'BDM', managerId: user.ManagerId || '', region: user.Region || '',
      franchiseId: user.FranchiseId || '', password: ''
    });
    axios.post(Endpoints.Admin_User_Refs, {}).then((r) => setRefs(r.data.data)).catch(() => {});
  }, [open, user]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const managers = (refs.Managers || []).filter((m) => m.Id !== user?.UserId && (LEVEL[m.Role] || 9) <= (LEVEL[form.role] || 9));
  const emailBad = !!form.email && !EMAIL_RE.test(form.email.trim());
  const pwBad = !!form.password && form.password.length < 8;
  const canSave = form.name?.trim() && form.email?.trim() && !emailBad && !pwBad && form.role;

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await axios.post(Endpoints.Admin_User_Update, {
        userId: user.UserId, name: form.name, email: form.email, mobile: form.mobile, employeeCode: form.employeeCode,
        role: form.role, managerId: form.managerId || null, region: form.region, franchiseId: form.franchiseId || null,
        ...(form.password ? { password: form.password } : {})
      });
      onSaved?.();
    } catch (e) {
      setError(errMsg(e, 'Could not update the user.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => !busy && onClose()} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Edit {user?.Name}</DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Stack spacing={2}>
          <Section>Personal details</Section>
          <TextField label="Full name" value={form.name || ''} onChange={(e) => set('name', e.target.value)} required fullWidth
            error={form.name !== undefined && !form.name.trim()} />
          <TextField label="Email" type="email" value={form.email || ''} onChange={(e) => set('email', e.target.value)} required fullWidth
            error={emailBad} helperText={emailBad ? 'Enter a valid email address' : 'Used to sign in and for approval emails'} />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField label="Mobile" value={form.mobile || ''} onChange={(e) => set('mobile', e.target.value)} fullWidth />
            <TextField label="Employee code" value={form.employeeCode || ''} onChange={(e) => set('employeeCode', e.target.value)} fullWidth />
          </Stack>

          <Divider />
          <Section>Role &amp; reporting</Section>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField select label="Role" value={form.role || ''} onChange={(e) => set('role', e.target.value)} fullWidth>
              {(refs.Roles?.length ? refs.Roles.map((r) => r.Name) : Object.keys(LEVEL)).map((n) => (
                <MenuItem key={n} value={n}>{n}</MenuItem>
              ))}
            </TextField>
            <TextField label="Region" value={form.region || ''} placeholder="e.g. Telangana"
              onChange={(e) => set('region', e.target.value)} fullWidth />
          </Stack>
          <TextField select label="Reports to" value={form.managerId || ''} onChange={(e) => set('managerId', e.target.value)} fullWidth
            helperText="Approval requests are routed up this reporting line.">
            <MenuItem value="">— No manager (top of tree) —</MenuItem>
            {managers.map((m) => (
              <MenuItem key={m.Id} value={m.Id}>{m.Name} — {m.Role}{m.Region ? ` · ${m.Region}` : ''}</MenuItem>
            ))}
          </TextField>
          <TextField select label="Franchise" value={form.franchiseId || ''} onChange={(e) => set('franchiseId', e.target.value)} fullWidth>
            {(refs.Franchises || []).map((f) => (
              <MenuItem key={f.Id} value={f.Id}>{f.Name}</MenuItem>
            ))}
          </TextField>

          <Divider />
          <Section>Password</Section>
          <TextField
            label="New password" type={showPw ? 'text' : 'password'} value={form.password || ''} autoComplete="new-password"
            onChange={(e) => set('password', e.target.value)} fullWidth error={pwBad}
            helperText={pwBad ? 'At least 8 characters' : 'Leave blank to keep their current password'}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton aria-label={showPw ? 'Hide password' : 'Show password'} onClick={() => setShowPw((s) => !s)} edge="end">
                    {showPw ? <VisibilityOffOutlinedIcon fontSize="small" /> : <VisibilityOutlinedIcon fontSize="small" />}
                  </IconButton>
                </InputAdornment>
              )
            }}
          />

          {user?.OpenApprovals > 0 && (
            <Typography variant="body2" color="text.secondary">
              {user.OpenApprovals} open approval{user.OpenApprovals === 1 ? ' is' : 's are'} assigned to this user. In-flight approvals keep their
              original chain; reassign them from Approvals if needed.
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={busy}>Cancel</Button>
        <Button variant="contained" onClick={save} disabled={busy || !canSave}>
          {busy ? <CircularProgress size={20} color="inherit" /> : 'Save changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
