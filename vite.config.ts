import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    plugins: [react()],
    // Base URL is root for Netlify
    base: '/', 
    define: {
      // This ensures process.env.API_KEY works in the build
      'process.env.API_KEY': JSON.stringify(env.API_KEY)
    }
  };
});