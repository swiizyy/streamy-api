import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import adonisjs from '@adonisjs/vite/client'

export default defineConfig({
  plugins: [
    react(),
    adonisjs({
      entrypoints: ['resources/js/app.tsx'],
      reload: ['resources/views/**/*.edge'],
    }),
  ],
})
