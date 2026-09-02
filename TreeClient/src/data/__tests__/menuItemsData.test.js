import { describe, it, expect } from 'vitest';
import { menuItemsData, adminMenuItems } from '@/data/menuItemsData';

describe('menuItemsData', () => {
  it('exports an array of menu items', () => {
    expect(Array.isArray(menuItemsData)).toBe(true);
    expect(menuItemsData.length).toBeGreaterThan(0);
  });

  it('each item has required fields', () => {
    menuItemsData.forEach((item) => {
      expect(item).toHaveProperty('label');
      expect(item).toHaveProperty('Icon');
      expect(item).toHaveProperty('path');
      expect(typeof item.label).toBe('string');
      expect(typeof item.path).toBe('string');
    });
  });

  it('includes Dashboard as first item', () => {
    expect(menuItemsData[0].label).toBe('Dashboard');
    expect(menuItemsData[0].path).toBe('/dashboard');
  });

  it('has consistent path format (starts with /)', () => {
    menuItemsData.forEach((item) => {
      expect(item.path.startsWith('/')).toBe(true);
    });
  });

  it('has unique IDs', () => {
    const ids = menuItemsData.map((item) => item.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('includes all expected pages', () => {
    const labels = menuItemsData.map((item) => item.label);
    expect(labels).toContain('Dashboard');
    expect(labels).toContain('Plant Tree');
    expect(labels).toContain('My Trees');
    expect(labels).toContain('Marketplace');
    expect(labels).toContain('Carbon Credits');
    expect(labels).toContain('Map');
    expect(labels).toContain('Profile');
  });
});

describe('adminMenuItems', () => {
  it('exports an array', () => {
    expect(Array.isArray(adminMenuItems)).toBe(true);
    expect(adminMenuItems.length).toBeGreaterThan(0);
  });

  it('includes Admin Panel', () => {
    expect(adminMenuItems[0].label).toBe('Admin Panel');
    expect(adminMenuItems[0].path).toBe('/admin');
  });
});
