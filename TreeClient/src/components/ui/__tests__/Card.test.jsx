import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';

describe('Card Components', () => {
  it('renders Card with children', () => {
    render(<Card><p>Content</p></Card>);
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('renders Card with custom className', () => {
    const { container } = render(<Card className="my-class"><p>Test</p></Card>);
    expect(container.firstChild.className).toContain('my-class');
  });

  it('renders CardHeader', () => {
    render(<Card><CardHeader><p>Header</p></CardHeader></Card>);
    expect(screen.getByText('Header')).toBeInTheDocument();
  });

  it('renders CardTitle', () => {
    render(<Card><CardTitle>Title</CardTitle></Card>);
    expect(screen.getByText('Title')).toBeInTheDocument();
  });

  it('renders CardTitle as h3', () => {
    render(<Card><CardTitle>Title</CardTitle></Card>);
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Title');
  });

  it('renders CardContent', () => {
    render(<Card><CardContent><span>Body</span></CardContent></Card>);
    expect(screen.getByText('Body')).toBeInTheDocument();
  });

  it('renders nested components', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>My Title</CardTitle>
        </CardHeader>
        <CardContent>
          <p>My content</p>
        </CardContent>
      </Card>
    );
    expect(screen.getByText('My Title')).toBeInTheDocument();
    expect(screen.getByText('My content')).toBeInTheDocument();
  });
});
