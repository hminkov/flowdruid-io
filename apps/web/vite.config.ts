import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/trpc': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      // /api/* covers the non-tRPC Express routes: SSE events, Slack
      // webhooks, Jira attachment proxy. Without this the dev server
      // falls back to the SPA index.html for those paths and any
      // <img src="/api/..."> or fetch('/api/...') silently breaks.
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
