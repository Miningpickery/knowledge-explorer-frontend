// 🧪 Test Setup
// 모든 테스트에서 공통으로 사용할 설정

import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll, afterAll, vi } from 'vitest';

// 각 테스트 후 정리
afterEach(() => {
  cleanup();
});

// 전역 모킹
beforeAll(() => {
  // localStorage 모킹
  const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  };
  vi.stubGlobal('localStorage', localStorageMock);

  // sessionStorage 모킹
  const sessionStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  };
  vi.stubGlobal('sessionStorage', sessionStorageMock);

  // crypto 모킹
  const cryptoMock = {
    getRandomValues: vi.fn((array: Uint8Array) => {
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
      return array;
    }),
  };
  vi.stubGlobal('crypto', cryptoMock);

  // fetch 모킹
  global.fetch = vi.fn();

  // IntersectionObserver 모킹
  global.IntersectionObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));

  // ResizeObserver 모킹
  global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));

  // matchMedia 모킹
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  // console 경고 억제 (테스트 환경)
  const originalConsoleWarn = console.warn;
  console.warn = (...args) => {
    // React Testing Library 경고 필터링
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render is no longer supported')
    ) {
      return;
    }
    originalConsoleWarn(...args);
  };
});

afterAll(() => {
  vi.restoreAllMocks();
});

// 커스텀 매처 추가
expect.extend({
  toBeValidPassword(received: string) {
    const isValid = received.length >= 8 && /[A-Z]/.test(received) && /[0-9]/.test(received);
    return {
      message: () =>
        `expected ${received} to ${isValid ? 'not ' : ''}be a valid password`,
      pass: isValid,
    };
  },
  
  toBeValidEmail(received: string) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isValid = emailRegex.test(received);
    return {
      message: () =>
        `expected ${received} to ${isValid ? 'not ' : ''}be a valid email`,
      pass: isValid,
    };
  },
});

// 타입 선언
declare global {
  namespace Vi {
    interface JestAssertion<T = any> {
      toBeValidPassword(): T;
      toBeValidEmail(): T;
    }
  }
}
