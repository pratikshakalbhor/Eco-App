import React from "react";

const variantStyles = {
  default: "bg-zb-card text-zb-text-secondary border border-zb-border",
  cyan: "bg-zb-cyan/10 text-zb-cyan border border-zb-cyan/20",
  green: "bg-zb-green/10 text-zb-green border border-zb-green/20",
  amber: "bg-zb-amber/10 text-zb-amber border border-zb-amber/20",
  red: "bg-zb-red/10 text-zb-red border border-zb-red/20",
  blue: "bg-zb-blue/10 text-zb-blue border border-zb-blue/20",
  purple: "bg-zb-purple/10 text-zb-purple border border-zb-purple/20",
};

export function Badge({ children, className = "", variant = "default" }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-[11px] font-semibold uppercase tracking-wider ${variantStyles[variant] || variantStyles.default} ${className}`}
    >
      {children}
    </span>
  );
}

export default Badge;
