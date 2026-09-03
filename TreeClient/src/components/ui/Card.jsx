import React from "react";

export function Card({ children, className = "", hover = false }) {
  return (
    <div className={`bg-zb-card border border-zb-border rounded-2xl p-5 ${hover ? "hover:bg-zb-card-hover hover:border-zb-border-light transition-all duration-200" : ""} ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className = "" }) {
  return (
    <div className={`border-b border-zb-border pb-4 mb-4 ${className}`}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className = "" }) {
  return (
    <h3 className={`text-base font-semibold text-zb-text ${className}`}>
      {children}
    </h3>
  );
}

export function CardContent({ children, className = "" }) {
  return <div className={`space-y-3 ${className}`}>{children}</div>;
}
