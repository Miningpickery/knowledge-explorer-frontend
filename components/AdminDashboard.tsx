import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../src/stores/authStore';
import APITestComponent from './APITestComponent';

interface SystemHealth {
  database: {
    status: string;
    timestamp: string;
    version: string;
    recordCounts: { [key: string]: number };
  };
  api: {
    status: string;
    responseTime: number;
    uptime: number;
  };
  frontend: {
    status: string;
    version: string;
  };
}

interface AdminUser {
  admin_id: number;  // 🚨 id → admin_id로 변경
  email: string;
  name: string;
  role: string;
  permissions: string[];
  created_at: string;
}

interface DatabaseTable {
  tableName: string;
  recordCount: number;
  columns: string[];
}

interface TableRecord {
  [key: string]: any;
}

interface BackupInfo {
  backup_id: number;
  filename: string;
  size: number;
  created_at: string;
  created_by: string;
  description?: string;
  exists: boolean;
  actual_size: number;
  last_modified?: string;
}

// 비밀번호 확인 팝업 컴포넌트
const PasswordModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (password: string) => void;
  title: string;
  message: string;
}> = ({ isOpen, onClose, onConfirm, title, message }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError('비밀번호를 입력해주세요.');
      return;
    }
    onConfirm(password);
    setPassword('');
    setError('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96 max-w-md">
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-gray-600 mb-4">{message}</p>
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              관리자 비밀번호
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="관리자 비밀번호를 입력하세요"
              autoFocus
            />
            {error && <p className="text-red-600 text-sm mt-1">{error}</p>}
          </div>
          
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              취소
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
            >
              확인
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const AdminDashboard: React.FC = () => {
  const { user } = useAuthStore();
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [databaseTables, setDatabaseTables] = useState<DatabaseTable[]>([]);
  const [tableData, setTableData] = useState<TableRecord[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'database' | 'users' | 'permissions' | 'apitest'>('overview');
  
  // 권한 부여 상태
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(['database_read']);

  // 백업 관련 상태
  const [backupName, setBackupName] = useState('');
  const [restoreFilename, setRestoreFilename] = useState('');

  // 비밀번호 확인 모달 상태
  const [passwordModal, setPasswordModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    action: 'delete' | 'update' | 'backup' | 'restore' | 'deleteUser' | 'download' | null;
    recordId?: string;
    updates?: any;
    step?: number; // 복원 단계 추가
    userEmail?: string; // 사용자 삭제용 이메일
  }>({
    isOpen: false,
    title: '',
    message: '',
    action: null
  });

  // 데이터베이스 탭으로 리다이렉트 상태
  const [redirectToDatabase, setRedirectToDatabase] = useState<{table: string, action: string, recordId?: string} | null>(null);
  const [showAPITest, setShowAPITest] = useState(false);

  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  // 권한 옵션
  const permissionOptions = [
    { value: 'database_read', label: '데이터베이스 읽기' },
    { value: 'database_write', label: '데이터베이스 쓰기' },
    { value: 'user_management', label: '사용자 관리' },
    { value: 'system_admin', label: '시스템 관리' }
  ];

  useEffect(() => {
    if (user?.email === 'miningpickery@gmail.com') {
      loadSystemHealth();
      loadAdminUsers();
      loadAllUsers();
      loadDatabaseTables();
      loadBackups();
    }
  }, [user]);

  // 데이터베이스 탭으로 리다이렉트 처리
  useEffect(() => {
    if (redirectToDatabase) {
      setActiveTab('database');
      setSelectedTable(redirectToDatabase.table);
      
      // 삭제 액션이면 해당 테이블 데이터 로드
      if (redirectToDatabase.action === 'delete' && redirectToDatabase.table) {
        loadTableData(redirectToDatabase.table);
      }
      
      setRedirectToDatabase(null);
    }
  }, [redirectToDatabase]);

  const loadSystemHealth = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_BASE}/api/admin/system/health`, {
        headers
      });
      
      if (response.ok) {
        const result = await response.json();
        setSystemHealth(result.data);
      } else {
        throw new Error(`HTTP ${response.status}: 시스템 상태 조회 실패`);
      }
    } catch (error) {
      console.error('❌ 시스템 상태 조회 실패:', error);
      setError(error instanceof Error ? error.message : '알 수 없는 오류');
    } finally {
      setLoading(false);
    }
  };

  const loadAdminUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_BASE}/api/admin/users`, {
        headers
      });
      
      if (response.ok) {
        const result = await response.json();
        setAdminUsers(result.data || []);
      } else {
        throw new Error(`HTTP ${response.status}: 관리자 목록 조회 실패`);
      }
    } catch (error) {
      console.error('❌ 관리자 목록 조회 실패:', error);
      setAdminUsers([]);
    }
  };

  const loadDatabaseTables = async () => {
    try {
      console.log('🔍 데이터베이스 테이블 로딩 시작...');
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_BASE}/api/admin/database/tables`, {
        headers
      });
      
      console.log('📡 API 응답 상태:', response.status, response.ok);
      
      if (response.ok) {
        const result = await response.json();
        console.log('📊 받은 데이터:', result);
        
        // 배열인지 확인하고 안전하게 설정
        if (Array.isArray(result.data)) {
          console.log('✅ 배열 데이터 확인됨, 길이:', result.data.length);
          setDatabaseTables(result.data);
        } else if (Array.isArray(result)) {
          console.log('✅ 직접 배열 데이터 확인됨, 길이:', result.length);
          setDatabaseTables(result);
        } else {
          console.warn('⚠️ 데이터베이스 테이블 데이터가 배열이 아닙니다:', result);
          setDatabaseTables([]);
        }
      } else {
        const errorText = await response.text();
        console.error('❌ API 응답 오류:', errorText);
        throw new Error(`HTTP ${response.status}: 데이터베이스 테이블 조회 실패`);
      }
    } catch (error) {
      console.error('❌ 데이터베이스 테이블 조회 실패:', error);
      setDatabaseTables([]);
    }
  };

  const loadTableData = async (tableName: string, limit: number = 50, offset: number = 0) => {
    try {
      console.log(`🔍 테이블 데이터 로딩 시작: ${tableName}`);
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_BASE}/api/admin/database/tables/${tableName}?limit=${limit}&offset=${offset}`, {
        headers
      });
      
      console.log('📡 테이블 데이터 API 응답 상태:', response.status, response.ok);
      
      if (response.ok) {
        const result = await response.json();
        console.log('📊 받은 테이블 데이터:', result);
        
        // 백엔드 응답 구조에 맞게 처리
        if (result.success && result.data && Array.isArray(result.data.data)) {
          console.log('✅ 테이블 데이터 배열 확인됨, 길이:', result.data.data.length);
          setTableData(result.data.data);
        } else if (result.success && result.data && result.data.data) {
          console.log('✅ 테이블 데이터 객체 확인됨');
          setTableData(result.data.data);
        } else {
          console.warn('⚠️ 테이블 데이터가 올바른 형식이 아닙니다:', result);
          setTableData([]);
        }
        setSelectedTable(tableName);
      } else {
        const errorText = await response.text();
        console.error('❌ API 응답 오류:', errorText);
        throw new Error(`HTTP ${response.status}: 테이블 데이터 조회 실패`);
      }
    } catch (error) {
      console.error('❌ 테이블 데이터 조회 실패:', error);
      setTableData([]);
    }
  };

  const loadBackups = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_BASE}/api/admin/database/backups`, {
        headers
      });
      
      if (response.ok) {
        const result = await response.json();
        // 배열인지 확인하고 안전하게 설정
        if (Array.isArray(result.data)) {
          setBackups(result.data);
        } else {
          console.warn('⚠️ 백업 데이터가 배열이 아닙니다:', result.data);
          setBackups([]);
        }
      } else {
        throw new Error(`HTTP ${response.status}: 백업 목록 조회 실패`);
      }
    } catch (error) {
      console.error('❌ 백업 목록 조회 실패:', error);
      setBackups([]);
    }
  };

  // 모든 사용자 목록 로드
  const loadAllUsers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_BASE}/api/users`, {
        headers
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success && Array.isArray(result.data)) {
          setAllUsers(result.data);
          console.log(`✅ 사용자 목록 로드 완료: ${result.data.length}명`);
        } else {
          console.warn('⚠️ 사용자 데이터가 올바른 형식이 아닙니다:', result);
          setAllUsers([]);
        }
      } else {
        throw new Error(`HTTP ${response.status}: 사용자 목록 조회 실패`);
      }
    } catch (error) {
      console.error('❌ 사용자 목록 조회 실패:', error);
      setAllUsers([]);
    } finally {
      setLoading(false);
    }
  };

  // 사용자 삭제 처리 (데이터베이스 탭으로 리다이렉트)
  // const handleDeleteUser = (userId: number, userEmail: string) => {
  //   if (!confirm(`정말로 사용자 "${userEmail}"을(를) 삭제하시겠습니까?\n\n⚠️ 이 작업은 되돌릴 수 없습니다!`)) {
  //     return;
  //   }

  //   setPasswordModal({
  //     isOpen: true,
  //     title: '사용자 삭제 1단계 확인',
  //     message: `사용자 "${userEmail}"을(를) 삭제하려고 합니다.\n\n🚨 위험한 작업입니다!\n\n• 사용자의 모든 채팅과 메모리가 삭제됩니다\n• 이 작업은 되돌릴 수 없습니다\n\n정말로 계속하시겠습니까?\n\n계속하려면 "확인"을 클릭하세요.`,
  //     action: 'deleteUser',
  //     recordId: userId.toString(),
  //     userEmail: userEmail,
  //     step: 1
  //   });
  // };

  // 백업 다운로드 처리 (보안 강화)
  const handleDownloadBackup = (filename: string) => {
    setPasswordModal({
      isOpen: true,
      title: '백업 다운로드 확인',
      message: `"${filename}" 백업 파일을 다운로드하려고 합니다.\n\n관리자 비밀번호를 입력하세요:`,
      action: 'download',
      recordId: filename
    });
  };

  const handleDeleteRecord = (tableName: string, recordId: string) => {
    setPasswordModal({
      isOpen: true,
      title: '레코드 삭제 확인',
      message: `정말로 ${tableName} 테이블의 레코드 ID ${recordId}를 삭제하시겠습니까?\n\n⚠️ 이 작업은 되돌릴 수 없습니다!`,
      action: 'delete',
      recordId
    });
  };

  const handleCreateBackup = () => {
    if (!backupName.trim()) {
      alert('백업 이름을 입력해주세요.');
      return;
    }

    setPasswordModal({
      isOpen: true,
      title: '백업 생성 확인',
      message: `정말로 "${backupName}" 이름으로 데이터베이스 백업을 생성하시겠습니까?\n\n⚠️ 이 작업은 시간이 걸릴 수 있습니다.`,
      action: 'backup'
    });
  };

  const handleRestoreBackup = (filename: string) => {
    if (!confirm(`⚠️ 백업 복원을 시작하려고 합니다!\n\n"${filename}" 백업으로 데이터베이스를 복원하려고 합니다.\n\n🚨 이 작업은 매우 위험합니다!\n\n• 현재 모든 데이터가 삭제됩니다\n• 백업 데이터로 완전히 교체됩니다\n• 이 작업은 되돌릴 수 없습니다\n\n정말로 계속하시겠습니까?`)) {
      return;
    }

    setRestoreFilename(filename);
    setPasswordModal({
      isOpen: true,
      title: '⚠️ 백업 복원 2단계 확인',
      message: `"${filename}" 백업으로 데이터베이스를 복원하려고 합니다.\n\n🔐 최종 확인을 위해 관리자 비밀번호를 입력하세요:\n\n⚠️ 이 작업은 되돌릴 수 없습니다!`,
      action: 'restore',
      step: 2
    });
  };

  const handleDeleteBackup = (filename: string) => {
    setPasswordModal({
      isOpen: true,
      title: '백업 삭제 확인',
      message: `정말로 "${filename}" 백업 파일을 삭제하시겠습니까?\n\n⚠️ 이 작업은 되돌릴 수 없습니다!`,
      action: 'delete',
      recordId: filename
    });
  };

   
  const handleUpdateRecord = (tableName: string, recordId: string, updates: any) => {
    setPasswordModal({
      isOpen: true,
      title: '레코드 업데이트 확인',
      message: `정말로 ${tableName} 테이블의 레코드 ID ${recordId}를 업데이트하시겠습니까?`,
      action: 'update',
      recordId,
      updates
    });
  };

  const handlePasswordConfirm = async (password: string) => {
    if (!passwordModal.action) {
      setPasswordModal({ isOpen: false, title: '', message: '', action: null });
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };

      let response;
      
      if (passwordModal.action === 'deleteUser' && passwordModal.recordId) {
        // 사용자 삭제 - 2단계 확인
        if (passwordModal.step === 1) {
          // 1단계: 비밀번호 확인 후 2단계로 진행
          setPasswordModal({
            ...passwordModal,
            title: '사용자 삭제 2단계 확인',
            message: `사용자 "${passwordModal.userEmail}"을(를) 삭제하려고 합니다.\n\n🔐 관리자 비밀번호를 다시 한 번 입력하세요:\n\n⚠️ 이 작업은 되돌릴 수 없습니다!`,
            step: 2
          });
          return; // 여기서 종료하고 2단계로 진행
        } else if (passwordModal.step === 2) {
          // 2단계: 기존 어드민 API를 사용하여 사용자 삭제
          response = await fetch(`${API_BASE}/api/admin/database/records/users/${passwordModal.recordId}`, {
            method: 'DELETE',
            headers,
            body: JSON.stringify({ password })
          });
        }
      } else if (passwordModal.action === 'delete' && passwordModal.recordId) {
        // 백업 삭제 또는 레코드 삭제
        if (selectedTable) {
          // 레코드 삭제
          response = await fetch(`${API_BASE}/api/admin/database/records/${selectedTable}/${passwordModal.recordId}`, {
            method: 'DELETE',
            headers,
            body: JSON.stringify({ password })
          });
        } else {
          // 백업 삭제
          response = await fetch(`${API_BASE}/api/admin/database/backups/${passwordModal.recordId}`, {
            method: 'DELETE',
            headers,
            body: JSON.stringify({ password })
          });
        }
      } else if (passwordModal.action === 'update') {
        response = await fetch(`${API_BASE}/api/admin/database/records/${selectedTable}/${passwordModal.recordId}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({ 
            password,
            updates: passwordModal.updates 
          })
        });
      } else if (passwordModal.action === 'backup') {
        // 백업 생성
        response = await fetch(`${API_BASE}/api/admin/database/backup`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ 
            password,
            backupName
          })
        });
      } else if (passwordModal.action === 'download') {
        // 백업 다운로드 (보안 강화)
        const downloadUrl = `${API_BASE}/api/admin/database/backups/${passwordModal.recordId}?password=${encodeURIComponent(password)}`;
        window.open(downloadUrl, '_blank');
        // 다운로드는 새 창에서 열리므로 응답 처리 불필요
        setPasswordModal({ isOpen: false, title: '', message: '', action: null });
        return;
      } else if (passwordModal.action === 'restore') {
        // 백업 복원
        response = await fetch(`${API_BASE}/api/admin/database/restore`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ 
            password,
            filename: restoreFilename
          })
        });
      }

      if (response?.ok) {
        const result = await response.json();
        setError(null); // 성공 시 에러 상태 초기화
        
        // 관련 데이터 새로고침
        if (passwordModal.action === 'backup' || passwordModal.action === 'restore') {
          loadBackups();
          setBackupName('');
          setRestoreFilename('');
        } else if (passwordModal.action === 'deleteUser') {
          loadAllUsers(); // 사용자 목록 새로고침
        } else if (passwordModal.action === 'delete') {
          if (selectedTable) {
            loadTableData(selectedTable);
          } else {
            loadBackups();
          }
        }
        
        // 성공 메시지 표시
        setError(`✅ ${result.message}`);
        setTimeout(() => setError(null), 3000);
      } else {
        const error = await response?.json();
        setError(`❌ 작업 실패: ${error?.error?.message || '알 수 없는 오류'}`);
      }
    } catch (error) {
      console.error('❌ 작업 실패:', error);
      alert('작업에 실패했습니다.');
    } finally {
      setPasswordModal({ isOpen: false, title: '', message: '', action: null });
    }
  };

  const handleGrantPermission = async () => {
    if (!newAdminEmail.trim()) {
      alert('이메일을 입력해주세요.');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_BASE}/api/admin/users/grant`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          targetEmail: newAdminEmail,
          permissions: selectedPermissions
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setError(null); // 성공 시 에러 상태 초기화
        setNewAdminEmail('');
        setSelectedPermissions(['database_read']);
        loadAdminUsers();
        // 성공 메시지는 에러 상태에 표시
        setError(`✅ ${result.message}`);
        setTimeout(() => setError(null), 3000); // 3초 후 자동 제거
      } else {
        const error = await response.json();
        setError(`❌ 권한 부여 실패: ${error.error.message}`);
      }
    } catch (error) {
      console.error('❌ 권한 부여 실패:', error);
      setError('❌ 권한 부여에 실패했습니다.');
    }
  };

  const handleRevokePermission = async (targetEmail: string) => {
    if (!confirm(`정말로 ${targetEmail}의 관리자 권한을 해제하시겠습니까?`)) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_BASE}/api/admin/users/revoke`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ targetEmail }),
      });

      if (response.ok) {
        const result = await response.json();
        setError(null);
        loadAdminUsers();
        setError(`✅ ${result.message}`);
        setTimeout(() => setError(null), 3000);
      } else {
        const error = await response.json();
        setError(`❌ 권한 해제 실패: ${error.error.message}`);
      }
    } catch (error) {
      console.error('❌ 권한 해제 실패:', error);
      setError('❌ 권한 해제에 실패했습니다.');
    }
  };

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}시간 ${minutes}분`;
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('ko-KR');
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))  } ${  sizes[i]}`;
  };

  // 관리자가 아닌 경우 접근 제한
  if (user?.email !== 'miningpickery@gmail.com') {
    return (
      <div className="p-6 bg-white rounded-lg shadow-md">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">접근 제한</h2>
          <p className="text-gray-600">관리자 권한이 필요합니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">관리자 대시보드</h2>
        <p className="text-gray-600">시스템 상태와 관리자 권한을 관리합니다.</p>
      </div>

      {/* 탭 네비게이션 */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'overview', label: '개요' },
            { id: 'database', label: '데이터베이스' },
            { id: 'users', label: '사용자 관리' },
            { id: 'permissions', label: '권한 관리' },
            { id: 'apitest', label: '🔧 API 테스트' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* 새로고침 버튼 */}
      <div className="mb-6">
        <button
          onClick={loadSystemHealth}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? '새로고침 중...' : '상태 새로고침'}
        </button>
      </div>

      {/* 에러 표시 */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600">❌ 오류: {error}</p>
        </div>
      )}

      {/* 개요 탭 */}
      {activeTab === 'overview' && systemHealth && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* 데이터베이스 상태 */}
            <div className="p-4 bg-blue-50 rounded-lg">
              <h3 className="text-lg font-semibold mb-3">🗄️ 데이터베이스</h3>
              <div className="space-y-2">
                <div>
                  <span className="font-medium">상태: </span>
                  <span className="text-green-600">✅ {systemHealth.database.status}</span>
                </div>
                <div>
                  <span className="font-medium">버전: </span>
                  <span className="text-sm">{systemHealth.database.version}</span>
                </div>
                <div>
                  <span className="font-medium">시간: </span>
                  <span className="text-sm">{formatTimestamp(systemHealth.database.timestamp)}</span>
                </div>
              </div>
            </div>

            {/* API 상태 */}
            <div className="p-4 bg-green-50 rounded-lg">
              <h3 className="text-lg font-semibold mb-3">🔌 API 서버</h3>
              <div className="space-y-2">
                <div>
                  <span className="font-medium">상태: </span>
                  <span className="text-green-600">✅ {systemHealth.api.status}</span>
                </div>
                <div>
                  <span className="font-medium">응답시간: </span>
                  <span>{systemHealth.api.responseTime}ms</span>
                </div>
                <div>
                  <span className="font-medium">가동시간: </span>
                  <span>{formatUptime(systemHealth.api.uptime)}</span>
                </div>
              </div>
            </div>

            {/* 프론트엔드 상태 */}
            <div className="p-4 bg-purple-50 rounded-lg">
              <h3 className="text-lg font-semibold mb-3">🌐 프론트엔드</h3>
              <div className="space-y-2">
                <div>
                  <span className="font-medium">상태: </span>
                  <span className="text-green-600">✅ {systemHealth.frontend.status}</span>
                </div>
                <div>
                  <span className="font-medium">버전: </span>
                  <span>{systemHealth.frontend.version}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 테이블별 레코드 수 */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <h3 className="text-lg font-semibold mb-3">📊 테이블별 레코드 수</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {Object.entries(systemHealth.database.recordCounts).map(([table, count]) => (
                <div key={table} className="flex items-center justify-between">
                  <span className="font-medium">{table}:</span>
                  <span className="text-blue-600 font-bold">{count.toLocaleString()}개</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 데이터베이스 탭 */}
      {activeTab === 'database' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">📊 데이터베이스 관리</h3>
              <p className="text-gray-600">데이터베이스 테이블과 레코드를 관리할 수 있습니다.</p>
            </div>
            <button
              onClick={loadDatabaseTables}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? '새로고침 중...' : '테이블 새로고침'}
            </button>
          </div>
          
          {/* 백업 관리 섹션 */}
          <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h4 className="text-lg font-semibold mb-4">💾 백업 관리</h4>
            
            {/* 백업 생성 */}
            <div className="mb-6">
              <div className="flex items-center space-x-4 mb-4">
                <input
                  type="text"
                  value={backupName}
                  onChange={(e) => setBackupName(e.target.value)}
                  placeholder="백업 이름 (선택사항)"
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleCreateBackup}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  백업 생성
                </button>
                <button
                  onClick={loadBackups}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  목록 새로고침
                </button>
              </div>
            </div>

            {/* 백업 목록 */}
            <div className="space-y-3">
              <h5 className="font-semibold">📋 백업 목록</h5>
              {backups.length === 0 ? (
                <p className="text-gray-500">백업 파일이 없습니다.</p>
              ) : (
                <div className="space-y-2">
                  {backups.map((backup) => (
                    <div key={backup.backup_id} className="flex items-center justify-between p-3 bg-white rounded border">
                      <div className="flex-1">
                        <div className="font-medium">{backup.filename}</div>
                        <div className="text-sm text-gray-600">
                          크기: {formatFileSize(backup.size)} | 
                          생성: {formatTimestamp(backup.created_at)} | 
                          생성자: {backup.created_by}
                        </div>
                        {!backup.exists && (
                          <div className="text-sm text-red-600">⚠️ 파일이 존재하지 않습니다</div>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleDownloadBackup(backup.filename)}
                          disabled={!backup.exists}
                          className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
                        >
                          다운로드
                        </button>
                        <button
                          onClick={() => handleRestoreBackup(backup.filename)}
                          disabled={!backup.exists}
                          className="px-3 py-1 bg-orange-600 text-white text-sm rounded hover:bg-orange-700 disabled:opacity-50"
                        >
                          복원
                        </button>
                        <button
                          onClick={() => handleDeleteBackup(backup.filename)}
                          className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          {/* 테이블 목록 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {databaseTables.map((table) => (
              <div key={table.tableName} className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold">{table.tableName}</h4>
                  <span className="text-sm text-gray-500">{table.recordCount}개 레코드</span>
                </div>
                <button
                  onClick={() => loadTableData(table.tableName)}
                  className="w-full px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm hover:bg-blue-200"
                >
                  데이터 보기
                </button>
              </div>
            ))}
          </div>

          {/* 테이블 데이터 */}
          {selectedTable && tableData.length > 0 && (
            <div className="mt-8">
              <h4 className="text-lg font-semibold mb-4">📋 {selectedTable} 테이블 데이터</h4>
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white border border-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {Object.keys(tableData[0]).map((column) => (
                        <th key={column} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                          {column}
                        </th>
                      ))}
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        작업
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {tableData.map((record, index) => (
                      <tr key={`${selectedTable}-${record[Object.keys(record)[0]] || index}`} className="hover:bg-gray-50">
                        {Object.values(record).map((value, colIndex) => (
                          <td key={`${selectedTable}-${index}-${colIndex}`} className="px-4 py-2 text-sm text-gray-900 border-b">
                            {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                          </td>
                        ))}
                        <td className="px-4 py-2 text-sm border-b">
                          <button
                            onClick={() => handleUpdateRecord(selectedTable, record[Object.keys(record)[0]], record)}
                            className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 mr-2"
                          >
                            수정
                          </button>
                          <button
                            onClick={() => handleDeleteRecord(selectedTable, record[Object.keys(record)[0]])}
                            className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                          >
                            삭제
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
          </div>
            </div>
          )}
        </div>
      )}

      {/* 사용자 관리 탭 */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          <h3 className="text-lg font-semibold">👥 사용자 관리</h3>
          
          {/* 일반 사용자 목록 */}
          <div className="p-4 bg-blue-50 rounded-lg">
            <h4 className="font-semibold mb-3">일반 사용자 목록</h4>
            <div className="mb-4 p-3 bg-blue-100 border border-blue-300 rounded-lg">
              <p className="text-sm text-blue-800">
                💡 <strong>사용자 삭제는 데이터베이스 탭에서 관리됩니다.</strong><br/>
                삭제 버튼을 클릭하면 자동으로 데이터베이스 탭으로 이동하여 안전하게 삭제할 수 있습니다.
              </p>
            </div>
            <div className="mb-4">
              <button
                onClick={loadAllUsers}
                disabled={loading}
                className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? '로딩 중...' : '사용자 목록 새로고침'}
              </button>
            </div>
            <div className="space-y-2">
              {allUsers.map((user) => (
                <div key={user.user_id} className="flex items-center justify-between p-3 bg-white rounded border">
                  <div>
                    <div className="font-medium">{user.name}</div>
                    <div className="text-sm text-gray-600">{user.email}</div>
                    <div className="text-xs text-gray-500">
                      회사: {user.company || '없음'} | 역할: {user.role || '없음'}
                    </div>
                    <div className="text-xs text-gray-400">
                      가입일: {formatTimestamp(user.created_at)}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                      일반 사용자
                    </span>
                    <button
                      onClick={() => {
                        setRedirectToDatabase({
                          table: 'users',
                          action: 'delete',
                          recordId: user.user_id.toString()
                        });
                      }}
                      className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                    >
                      데이터베이스에서 관리
                    </button>
                  </div>
                </div>
              ))}
              {allUsers.length === 0 && (
                <p className="text-gray-500 text-center py-4">사용자가 없습니다.</p>
              )}
            </div>
          </div>
          
          {/* 관리자 목록 */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <h4 className="font-semibold mb-3">현재 관리자 목록</h4>
            <div className="space-y-2">
              {adminUsers.map((admin) => (
                <div key={admin.admin_id} className="flex items-center justify-between p-3 bg-white rounded border">
                  <div>
                    <div className="font-medium">{admin.name}</div>
                    <div className="text-sm text-gray-600">{admin.email}</div>
                    <div className="text-xs text-gray-500">권한: {admin.permissions.join(', ')}</div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                      {admin.role}
                    </span>
                    {admin.email !== 'miningpickery@gmail.com' && (
                      <button
                        onClick={() => handleRevokePermission(admin.email)}
                        className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                      >
                        권한 해제
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 권한 관리 탭 */}
      {activeTab === 'permissions' && (
        <div className="space-y-6">
          <h3 className="text-lg font-semibold">🔐 권한 관리</h3>
          
          {/* 새 관리자 권한 부여 */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <h4 className="font-semibold mb-3">새 관리자 권한 부여</h4>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  이메일
                </label>
                <input
                  type="email"
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="admin@example.com"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  권한 선택
                </label>
                <div className="space-y-2">
                  {permissionOptions.map((option) => (
                    <label key={option.value} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={selectedPermissions.includes(option.value)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedPermissions([...selectedPermissions, option.value]);
                          } else {
                            setSelectedPermissions(selectedPermissions.filter(p => p !== option.value));
                          }
                        }}
                        className="mr-2"
                      />
                      <span className="text-sm">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              
              <button
                onClick={handleGrantPermission}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                권한 부여
              </button>
            </div>
          </div>
        </div>
      )}

      {/* API 테스트 탭 */}
      {activeTab === 'apitest' && (
        <div className="space-y-6">
          <h3 className="text-lg font-semibold">🔧 API 연동 테스트</h3>
          <div className="p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800 mb-4">
              💡 <strong>API 연동 상태를 테스트하고 디버깅할 수 있습니다.</strong><br/>
              백엔드 API와의 연결 상태, 응답 시간, 오류 등을 확인할 수 있습니다.
            </p>
            <APITestComponent />
          </div>
        </div>
      )}

      {/* 비밀번호 확인 모달 */}
      <PasswordModal
        isOpen={passwordModal.isOpen}
        onClose={() => setPasswordModal({ isOpen: false, title: '', message: '', action: null })}
        onConfirm={handlePasswordConfirm}
        title={passwordModal.title}
        message={passwordModal.message}
      />
    </div>
  );
};

export default AdminDashboard;
