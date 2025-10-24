import { defineConfig } from 'vite';

export default defineConfig({
  // Serve and build files from this directory (src/client)
  root: '.',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: 'index.html'
    }
  }
});