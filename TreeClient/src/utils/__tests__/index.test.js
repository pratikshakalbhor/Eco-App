import { describe, it, expect } from 'vitest';
import { createPageUrl } from '@/utils/index';

describe('createPageUrl utility', () => {
  it('creates a page URL with /pages/ prefix', () => {
    expect(createPageUrl('Dashboard')).toBe('/pages/Dashboard');
  });

  it('handles empty string', () => {
    expect(createPageUrl('')).toBe('/pages/');
  });

  it('handles nested paths', () => {
    expect(createPageUrl('admin/settings')).toBe('/pages/admin/settings');
  });
});
