import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Input } from '@/components/ui/Input';

describe('Input Component', () => {
  it('renders with placeholder', () => {
    render(<Input placeholder="Enter value" />);
    expect(screen.getByPlaceholderText('Enter value')).toBeInTheDocument();
  });

  it('renders as text input by default', () => {
    render(<Input data-testid="input" />);
    expect(screen.getByTestId('input').tagName).toBe('INPUT');
  });

  it('applies custom className', () => {
    render(<Input className="custom-input" data-testid="input" />);
    expect(screen.getByTestId('input').className).toContain('custom-input');
  });

  it('can be disabled', () => {
    render(<Input disabled data-testid="input" />);
    expect(screen.getByTestId('input')).toBeDisabled();
  });

  it('accepts different types', () => {
    render(<Input type="password" data-testid="input" />);
    expect(screen.getByTestId('input').type).toBe('password');
  });
});
