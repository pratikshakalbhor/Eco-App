import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import Badge from '@/components/ui/Badge';

describe('Badge Component', () => {
  it('renders with text', () => {
    render(<Badge>Active</Badge>);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<Badge className="extra-class">Test</Badge>);
    expect(container.firstChild.className).toContain('extra-class');
  });

  it('renders as span element', () => {
    const { container } = render(<Badge>Badge</Badge>);
    expect(container.firstChild.tagName).toBe('SPAN');
  });
});
