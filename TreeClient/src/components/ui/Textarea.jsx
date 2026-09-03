import React from "react";

export function Textarea({ value, onChange, placeholder, className = "", ...props }) {
  return (
    <textarea
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={`w-full bg-zb-surface border border-zb-border rounded-xl px-4 py-3 text-sm text-zb-text placeholder:text-zb-text-muted focus:outline-none focus:border-zb-cyan/40 focus:ring-1 focus:ring-zb-cyan/20 transition-all resize-none ${className}`}
      {...props}
    />
  );
}
