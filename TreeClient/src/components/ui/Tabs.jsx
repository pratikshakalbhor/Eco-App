import React, { useState } from "react";

export function Tabs({ children, value, onValueChange, defaultValue }) {
  const [internal, setInternal] = useState(defaultValue || "");
  const active = value !== undefined ? value : internal;
  const setActive = onValueChange !== undefined ? onValueChange : setInternal;

  return (
    <div>
      {React.Children.map(children, (child) => {
        if (!child) return null;
        return React.cloneElement(child, { active, setActive });
      })}
    </div>
  );
}

export function TabsList({ children, active, setActive, className = "" }) {
  return (
    <div className={`flex gap-1 p-1 bg-zb-surface rounded-xl border border-zb-border ${className}`}>
      {React.Children.map(children, (child) => {
        if (!child) return null;
        return React.cloneElement(child, { active, setActive });
      })}
    </div>
  );
}

export function TabsTrigger({ value, children, active, setActive }) {
  const isActive = active === value;
  return (
    <button
      type="button"
      onClick={() => setActive(value)}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
        isActive
          ? "bg-zb-card text-zb-cyan shadow-sm border border-zb-border"
          : "text-zb-text-muted hover:text-zb-text-secondary"
      }`}
    >
      {children}
    </button>
  );
}

export function TabsContent({ value, active, children, className = "" }) {
  if (active !== value) return null;
  return <div className={`mt-4 ${className}`}>{children}</div>;
}
