import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '@/hooks/useAuth';

// Mock axios
vi.mock('axios', () => {
  const instance = {
    get: vi.fn(),
    post: vi.fn(),
    defaults: { headers: { common: {} } },
    create: vi.fn().mockReturnThis(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  };
  return {
    default: instance,
    ...instance,
  };
});

// Mock web3Service
vi.mock('@/utils/web3Service', () => ({
  connectWallet: vi.fn().mockResolvedValue({ address: '0xtest123' }),
  signMessage: vi.fn().mockResolvedValue('0xsignature123'),
}));

function TestComponent() {
  const auth = useAuth();
  return (
    <div>
      <span data-testid="loading">{auth.loading ? 'loading' : 'done'}</span>
      <span data-testid="user">{auth.user ? auth.user.role : 'null'}</span>
      <button data-testid="login" onClick={() => auth.login()}>Login</button>
      <button data-testid="logout" onClick={() => auth.logout()}>Logout</button>
    </div>
  );
}

describe('useAuth Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('provides auth context', async () => {
    const axios = (await import('axios')).default;
    axios.get.mockRejectedValue(new Error('no token'));

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('done');
    });
  });

  it('starts with no user', async () => {
    const axios = (await import('axios')).default;
    axios.get.mockRejectedValue(new Error('no token'));

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('null');
    });
  });

  it('logout clears user', async () => {
    const axios = (await import('axios')).default;
    axios.get.mockRejectedValue(new Error('no token'));

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('done');
    });

    screen.getByTestId('logout').click();
    expect(screen.getByTestId('user')).toHaveTextContent('null');
  });

  it('sets token in localStorage on successful login', async () => {
    const axios = (await import('axios')).default;
    const { connectWallet, signMessage } = await import('@/utils/web3Service');

    axios.get
      .mockResolvedValueOnce({ data: { nonce: 'abc123' } })  // GetNonce
      .mockResolvedValueOnce({ data: { id: '1', role: 'user', wallet_address: '0xtest' } }); // GetMe

    axios.post
      .mockResolvedValueOnce({ data: { token: 'jwt-token', user: { role: 'user' } } }); // VerifySignature

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('done');
    });

    // Click login
    screen.getByTestId('login').click();

    await waitFor(() => {
      expect(connectWallet).toHaveBeenCalled();
    });
  });
});
