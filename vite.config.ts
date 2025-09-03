import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode, command }) => {
  // 환경별 API URL 설정
  const getApiUrl = () => {
    // 환경 변수에서 우선 확인
    if (process.env.VITE_API_URL) {
      return process.env.VITE_API_URL;
    }
    
    // 로컬 개발 환경 (기본값)
    return 'http://localhost:3001';
  };

  // 개발 환경 감지
  const isDev = command === 'serve';
  const isBuild = command === 'build';

  return {
    plugins: [
      react(),
      // 개발 환경에서만 활성화할 플러그인들
      ...(isDev ? [
        // 개발 시 유용한 플러그인들
      ] : [])
    ],
    define: {
      'import.meta.env.VITE_API_URL': JSON.stringify(getApiUrl()),
      'import.meta.env.VITE_APP_NAME': JSON.stringify('지식 탐험가'),
      'import.meta.env.VITE_APP_VERSION': JSON.stringify('1.0.0'),
      // 개발 환경 감지
      'import.meta.env.DEV': isDev,
      'import.meta.env.PROD': isBuild,
      // 전역 상수
      __DEV__: isDev,
      __PROD__: isBuild,
    },
    server: {
      port: 8000,
      host: '0.0.0.0', // 모든 IP에서 접근 가능하도록 설정
      strictPort: true,
      
      // LocalTunnel, ngrok, Cloudflare Tunnel 호스트 허용
      allowedHosts: [
        'localhost',
        '127.0.0.1',
        '192.168.0.55',
        '.loca.lt',
        '.ngrok-free.app',
        '.ngrok.io',
        '.trycloudflare.com'
      ],
      
      // HMR 설정 (WebSocket 문제 시 주석 해제)
      hmr: {
        port: 8000,
        host: 'localhost',
        protocol: 'ws'
      },
      // HMR 완전 비활성화 (WebSocket 문제 지속 시 사용)
      // hmr: false,
      
      // 개발 서버 최적화
      open: true,                    // 브라우저 자동 열기
      cors: true,                    // CORS 활성화
      
      // 프록시 설정 (API 요청 우회)
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/api/, '/api')
        }
      },
      
      headers: {
        'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob:; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; connect-src 'self' ws: wss: http: https: localhost:*; font-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self';"
      }
    },
    resolve: {
      alias: {
        '@': '/src',
        '@components': '/src/components',
        '@services': '/src/services',
        '@utils': '/src/utils',
        '@types': '/src/types',
        '@stores': '/src/stores',
        '@hooks': '/src/hooks'
      },
      // 파일 확장자 자동 해석
      extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json']
    },
    
    // 최적화 설정
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'zustand',
        '@tanstack/react-query',
        'framer-motion',
        'lucide-react'
      ],
      exclude: ['@google/generative-ai'] // AI 라이브러리는 제외
    },
    build: {
      // 빌드 최적화
      target: 'es2015',              // ES2015 호환성
      minify: 'terser',              // Terser로 코드 압축
      sourcemap: false,               // 프로덕션에서는 소스맵 비활성화
      outDir: 'dist',                // 빌드 출력 디렉토리
      assetsDir: 'assets',           // 정적 자산 디렉토리
      
      // 청크 분할 최적화
      rollupOptions: {
        output: {
          manualChunks: {
            // React 관련 라이브러리들을 별도 청크로 분리
            'react-vendor': ['react', 'react-dom'],
            // UI 라이브러리들을 별도 청크로 분리
            'ui-vendor': ['lucide-react', 'framer-motion'],
            // 상태 관리 라이브러리들을 별도 청크로 분리
            'state-vendor': ['zustand', '@tanstack/react-query'],
            // 마크다운 관련 라이브러리들을 별도 청크로 분리
            'markdown-vendor': ['react-markdown', 'highlight.js'],
            // 유틸리티 라이브러리들을 별도 청크로 분리
            'utils-vendor': ['clsx', 'tailwind-merge', 'immer'],
            // 외부 라이브러리들을 별도 청크로 분리
            'external-vendor': ['@google/generative-ai', 'bcryptjs', 'jsonwebtoken']
          },
          // 청크 파일명 패턴
          chunkFileNames: 'assets/js/[name]-[hash].js',
          entryFileNames: 'assets/js/[name]-[hash].js',
          assetFileNames: 'assets/[ext]/[name]-[hash].[ext]'
        }
      },
      // 청크 크기 경고 임계값 조정
      chunkSizeWarningLimit: 1000,
      
      // 빌드 성능 최적화
      reportCompressedSize: false,    // 압축 크기 리포트 비활성화 (빌드 속도 향상)
      cssCodeSplit: true,             // CSS 코드 분할
      assetsInlineLimit: 4096,        // 4KB 이하 자산은 인라인
    }
  };
});
