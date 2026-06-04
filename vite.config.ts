import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react-dom') || id.includes('react/')) return 'vendor';
            if (id.includes('react-router-dom')) return 'router';
            if (id.includes('firebase')) return 'firebase';
          }
        },
      },
    },
    cssMinify: true,
    chunkSizeWarningLimit: 600,
    reportCompressedSize: false,
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
  },
});