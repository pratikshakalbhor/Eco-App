import React from "react";

export function Button({
  children,
  className = "",
  onClick,
  type = "button",
  disabled = false,
  ...props
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`px-4 py-2 rounded-lg font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
