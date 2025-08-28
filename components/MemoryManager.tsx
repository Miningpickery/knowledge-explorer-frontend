import React, { useState, useEffect } from 'react';

interface Memory {
  id: number;
  title: string;
  content: string;
  importance: number;
  tags: string[];
  memory_type: string;
  created_at: string;
  updated_at: string;
}

interface MemoryManagerProps {
  userId: number;
}

const MemoryManager: React.FC<MemoryManagerProps> = ({ userId }) => {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingMemory, setEditingMemory] = useState<Memory | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    importance: 1,
    tags: [] as string[],
    memory_type: 'conversation'
  });

  useEffect(() => {
    fetchMemories();
  }, [userId]);

  const fetchMemories = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/memories`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const responseData = await response.json();
        // API 응답이 { success: true, data: [...] } 형태로 오므로 data 필드를 사용
        const memoriesArray = responseData.data || [];
        setMemories(memoriesArray);
      }
    } catch (error) {
      console.error('메모리 로딩 오류:', error);
      setMemories([]); // 에러 시 빈 배열로 설정
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/memories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        const responseData = await response.json();
        console.log('메모리 생성 성공:', responseData);
        setShowCreateForm(false);
        setFormData({ title: '', content: '', importance: 1, tags: [], memory_type: 'conversation' });
        fetchMemories();
      } else {
        const errorData = await response.json();
        console.error('메모리 생성 실패:', errorData);
      }
    } catch (error) {
      console.error('메모리 생성 오류:', error);
    }
  };

  const handleUpdateMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMemory) return;

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/memories/${editingMemory.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        const responseData = await response.json();
        console.log('메모리 수정 성공:', responseData);
        setEditingMemory(null);
        setFormData({ title: '', content: '', importance: 1, tags: [], memory_type: 'conversation' });
        fetchMemories();
      } else {
        const errorData = await response.json();
        console.error('메모리 수정 실패:', errorData);
      }
    } catch (error) {
      console.error('메모리 수정 오류:', error);
    }
  };

  const handleDeleteMemory = async (memoryId: number) => {
    if (!confirm('정말로 이 메모리를 삭제하시겠습니까?')) return;

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/memories/${memoryId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const responseData = await response.json();
        console.log('메모리 삭제 성공:', responseData);
        fetchMemories();
      } else {
        const errorData = await response.json();
        console.error('메모리 삭제 실패:', errorData);
      }
    } catch (error) {
      console.error('메모리 삭제 오류:', error);
    }
  };

  const handleEditMemory = (memory: Memory) => {
    setEditingMemory(memory);
    setFormData({
      title: memory.title,
      content: memory.content,
      importance: memory.importance,
      tags: memory.tags,
      memory_type: memory.memory_type
    });
  };

  const handleTagsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const tags = e.target.value.split(',').map(tag => tag.trim()).filter(tag => tag);
    setFormData({ ...formData, tags });
  };

  if (loading) {
    return <div className="text-center py-8">메모리를 불러오는 중...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">장기 메모리 관리</h2>
        <button
          onClick={() => setShowCreateForm(true)}
          className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition-colors"
        >
          새 메모리 추가
        </button>
      </div>

      {/* 메모리 생성/수정 폼 */}
      {(showCreateForm || editingMemory) && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">
            {editingMemory ? '메모리 수정' : '새 메모리 추가'}
          </h3>
          <form onSubmit={editingMemory ? handleUpdateMemory : handleCreateMemory} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">제목</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">내용</label>
              <textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={4}
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">중요도</label>
              <select
                value={formData.importance}
                onChange={(e) => setFormData({ ...formData, importance: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={1}>1 - 낮음</option>
                <option value={2}>2 - 보통</option>
                <option value={3}>3 - 중간</option>
                <option value={4}>4 - 높음</option>
                <option value={5}>5 - 매우 높음</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">태그 (쉼표로 구분)</label>
              <input
                type="text"
                value={formData.tags.join(', ')}
                onChange={handleTagsChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="예: 비즈니스, 전략, 마케팅"
              />
            </div>
            
            <div className="flex space-x-2">
              <button
                type="submit"
                className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition-colors"
              >
                {editingMemory ? '수정' : '추가'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false);
                  setEditingMemory(null);
                  setFormData({ title: '', content: '', importance: 1, tags: [], memory_type: 'conversation' });
                }}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400 transition-colors"
              >
                취소
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 메모리 목록 */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-8 text-gray-500">
            메모리를 불러오는 중...
          </div>
        ) : !Array.isArray(memories) || memories.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            아직 저장된 메모리가 없습니다.
          </div>
        ) : (
          memories.map((memory) => (
            <div key={memory.id} className="bg-white rounded-lg shadow-md p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">{memory.title}</h3>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className="text-sm text-gray-500">
                      중요도: {memory.importance}/5
                    </span>
                    <span className="text-sm text-gray-500">
                      {new Date(memory.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleEditMemory(memory)}
                    className="text-blue-500 hover:text-blue-700 text-sm"
                  >
                    수정
                  </button>
                  <button
                    onClick={() => handleDeleteMemory(memory.id)}
                    className="text-red-500 hover:text-red-700 text-sm"
                  >
                    삭제
                  </button>
                </div>
              </div>
              
              <p className="text-gray-700 mb-3">{memory.content}</p>
              
              {memory.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {memory.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-xs"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default MemoryManager;
