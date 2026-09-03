import React, { useState } from "react";

// Supports both controlled (value + onValueChange) and uncontrolled (defaultValue) usage
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
    <div className={`flex flex-wrap gap-2 ${className}`}>
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
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        isActive
          ? "bg-green-600 text-white shadow-sm"
          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
      }`}
    >
      {children}
    </button>
  );
}

export function TabsContent({ value, active, children, className = "" }) {
  if (active !== value) return null;
  return <div className={className}>{children}</div>;
}
