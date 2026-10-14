import { describe, it, expect, vi, beforeEach } from 'vitest';

const { sendTransaction, parseEther, isAddress } = vi.hoisted(() => {
  const sendTransaction = vi.fn().mockResolvedValue({
    wait: vi.fn().mockResolvedValue({ hash: '0xtxhash' }),
  });

  // Minimal decimal-string -> wei parser (matches ethers.parseEther behavior
  // for the values under test) without floating point arithmetic.
  const parseEther = vi.fn((val) => {
    const [whole = '0', frac = ''] = String(val).split('.');
    const fracPadded = (frac + '0'.repeat(18)).slice(0, 18);
    return BigInt(whole || '0') * 10n ** 18n + BigInt(fracPadded || '0');
  });

  const isAddress = vi.fn(
    (addr) => typeof addr === 'string' && /^0x[0-9a-fA-F]{40}$/.test(addr)
  );

  return { sendTransaction, parseEther, isAddress };
});

// Mock ethers
vi.mock('ethers', () => ({
  ethers: {
    BrowserProvider: vi.fn().mockImplementation(() => ({
      getSigner: vi.fn().mockResolvedValue({ sendTransaction }),
    })),
    parseEther,
    isAddress,
    ZeroAddress: '0x0000000000000000000000000000000000000000',
  },
}));

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const VALID_ADDRESS = '0x1111111111111111111111111111111111111111';

describe('payment utility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.ethereum = {};
    global.fetch = vi.fn().mockResolvedValue({
      json: async () => ({ ethereum: { inr: 320000 } }),
    });
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

  it('sends payment to the provided recipient, never the zero address', async () => {
    vi.stubEnv('VITE_PLATFORM_WALLET', '');
    const { payWithMetaMask } = await import('@/utils/payment');

    const result = await payWithMetaMask(VALID_ADDRESS, 320);

    expect(sendTransaction).toHaveBeenCalledTimes(1);
    expect(sendTransaction).toHaveBeenCalledWith({
      to: VALID_ADDRESS,
      value: 1000000000000000n, // 0.001 ETH
    });
    expect(result.txHash).toBe('0xtxhash');
  });

  it('refuses to send when no recipient is configured', async () => {
    vi.stubEnv('VITE_PLATFORM_WALLET', '');
    const { payWithMetaMask } = await import('@/utils/payment');

    await expect(payWithMetaMask(undefined, 320)).rejects.toThrow(
      /recipient is not configured/i
    );
    expect(sendTransaction).not.toHaveBeenCalled();
  });

  it('refuses to send to the zero address', async () => {
    vi.stubEnv('VITE_PLATFORM_WALLET', '');
    const { payWithMetaMask } = await import('@/utils/payment');

    await expect(payWithMetaMask(ZERO_ADDRESS, 320)).rejects.toThrow(
      /zero address/i
    );
    expect(sendTransaction).not.toHaveBeenCalled();
  });

  it('rejects an invalid recipient address', async () => {
    vi.stubEnv('VITE_PLATFORM_WALLET', '');
    const { payWithMetaMask } = await import('@/utils/payment');

    await expect(payWithMetaMask('not-an-address', 320)).rejects.toThrow(
      /invalid payment recipient/i
    );
    expect(sendTransaction).not.toHaveBeenCalled();
  });

  it('rejects non-positive payment amounts', async () => {
    vi.stubEnv('VITE_PLATFORM_WALLET', '');
    const { payWithMetaMask } = await import('@/utils/payment');

    await expect(payWithMetaMask(VALID_ADDRESS, 0)).rejects.toThrow(
      /invalid payment amount/i
    );
    await expect(payWithMetaMask(VALID_ADDRESS, -5)).rejects.toThrow(
      /invalid payment amount/i
    );
    expect(sendTransaction).not.toHaveBeenCalled();
  });
});
