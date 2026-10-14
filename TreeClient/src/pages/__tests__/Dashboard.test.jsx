import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from '@/pages/Dashboard';
import API_URL from '@/utils/config.js';

// Mock axios — Dashboard calls axios.get directly for its queries.
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

function renderDashboard() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Dashboard data privacy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("requests the authenticated /api/trees/my endpoint, not the public /api/trees", async () => {
    const axios = (await import('axios')).default;
    axios.get.mockImplementation((url) => {
      if (url === `${API_URL}/api/trees/my`) return Promise.resolve({ data: [] });
      if (url === `${API_URL}/api/trees/stats`) return Promise.resolve({ data: { total: 0 } });
      return Promise.reject(new Error(`unexpected request: ${url}`));
    });

    renderDashboard();

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith(`${API_URL}/api/trees/my`);
    });

    const calledUrls = axios.get.mock.calls.map(([url]) => url);
    expect(calledUrls).not.toContain(`${API_URL}/api/trees`);
  });

  it("renders only the trees returned by the authenticated endpoint", async () => {
    const axios = (await import('axios')).default;
    const myTree = {
      id: 't1',
      tree_id: 'TREE-1',
      species: 'Oak',
      status: 'VERIFIED',
      location: 'Forest',
      image_url: 'http://example.com/oak.jpg',
    };
    axios.get.mockImplementation((url) => {
      if (url === `${API_URL}/api/trees/my`) return Promise.resolve({ data: [myTree] });
      if (url === `${API_URL}/api/trees/stats`) return Promise.resolve({ data: { total: 1, verified: 1 } });
      return Promise.reject(new Error(`unexpected request: ${url}`));
    });

    renderDashboard();

    expect(await screen.findByText('Oak')).toBeInTheDocument();
  });
});
