import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import StatsCard from '@/components/shared/StatsCard';

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, initial, animate, transition, whileHover, ...props }) => (
      <div {...props}>{children}</div>
    ),
  },
}));

function MockIcon(props) {
  return <svg data-testid="mock-icon" {...props} />;
}

describe('StatsCard Component', () => {
  it('renders title and value', () => {
    render(<StatsCard title="Total Trees" value={42} icon={MockIcon} />);
    expect(screen.getByText('Total Trees')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders icon component', () => {
    render(<StatsCard title="Test" value={0} icon={MockIcon} />);
    expect(screen.getByTestId('mock-icon')).toBeInTheDocument();
  });

  it('renders trend when provided', () => {
    render(<StatsCard title="Trees" value={10} icon={MockIcon} trend="+12%" />);
    expect(screen.getByText('+12%')).toBeInTheDocument();
    expect(screen.getByText('vs last month')).toBeInTheDocument();
  });

  it('does not render trend when not provided', () => {
    render(<StatsCard title="Trees" value={10} icon={MockIcon} />);
    expect(screen.queryByText('vs last month')).not.toBeInTheDocument();
  });

  it('applies color gradient classes', () => {
    const { container } = render(
      <StatsCard title="Test" value={0} icon={MockIcon} color="blue" />
    );
    expect(container.innerHTML).toContain('from-blue-500');
  });
});
