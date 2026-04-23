import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5723
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser']
        }
      }
    }
  }
});
