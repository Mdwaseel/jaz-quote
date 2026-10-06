import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import jsconfigPaths from 'vite-jsconfig-paths';

// Dev server on 3000. API + media are proxied to the Django backend on 8080,
// so the browser always talks same-origin (no CORS, no port confusion).
export default defineConfig({
  plugins: [react(), jsconfigPaths()],
  server: {
    port: 3000,
    open: !process.env.NO_OPEN,
    proxy: {
      '/api': 'http://127.0.0.1:8080',
      '/media': 'http://127.0.0.1:8080'
    }
  },
  resolve: {
    alias: { src: '/src' }
  }
});
