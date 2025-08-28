/// <reference types="vitest" />
// 🧪 Vitest Configuration
// 상용화 수준의 테스트 환경 설정

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    // 테스트 환경 설정
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    
    // 글로벌 설정
    globals: true,
    
    // 테스트 파일 패턴
    include: [
      'src/**/__tests__/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'
    ],
    exclude: [
      'node_modules',
      'dist',
      '.next',
      'coverage'
    ],
    
    // 커버리지 설정
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/',
        'src/__tests__/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/types.ts',
        'src/main.tsx',
        'src/vite-env.d.ts'
      ],
      thresholds: {
        global: {
          branches: 70,
          functions: 70,
          lines: 70,
          statements: 70
        }
      }
    },
    
    // 테스트 타임아웃
    testTimeout: 10000,
    hookTimeout: 10000,
    
    // 병렬 실행
    threads: true,
    maxThreads: 4,
    minThreads: 1,
    
    // 리포터 설정
    reporter: ['verbose', 'html'],
    outputFile: {
      html: './test-results/index.html'
    },
    
    // 모킹 설정
    deps: {
      inline: [/@testing-library\/.*/]
    },
    
    // 환경 변수
    env: {
      NODE_ENV: 'test'
    }
  },
  
  // 경로 별칭 설정
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/hooks': path.resolve(__dirname, './src/hooks'),
      '@/stores': path.resolve(__dirname, './src/stores'),
      '@/utils': path.resolve(__dirname, './src/utils'),
      '@/services': path.resolve(__dirname, './src/services'),
      '@/types': path.resolve(__dirname, './src/types')
    }
  },
  
  // 빌드 설정 (테스트용)
  esbuild: {
    target: 'es2020'
  }
});
