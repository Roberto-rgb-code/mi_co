import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Siempre rutas absolutas /assets/... (evita 404 al entrar desde /catalogo etc.)
  base: '/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})
