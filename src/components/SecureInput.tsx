// 🔒 Secure Input Components
// 상용화 수준의 보안 강화된 입력 컴포넌트

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { SecurityValidator, RateLimiter } from '../utils/security';
import { useDebounce } from '../hooks/usePerformance';

interface SecureTextareaProps {
  value: string;
  onChange: (value: string) => void;
  onValidationChange?: (isValid: boolean, errors: string[]) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  maxLength?: number;
  rows?: number;
  autoResize?: boolean;
  enableRateLimit?: boolean;
  rateLimitKey?: string;
}

/**
 * 🛡️ Secure Textarea with real-time validation
 */
export const SecureTextarea: React.FC<SecureTextareaProps> = ({
  value,
  onChange,
  onValidationChange,
  placeholder = "메시지를 입력하세요...",
  className = "",
  disabled = false,
  maxLength = 10000,
  rows = 3,
  autoResize = true,
  enableRateLimit = true,
  rateLimitKey = 'message_input',
}) => {
  const [errors, setErrors] = useState<string[]>([]);
  const [isValid, setIsValid] = useState(true);
  const [showErrors, setShowErrors] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // 디바운스된 값으로 검증 실행
  const debouncedValue = useDebounce(value, 300);

  // 실시간 검증
  useEffect(() => {
    if (debouncedValue) {
      const validation = SecurityValidator.validateMessage(debouncedValue);
      setErrors(validation.errors);
      setIsValid(validation.isValid);
      onValidationChange?.(validation.isValid, validation.errors);
    } else {
      setErrors([]);
      setIsValid(true);
      onValidationChange?.(true, []);
    }
  }, [debouncedValue, onValidationChange]);

  // 자동 리사이즈
  useEffect(() => {
    if (autoResize && textareaRef.current) {
      const textarea = textareaRef.current;
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [value, autoResize]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;

    // Rate limiting 체크
    if (enableRateLimit) {
      const { allowed } = RateLimiter.checkLimit(rateLimitKey, 10, 1000); // 10회/초
      if (!allowed) {
        console.warn('Rate limit exceeded for input');
        return;
      }
    }

    // 길이 제한
    if (newValue.length > maxLength) {
      return;
    }

    // 기본 검증 후 변경
    const sanitized = SecurityValidator.sanitizeText(newValue);
    onChange(sanitized);
  }, [onChange, maxLength, enableRateLimit, rateLimitKey]);

  const handleFocus = useCallback(() => {
    setShowErrors(true);
  }, []);

  const handleBlur = useCallback(() => {
    // 에러가 있을 때만 계속 표시
    setShowErrors(errors.length > 0);
  }, [errors.length]);

  const getInputClassName = () => {
    const baseClass = "w-full p-3 border rounded-lg resize-none focus:outline-none focus:ring-2 transition-colors";
    const statusClass = !isValid && showErrors 
      ? "border-red-300 focus:ring-red-500 bg-red-50" 
      : "border-gray-300 focus:ring-blue-500 bg-white";
    const disabledClass = disabled ? "opacity-50 cursor-not-allowed" : "";
    
    return `${baseClass} ${statusClass} ${disabledClass} ${className}`;
  };

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        className={getInputClassName()}
        disabled={disabled ? "disabled" : undefined}
        rows={rows}
        maxLength={maxLength}
        spellCheck={false}
        autoComplete="off"
        aria-invalid={!isValid}
        aria-describedby={!isValid ? 'input-errors' : undefined}
      />
      
      {/* 문자 수 표시 */}
      <div className="absolute bottom-2 right-2 text-xs text-gray-400 pointer-events-none">
        {value.length}/{maxLength}
      </div>
      
      {/* 에러 메시지 */}
      {!isValid && showErrors && errors.length > 0 && (
        <div id="input-errors" className="mt-2 space-y-1">
          {errors.map((error, index) => (
            <div key={index} className="flex items-center text-sm text-red-600">
              <span className="mr-1">⚠️</span>
              {error}
            </div>
          ))}
        </div>
      )}
      
      {/* 보안 상태 표시 */}
      <div className="mt-1 flex items-center justify-between text-xs">
        <div className="flex items-center space-x-2">
          <span className={`flex items-center ${isValid ? 'text-green-600' : 'text-red-600'}`}>
            {isValid ? '🛡️ 안전' : '⚠️ 검증 필요'}
          </span>
          
          {enableRateLimit && (
            <span className="text-gray-500">
              🚥 Rate Limited
            </span>
          )}
        </div>
        
        {value && (
          <div className="text-gray-500">
            새니타이즈됨
          </div>
        )}
      </div>
    </div>
  );
};

