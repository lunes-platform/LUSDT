import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {
    global: 'globalThis',
  },
  server: {
    host: "0.0.0.0",
    port: 3003,
    allowedHosts:["lusdt.lunes.io"],
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  optimizeDeps: {
    include: ['@solana/web3.js', '@polkadot/api', 'buffer']
  }
})
