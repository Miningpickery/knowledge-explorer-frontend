import React, { useState, useEffect } from 'react';

interface DatabaseStatus {
  connection: {
    status: string;
    timestamp: string;
    version: string;
  };
  tables: {
    [key: string]: boolean;
  };
  recordCounts: {
    [key: string]: number;
  };
}

interface SampleData {
  id: number;
  [key: string]: any;
}

const DatabaseMonitor: React.FC = () => {
  const [databaseStatus, setDatabaseStatus] = useState<DatabaseStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sampleData, setSampleData] = useState<{
    users: SampleData[];
    chats: SampleData[];
    messages: SampleData[];
    memories: SampleData[];
  }>({
    users: [],
    chats: [],
    messages: [],
    memories: []
  });

  const checkDatabaseStatus = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/health/database/status`);
      
      if (response.ok) {
        const result = await response.json();
        setDatabaseStatus(result.data);
        console.log('✅ 데이터베이스 상태 확인 완료:', result.data);
      } else {
        throw new Error(`HTTP ${response.status}: 데이터베이스 상태 확인 실패`);
      }
    } catch (error) {
      console.error('❌ 데이터베이스 상태 확인 실패:', error);
      setError(error instanceof Error ? error.message : '알 수 없는 오류');
    } finally {
      setLoading(false);
    }
  };

  const loadSampleData = async (type: string) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/health/database/${type}/sample?limit=10`);
      
      if (response.ok) {
        const result = await response.json();
        setSampleData(prev => ({
          ...prev,
          [type]: result.data
        }));
        console.log(`✅ ${type} 샘플 데이터 로드 완료:`, result.data);
      } else {
        throw new Error(`HTTP ${response.status}: ${type} 샘플 데이터 로드 실패`);
      }
    } catch (error) {
      console.error(`❌ ${type} 샘플 데이터 로드 실패:`, error);
      setError(error instanceof Error ? error.message : '알 수 없는 오류');
    }
  };

  useEffect(() => {
    checkDatabaseStatus();
  }, []);

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('ko-KR');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'text-green-600';
      case 'error':
        return 'text-red-600';
      default:
        return 'text-yellow-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return '✅';
      case 'error':
        return '❌';
      default:
        return '⚠️';
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">데이터베이스 모니터</h2>
        <p className="text-gray-600">데이터베이스 연결 상태와 테이블 데이터를 확인합니다.</p>
      </div>

      {/* 새로고침 버튼 */}
      <div className="mb-6">
        <button
          onClick={checkDatabaseStatus}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? '확인 중...' : '상태 새로고침'}
        </button>
      </div>

      {/* 에러 표시 */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600">❌ 오류: {error}</p>
        </div>
      )}

      {/* 데이터베이스 연결 상태 */}
      {databaseStatus && (
        <div className="space-y-6">
          {/* 연결 상태 */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <h3 className="text-lg font-semibold mb-3">📡 연결 상태</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <span className="font-medium">상태: </span>
                <span className={getStatusColor(databaseStatus.connection.status)}>
                  {getStatusIcon(databaseStatus.connection.status)} {databaseStatus.connection.status}
                </span>
              </div>
              <div>
                <span className="font-medium">시간: </span>
                <span>{formatTimestamp(databaseStatus.connection.timestamp)}</span>
              </div>
              <div>
                <span className="font-medium">버전: </span>
                <span className="text-sm">{databaseStatus.connection.version}</span>
              </div>
            </div>
          </div>

          {/* 테이블 상태 */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <h3 className="text-lg font-semibold mb-3">📋 테이블 상태</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {Object.entries(databaseStatus.tables).map(([table, exists]) => (
                <div key={table} className="flex items-center">
                  <span className={exists ? 'text-green-600' : 'text-red-600'}>
                    {exists ? '✅' : '❌'} {table}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 레코드 수 */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <h3 className="text-lg font-semibold mb-3">📊 레코드 수</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {Object.entries(databaseStatus.recordCounts).map(([table, count]) => (
                <div key={table} className="flex items-center justify-between">
                  <span className="font-medium">{table}:</span>
                  <span className="text-blue-600 font-bold">{count.toLocaleString()}개</span>
                </div>
              ))}
            </div>
          </div>

          {/* 샘플 데이터 */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">📝 샘플 데이터</h3>
            
            {/* 사용자 데이터 */}
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold">👥 사용자</h4>
                <button
                  onClick={() => loadSampleData('users')}
                  className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                >
                  로드
                </button>
              </div>
              {sampleData.users.length > 0 && (
                <div className="space-y-2">
                  {sampleData.users.map((user) => (
                    <div key={user.user_id} className="text-sm">
                      <span className="font-medium">ID {user.user_id}:</span> {user.name} ({user.email})
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 채팅 세션 데이터 */}
            <div className="p-4 bg-green-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold">💬 채팅 세션</h4>
                <button
                  onClick={() => loadSampleData('chats')}
                  className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                >
                  로드
                </button>
              </div>
              {sampleData.chats.length > 0 && (
                <div className="space-y-2">
                  {sampleData.chats.map((chat) => (
                    <div key={chat.chat_id} className="text-sm">
                      <span className="font-medium">ID {chat.chat_id}:</span> {chat.title} (사용자: {chat.user_name || '익명'})
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 메시지 데이터 */}
            <div className="p-4 bg-yellow-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold">💭 메시지</h4>
                <button
                  onClick={() => loadSampleData('messages')}
                  className="px-3 py-1 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700"
                >
                  로드
                </button>
              </div>
              {sampleData.messages.length > 0 && (
                <div className="space-y-2">
                  {sampleData.messages.map((message) => (
                    <div key={message.message_id} className="text-sm">
                      <span className="font-medium">ID {message.message_id}:</span> {message.sender} - {message.text.substring(0, 50)}...
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 메모리 데이터 */}
            <div className="p-4 bg-purple-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold">🧠 메모리</h4>
                <button
                  onClick={() => loadSampleData('memories')}
                  className="px-3 py-1 bg-purple-600 text-white text-sm rounded hover:bg-purple-700"
                >
                  로드
                </button>
              </div>
              {sampleData.memories.length > 0 && (
                <div className="space-y-2">
                  {sampleData.memories.map((memory) => (
                    <div key={memory.memory_id} className="text-sm">
                      <span className="font-medium">ID {memory.memory_id}:</span> {memory.title} (중요도: {memory.importance})
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DatabaseMonitor;
