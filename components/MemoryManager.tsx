import React, { useState, useEffect } from 'react';
import { Button } from './ui/Button';
import { FileText, Star, Calendar, Edit, Trash, Plus, Zap } from 'lucide-react';
import { cn } from '../lib/utils';

interface Memory {
  memory_id: number;  // 🚨 id → memory_id로 변경
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
        const memoriesArray = responseData.data || [];
        setMemories(memoriesArray);
      }
    } catch (error) {
      console.error('메모리 로딩 오류:', error);
      setMemories([]);
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
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/memories/${editingMemory.memory_id}`, {
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

  const renderImportanceStars = (importance: number) => {
    return (
      <div className="flex items-center gap-1">
        <Star className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">{importance}/5</span>
      </div>
    );
  };

  const renderActionButtons = (memory: Memory) => {
    return (
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleEditMemory(memory)}
          className="flex items-center gap-1"
        >
          <FileText className="w-3 h-3" />
          <span className="hidden sm:inline">대화요약</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleEditMemory(memory)}
          className="flex items-center gap-1"
        >
          <Zap className="w-3 h-3" />
          <span className="hidden sm:inline">자동생성</span>
        </Button>
      </div>
    );
  };

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">메모리를 불러오는 중...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* 헤더 */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <FileText className="w-4 h-4 text-primary-foreground" />
          </div>
          <h2 className="text-2xl font-semibold text-foreground">장기 메모리 관리</h2>
        </div>
        <Button
          onClick={() => setShowCreateForm(true)}
          variant="primary"
          size="sm"
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>새 메모리</span>
        </Button>
      </div>

      {/* 메모리 생성/수정 폼 */}
      {(showCreateForm || editingMemory) && (
        <div className="bg-card rounded-lg shadow-soft p-6 mb-6 border border-border">
          <h3 className="text-lg font-semibold mb-4 text-card-foreground">
            {editingMemory ? '메모리 수정' : '새 메모리 추가'}
          </h3>
          <form onSubmit={editingMemory ? handleUpdateMemory : handleCreateMemory} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-card-foreground mb-1">제목</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring bg-background text-foreground"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-card-foreground mb-1">내용</label>
              <textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring bg-background text-foreground"
                rows={4}
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-card-foreground mb-1">중요도</label>
              <select
                value={formData.importance}
                onChange={(e) => setFormData({ ...formData, importance: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring bg-background text-foreground"
              >
                <option value={1}>1 - 낮음</option>
                <option value={2}>2 - 보통</option>
                <option value={3}>3 - 중간</option>
                <option value={4}>4 - 높음</option>
                <option value={5}>5 - 매우 높음</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-card-foreground mb-1">태그 (쉼표로 구분)</label>
              <input
                type="text"
                value={formData.tags.join(', ')}
                onChange={handleTagsChange}
                className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring bg-background text-foreground"
                placeholder="예: 비즈니스, 전략, 마케팅"
              />
            </div>
            
            <div className="flex gap-2">
              <Button
                type="submit"
                variant="primary"
                size="sm"
              >
                {editingMemory ? '수정' : '추가'}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowCreateForm(false);
                  setEditingMemory(null);
                  setFormData({ title: '', content: '', importance: 1, tags: [], memory_type: 'conversation' });
                }}
              >
                취소
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* 메모리 목록 */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">
            메모리를 불러오는 중...
          </div>
        ) : !Array.isArray(memories) || memories.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            아직 저장된 메모리가 없습니다.
          </div>
        ) : (
          memories.map((memory) => (
            <div key={memory.memory_id} className="bg-card rounded-lg shadow-soft p-6 border border-border">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-primary-foreground" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-card-foreground">{memory.title}</h3>
                    <div className="flex items-center gap-4 mt-2">
                      {renderImportanceStars(memory.importance)}
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          {new Date(memory.created_at).toLocaleDateString('ko-KR')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEditMemory(memory)}
                    className="p-2"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <button
                    onClick={() => handleDeleteMemory(memory.memory_id)}
                    className="text-red-500 hover:text-red-700 transition-colors"
                  >
                    <Trash className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <p className="text-card-foreground mb-4 ml-11">{memory.content}</p>
              
              {memory.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 ml-11">
                  {memory.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="bg-muted text-muted-foreground px-2 py-1 rounded-full text-xs"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              
              <div className="mt-4 ml-11">
                {renderActionButtons(memory)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default MemoryManager;
