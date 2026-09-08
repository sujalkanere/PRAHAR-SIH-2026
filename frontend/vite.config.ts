import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 1400,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router') || id.includes('@tanstack')) {
              return 'vendor-react'
            }
            if (id.includes('@ant-design/icons')) {
              return 'vendor-icons'
            }
            if (id.includes('antd')) {
              return 'vendor-antd'
            }
            if (id.includes('recharts') || id.includes('d3')) {
              return 'vendor-charts'
            }
          }
        },
      },
    },
  },
})
