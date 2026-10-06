import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from '../../api/axios';
import { Endpoints } from '../../api/endpoints';

const data = (res) => res.data.data;

export const fetchUserList = createAsyncThunk('user/list', async () => {
  const d = data(await axios.post(Endpoints.Get_User_List, {}));
  return d?.Data || [];
});
export const fetchRoles = createAsyncThunk('user/roles', async () => data(await axios.post(Endpoints.Get_Roles, {})));
export const fetchFranchize = createAsyncThunk('user/franchize', async () => data(await axios.post(Endpoints.Get_Franchize, {})));
export const fetchBranchList = createAsyncThunk('user/branchList', async () => data(await axios.post(Endpoints.Get_Branch_List, {})));
export const fetchBranches = createAsyncThunk('user/branches', async (franchizeId) => data(await axios.post(Endpoints.Get_Branch, { franchizeId })));
export const fetchReportingManagers = createAsyncThunk('user/rm', async (franchizeId) => data(await axios.post(Endpoints.Get_RM, { franchizeId })));
export const fetchUserProfile = createAsyncThunk('user/profile', async () => data(await axios.post(Endpoints.Get_User_Profile, {})));
export const fetchBankList = createAsyncThunk('user/bankList', async () => data(await axios.post(Endpoints.Get_Bank_List, {})));

export const createUser = createAsyncThunk('user/create', async (payload, { rejectWithValue }) => {
  try {
    return data(await axios.post(Endpoints.Add_User, payload));
  } catch (e) {
    return rejectWithValue(e.response?.data?.message || 'Failed to create user.');
  }
});
export const inactivateUser = createAsyncThunk('user/inactivate', async (userId) => data(await axios.post(Endpoints.InActive_User, { userId })));
export const updateProfile = createAsyncThunk('user/updateProfile', async (payload) => data(await axios.post(Endpoints.Add_Profile, payload)));
export const changePassword = createAsyncThunk('user/changePw', async (payload, { rejectWithValue }) => {
  try {
    return data(await axios.post(Endpoints.Change_PW, payload));
  } catch (e) {
    return rejectWithValue(e.response?.data?.message || 'Failed to change password.');
  }
});

const initialState = {
  list: [], roles: [], franchize: [], branches: [], branchList: [],
  reportingManagers: [], profile: null, bank: [], loading: false, error: null
};

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {},
  extraReducers: (b) => {
    b.addCase(fetchUserList.pending, (s) => {
      s.loading = true;
    });
    b.addCase(fetchUserList.fulfilled, (s, a) => {
      s.loading = false;
      s.list = a.payload;
    });
    b.addCase(fetchRoles.fulfilled, (s, a) => {
      s.roles = a.payload;
    });
    b.addCase(fetchFranchize.fulfilled, (s, a) => {
      s.franchize = a.payload;
    });
    b.addCase(fetchBranches.fulfilled, (s, a) => {
      s.branches = a.payload;
    });
    b.addCase(fetchBranchList.fulfilled, (s, a) => {
      s.branchList = a.payload;
    });
    b.addCase(fetchReportingManagers.fulfilled, (s, a) => {
      s.reportingManagers = a.payload;
    });
    b.addCase(fetchUserProfile.fulfilled, (s, a) => {
      s.profile = a.payload;
    });
    b.addCase(fetchBankList.fulfilled, (s, a) => {
      s.bank = a.payload;
    });
  }
});

export default userSlice.reducer;