interface SecureFileUploadProps {
  onFileSelect: (file: File) => void;
  onValidationChange?: (isValid: boolean, errors: string[]) => void;
  accept?: string;
  maxSize?: number; // bytes
  className?: string;
  disabled?: boolean;
}

/**
 * 📁 Secure File Upload Component
 */
export const SecureFileUpload: React.FC<SecureFileUploadProps> = ({
  onFileSelect,
  onValidationChange,
  accept = "image/*,.pdf,.txt",
  maxSize = 10 * 1024 * 1024, // 10MB
  className = "",
  disabled = false,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateAndSelectFile = useCallback((file: File) => {
    const validation = SecurityValidator.validateFile(file);
    
    // 추가 크기 검증
    if (file.size > maxSize) {
      validation.errors.push(`파일 크기는 ${(maxSize / 1024 / 1024).toFixed(1)}MB를 초과할 수 없습니다.`);
      validation.isValid = false;
    }

    setErrors(validation.errors);
    onValidationChange?.(validation.isValid, validation.errors);

    if (validation.isValid) {
      onFileSelect(file);
    }
  }, [onFileSelect, onValidationChange, maxSize]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      validateAndSelectFile(file);
    }
  }, [validateAndSelectFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      validateAndSelectFile(file);
    }
  }, [validateAndSelectFile]);

  const handleClick = useCallback(() => {
    if (!disabled) {
      inputRef.current?.click();
    }
  }, [disabled]);

  const getContainerClassName = () => {
    const baseClass = "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors";
    const stateClass = dragActive 
      ? "border-blue-400 bg-blue-50" 
      : "border-gray-300 hover:border-gray-400";
    const disabledClass = disabled ? "opacity-50 cursor-not-allowed" : "";
    
    return `${baseClass} ${stateClass} ${disabledClass} ${className}`;
  };

  return (
    <div>
      <div
        className={getContainerClassName()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <input
          ref={inputRef}
          type="file"
          onChange={handleFileSelect}
          accept={accept}
          className="hidden"
          disabled={disabled ? "disabled" : undefined}
        />
        
        <div className="space-y-2">
          <div className="text-3xl">📁</div>
          <div className="text-gray-600">
            파일을 여기에 드래그하거나 클릭하여 선택하세요
          </div>
          <div className="text-sm text-gray-500">
            최대 {(maxSize / 1024 / 1024).toFixed(1)}MB
          </div>
        </div>
      </div>
      
      {/* 에러 메시지 */}
      {errors.length > 0 && (
        <div className="mt-2 space-y-1">
          {errors.map((error, index) => (
            <div key={index} className="flex items-center text-sm text-red-600">
              <span className="mr-1">⚠️</span>
              {error}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * 🔐 Security Status Indicator
 */
interface SecurityStatusProps {
  className?: string;
}

export const SecurityStatus: React.FC<SecurityStatusProps> = ({ className = "" }) => {
  const [securityLevel, setSecurityLevel] = useState<'high' | 'medium' | 'low'>('high');

  useEffect(() => {
    // 보안 상태 체크
    const checkSecurity = () => {
      let level: 'high' | 'medium' | 'low' = 'high';
      
      // HTTPS 체크
      if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
        level = 'medium';
      }
      
      // CSP 체크
      const cspMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
      if (!cspMeta) {
        level = 'low';
      }
      
      setSecurityLevel(level);
    };

    checkSecurity();
  }, []);

  const getStatusInfo = () => {
    switch (securityLevel) {
      case 'high':
        return { icon: '🔒', text: '보안 양호', color: 'text-green-600' };
      case 'medium':
        return { icon: '🟡', text: '보안 주의', color: 'text-yellow-600' };
      case 'low':
        return { icon: '🔓', text: '보안 위험', color: 'text-red-600' };
    }
  };

  const { icon, text, color } = getStatusInfo();

  return (
    <div className={`flex items-center space-x-1 text-sm ${color} ${className}`}>
      <span>{icon}</span>
      <span>{text}</span>
    </div>
  );
};

export default {
  SecureTextarea,
  SecureFileUpload,
  SecurityStatus,
};
