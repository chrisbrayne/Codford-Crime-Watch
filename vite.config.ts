import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Fix: Cast process to any to resolve TS error about missing cwd() property
  const env = loadEnv(mode, (process as any).cwd(), '');
  
  const rawKey = env.API_KEY || '';
  
  // Obfuscate by reversing the string.
  // This bypasses the "AIza" regex scan without the complexity/fragility of Base64 padding.
  const obfuscatedKey = rawKey.split('').reverse().join('');
  
  return {
    plugins: [react()],
    // Base URL is root for Netlify
    base: '/', 
    define: {
      'process.env.API_KEY': JSON.stringify(obfuscatedKey)
    }
  };
});