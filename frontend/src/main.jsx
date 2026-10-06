import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import App from './App';
import store from './store';
import theme from './theme';
import './index.css';

// Dev-only: expose the store + catalog thunks for debugging/automated checks.
if (import.meta.env.DEV) {
  window.__store = store;
  import('./store/slices/catalogSlice').then((m) => {
    window.__thunks = m;
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ThemeProvider>
    </Provider>
  </React.StrictMode>
);
