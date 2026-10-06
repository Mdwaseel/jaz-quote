import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { approvalCounts } from '../../api/workflow';

// Pending-approval and unread-notification counts for nav badges.
export const fetchCounts = createAsyncThunk('approval/counts', async () => approvalCounts());

const approvalSlice = createSlice({
  name: 'approval',
  initialState: { counts: { Pending: {}, PendingTotal: 0, MyOpenRequests: 0, UnreadNotifications: 0 } },
  reducers: {},
  extraReducers: (b) => {
    b.addCase(fetchCounts.fulfilled, (s, a) => {
      s.counts = a.payload || s.counts;
    });
  }
});

export default approvalSlice.reducer;
