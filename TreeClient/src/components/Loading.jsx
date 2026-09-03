import React from "react";
import { Shield } from "lucide-react";

const Loading = ({ height = "100vh", message = "Loading ZeroBridge..." }) => {
  return (
    <div style={{ height }} className="flex flex-col items-center justify-center bg-zb-bg gap-4">
      <div className="relative">
        <div className="w-12 h-12 bg-gradient-to-br from-zb-cyan to-zb-blue rounded-xl flex items-center justify-center animate-zb-glow">
          <Shield className="w-6 h-6 text-zb-bg" strokeWidth={2.5} />
        </div>
        <div className="absolute inset-0 w-12 h-12 border-2 border-zb-cyan/30 rounded-xl animate-spin" style={{ borderTopColor: "transparent" }} />
      </div>
      <p className="text-xs text-zb-text-muted font-medium uppercase tracking-widest">{message}</p>
    </div>
  );
};

export default Loading;
