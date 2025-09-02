import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';
import { cn } from '../../lib/utils';

interface SidebarModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  width?: 'sm' | 'md' | 'lg' | 'xl';
}

const SidebarModal: React.FC<SidebarModalProps> = ({
  isOpen,
  onClose,
  children,
  className = '',
  width = 'lg'
}) => {
  const widthClasses = {
    sm: 'w-64',
    md: 'w-80',
    lg: 'w-96',
    xl: 'w-[28rem]'
  };

  // ESC 키로 모달 닫기
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  return (
    <>
      {/* 백드롭 */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />
      )}
      
      {/* 사이드바 */}
      <div 
        className={cn(
          "fixed top-0 left-0 h-full z-50 transform transition-all duration-300 ease-in-out",
          widthClasses[width],
          isOpen ? "translate-x-0" : "-translate-x-full",
          "bg-card border-r border-border shadow-soft"
        )}
      >
        <div className={cn(
          "h-full flex flex-col",
          className
        )}>
          {/* 헤더 */}
          <div className="flex items-center justify-between p-4 border-b border-border bg-card">
            <h3 className="text-lg font-semibold text-card-foreground">
              대화 목록
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="p-2 text-foreground hover:bg-secondary rounded-lg"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          
          {/* 컨텐츠 */}
          <div className="flex-1 overflow-hidden">
            {children}
          </div>
        </div>
      </div>
    </>
  );
};

export default SidebarModal;
