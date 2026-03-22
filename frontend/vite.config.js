import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const ROOT_DIR = path.dirname(fileURLToPath(import.meta.url))

function readBackendEnvValue(name) {
  try {
    const envPath = path.resolve(ROOT_DIR, '../backend/.env.example')
    const envFile = fs.readFileSync(envPath, 'utf8')
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const match = envFile.match(new RegExp(`^${escapedName}=(.*)$`, 'm'))
    return match?.[1]?.trim() || ''
  } catch {
    return ''
  }
}

const googleClientId = globalThis.process?.env?.VITE_GOOGLE_CLIENT_ID || readBackendEnvValue('GOOGLE_CLIENT_ID')
const turnstileSiteKey = globalThis.process?.env?.VITE_TURNSTILE_SITE_KEY || readBackendEnvValue('TURNSTILE_SITE_KEY')

// https://vite.dev/config/
export default defineConfig({
  define: {
    'import.meta.env.VITE_GOOGLE_CLIENT_ID': JSON.stringify(googleClientId),
    'import.meta.env.VITE_TURNSTILE_SITE_KEY': JSON.stringify(turnstileSiteKey),
  },
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    watch: {
      usePolling: globalThis.process?.env?.CHOKIDAR_USEPOLLING === 'true',
    },
  },
})
