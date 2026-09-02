import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock ethers
vi.mock('ethers', () => ({
  ethers: {
    BrowserProvider: vi.fn().mockImplementation(() => ({
      getSigner: vi.fn().mockResolvedValue({
        sendTransaction: vi.fn().mockResolvedValue({
          wait: vi.fn().mockResolvedValue({ hash: '0xtxhash' }),
        }),
      }),
    })),
    parseEther: vi.fn((val) => BigInt(parseFloat(val) * 1e18)),
  },
}));

describe('payment utility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetchEthInrRate returns a number', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: async () => ({ ethereum: { inr: 320000 } }),
    });

    const { fetchEthInrRate } = await import('@/utils/payment');
    const rate = await fetchEthInrRate();
    expect(typeof rate).toBe('number');
    expect(rate).toBe(320000);
  });

  it('fetchEthInrRate returns fallback on error', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const { fetchEthInrRate } = await import('@/utils/payment');
    const rate = await fetchEthInrRate();
    expect(rate).toBe(320000); // fallback
  });
});
