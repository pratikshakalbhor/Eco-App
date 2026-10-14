import '@testing-library/jest-dom';

// Mock window.ethereum (MetaMask)
Object.defineProperty(window, 'ethereum', {
  value: {
    isMetaMask: true,
    request: async ({ method }) => {
      if (method === 'eth_requestAccounts') return ['0xtest1234567890abcdef1234567890abcdef123456'];
      if (method === 'eth_accounts') return ['0xtest1234567890abcdef1234567890abcdef123456'];
      if (method === 'eth_chainId') return '0xaa36a7';
      if (method === 'wallet_switchEthereumChain') return null;
      return null;
    },
    on: () => {},
    removeListener: () => {},
  },
  writable: true,
});

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => { store[key] = value; },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock URL.createObjectURL
URL.createObjectURL = () => 'blob:mock-url';
URL.revokeObjectURL = () => {};

// Mock IntersectionObserver
class MockIntersectionObserver {
  constructor() {}
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.IntersectionObserver = MockIntersectionObserver;

// Suppress console.error for cleaner test output (optional)
// const originalError = console.error;
// console.error = (...args) => {
//   if (typeof args[0] === 'string' && args[0].includes('Warning:')) return;
//   originalError(...args);
// };
