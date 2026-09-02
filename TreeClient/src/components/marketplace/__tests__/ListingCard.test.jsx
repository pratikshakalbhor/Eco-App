import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ListingCard from '@/components/marketplace/ListingCard';

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }) => <div {...filterMotionProps(props)}>{children}</div>,
  },
}));

function filterMotionProps(props) {
  const { initial, animate, transition, whileHover, ...rest } = props;
  return rest;
}

describe('ListingCard Component', () => {
  const mockListing = {
    id: '1',
    tree_id: 'TREE-001',
    species: 'Oak',
    credits_total: 5,
    credits_sold: 2,
    price_per_credit: 150,
    seller_wallet: '0x1234567890abcdef1234567890abcdef12345678',
    status: 'ACTIVE',
  };

  it('renders species name', () => {
    render(
      <ListingCard listing={mockListing} onBuy={vi.fn()} isOwnListing={false} />
    );
    expect(screen.getByText(/Oak/i)).toBeInTheDocument();
  });

  it('shows "Credits" label with species', () => {
    render(
      <ListingCard listing={mockListing} onBuy={vi.fn()} isOwnListing={false} />
    );
    expect(screen.getByText(/Oak Credits/)).toBeInTheDocument();
  });

  it('shows available credits', () => {
    render(
      <ListingCard listing={mockListing} onBuy={vi.fn()} isOwnListing={false} />
    );
    expect(screen.getByText(/3\.000/)).toBeInTheDocument();
  });

  it('shows price', () => {
    render(
      <ListingCard listing={mockListing} onBuy={vi.fn()} isOwnListing={false} />
    );
    expect(screen.getByText(/150/)).toBeInTheDocument();
  });

  it('shows purchase button when not own listing', () => {
    render(
      <ListingCard listing={mockListing} onBuy={vi.fn()} isOwnListing={false} />
    );
    expect(screen.getByText(/purchase/i)).toBeInTheDocument();
  });

  it('hides purchase button when isOwnListing is true', () => {
    render(
      <ListingCard listing={mockListing} onBuy={vi.fn()} isOwnListing={true} />
    );
    expect(screen.queryByText(/purchase/i)).not.toBeInTheDocument();
  });

  it('shows "Your Listing" badge when isOwnListing', () => {
    render(
      <ListingCard listing={mockListing} onBuy={vi.fn()} isOwnListing={true} />
    );
    expect(screen.getByText(/your listing/i)).toBeInTheDocument();
  });

  it('shows truncated wallet address', () => {
    render(
      <ListingCard listing={mockListing} onBuy={vi.fn()} isOwnListing={false} />
    );
    expect(screen.getByText(/0x1234/)).toBeInTheDocument();
  });
});
