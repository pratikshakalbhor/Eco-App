import React from "react";

export function Card({ children, className = "" }) {
  return (
    <div className={`rounded-xl border bg-white shadow p-4 ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className = "" }) {
  return (
    <div className={`border-b pb-3 mb-3 ${className}`}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className = "" }) {
  return (
    <h3 className={`text-lg font-semibold text-gray-900 ${className}`}>
      {children}
    </h3>
  );
}

export function CardContent({ children, className = "" }) {
  return <div className={`space-y-2 ${className}`}>{children}</div>;
}
