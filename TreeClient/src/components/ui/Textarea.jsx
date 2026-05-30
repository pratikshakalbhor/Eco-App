import React from "react";

export function Textarea({ value, onChange, placeholder, className = "", ...props }) {
  return (
    <textarea
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={`border rounded-lg p-2 w-full ${className}`}
      {...props}
    />
  );
}
