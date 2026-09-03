import React from "react";

export function Table({ children, className = "" }) {
  return (
    <div className={`w-full overflow-x-auto ${className}`}>
      <table className="w-full text-sm">
        {children}
      </table>
    </div>
  );
}

export function TableHeader({ children, className = "" }) {
  return <thead className={`${className}`}>{children}</thead>;
}

export function TableBody({ children, className = "" }) {
  return <tbody className={`divide-y divide-zb-border ${className}`}>{children}</tbody>;
}

export function TableRow({ children, className = "" }) {
  return (
    <tr className={`hover:bg-zb-card-hover transition-colors ${className}`}>
      {children}
    </tr>
  );
}

export function TableHead({ children, className = "" }) {
  return (
    <th className={`text-left px-4 py-3 text-[11px] font-semibold text-zb-text-muted uppercase tracking-wider ${className}`}>
      {children}
    </th>
  );
}

export function TableCell({ children, className = "" }) {
  return (
    <td className={`px-4 py-3 text-zb-text ${className}`}>
      {children}
    </td>
  );
}

export default Table;
