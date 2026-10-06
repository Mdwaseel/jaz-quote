import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from '../../api/axios';
import { Endpoints } from '../../api/endpoints';
import { getCookie, setCookie, eraseCookie } from '../../utils/cookies';

const storedProfile = (() => {
  try {
    return JSON.parse(localStorage.getItem('userProfile') || 'null');
  } catch {
    return null;
  }
})();

const persistSession = ({ accessToken, refreshToken, userProfile }) => {
  setCookie('serviceToken', accessToken);
  setCookie('refreshToken', refreshToken);
  localStorage.setItem('userProfile', JSON.stringify(userProfile));
};

// Step 1 — verify credentials. When two-step is enabled the backend returns
// { otpRequired: true } and emails a code instead of issuing tokens.
export const login = createAsyncThunk('auth/login', async ({ email, password }, { rejectWithValue }) => {
  try {
    const res = await axios.post(Endpoints.Login, { email, password });
    if (res.data?.otpRequired) {
      return { otpRequired: true, email, maskedEmail: res.data.maskedEmail, message: res.data.message };
    }
    persistSession(res.data);
    return { otpRequired: false, userProfile: res.data.userProfile };
  } catch (e) {
    return rejectWithValue(e.response?.data?.message || 'Invalid email or password.');
  }
});

// Step 2 — verify the emailed OTP; on success tokens are issued.
export const verifyOtp = createAsyncThunk('auth/verifyOtp', async ({ email, otp }, { rejectWithValue }) => {
  try {
    const res = await axios.post(Endpoints.VerifyOtp, { email, otp });
    persistSession(res.data);
    return res.data.userProfile;
  } catch (e) {
    return rejectWithValue(e.response?.data?.message || 'Invalid or expired code.');
  }
});

export const resendOtp = createAsyncThunk('auth/resendOtp', async ({ email }, { rejectWithValue }) => {
  try {
    await axios.post(Endpoints.ResendOtp, { email });
    return true;
  } catch (e) {
    return rejectWithValue(e.response?.data?.message || 'Could not resend the code.');
  }
});

// Re-fetch the profile so role / hierarchy changes made by an Admin apply without re-login.
export const refreshMe = createAsyncThunk('auth/me', async () => {
  const profile = (await axios.post(Endpoints.Me, {})).data.data;
  localStorage.setItem('userProfile', JSON.stringify(profile));
  return profile;
});

export const logout = createAsyncThunk('auth/logout', async (_, { rejectWithValue }) => {
  try {
    const refreshToken = getCookie('refreshToken');
    await axios.post(
      Endpoints.Logout,
      { RefreshToken: refreshToken, IsLogoutFromAllDevices: true },
      { headers: { skipAuthRefresh: 'true' } }
    );
  } catch (e) {
    // ignore network errors on logout
  } finally {
    eraseCookie('serviceToken');
    eraseCookie('refreshToken');
    localStorage.removeItem('userProfile');
  }
  return true;
});

const initialState = {
  isLoggedIn: !!getCookie('serviceToken'),
  user: storedProfile,
  loading: false,
  error: null
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (s) => {
        s.loading = true;
        s.error = null;
      })
      .addCase(login.fulfilled, (s, a) => {
        s.loading = false;
        if (a.payload?.otpRequired) {
          // Awaiting OTP — not logged in yet.
          return;
        }
        s.isLoggedIn = true;
        s.user = a.payload.userProfile;
      })
      .addCase(login.rejected, (s, a) => {
        s.loading = false;
        s.error = a.payload;
      })
      .addCase(verifyOtp.pending, (s) => {
        s.loading = true;
        s.error = null;
      })
      .addCase(verifyOtp.fulfilled, (s, a) => {
        s.loading = false;
        s.isLoggedIn = true;
        s.user = a.payload;
      })
      .addCase(verifyOtp.rejected, (s, a) => {
        s.loading = false;
        s.error = a.payload;
      })
      .addCase(refreshMe.fulfilled, (s, a) => {
        s.user = a.payload;
      })
      .addCase(logout.fulfilled, (s) => {
        s.isLoggedIn = false;
        s.user = null;
      });
  }
});

export const { clearError } = authSlice.actions;
export default authSlice.reducer;
