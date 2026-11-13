import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        allowedHosts: true,
      },
      plugins: [
        react(),
      ],
      define: {
        'process.env.OMDB_KEY': JSON.stringify(env.VITE_OMDB_KEY || ""),
        'process.env.TMDB_API_KEY': JSON.stringify(env.VITE_TMDB_API_KEY || ""),
        'process.env.RAPID_API_KEY': JSON.stringify(env.VITE_RAPID_API_KEY || ""),
        'process.env.RAPID_API_HOST_IMDB': JSON.stringify(env.VITE_RAPID_API_HOST_IMDB || ""),
        'process.env.WIKIDATA_BACKEND_URL': JSON.stringify(env.VITE_WIKIDATA_BACKEND_URL || ""),
        global: 'window',
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
