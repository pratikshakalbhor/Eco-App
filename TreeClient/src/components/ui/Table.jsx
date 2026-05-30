import React from "react";

export function Table({ children, className = "" }) {
  return (
    <table className={`min-w-full border border-gray-200 rounded-lg ${className}`}>
      {children}
    </table>
  );
}

export function TableHeader({ children, className = "" }) {
  return <thead className={`bg-gray-100 ${className}`}>{children}</thead>;
}

export function TableBody({ children, className = "" }) {
  return <tbody className={className}>{children}</tbody>;
}

export function TableRow({ children, className = "" }) {
  return (
    <tr className={`border-b last:border-none hover:bg-gray-50 ${className}`}>
      {children}
    </tr>
  );
}

export function TableHead({ children, className = "" }) {
  return (
    <th className={`text-left px-4 py-2 font-semibold text-gray-700 ${className}`}>
      {children}
    </th>
  );
}

export function TableCell({ children, className = "" }) {
  return (
    <td className={`px-4 py-2 text-gray-700 ${className}`}>
      {children}
    </td>
  );
}

export default Table;
