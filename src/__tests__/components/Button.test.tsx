import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from '../../../components/ui/Button';

describe('Button Component', () => {
  test('버튼이 올바르게 렌더링되어야 함', () => {
    render(<Button>테스트 버튼</Button>);
    
    const button = screen.getByRole('button', { name: '테스트 버튼' });
    expect(button).toBeInTheDocument();
  });

  test('disabled 상태가 올바르게 적용되어야 함', () => {
    render(<Button disabled>비활성화 버튼</Button>);
    
    const button = screen.getByRole('button', { name: '비활성화 버튼' });
    expect(button).toBeDisabled();
  });

  test('onClick 핸들러가 올바르게 작동해야 함', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>클릭 버튼</Button>);
    
    const button = screen.getByRole('button', { name: '클릭 버튼' });
    button.click();
    
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  test('다양한 variant가 올바르게 적용되어야 함', () => {
    const { rerender } = render(<Button variant="primary">Primary</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-primary');

    rerender(<Button variant="secondary">Secondary</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-secondary');

    rerender(<Button variant="destructive">Destructive</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-destructive');
  });
});
