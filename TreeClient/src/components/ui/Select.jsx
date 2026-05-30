import React, { useState } from "react";

export function Select({ value, onValueChange, children }) {
  const [open, setOpen] = useState(false);

  const handleSelect = (val) => {
    onValueChange(val);
    setOpen(false);
  };

  return (
    <div className="relative">
      <div
        onClick={() => setOpen(!open)}
        className="border border-gray-300 rounded-lg px-3 py-2 cursor-pointer bg-white"
      >
        {value || "Select an option"}
      </div>
      {open && (
        <div className="absolute mt-1 w-full bg-white border border-gray-200 rounded-lg shadow z-10">
          {React.Children.map(children, (child) =>
            React.cloneElement(child, { onSelect: handleSelect })
          )}
        </div>
      )}
    </div>
  );
}

export function SelectTrigger({ children }) {
  return <>{children}</>;
}

export function SelectContent({ children }) {
  return <div>{children}</div>;
}

export function SelectItem({ value, children, onSelect }) {
  return (
    <div
      onClick={() => onSelect(value)}
      className="px-3 py-2 hover:bg-green-50 cursor-pointer"
    >
      {children}
    </div>
  );
}

export function SelectValue({ placeholder }) {
  return <span className="text-gray-500">{placeholder}</span>;
}

export default Select;
