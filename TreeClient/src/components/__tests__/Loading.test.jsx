import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import Loading from '@/components/Loading';

describe('Loading Component', () => {
  it('renders a spinner', () => {
    const { container } = render(<Loading />);
    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('renders with full screen centering', () => {
    const { container } = render(<Loading />);
    const wrapper = container.firstChild;
    expect(wrapper.className).toContain('flex');
    expect(wrapper.className).toContain('items-center');
    expect(wrapper.className).toContain('justify-center');
  });
});
