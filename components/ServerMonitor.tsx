import React, { useState, useEffect } from 'react';

interface ServerStatus {
  status: 'online' | 'offline' | 'error';
  uptime: string;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  cpu: {
    usage: number;
    cores: number;
  };
  database: {
    status: 'connected' | 'disconnected' | 'error';
    connections: number;
  };
  api: {
    responseTime: number;
    requestsPerMinute: number;
  };
  lastUpdate: string;
}

const ServerMonitor: React.FC = () => {
  const [serverStatus, setServerStatus] = useState<ServerStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchServerStatus = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/admin/system/status');
      if (!response.ok) {
        throw new Error('서버 상태를 가져오는데 실패했습니다.');
      }
      const data = await response.json();
      setServerStatus(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '서버 연결 실패');
      setServerStatus(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServerStatus();
    // 10초마다 상태 업데이트
    const interval = setInterval(fetchServerStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
      case 'connected':
        return 'text-green-600 bg-green-100';
      case 'offline':
      case 'disconnected':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-yellow-600 bg-yellow-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online':
      case 'connected':
        return '🟢';
      case 'offline':
      case 'disconnected':
        return '🔴';
      default:
        return '🟡';
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          <strong>서버 모니터링 오류:</strong> {error}
          <button
            onClick={fetchServerStatus}
            className="ml-4 px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
          >
            재시도
          </button>
        </div>
      </div>
    );
  }

  if (!serverStatus) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded">
          서버 상태 정보를 가져올 수 없습니다.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">서버 모니터링</h1>
          <p className="text-gray-600">실시간 서버 상태 및 성능 모니터링</p>
          <p className="text-sm text-gray-500 mt-2">
            마지막 업데이트: {new Date(serverStatus.lastUpdate).toLocaleString()}
          </p>
        </div>

        {/* 상태 카드들 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* 서버 상태 */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">서버 상태</p>
                <p className="text-2xl font-bold text-gray-900">
                  {getStatusIcon(serverStatus.status)} {serverStatus.status}
                </p>
              </div>
              <div className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(serverStatus.status)}`}>
                {serverStatus.status}
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-2">업타임: {serverStatus.uptime}</p>
          </div>

          {/* 메모리 사용량 */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">메모리 사용량</p>
                <p className="text-2xl font-bold text-gray-900">
                  {serverStatus.memory.percentage.toFixed(1)}%
                </p>
              </div>
              <div className="w-16 h-16 relative">
                <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#e5e7eb"
                    strokeWidth="3"
                  />
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke={serverStatus.memory.percentage > 80 ? '#ef4444' : serverStatus.memory.percentage > 60 ? '#f59e0b' : '#10b981'}
                    strokeWidth="3"
                    strokeDasharray={`${serverStatus.memory.percentage}, 100`}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-xs font-medium">
                  {serverStatus.memory.percentage.toFixed(0)}%
                </div>
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-2">
              {Math.round(serverStatus.memory.used / 1024 / 1024)}MB / {Math.round(serverStatus.memory.total / 1024 / 1024)}MB
            </p>
          </div>

          {/* CPU 사용량 */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">CPU 사용량</p>
                <p className="text-2xl font-bold text-gray-900">
                  {serverStatus.cpu.usage.toFixed(1)}%
                </p>
              </div>
              <div className="w-16 h-16 relative">
                <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#e5e7eb"
                    strokeWidth="3"
                  />
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke={serverStatus.cpu.usage > 80 ? '#ef4444' : serverStatus.cpu.usage > 60 ? '#f59e0b' : '#10b981'}
                    strokeWidth="3"
                    strokeDasharray={`${serverStatus.cpu.usage}, 100`}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-xs font-medium">
                  {serverStatus.cpu.usage.toFixed(0)}%
                </div>
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-2">
              {serverStatus.cpu.cores} 코어
            </p>
          </div>

          {/* 데이터베이스 상태 */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">데이터베이스</p>
                <p className="text-2xl font-bold text-gray-900">
                  {getStatusIcon(serverStatus.database.status)} {serverStatus.database.status}
                </p>
              </div>
              <div className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(serverStatus.database.status)}`}>
                {serverStatus.database.status}
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-2">
              연결: {serverStatus.database.connections}개
            </p>
          </div>
        </div>

        {/* API 성능 */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">API 성능</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm font-medium text-gray-600">평균 응답 시간</p>
              <p className="text-3xl font-bold text-gray-900">
                {serverStatus.api.responseTime}ms
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">분당 요청 수</p>
              <p className="text-3xl font-bold text-gray-900">
                {serverStatus.api.requestsPerMinute}
              </p>
            </div>
          </div>
        </div>

        {/* 새로고침 버튼 */}
        <div className="text-center">
          <button
            onClick={fetchServerStatus}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            상태 새로고침
          </button>
        </div>
      </div>
    </div>
  );
};

export default ServerMonitor;
