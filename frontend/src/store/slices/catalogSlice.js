import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from '../../api/axios';
import { Endpoints } from '../../api/endpoints';

const data = (res) => res.data.data;

// -- geography --
export const fetchCountries = createAsyncThunk('catalog/countries', async () => data(await axios.post(Endpoints.Country, {})));
export const fetchStates = createAsyncThunk('catalog/states', async (CountryId) => data(await axios.post(Endpoints.State, { CountryId })));
export const fetchCities = createAsyncThunk('catalog/cities', async (StateId) => data(await axios.post(Endpoints.City, { StateId })));

// -- home theatre catalog (products, packages, defaults) for the quotation builder --
export const fetchBuilderCatalog = createAsyncThunk('catalog/builder', async () => (await axios.get(Endpoints.Quote_Catalog)).data.data);

const initialState = {
  countries: [], states: [], cities: [],
  builder: null, loading: false
};

const set = (key) => (state, action) => {
  state[key] = action.payload || [];
};

const catalogSlice = createSlice({
  name: 'catalog',
  initialState,
  reducers: {
    // Clear dependent lists when a parent selection changes (payload: array of keys).
    resetKeys: (state, action) => {
      (action.payload || []).forEach((k) => {
        state[k] = [];
      });
    }
  },
  extraReducers: (b) => {
    b.addCase(fetchCountries.fulfilled, set('countries'));
    b.addCase(fetchStates.fulfilled, set('states'));
    b.addCase(fetchCities.fulfilled, set('cities'));
    b.addCase(fetchBuilderCatalog.pending, (s) => { s.loading = true; });
    b.addCase(fetchBuilderCatalog.fulfilled, (s, a) => { s.loading = false; s.builder = a.payload; });
    b.addCase(fetchBuilderCatalog.rejected, (s) => { s.loading = false; });
  }
});

export const { resetKeys } = catalogSlice.actions;
export default catalogSlice.reducer;
