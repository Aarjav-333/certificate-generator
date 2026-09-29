import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // The main chunk carries fontkit (~1 MB), which the layout engine needs at
    // startup to measure text. pdf-lib is split out and loaded on first export.
    chunkSizeWarningLimit: 1200,
  },
})
