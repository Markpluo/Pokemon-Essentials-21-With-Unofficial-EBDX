import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const page = (f: string) => fileURLToPath(new URL(f, import.meta.url));

export default defineConfig({
  base: './',
  worker: { format: 'es' },
  build: {
    target: 'es2022', chunkSizeWarningLimit: 4000,
    // index.html is the homepage with the invite gate; play.html is the game.
    rollupOptions: { input: { home: page('index.html'), play: page('play.html'), credits: page('credits.html'), privacy: page('privacy.html') } }
  }
});
