import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// In development, Vite serves the UI and passes API requests to the backend (D1).
// The backend refuses a Host other than its own, so the proxy sets it
// (changeOrigin). The browser's Origin, http://localhost:5173, passes through
// unchanged: `pnpm dev` tells the backend to accept it.
const backend = `http://127.0.0.1:${process.env.FILMFILE_PORT ?? '4310'}`;

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Fail rather than move to another port, which the backend wouldn't accept.
    strictPort: true,
    proxy: { '/api': { target: backend, changeOrigin: true } },
  },
});
