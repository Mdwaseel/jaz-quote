import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from '../../api/axios';
import { Endpoints } from '../../api/endpoints';

const data = (res) => res.data.data;

export const fetchStats = createAsyncThunk('admin/stats', async () => data(await axios.post(Endpoints.Admin_Stats, {})));
export const fetchCatalog = createAsyncThunk('admin/catalog', async (kind) => {
  const rows = data(await axios.post(Endpoints.Admin_Catalog_List, { kind }));
  return { kind, rows };
});
export const updateCatalog = createAsyncThunk('admin/catalogUpdate', async (payload, { rejectWithValue }) => {
  try {
    return data(await axios.post(Endpoints.Admin_Catalog_Update, payload));
  } catch (e) {
    return rejectWithValue(e.response?.data?.message || 'Save failed.');
  }
});
export const createCatalog = createAsyncThunk('admin/catalogCreate', async (payload, { rejectWithValue }) => {
  try {
    return data(await axios.post(Endpoints.Admin_Catalog_Create, payload));
  } catch (e) {
    return rejectWithValue(e.response?.data?.message || 'Create failed.');
  }
});
export const deleteCatalog = createAsyncThunk('admin/catalogDelete', async ({ kind, id }, { rejectWithValue }) => {
  try {
    return data(await axios.post(Endpoints.Admin_Catalog_Delete, { kind, id }));
  } catch (e) {
    return rejectWithValue(e.response?.data?.message || 'Delete failed.');
  }
});
export const fetchCatalogRefs = createAsyncThunk('admin/catalogRefs', async () => data(await axios.post(Endpoints.Admin_Catalog_Refs, {})));
export const fetchAdminQuotations = createAsyncThunk('admin/quotations', async () => data(await axios.post(Endpoints.Admin_Quotations, {})));
export const updateQuotationStatus = createAsyncThunk('admin/quoteStatus', async ({ QuotationNumber, Status }) =>
  data(await axios.post(Endpoints.Admin_Quotation_Status, { QuotationNumber, Status }))
);
export const fetchAdminUsers = createAsyncThunk('admin/users', async () => data(await axios.post(Endpoints.Admin_Users, {})));
export const toggleUser = createAsyncThunk('admin/toggleUser', async ({ userId, active }, { rejectWithValue }) => {
  try {
    return data(await axios.post(Endpoints.Admin_User_Toggle, { userId, active }));
  } catch (e) {
    return rejectWithValue(e.response?.data?.message || 'Could not update user.');
  }
});
export const fetchUserRefs = createAsyncThunk('admin/userRefs', async () => data(await axios.post(Endpoints.Admin_User_Refs, {})));
export const createAdminUser = createAsyncThunk('admin/createUser', async (payload, { rejectWithValue }) => {
  try {
    return data(await axios.post(Endpoints.Admin_User_Create, payload));
  } catch (e) {
    return rejectWithValue(e.response?.data?.message || 'Could not create user.');
  }
});

const initialState = {
  stats: null,
  catalog: {}, // kind -> rows
  refs: { categories: [], products: [], tiers: [], configurations: [], specLabels: [], brands: {} },
  quotations: [],
  users: [],
  loading: false
};

const adminSlice = createSlice({
  name: 'admin',
  initialState,
  reducers: {},
  extraReducers: (b) => {
    b.addCase(fetchStats.fulfilled, (s, a) => {
      s.stats = a.payload;
    });
    b.addCase(fetchCatalog.pending, (s) => {
      s.loading = true;
    });
    b.addCase(fetchCatalog.fulfilled, (s, a) => {
      s.loading = false;
      s.catalog[a.payload.kind] = a.payload.rows;
    });
    b.addCase(fetchCatalog.rejected, (s) => {
      s.loading = false;
    });
    b.addCase(fetchAdminQuotations.fulfilled, (s, a) => {
      s.quotations = a.payload || [];
    });
    b.addCase(fetchAdminUsers.fulfilled, (s, a) => {
      s.users = a.payload || [];
    });
    b.addCase(fetchCatalogRefs.fulfilled, (s, a) => {
      s.refs = a.payload || s.refs;
    });
  }
});

export default adminSlice.reducer;
