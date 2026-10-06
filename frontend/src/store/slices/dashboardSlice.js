import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from '../../api/axios';
import { Endpoints } from '../../api/endpoints';

export const fetchModelWiseCount = createAsyncThunk('dashboard/modelCount', async () =>
  (await axios.get(Endpoints.Dashboard_Card_Count)).data.data
);

export const fetchOverview = createAsyncThunk('dashboard/overview', async () =>
  (await axios.get(Endpoints.Dashboard_Overview)).data.data
);

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState: { modelCounts: [], overview: null, loading: false, error: null },
  reducers: {},
  extraReducers: (b) => {
    b.addCase(fetchModelWiseCount.pending, (s) => {
      s.loading = true;
      s.error = null;
    });
    b.addCase(fetchModelWiseCount.fulfilled, (s, a) => {
      s.loading = false;
      s.modelCounts = a.payload || [];
    });
    b.addCase(fetchModelWiseCount.rejected, (s, a) => {
      s.loading = false;
      s.error = a.error?.message;
    });
    b.addCase(fetchOverview.fulfilled, (s, a) => {
      s.overview = a.payload || null;
    });
  }
});

export default dashboardSlice.reducer;
