import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Button } from '@/components/ui/Button';

describe('Button Component', () => {
  it('renders with default text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
  });

  it('applies default green styling', () => {
    render(<Button>Test</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('bg-green-600');
  });

  it('renders as disabled when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('passes custom className', () => {
    render(<Button className="custom-class">Test</Button>);
    expect(screen.getByRole('button').className).toContain('custom-class');
  });

  it('calls onClick handler', async () => {
    let clicked = false;
    render(<Button onClick={() => { clicked = true; }}>Click</Button>);
    screen.getByRole('button').click();
    expect(clicked).toBe(true);
  });

  it('renders as button type by default', () => {
    render(<Button>Test</Button>);
    expect(screen.getByRole('button').type).toBe('button');
  });

  it('spreads additional props', () => {
    render(<Button data-testid="btn">Test</Button>);
    expect(screen.getByTestId('btn')).toBeInTheDocument();
  });
});
