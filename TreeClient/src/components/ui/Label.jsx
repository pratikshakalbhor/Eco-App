import React from "react";

export function Label({ htmlFor, children, className = "" }) {
  return (
    <label
      htmlFor={htmlFor}
      className={`block text-xs font-semibold text-zb-text-secondary mb-1.5 uppercase tracking-wider ${className}`}
    >
      {children}
    </label>
  );
}
