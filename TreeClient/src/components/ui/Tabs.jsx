import React, { useState } from "react";

export function Tabs({ children, defaultValue }) {
  const [active, setActive] = useState(defaultValue);
  const tabs = React.Children.map(children, (child) =>
    React.cloneElement(child, { active, setActive })
  );
  return <div>{tabs}</div>;
}

export function TabsList({ children }) {
  return <div className="flex space-x-2 mb-4">{children}</div>;
}

export function TabsTrigger({ value, children, active, setActive }) {
  const isActive = active === value;
  return (
    <button
      onClick={() => setActive(value)}
      className={`px-4 py-2 rounded-lg ${
        isActive
          ? "bg-green-600 text-white"
          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
      }`}
    >
      {children}
    </button>
  );
}
