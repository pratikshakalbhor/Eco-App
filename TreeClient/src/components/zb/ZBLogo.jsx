import React from "react";
import { Shield } from "lucide-react";

const ZBLogo = ({ size = "default", showText = true, className = "" }) => {
  const sizes = {
    sm: { icon: 16, text: "text-sm" },
    default: { icon: 20, text: "text-lg" },
    lg: { icon: 28, text: "text-2xl" },
  };

  const s = sizes[size] || sizes.default;

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div className="relative">
        <div className="bg-gradient-to-br from-zb-cyan to-zb-blue rounded-xl flex items-center justify-center shadow-lg shadow-zb-cyan/20" style={{ width: s.icon + 12, height: s.icon + 12 }}>
          <Shield className="text-zb-bg" style={{ width: s.icon, height: s.icon }} strokeWidth={2.5} />
        </div>
        <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-zb-green rounded-full border-2 border-zb-surface" />
      </div>
      {showText && (
        <div className="flex flex-col">
          <span className={`font-bold text-zb-text leading-none tracking-tight ${s.text}`}>
            Zero<span className="text-zb-cyan">Bridge</span>
          </span>
        </div>
      )}
    </div>
  );
};

export default ZBLogo;
