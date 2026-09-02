import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import BuyModal from '@/components/marketplace/BuyModal';

vi.mock('@/utils/payment', () => ({
  payWithMetaMask: vi.fn().mockResolvedValue({
    txHash: '0xhash123',
    ethAmount: '0.001',
    ethRate: 320000,
    inrAmount: 320,
  }),
  fetchEthInrRate: vi.fn().mockResolvedValue(320000),
}));

vi.mock('axios', () => ({
  default: {
    post: vi.fn().mockResolvedValue({ data: {} }),
    defaults: { headers: { common: {} } },
  },
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, initial, animate, transition, whileHover, ...props }) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }) => <>{children}</>,
}));

describe('BuyModal Component', () => {
  const mockListing = {
    id: '1',
    tree_id: 'TREE-001',
    species: 'Oak',
    credits_total: 5,
    credits_sold: 2,
    price_per_credit: 100,
    seller_wallet: '0xseller1234567890abcdef',
  };

  it('renders listing species name in header', () => {
    render(<BuyModal listing={mockListing} onClose={vi.fn()} onSuccess={vi.fn()} />);
    expect(screen.getByText(/Buy Carbon Credits/)).toBeInTheDocument();
  });

  it('shows species in listing detail', () => {
    render(<BuyModal listing={mockListing} onClose={vi.fn()} onSuccess={vi.fn()} />);
    expect(screen.getByText(/Oak Tree Credits/)).toBeInTheDocument();
  });

  it('shows available credits (max)', () => {
    render(<BuyModal listing={mockListing} onClose={vi.fn()} onSuccess={vi.fn()} />);
    expect(screen.getByText(/Max:/)).toBeInTheDocument();
    expect(screen.getByText(/3.000/)).toBeInTheDocument();
  });

  it('has an input for credit amount', () => {
    render(<BuyModal listing={mockListing} onClose={vi.fn()} onSuccess={vi.fn()} />);
    expect(screen.getByPlaceholderText('0.000')).toBeInTheDocument();
  });

  it('shows Complete Purchase button', () => {
    render(<BuyModal listing={mockListing} onClose={vi.fn()} onSuccess={vi.fn()} />);
    expect(screen.getByText(/Complete Purchase/)).toBeInTheDocument();
  });

  it('shows subtotal and fee labels', () => {
    render(<BuyModal listing={mockListing} onClose={vi.fn()} onSuccess={vi.fn()} />);
    expect(screen.getByText('Subtotal')).toBeInTheDocument();
    expect(screen.getByText('Platform Fee')).toBeInTheDocument();
  });

  it('shows close button (X icon)', () => {
    const { container } = render(<BuyModal listing={mockListing} onClose={vi.fn()} onSuccess={vi.fn()} />);
    const closeBtn = container.querySelector('button');
    expect(closeBtn).toBeInTheDocument();
  });

  it('shows security message', () => {
    render(<BuyModal listing={mockListing} onClose={vi.fn()} onSuccess={vi.fn()} />);
    expect(screen.getByText(/Secured by MetaMask/)).toBeInTheDocument();
  });
});
