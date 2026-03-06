import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

// Resolve o React canônico a partir do pnpm store para evitar múltiplas instâncias
const reactPath = path.resolve(__dirname, '../node_modules/.pnpm/react@18.3.1/node_modules/react');
const reactDomPath = path.resolve(__dirname, '../node_modules/.pnpm/react-dom@18.3.1_react@18.3.1/node_modules/react-dom');

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      react: reactPath,
      'react-dom': reactDomPath,
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: [
      'src/components/__tests__/AdminPanel.test.tsx',
      'src/components/__tests__/VolumeInfo.test.tsx',
    ],
    deps: {
      // Força o @testing-library/react a ser processado pelo bundler do vitest
      // para usar o mesmo React resolvido pelo alias acima
      inline: ['@testing-library/react', '@testing-library/dom'],
    },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.*', 'src/test/**'],
    },
  },
});
