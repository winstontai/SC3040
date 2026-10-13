import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // AI chatbot backend (backend/src/chatbot), run with `npm start` in backend/
      '/chatbot': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/api': {
        target: 'https://api-open.data.gov.sg', // Your API's base URL
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});