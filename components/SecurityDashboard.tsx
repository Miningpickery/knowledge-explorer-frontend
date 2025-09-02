import React, { useState, useEffect } from 'react';

interface SecurityThreat {
  threat_id: number;
  threat_type: string;
  threat_level: string;
  question_preview: string;
  timestamp: string;
  handled: boolean;
}

interface SecurityStats {
  threat_type: string;
  threat_level: string;
  count: number;
  hour: string;
}

interface SecurityDashboardData {
  totalThreats: number;
  levelDistribution: Array<{ threat_level: string; count: number }>;
  hourlyStats: SecurityStats[];
  recentThreats: SecurityThreat[];
}

const SecurityDashboard: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<SecurityDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:3001/api/security/dashboard');
      if (!response.ok) {
        throw new Error('보안 대시보드 데이터를 가져오는데 실패했습니다.');
      }
      const result = await response.json();
      setDashboardData(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleThreat = async (threatId: number) => {
    try {
      const response = await fetch(`http://localhost:3001/api/security/threats/${threatId}/handle`, {
        method: 'PUT'
      });
      if (response.ok) {
        // 대시보드 데이터 새로고침
        fetchDashboardData();
      }
    } catch (err) {
      console.error('보안 위협 처리 실패:', err);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    // 30초마다 데이터 새로고침
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-8 bg-gray-200 rounded w-1/2 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
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
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-red-800 font-medium">오류 발생</h3>
          <p className="text-red-600 mt-1">{error}</p>
          <button
            onClick={fetchDashboardData}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="p-6">
        <p className="text-gray-500">데이터를 불러올 수 없습니다.</p>
      </div>
    );
  }

  const getThreatLevelColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getThreatTypeLabel = (type: string) => {
    switch (type) {
      case 'PROMPT_INJECTION':
        return '프롬프트 주입';
      case 'AI_IDENTITY':
        return 'AI 정체성 탐색';
      case 'SYSTEM_INFO':
        return '시스템 정보 탐색';
      default:
        return type;
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">보안 대시보드</h1>
          <p className="text-gray-600">AI 챗봇 보안 위협 모니터링</p>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">총 위협 수</p>
                <p className="text-2xl font-bold text-gray-900">{dashboardData.totalThreats}</p>
              </div>
            </div>
          </div>

          {dashboardData.levelDistribution.map((level) => (
            <div key={level.threat_level} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className={`p-2 rounded-lg ${
                  level.threat_level === 'HIGH' ? 'bg-red-100' :
                  level.threat_level === 'MEDIUM' ? 'bg-yellow-100' :
                  'bg-green-100'
                }`}>
                  <svg className={`w-6 h-6 ${
                    level.threat_level === 'HIGH' ? 'text-red-600' :
                    level.threat_level === 'MEDIUM' ? 'text-yellow-600' :
                    'text-green-600'
                  }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">{level.threat_level} 레벨</p>
                  <p className="text-2xl font-bold text-gray-900">{level.count}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 최근 위협 목록 */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">최근 보안 위협</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    시간
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    위협 유형
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    레벨
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    질문 미리보기
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    상태
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    작업
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {dashboardData.recentThreats.map((threat) => (
                  <tr key={threat.threat_id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(threat.timestamp).toLocaleString('ko-KR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {getThreatTypeLabel(threat.threat_type)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${getThreatLevelColor(threat.threat_level)}`}>
                        {threat.threat_level}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                      {threat.question_preview}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        threat.handled 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {threat.handled ? '처리됨' : '대기중'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {!threat.handled && (
                        <button
                          onClick={() => handleThreat(threat.threat_id)}
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          처리 완료
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 새로고침 버튼 */}
        <div className="mt-6 text-center">
          <button
            onClick={fetchDashboardData}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            데이터 새로고침
          </button>
        </div>
      </div>
    </div>
  );
};

export default SecurityDashboard;
