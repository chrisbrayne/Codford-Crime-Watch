import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Fix: Cast process to any to resolve TS error about missing cwd() property
  const env = loadEnv(mode, (process as any).cwd(), '');
  
  // Sanitize API Key to remove potential whitespace from copy-paste
  const apiKey = env.API_KEY ? env.API_KEY.trim() : undefined;
  
  return {
    plugins: [react()],
    // Base URL is root for Netlify
    base: '/', 
    define: {
      // In client-side apps, we must replace process.env.API_KEY with the actual value at build time
      'process.env.API_KEY': JSON.stringify(apiKey)
    }
  };
});