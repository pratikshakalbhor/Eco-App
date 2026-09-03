import React, { useState, useRef, useEffect } from "react";

export function Select({ value, onValueChange, children }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const injectOnSelect = (children) =>
    React.Children.map(children, (child) => {
      if (!child) return child;
      if (child.type?.displayName === "SelectItem" || child.type === SelectItem) {
        return React.cloneElement(child, {
          onSelect: (val) => { onValueChange(val); setOpen(false); },
          selected: child.props.value === value,
        });
      }
      if (child.props?.children) {
        return React.cloneElement(child, {
          children: injectOnSelect(child.props.children),
        });
      }
      return child;
    });

  let currentLabel = null;
  const findLabel = (children) => {
    React.Children.forEach(children, (child) => {
      if (!child) return;
      if ((child.type?.displayName === "SelectItem" || child.type === SelectItem) && child.props.value === value) {
        currentLabel = child.props.children;
      } else if (child.props?.children) {
        findLabel(child.props.children);
      }
    });
  };
  findLabel(children);

  return (
    <div ref={ref} className="relative">
      <div onClick={() => setOpen(!open)}>
        {React.Children.map(children, (child) => {
          if (child?.type === SelectTrigger) {
            return React.cloneElement(child, {
              children: React.Children.map(child.props.children, (c) => {
                if (c?.type === SelectValue) {
                  return React.cloneElement(c, { currentLabel });
                }
                return c;
              }),
            });
          }
          return null;
        })}
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-zb-card border border-zb-border rounded-xl shadow-2xl max-h-60 overflow-auto">
          {React.Children.map(children, (child) => {
            if (child?.type === SelectContent) {
              return injectOnSelect(child.props.children);
            }
            return null;
          })}
        </div>
      )}
    </div>
  );
}

export function SelectTrigger({ children, className = "" }) {
  return (
    <div className={`flex items-center justify-between border border-zb-border rounded-xl px-3 py-2.5 cursor-pointer bg-zb-surface hover:border-zb-border-light transition-colors text-sm ${className}`}>
      {children}
      <svg className="w-4 h-4 text-zb-text-muted ml-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  );
}

export function SelectContent({ children, className = "" }) {
  return <div className={className}>{children}</div>;
}

SelectContent.displayName = "SelectContent";

export function SelectItem({ value, children, onSelect, selected }) {
  return (
    <div
      onClick={() => onSelect && onSelect(value)}
      className={`px-3 py-2.5 cursor-pointer text-sm transition-colors ${
        selected ? "bg-zb-cyan/10 text-zb-cyan" : "hover:bg-zb-card-hover text-zb-text-secondary"
      }`}
    >
      {children}
    </div>
  );
}

SelectItem.displayName = "SelectItem";

export function SelectValue({ placeholder, currentLabel }) {
  return (
    <span className={currentLabel ? "text-zb-text" : "text-zb-text-muted"}>
      {currentLabel || placeholder || "Select..."}
    </span>
  );
}

export default Select;
