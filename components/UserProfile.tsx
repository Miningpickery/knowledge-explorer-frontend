import React, { useState, useEffect, useCallback } from 'react';

interface User {
  user_id: number;  // 🚨 id → user_id로 변경
  name: string;
  email: string;
  username?: string;
  profile_picture?: string;
  google_id?: string;
}

interface Memory {
  memory_id: number;  // 🚨 id → memory_id로 변경
  title: string;
  content: string;
  importance: number;
  created_at: string;
  tags?: string[];
}

interface UserProfileProps {
  user: User;
  onLogout: () => void;
  onProfileUpdate: (updatedUser: Partial<User>) => void;
}

const UserProfile: React.FC<UserProfileProps> = ({ user, onLogout, onProfileUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'memories'>('profile');
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loadingMemories, setLoadingMemories] = useState(false);
  const [editingMemory, setEditingMemory] = useState<Memory | null>(null);
  const [showMemoryForm, setShowMemoryForm] = useState(false);
  const [memoryFormData, setMemoryFormData] = useState({
    title: '',
    content: '',
    importance: 3,
    tags: ''
  });
  const [formData, setFormData] = useState({
    name: user.name || '',
    username: user.username || ''
  });

  // Google OAuth 정보를 기본값으로 설정
  useEffect(() => {
    if (user.name && !formData.name) {
      setFormData(prev => ({ ...prev, name: user.name }));
    }
    if (user.username && !formData.username) {
      setFormData(prev => ({ ...prev, username: user.username || '' }));
    }
  }, [user, formData.name, formData.username]);

  // 메모리 로드 함수
  const loadMemories = useCallback(async () => {
    if (activeTab === 'memories' && !loadingMemories) {
      setLoadingMemories(true);
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/memories`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          setMemories(data.data || []);
        }
      } catch (error) {
        console.error('메모리 로드 오류:', error);
      } finally {
        setLoadingMemories(false);
      }
    }
  }, [activeTab]); // 🚨 loadingMemories 의존성 제거

  // 메모리 생성/수정 함수
  const handleSaveMemory = async () => {
    try {
      const method = editingMemory ? 'PUT' : 'POST';
      const url = editingMemory 
        ? `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/memories/${editingMemory.memory_id}`
        : `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/memories`;

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          ...memoryFormData,
          tags: memoryFormData.tags ? memoryFormData.tags.split(',').map(t => t.trim()) : []
        })
      });

      if (response.ok) {
        const result = await response.json();
        
        if (result.success) {
          setShowMemoryForm(false);
          setEditingMemory(null);
          setMemoryFormData({ title: '', content: '', importance: 3, tags: '' });
          loadMemories(); // 새로고침
          
          console.log(`✅ 메모리 ${editingMemory ? '수정' : '생성'} 완료`);
        } else {
          throw new Error(result.error?.message || '메모리 저장 실패');
        }
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `HTTP ${response.status}: 메모리 저장 실패`);
      }
    } catch (error) {
      console.error('❌ 메모리 저장 실패:', error);
      alert(`메모리 저장에 실패했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    }
  };

  // 메모리 수정 시작
  const handleEditMemory = (memory: Memory) => {
    setEditingMemory(memory);
    setMemoryFormData({
      title: memory.title,
      content: memory.content,
      importance: memory.importance,
      tags: Array.isArray(memory.tags) ? memory.tags.join(', ') : ''
    });
    setShowMemoryForm(true);
  };

  // 메모리 삭제
  const handleDeleteMemory = async (memoryId: number) => {
    if (!confirm('정말 이 메모리를 삭제하시겠습니까?')) return;

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/memories/${memoryId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        
        if (result.success) {
          loadMemories(); // 새로고침
          console.log('✅ 메모리 삭제 완료');
        } else {
          throw new Error(result.error?.message || '메모리 삭제 실패');
        }
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `HTTP ${response.status}: 메모리 삭제 실패`);
      }
    } catch (error) {
      console.error('❌ 메모리 삭제 실패:', error);
      alert(`메모리 삭제에 실패했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    }
  };

  // 탭 변경 시 메모리 로드
  useEffect(() => {
    if (activeTab === 'memories') {
      loadMemories();
    }
  }, [activeTab, loadMemories]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        onProfileUpdate(formData);
        setIsEditing(false);
      } else {
        console.error('프로필 업데이트 실패');
      }
    } catch (error) {
      console.error('프로필 업데이트 오류:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      localStorage.removeItem('token');
      onLogout();
    } catch (error) {
      console.error('로그아웃 오류:', error);
      localStorage.removeItem('token');
      onLogout();
    }
  };

  return (
    <div className="bg-white">
      <div className="w-full">
        {/* 헤더 */}
        <div className="text-center mb-6">
          <h1 className="text-xl font-semibold text-gray-900 mb-1">프로필</h1>
          <p className="text-sm text-gray-600">개인정보를 관리하세요</p>
        </div>

                         {/* 탭 네비게이션 */}
        <div className="bg-gray-50 rounded-xl overflow-hidden mb-4">
          <div className="flex">
            <button
              onClick={() => setActiveTab('profile')}
              className={`flex-1 py-3 px-4 text-sm font-medium transition-all duration-200 relative ${
                activeTab === 'profile'
                  ? 'text-blue-600 bg-white'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center justify-center space-x-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span>개인정보</span>
              </div>
              {activeTab === 'profile' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500"></div>
              )}
            </button>
            <button
              onClick={() => setActiveTab('memories')}
              className={`flex-1 py-3 px-4 text-sm font-medium transition-all duration-200 relative ${
                activeTab === 'memories'
                  ? 'text-blue-600 bg-white'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center justify-center space-x-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>메모리 관리</span>
              </div>
              {activeTab === 'memories' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500"></div>
              )}
            </button>
          </div>
        </div>

        {/* 프로필 카드 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {activeTab === 'profile' ? (
            <>
              {/* 프로필 이미지 섹션 */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-8 text-center">
            <div className="inline-block relative">
              {user.profile_picture ? (
                <img 
                  src={user.profile_picture} 
                  alt={user.name || 'User'}
                  className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center border-4 border-white shadow-lg">
                  <span className="text-3xl font-semibold text-white">
                    {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                  </span>
                </div>
              )}
              {user.google_id && (
                <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-1 shadow-md">
                  <svg className="w-5 h-5 text-red-500" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                </div>
              )}
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mt-4">{user.name || '사용자'}</h2>
            <p className="text-gray-600 text-sm">{user.email}</p>
            {user.google_id && (
              <p className="text-xs text-gray-500 mt-1">Google 계정으로 연결됨</p>
            )}
          </div>

          {/* 정보 섹션 */}
          <div className="p-6">
            {isEditing ? (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    이름
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="이름을 입력하세요"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    사용자명
                  </label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="사용자명을 입력하세요"
                  />
                  <p className="text-xs text-gray-500 mt-1">채팅에서 표시될 이름입니다</p>
                </div>
                
                                 <div className="flex space-x-3 pt-4">
                   <button
                     type="submit"
                     className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-600 text-white py-3 px-4 rounded-xl font-medium hover:from-blue-600 hover:to-indigo-700 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105 flex items-center justify-center space-x-2"
                   >
                     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                     </svg>
                     <span>저장</span>
                   </button>
                   <button
                     type="button"
                     onClick={() => setIsEditing(false)}
                     className="flex-1 bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 py-3 px-4 rounded-xl font-medium hover:from-gray-200 hover:to-gray-300 transition-all duration-200 flex items-center justify-center space-x-2"
                   >
                     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                     </svg>
                     <span>취소</span>
                   </button>
                 </div>
              </form>
            ) : (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    이름
                  </label>
                  <div className="px-4 py-3 bg-gray-50 rounded-xl">
                    <p className="text-gray-900">{user.name || '미설정'}</p>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    사용자명
                  </label>
                  <div className="px-4 py-3 bg-gray-50 rounded-xl">
                    <p className="text-gray-900">{user.username || '미설정'}</p>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    이메일
                  </label>
                  <div className="px-4 py-3 bg-gray-50 rounded-xl">
                    <p className="text-gray-900">{user.email}</p>
                  </div>
                </div>

                                 <div className="pt-4 space-y-3">
                   <button
                     onClick={() => setIsEditing(true)}
                     className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white py-3 px-4 rounded-xl font-medium hover:from-blue-600 hover:to-indigo-700 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105 flex items-center justify-center space-x-2"
                   >
                     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                     </svg>
                     <span>프로필 수정</span>
                   </button>
                   <button
                     onClick={handleLogout}
                     className="w-full bg-gradient-to-r from-red-50 to-pink-50 text-red-600 py-3 px-4 rounded-xl font-medium hover:from-red-100 hover:to-pink-100 transition-all duration-200 border border-red-200 hover:border-red-300 flex items-center justify-center space-x-2"
                   >
                     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                     </svg>
                     <span>로그아웃</span>
                   </button>
                 </div>
              </div>
            )}
          </div>
        </>
      ) : (
                 /* 메모리 관리 섹션 */
         <div className="p-6">
           <div className="flex justify-between items-center mb-6">
             <div className="flex items-center space-x-3">
               <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                 <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                 </svg>
               </div>
               <div>
                 <h3 className="text-lg font-semibold text-gray-900">장기 메모리 관리</h3>
                 <p className="text-sm text-gray-500">채팅에서 저장된 중요한 정보들</p>
               </div>
             </div>
             <button 
              onClick={() => setShowMemoryForm(true)}
              className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
            >
               <div className="flex items-center space-x-2">
                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                 </svg>
                 <span>새 메모리</span>
               </div>
             </button>
           </div>

           {loadingMemories ? (
             <div className="text-center py-12">
               <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600 mx-auto mb-4"></div>
               <p className="text-gray-500 font-medium">메모리를 불러오는 중...</p>
               <p className="text-sm text-gray-400 mt-1">잠시만 기다려주세요</p>
             </div>
           ) : memories.length === 0 ? (
             <div className="text-center py-12">
               <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-6">
                 <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                 </svg>
               </div>
               <h4 className="text-lg font-medium text-gray-900 mb-2">아직 저장된 메모리가 없습니다</h4>
               <p className="text-gray-500 mb-4">채팅을 통해 중요한 정보를 저장해보세요</p>
               <div className="inline-flex items-center space-x-2 text-sm text-blue-600">
                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                 </svg>
                 <span>채팅에서 자동으로 중요한 내용이 저장됩니다</span>
               </div>
             </div>
           ) : (
             <div className="space-y-4">
               {memories.map((memory) => (
                 <div key={memory.memory_id} className="group bg-white border border-gray-200 rounded-xl p-5 hover:shadow-lg hover:border-blue-200 transition-all duration-200">
                   <div className="flex justify-between items-start mb-3">
                     <div className="flex items-center space-x-3">
                       <div className="w-8 h-8 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-lg flex items-center justify-center">
                         <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                         </svg>
                       </div>
                       <h4 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">{memory.title}</h4>
                     </div>
                     <div className="flex space-x-2 text-sm opacity-0 group-hover:opacity-100 transition-opacity">
                                             <button 
                        onClick={() => handleEditMemory(memory)}
                        className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded transition-colors"
                        title="수정"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button 
                        onClick={() => handleDeleteMemory(memory.memory_id)}
                        className="text-red-600 hover:text-red-800 hover:bg-red-50 px-2 py-1 rounded transition-colors"
                        title="삭제"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                     </div>
                   </div>
                   
                   <div className="flex items-center justify-between text-sm text-gray-500 mb-3">
                     <div className="flex items-center space-x-4">
                       <div className="flex items-center space-x-1">
                         <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                           <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                         </svg>
                         <span>중요도 {memory.importance}/5</span>
                       </div>
                       <div className="flex items-center space-x-1">
                         <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                         </svg>
                         <span>{new Date(memory.created_at).toLocaleDateString('ko-KR')}</span>
                       </div>
                     </div>
                   </div>
                   
                   <p className="text-gray-700 text-sm leading-relaxed mb-4 line-clamp-3">{memory.content}</p>
                   
                   <div className="flex space-x-2">
                     <button className="bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 px-3 py-1.5 rounded-lg text-xs font-medium hover:from-blue-100 hover:to-indigo-100 transition-all duration-200 flex items-center space-x-1">
                       <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                       </svg>
                       <span>대화요약</span>
                     </button>
                     <button className="bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 px-3 py-1.5 rounded-lg text-xs font-medium hover:from-green-100 hover:to-emerald-100 transition-all duration-200 flex items-center space-x-1">
                       <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                       </svg>
                       <span>자동생성</span>
                     </button>
                   </div>
                 </div>
               ))}
             </div>
           )}
         </div>
      )}
        </div>

        {/* 추가 정보 */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500">
            Google 계정으로 로그인하여 안전하게 서비스를 이용하세요
          </p>
        </div>
      </div>

      {/* 메모리 생성/수정 폼 모달 */}
      {showMemoryForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  {editingMemory ? '메모리 수정' : '새 메모리 생성'}
                </h3>
                <button
                  onClick={() => {
                    setShowMemoryForm(false);
                    setEditingMemory(null);
                    setMemoryFormData({ title: '', content: '', importance: 3, tags: '' });
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">제목</label>
                  <input
                    type="text"
                    value={memoryFormData.title}
                    onChange={(e) => setMemoryFormData(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="메모리 제목을 입력하세요"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">내용</label>
                  <textarea
                    value={memoryFormData.content}
                    onChange={(e) => setMemoryFormData(prev => ({ ...prev, content: e.target.value }))}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="메모리 내용을 입력하세요"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">중요도 (1-5)</label>
                  <select
                    value={memoryFormData.importance}
                    onChange={(e) => setMemoryFormData(prev => ({ ...prev, importance: parseInt(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={1}>1 - 낮음</option>
                    <option value={2}>2</option>
                    <option value={3}>3 - 보통</option>
                    <option value={4}>4</option>
                    <option value={5}>5 - 높음</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">태그 (쉼표로 구분)</label>
                  <input
                    type="text"
                    value={memoryFormData.tags}
                    onChange={(e) => setMemoryFormData(prev => ({ ...prev, tags: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="태그1, 태그2, 태그3"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowMemoryForm(false);
                    setEditingMemory(null);
                    setMemoryFormData({ title: '', content: '', importance: 3, tags: '' });
                  }}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  onClick={handleSaveMemory}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors"
                >
                  {editingMemory ? '수정' : '생성'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserProfile;
