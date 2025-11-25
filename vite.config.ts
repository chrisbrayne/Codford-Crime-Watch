import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Fix: Cast process to any to resolve TS error about missing cwd() property
  const env = loadEnv(mode, (process as any).cwd(), '');
  
  return {
    plugins: [react()],
    // Base URL is root for Netlify
    base: '/', 
    define: {
      // Fix: Use simple JSON stringify. 
      // Complex expressions like string concatenation are not supported as define values in strict esbuild contexts.
      'process.env.API_KEY': JSON.stringify(env.API_KEY)
    }
  };
});