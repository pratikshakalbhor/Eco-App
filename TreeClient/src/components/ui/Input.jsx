import React from "react";

export function Input({ id, type = "text", value, onChange, placeholder, className = "", ...props }) {
  return (
    <input
      id={id}
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={`w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 ${className}`}
      {...props}
    />
  );
}
