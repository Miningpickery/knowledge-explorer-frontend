import React, { useState, useEffect, useCallback } from 'react';
import { FileText, Zap, X, User, Edit, LogOut, Calendar, Star, Plus, Save, Trash2, Brain } from 'lucide-react';

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
  isReadOnly?: boolean; // 읽기 전용 메모리 플래그
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
      const isEditing = !!editingMemory;
      const method = isEditing ? 'PUT' : 'POST';
      const url = isEditing 
        ? `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/memories/${editingMemory!.memory_id}`
        : `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/memories`;

      console.log('🔍 메모리 저장 요청:', { method, url, data: memoryFormData });

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          title: memoryFormData.title,
          content: memoryFormData.content,
          importance: memoryFormData.importance,
          tags: memoryFormData.tags ? memoryFormData.tags.split(',').map(t => t.trim()) : []
        })
      });

      console.log('🔍 메모리 저장 응답:', { status: response.status, ok: response.ok });

      if (response.ok) {
        const result = await response.json();
        console.log('🔍 메모리 저장 결과:', result);
        
        if (result.success) {
          setShowMemoryForm(false);
          setEditingMemory(null);
          setMemoryFormData({ title: '', content: '', importance: 3, tags: '' });
          
          // 메모리 목록 새로고침
          await loadMemories();
          
          console.log(`✅ 메모리 ${isEditing ? '수정' : '생성'} 완료`);
        } else {
          throw new Error(result.error?.message || '메모리 저장 실패');
        }
      } else {
        const errorData = await response.json();
        console.error('🔍 메모리 저장 에러 응답:', errorData);
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
    <div className="bg-white h-screen overflow-hidden flex flex-col">
      <div className="w-full flex-1 overflow-hidden">


        {/* 탭 네비게이션 */}
        <div className="bg-gray-50 rounded-xl overflow-hidden mb-4 mx-6">
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
                <User className="w-4 h-4" />
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
                <FileText className="w-4 h-4" />
                <span>메모리 관리</span>
              </div>
              {activeTab === 'memories' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500"></div>
              )}
            </button>
          </div>
        </div>

        {/* 프로필 카드 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mx-6 flex-1 flex flex-col" style={{ height: 'calc(100vh - 200px)' }}>
          {activeTab === 'profile' ? (
            <>
              {/* 프로필 이미지 섹션 */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-8 text-center flex-shrink-0">
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
              <div className="p-6 flex-1">
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
                        <Save className="w-4 h-4" />
                        <span>저장</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEditing(false)}
                        className="flex-1 bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 py-3 px-4 rounded-xl font-medium hover:from-gray-200 hover:to-gray-300 transition-all duration-200 flex items-center justify-center space-x-2"
                      >
                        <X className="w-4 h-4" />
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
                        className="w-full bg-gray-700 hover:bg-gray-600 text-white py-3 px-4 rounded-xl font-medium transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105 flex items-center justify-center space-x-2"
                      >
                        <Edit className="w-4 h-4" />
                        <span>프로필 수정</span>
                      </button>
                      <button
                        onClick={handleLogout}
                        className="w-full bg-gradient-to-r from-red-50 to-pink-50 text-red-600 py-3 px-4 rounded-xl font-medium hover:from-red-100 hover:to-pink-100 transition-all duration-200 border border-red-200 hover:border-red-300 flex items-center justify-center space-x-2"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>로그아웃</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* 메모리 관리 섹션 */
            <div className="p-6 flex-1 overflow-hidden flex flex-col">
              <div className="flex justify-between items-center mb-6 flex-shrink-0">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg flex items-center justify-center">
                    <Brain className="w-5 h-5 text-gray-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">장기 메모리 관리</h3>
                    <p className="text-sm text-gray-500">저장된 중요 정보</p>
                  </div>
                </div>
                <button 
                 onClick={() => setShowMemoryForm(true)}
                 className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105 whitespace-nowrap"
               >
                  <div className="flex items-center space-x-2">
                    <Plus className="w-4 h-4" />
                    <span>추가</span>
                  </div>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto sidebar-scroll" style={{ maxHeight: 'calc(100vh - 300px)' }}>
                {loadingMemories ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-500 font-medium">메모리를 불러오는 중...</p>
                    <p className="text-sm text-gray-400 mt-1">잠시만 기다려주세요</p>
                  </div>
                ) : memories.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-6">
                      <FileText className="w-10 h-10 text-gray-400" />
                    </div>
                    <h4 className="text-lg font-medium text-gray-900 mb-2">아직 저장된 메모리가 없습니다</h4>
                    <p className="text-gray-500 mb-4">채팅을 통해 중요한 정보를 저장해보세요</p>
                    <div className="inline-flex items-center space-x-2 text-sm text-blue-600">
                      <FileText className="w-4 h-4" />
                      <span>채팅에서 자동으로 중요한 내용이 저장됩니다</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {memories.map((memory) => (
                      <div key={memory.memory_id} className="group bg-white border border-gray-200 rounded-xl p-5 hover:shadow-lg hover:border-blue-200 transition-all duration-200">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center space-x-3 flex-1 min-w-0">
                            <div className="w-8 h-8 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                              <FileText className="w-4 h-4 text-gray-600" />
                            </div>
                            <h4 className="font-semibold text-gray-900 group-hover:text-gray-700 transition-colors truncate flex-1 min-w-0" title={memory.title}>{memory.title}</h4>
                          </div>
                          <div className="flex space-x-2 text-sm flex-shrink-0 ml-3">
                             {!memory.isReadOnly && (
                               <>
                                 <button 
                                   onClick={() => handleEditMemory(memory)}
                                   className="text-gray-600 hover:text-gray-800 hover:bg-gray-100 px-2 py-1 rounded transition-colors"
                                   title="수정"
                                 >
                                   <Edit className="w-4 h-4" />
                                 </button>
                                 <button 
                                   onClick={() => handleDeleteMemory(memory.memory_id)}
                                   className="text-red-600 hover:text-red-800 hover:bg-red-50 px-2 py-1 rounded transition-colors"
                                   title="삭제"
                                 >
                                   <Trash2 className="w-4 h-4" />
                                 </button>
                               </>
                             )}
                             {memory.isReadOnly && (
                               <span className="text-xs text-gray-500 px-2 py-1 bg-gray-100 rounded">
                                 읽기 전용
                               </span>
                             )}
                           </div>
                        </div>
                        
                        <div className="flex items-center justify-between text-sm text-gray-500 mb-3">
                          <div className="flex items-center space-x-4">
                            <div className="flex items-center space-x-1">
                              <Star className="w-4 h-4 text-yellow-500" />
                              <span>중요도 {memory.importance}/5</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <Calendar className="w-4 h-4 text-gray-400" />
                              <span>{new Date(memory.created_at).toLocaleDateString('ko-KR')}</span>
                            </div>
                          </div>
                        </div>
                        
                        <p className="text-gray-700 text-sm leading-relaxed mb-4 line-clamp-3">{memory.content}</p>
                        
                        <div className="flex space-x-2 overflow-hidden">
                          {memory.tags && memory.tags.length > 0 ? (
                            memory.tags.slice(0, 2).map((tag, index) => (
                              <span key={index} className="bg-gradient-to-r from-gray-50 to-gray-100 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap truncate" title={tag}>
                                {tag}
                              </span>
                            ))
                          ) : (
                            <>
                              <span className="bg-gradient-to-r from-gray-50 to-gray-100 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap">
                                <FileText className="w-3 h-3 inline mr-1" />
                                대화요약
                              </span>
                              <span className="bg-gradient-to-r from-gray-50 to-gray-100 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap">
                                <Zap className="w-3 h-3 inline mr-1" />
                                자동생성
                              </span>
                            </>
                          )}
                          {memory.tags && memory.tags.length > 2 && (
                            <span className="bg-gradient-to-r from-gray-50 to-gray-100 text-gray-500 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap">
                              +{memory.tags.length - 2}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>


      </div>

      {/* 메모리 생성/수정 폼 모달 */}
      {showMemoryForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-hidden shadow-xl">
            <div className="p-6 max-h-[calc(90vh-2rem)] overflow-y-auto">
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
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-6 h-6" />
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
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

              <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
                <button
                  onClick={() => {
                    setShowMemoryForm(false);
                    setEditingMemory(null);
                    setMemoryFormData({ title: '', content: '', importance: 3, tags: '' });
                  }}
                  className="px-4 py-2.5 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors font-medium"
                >
                  취소
                </button>
                <button
                  onClick={handleSaveMemory}
                  className="px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors flex items-center space-x-2 font-medium"
                >
                  <Save className="w-4 h-4" />
                  <span>{editingMemory ? '수정' : '생성'}</span>
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
