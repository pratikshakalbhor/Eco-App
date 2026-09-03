import React from "react";

export function Input({ id, type = "text", value, onChange, placeholder, className = "", icon: Icon, ...props }) {
  return (
    <div className="relative">
      {Icon && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zb-text-muted">
          <Icon className="w-4 h-4" />
        </div>
      )}
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`w-full bg-zb-surface border border-zb-border rounded-xl px-4 py-2.5 text-sm text-zb-text placeholder:text-zb-text-muted focus:outline-none focus:border-zb-cyan/40 focus:ring-1 focus:ring-zb-cyan/20 transition-all ${Icon ? "pl-10" : ""} ${className}`}
        {...props}
      />
    </div>
  );
}
