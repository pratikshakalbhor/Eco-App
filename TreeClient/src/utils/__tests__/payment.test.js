import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';

const { sendTransaction, parseEther, isAddress, BrowserProvider } = vi.hoisted(() => {
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

  // vitest 4 requires a mock implementation to be a `function` or a `class`
  // so that the mock can be used with `new`. An arrow function cannot be
  // constructed, which is what broke this suite under vitest 4.
  const BrowserProvider = vi.fn(function BrowserProvider() {
    this.getSigner = vi.fn().mockResolvedValue({ sendTransaction });
  });

  return { sendTransaction, parseEther, isAddress, BrowserProvider };
});

// Mock ethers
vi.mock('ethers', () => ({
  ethers: {
    BrowserProvider,
    parseEther,
    isAddress,
    ZeroAddress: '0x0000000000000000000000000000000000000000',
  },
}));

// Mock axios — the payment configuration is fetched from the backend.
vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    defaults: { headers: { common: {} } },
  },
}));

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const VALID_ADDRESS = '0x1111111111111111111111111111111111111111';
const SERVER_RATE = 320000;

const serverConfig = {
  configured: true,
  platform_wallet: VALID_ADDRESS,
  eth_inr_rate: SERVER_RATE,
  platform_fee_percent: 2,
};

describe('payment utility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.ethereum = {};
    axios.get = vi.fn().mockResolvedValue({ data: { ...serverConfig } });
    // Any accidental use of a public price API would be visible here.
    globalThis.fetch = vi.fn();
  });

  describe('fetchPaymentConfig', () => {
    it('returns the server-supplied wallet and rate', async () => {
      const { fetchPaymentConfig } = await import('@/utils/payment');

      const config = await fetchPaymentConfig();

      expect(config.platformWallet).toBe(VALID_ADDRESS);
      expect(config.ethInrRate).toBe(SERVER_RATE);
      expect(config.platformFeePercent).toBe(2);
      expect(axios.get).toHaveBeenCalledTimes(1);
      expect(axios.get.mock.calls[0][0]).toContain('/api/marketplace/payment-config');
    });

    it('never contacts a public exchange-rate API', async () => {
      const { fetchPaymentConfig } = await import('@/utils/payment');

      await fetchPaymentConfig();

      expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('fails closed when the request fails', async () => {
      axios.get = vi.fn().mockRejectedValue(new Error('Network error'));
      const { fetchPaymentConfig } = await import('@/utils/payment');

      await expect(fetchPaymentConfig()).rejects.toThrow(/could not load/i);
    });

    it('fails closed when the server reports pricing is not configured', async () => {
      axios.get = vi.fn().mockResolvedValue({
        data: { configured: false, error: 'ETH_INR_RATE is not configured' },
      });
      const { fetchPaymentConfig } = await import('@/utils/payment');

      await expect(fetchPaymentConfig()).rejects.toThrow(/not configured/i);
    });

    it('fails closed when the server returns no platform wallet', async () => {
      axios.get = vi.fn().mockResolvedValue({
        data: { ...serverConfig, platform_wallet: '' },
      });
      const { fetchPaymentConfig } = await import('@/utils/payment');

      await expect(fetchPaymentConfig()).rejects.toThrow(/did not return a platform wallet/i);
    });

    it('fails closed on an invalid platform wallet', async () => {
      axios.get = vi.fn().mockResolvedValue({
        data: { ...serverConfig, platform_wallet: 'not-an-address' },
      });
      const { fetchPaymentConfig } = await import('@/utils/payment');

      await expect(fetchPaymentConfig()).rejects.toThrow(/invalid platform wallet/i);
    });

    it('fails closed on the zero address as platform wallet', async () => {
      axios.get = vi.fn().mockResolvedValue({
        data: { ...serverConfig, platform_wallet: ZERO_ADDRESS },
      });
      const { fetchPaymentConfig } = await import('@/utils/payment');

      await expect(fetchPaymentConfig()).rejects.toThrow(/zero address/i);
    });

    it('fails closed on an invalid rate', async () => {
      axios.get = vi.fn().mockResolvedValue({
        data: { ...serverConfig, eth_inr_rate: 0 },
      });
      const { fetchPaymentConfig } = await import('@/utils/payment');

      await expect(fetchPaymentConfig()).rejects.toThrow(/invalid ETH\/INR rate/i);
    });
  });

  describe('payWithMetaMask', () => {
    it('sends payment to the provided recipient, never the zero address', async () => {
      const { payWithMetaMask } = await import('@/utils/payment');

      const result = await payWithMetaMask({
        recipient: VALID_ADDRESS,
        inrAmount: 320,
        ethInrRate: SERVER_RATE,
      });

      expect(sendTransaction).toHaveBeenCalledTimes(1);
      expect(sendTransaction).toHaveBeenCalledWith({
        to: VALID_ADDRESS,
        value: 1000000000000000n, // 320 INR / 320000 = 0.001 ETH
      });
      expect(result.txHash).toBe('0xtxhash');
      expect(result.ethRate).toBe(SERVER_RATE);
    });

    it('uses the supplied rate rather than any built-in price', async () => {
      const { payWithMetaMask } = await import('@/utils/payment');

      await payWithMetaMask({
        recipient: VALID_ADDRESS,
        inrAmount: 320,
        ethInrRate: 160000, // half the server rate -> twice the ETH
      });

      expect(sendTransaction).toHaveBeenCalledWith({
        to: VALID_ADDRESS,
        value: 2000000000000000n, // 0.002 ETH
      });
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('refuses to send when no recipient is configured', async () => {
      const { payWithMetaMask } = await import('@/utils/payment');

      await expect(
        payWithMetaMask({ recipient: undefined, inrAmount: 320, ethInrRate: SERVER_RATE })
      ).rejects.toThrow(/recipient is not configured/i);
      expect(sendTransaction).not.toHaveBeenCalled();
    });

    it('refuses to send to the zero address', async () => {
      const { payWithMetaMask } = await import('@/utils/payment');

      await expect(
        payWithMetaMask({ recipient: ZERO_ADDRESS, inrAmount: 320, ethInrRate: SERVER_RATE })
      ).rejects.toThrow(/zero address/i);
      expect(sendTransaction).not.toHaveBeenCalled();
    });

    it('rejects an invalid recipient address', async () => {
      const { payWithMetaMask } = await import('@/utils/payment');

      await expect(
        payWithMetaMask({ recipient: 'not-an-address', inrAmount: 320, ethInrRate: SERVER_RATE })
      ).rejects.toThrow(/invalid payment recipient/i);
      expect(sendTransaction).not.toHaveBeenCalled();
    });

    it('rejects non-positive payment amounts', async () => {
      const { payWithMetaMask } = await import('@/utils/payment');

      await expect(
        payWithMetaMask({ recipient: VALID_ADDRESS, inrAmount: 0, ethInrRate: SERVER_RATE })
      ).rejects.toThrow(/invalid payment amount/i);
      await expect(
        payWithMetaMask({ recipient: VALID_ADDRESS, inrAmount: -5, ethInrRate: SERVER_RATE })
      ).rejects.toThrow(/invalid payment amount/i);
      expect(sendTransaction).not.toHaveBeenCalled();
    });

    it('rejects an invalid exchange rate', async () => {
      const { payWithMetaMask } = await import('@/utils/payment');

      await expect(
        payWithMetaMask({ recipient: VALID_ADDRESS, inrAmount: 320, ethInrRate: 0 })
      ).rejects.toThrow(/invalid ETH\/INR rate/i);
      expect(sendTransaction).not.toHaveBeenCalled();
    });
  });
});
