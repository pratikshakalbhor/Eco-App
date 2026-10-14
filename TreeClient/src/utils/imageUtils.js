// Returns a safe image URL, falling back to a placeholder for blob: URLs
// (stale local previews) or missing values.
export const cleanImageUrl = (url) =>
  url && typeof url === 'string' && !url.startsWith('blob:') ? url : '/placeholder-tree.jpg';
