import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// In development, Vite serves the UI and passes API requests to the backend (D1).
const backend = `http://127.0.0.1:${process.env.FILMFILE_PORT ?? '4310'}`;

export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': backend } },
});
