import React, { useState, useEffect } from 'react';

interface TestResult {
  success: boolean;
  data?: any;
  error?: string;
  status?: number;
}

interface APITestComponentProps {
  className?: string;
}

const APITestComponent: React.FC<APITestComponentProps> = ({ className = '' }) => {
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const [isLoading, setIsLoading] = useState<Record<string, boolean>>({});
  const [summary, setSummary] = useState({ total: 0, success: 0, failed: 0 });

  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  // API 호출 함수
  const callAPI = async (endpoint: string, options: RequestInit = {}): Promise<TestResult> => {
    const url = `${API_BASE_URL}${endpoint}`;
    try {
      const response = await fetch(url, {
        method: options.method || 'GET',
        headers: options.headers || {
          'Content-Type': 'application/json'
        },
        body: options.body ? JSON.stringify(options.body) : undefined
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return { success: true, data, status: response.status };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error', 
        status: 'error' 
      };
    }
  };

  // 테스트 실행 함수
  const runTest = async (testName: string, testFunction: () => Promise<TestResult>) => {
    setIsLoading(prev => ({ ...prev, [testName]: true }));
    
    try {
      const result = await testFunction();
      setTestResults(prev => ({ ...prev, [testName]: result }));
    } catch (error) {
      setTestResults(prev => ({ 
        ...prev, 
        [testName]: { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        } 
      }));
    } finally {
      setIsLoading(prev => ({ ...prev, [testName]: false }));
    }
  };

  // 메시지 API 테스트
  const testMessagesAPI = () => runTest('메시지 기본 조회', () => callAPI('/api/messages'));
  const testMessagesWithLimit = () => runTest('메시지 제한 조회', () => callAPI('/api/messages?limit=5'));
  const testMessagesSearch = () => runTest('메시지 검색', () => callAPI('/api/messages?search=질문&limit=3'));
  const testMessagesBySender = () => runTest('메시지 발신자별 필터링', () => callAPI('/api/messages?sender=user&limit=3'));

  // 사용자 API 테스트
  const testUsersAPI = () => runTest('사용자 기본 조회', () => callAPI('/api/users'));
  const testUsersWithLimit = () => runTest('사용자 제한 조회', () => callAPI('/api/users?limit=3'));
  const testUsersSearch = () => runTest('사용자 검색', () => callAPI('/api/users?search=James&limit=2'));

  // 보안 API 테스트
  const testSecurityAPI = () => runTest('보안 위협 기본 조회', () => callAPI('/api/security'));
  const testSecurityWithLimit = () => runTest('보안 위협 제한 조회', () => callAPI('/api/security?limit=3'));
  const testSecurityByType = () => runTest('보안 위협 유형별 필터링', () => callAPI('/api/security?threatType=PROMPT_INJECTION&limit=2'));

  // 헬스 API 테스트
  const testHealthAPI = () => runTest('서버 상태 확인', () => callAPI('/health'));

  // 모든 테스트 실행
  const runAllTests = async () => {
    await testHealthAPI();
    await testMessagesAPI();
    await testUsersAPI();
    await testSecurityAPI();
  };

  // 요약 업데이트
  useEffect(() => {
    const total = Object.keys(testResults).length;
    const success = Object.values(testResults).filter(r => r.success).length;
    const failed = total - success;
    setSummary({ total, success, failed });
  }, [testResults]);

  // 페이지 로드 시 자동 테스트 실행
  useEffect(() => {
    runAllTests();
  }, []);

  const getStatusColor = (success: boolean) => success ? 'text-green-600' : 'text-red-600';
  const getStatusIcon = (success: boolean) => success ? '✅' : '❌';

  return (
    <div className={`p-6 bg-white rounded-lg shadow-lg ${className}`}>
      <h2 className="text-2xl font-bold text-center mb-6 text-gray-800">
        🔧 새로 구현된 API 연동 테스트
      </h2>

      {/* 요약 정보 */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="text-lg font-semibold mb-3">📊 테스트 결과 요약</h3>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-gray-700">{summary.total}</div>
            <div className="text-sm text-gray-600">총 테스트</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-600">{summary.success}</div>
            <div className="text-sm text-gray-600">성공</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-red-600">{summary.failed}</div>
            <div className="text-sm text-gray-600">실패</div>
          </div>
        </div>
      </div>

      {/* 메시지 API 테스트 */}
      <div className="mb-6 p-4 border border-gray-200 rounded-lg">
        <h3 className="text-lg font-semibold mb-3 text-blue-600">📨 메시지 API 테스트</h3>
        <div className="mb-3 text-sm text-gray-600">
          <strong>GET /api/messages</strong> - 전체 메시지 조회 (페이지네이션, 필터링, 검색 지원)
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          <button
            onClick={testMessagesAPI}
            disabled={isLoading['메시지 기본 조회']}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
          >
            {isLoading['메시지 기본 조회'] ? '로딩...' : '기본 조회'}
          </button>
          <button
            onClick={testMessagesWithLimit}
            disabled={isLoading['메시지 제한 조회']}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
          >
            {isLoading['메시지 제한 조회'] ? '로딩...' : '5개 제한'}
          </button>
          <button
            onClick={testMessagesSearch}
            disabled={isLoading['메시지 검색']}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
          >
            {isLoading['메시지 검색'] ? '로딩...' : '텍스트 검색'}
          </button>
          <button
            onClick={testMessagesBySender}
            disabled={isLoading['메시지 발신자별 필터링']}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
          >
            {isLoading['메시지 발신자별 필터링'] ? '로딩...' : '발신자별'}
          </button>
        </div>
        {testResults['메시지 기본 조회'] && (
          <div className={`p-3 rounded text-sm ${getStatusColor(testResults['메시지 기본 조회'].success)}`}>
            {getStatusIcon(testResults['메시지 기본 조회'].success)} 메시지 API 테스트 결과
          </div>
        )}
      </div>

      {/* 사용자 API 테스트 */}
      <div className="mb-6 p-4 border border-gray-200 rounded-lg">
        <h3 className="text-lg font-semibold mb-3 text-green-600">👥 사용자 API 테스트</h3>
        <div className="mb-3 text-sm text-gray-600">
          <strong>GET /api/users</strong> - 전체 사용자 조회 (페이지네이션, 검색, 역할별 필터링 지원)
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          <button
            onClick={testUsersAPI}
            disabled={isLoading['사용자 기본 조회']}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-400"
          >
            {isLoading['사용자 기본 조회'] ? '로딩...' : '기본 조회'}
          </button>
          <button
            onClick={testUsersWithLimit}
            disabled={isLoading['사용자 제한 조회']}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-400"
          >
            {isLoading['사용자 제한 조회'] ? '로딩...' : '3개 제한'}
          </button>
          <button
            onClick={testUsersSearch}
            disabled={isLoading['사용자 검색']}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-400"
          >
            {isLoading['사용자 검색'] ? '로딩...' : '이름 검색'}
          </button>
        </div>
        {testResults['사용자 기본 조회'] && (
          <div className={`p-3 rounded text-sm ${getStatusColor(testResults['사용자 기본 조회'].success)}`}>
            {getStatusIcon(testResults['사용자 기본 조회'].success)} 사용자 API 테스트 결과
          </div>
        )}
      </div>

      {/* 보안 API 테스트 */}
      <div className="mb-6 p-4 border border-gray-200 rounded-lg">
        <h3 className="text-lg font-semibold mb-3 text-red-600">🛡️ 보안 API 테스트</h3>
        <div className="mb-3 text-sm text-gray-600">
          <strong>GET /api/security</strong> - 전체 보안 위협 조회 (페이지네이션, 위협 유형별 필터링 지원)
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          <button
            onClick={testSecurityAPI}
            disabled={isLoading['보안 위협 기본 조회']}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:bg-gray-400"
          >
            {isLoading['보안 위협 기본 조회'] ? '로딩...' : '기본 조회'}
          </button>
          <button
            onClick={testSecurityWithLimit}
            disabled={isLoading['보안 위협 제한 조회']}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:bg-gray-400"
          >
            {isLoading['보안 위협 제한 조회'] ? '로딩...' : '3개 제한'}
          </button>
          <button
            onClick={testSecurityByType}
            disabled={isLoading['보안 위협 유형별 필터링']}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:bg-gray-400"
          >
            {isLoading['보안 위협 유형별 필터링'] ? '로딩...' : '유형별 필터링'}
          </button>
        </div>
        {testResults['보안 위협 기본 조회'] && (
          <div className={`p-3 rounded text-sm ${getStatusColor(testResults['보안 위협 기본 조회'].success)}`}>
            {getStatusIcon(testResults['보안 위협 기본 조회'].success)} 보안 API 테스트 결과
          </div>
        )}
      </div>

      {/* 헬스 API 테스트 */}
      <div className="mb-6 p-4 border border-gray-200 rounded-lg">
        <h3 className="text-lg font-semibold mb-3 text-purple-600">🔗 기존 API 테스트</h3>
        <div className="mb-3 text-sm text-gray-600">
          <strong>GET /health</strong> - 서버 상태 확인
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          <button
            onClick={testHealthAPI}
            disabled={isLoading['서버 상태 확인']}
            className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:bg-gray-400"
          >
            {isLoading['서버 상태 확인'] ? '로딩...' : '서버 상태 확인'}
          </button>
        </div>
        {testResults['서버 상태 확인'] && (
          <div className={`p-3 rounded text-sm ${getStatusColor(testResults['서버 상태 확인'].success)}`}>
            {getStatusIcon(testResults['서버 상태 확인'].success)} 헬스 API 테스트 결과
          </div>
        )}
      </div>

      {/* 전체 테스트 실행 버튼 */}
      <div className="text-center">
        <button
          onClick={runAllTests}
          className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-semibold"
        >
          🔄 모든 테스트 다시 실행
        </button>
      </div>

      {/* 상세 결과 표시 */}
      {Object.keys(testResults).length > 0 && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="text-lg font-semibold mb-3">📋 상세 테스트 결과</h3>
          <div className="space-y-2">
            {Object.entries(testResults).map(([testName, result]) => (
              <div key={testName} className="p-3 bg-white rounded border">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{testName}</span>
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                    result.success 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {result.success ? '성공' : '실패'}
                  </span>
                </div>
                {result.error && (
                  <div className="mt-2 text-sm text-red-600">
                    <strong>오류:</strong> {result.error}
                  </div>
                )}
                {result.data && (
                  <div className="mt-2 text-sm text-gray-600">
                    <strong>응답 크기:</strong> {JSON.stringify(result.data).length} 문자
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default APITestComponent;
