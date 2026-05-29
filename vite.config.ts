import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// https://vite.dev/config/
const configDir = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  envDir: path.resolve(configDir, '..'),
  plugins: [react()],
})
