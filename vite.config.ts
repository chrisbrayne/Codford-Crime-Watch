import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Fix: Cast process to any to resolve TS error about missing cwd() property
  const env = loadEnv(mode, (process as any).cwd(), '');
  
  // 1. Get the key from the environment
  const apiKey = env.API_KEY || '';
  
  return {
    plugins: [react()],
    // Base URL is root for Netlify
    base: '/', 
    define: {
      // In client-side apps, we must replace process.env.API_KEY with the value.
      'process.env.API_KEY': JSON.stringify(apiKey)
    }
  };
});