import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    open: false,
    watch: {
      ignored: ['**/src-tauri/**']
    }
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-codemirror': [
            '@codemirror/state',
            '@codemirror/view',
            '@codemirror/language',
            '@codemirror/commands',
            '@replit/codemirror-vim'
          ],
          'vendor-xterm': ['@xterm/xterm', '@xterm/addon-fit', '@xterm/addon-search'],
          'vendor-icons': ['lucide-react'],
        }
      }
    }
  }
});
