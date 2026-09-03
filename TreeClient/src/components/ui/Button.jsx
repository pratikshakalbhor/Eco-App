import React from "react";

export function Button({
  children,
  className = "",
  onClick,
  type = "button",
  disabled = false,
  variant = "primary",
  size = "default",
  ...props
}) {
  const variants = {
    primary: "bg-zb-cyan text-zb-bg hover:bg-zb-cyan-dim font-semibold shadow-lg shadow-zb-cyan/10",
    secondary: "bg-zb-card text-zb-text border border-zb-border hover:bg-zb-card-hover hover:border-zb-border-light",
    ghost: "bg-transparent text-zb-text-secondary hover:text-zb-text hover:bg-zb-card",
    danger: "bg-zb-red/10 text-zb-red border border-zb-red/20 hover:bg-zb-red/20",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs rounded-lg",
    default: "px-5 py-2.5 text-sm rounded-xl",
    lg: "px-8 py-4 text-base rounded-xl",
    icon: "p-2.5 rounded-xl",
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${variants[variant] || variants.primary} ${sizes[size] || sizes.default} transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
