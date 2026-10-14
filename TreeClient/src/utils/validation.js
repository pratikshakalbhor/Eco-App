// Lightweight client-side validation helpers.
//
// These are UX-only conveniences. The backend remains the authoritative
// source of truth for all validation.

export const isPositiveNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0;
};

export const isNonNegativeInteger = (value) => {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0;
};

export const isWithinRange = (value, min, max) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max;
};

export const isValidDate = (value) => {
  if (!value) return false;
  const d = new Date(value);
  return !Number.isNaN(d.getTime());
};

export const isNotFutureDate = (value) => {
  if (!value) return false;
  const d = new Date(value);
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return !Number.isNaN(d.getTime()) && d.getTime() <= today.getTime();
};

export const isRequiredNonEmpty = (value) =>
  value !== undefined && value !== null && String(value).trim() !== "";
