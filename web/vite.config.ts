import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The backend runs on 127.0.0.1:3000. Proxy API + OAuth discovery routes to it
// so the browser talks to a single origin (keeps the session cookie same-site).
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:3000',
      '/client-metadata.json': 'http://127.0.0.1:3000',
      '/jwks.json': 'http://127.0.0.1:3000',
    },
  },
});
