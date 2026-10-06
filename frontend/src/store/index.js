import { configureStore } from '@reduxjs/toolkit';
import auth from './slices/authSlice';
import catalog from './slices/catalogSlice';
import user from './slices/userSlice';
import dashboard from './slices/dashboardSlice';
import admin from './slices/adminSlice';
import approval from './slices/approvalSlice';

export const store = configureStore({
  reducer: { auth, catalog, user, dashboard, admin, approval },
  middleware: (getDefault) => getDefault({ serializableCheck: false })
});

export default store;
