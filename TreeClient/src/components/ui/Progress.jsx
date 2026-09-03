import React from "react";

export function Progress({ value = 0, className = "", color = "cyan" }) {
  const colorMap = {
    cyan: "bg-zb-cyan",
    green: "bg-zb-green",
    amber: "bg-zb-amber",
    red: "bg-zb-red",
    blue: "bg-zb-blue",
  };

  return (
    <div className={`w-full bg-zb-surface rounded-full h-2 ${className}`}>
      <div
        className={`${colorMap[color] || colorMap.cyan} h-2 rounded-full transition-all duration-500 ease-out`}
        style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }}
      />
    </div>
  );
}

export default Progress;
