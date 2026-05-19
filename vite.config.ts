import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      '@core': fileURLToPath(new URL('./src/core', import.meta.url)),
      '@engine': fileURLToPath(new URL('./src/engine', import.meta.url)),
      '@config': fileURLToPath(new URL('./src/config', import.meta.url)),
      '@modules': fileURLToPath(new URL('./src/modules', import.meta.url)),
      '@physics': fileURLToPath(new URL('./src/physics', import.meta.url)),
      '@services': fileURLToPath(new URL('./src/services', import.meta.url)),
      '@utils': fileURLToPath(new URL('./src/utils', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      input: {
        playfield: fileURLToPath(new URL('./playfield.html', import.meta.url)),
        backglass: fileURLToPath(new URL('./backglass.html', import.meta.url)),
        dmd: fileURLToPath(new URL('./dmd.html', import.meta.url)),
      },
    },
  },
})
