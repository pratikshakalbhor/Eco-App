import React, { useState } from "react";
import { Shield, Wallet, Loader2, Lock, Eye } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import ZBLogo from "@/components/zb/ZBLogo";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState("");

  const handleConnect = async () => {
    setIsConnecting(true);
    setError("");
    try {
      await login();
      navigate("/");
    } catch (err) {
      if (err.message?.includes("MetaMask is not detected") || err.message?.includes("No wallet connected")) {
        setError(err.message);
      } else if (err.code === "ERR_NETWORK" || !err.response) {
        setError("Backend server is unreachable. Please ensure the API is running.");
      } else {
        setError(err.response?.data?.error || err.message || "Failed to connect wallet.");
      }
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zb-bg text-zb-text overflow-hidden relative">
      {/* Background Effects */}
      <div className="absolute inset-0">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-zb-cyan/5 blur-[150px] rounded-full" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-zb-blue/5 blur-[150px] rounded-full" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-zb-purple/3 blur-[200px] rounded-full" />
      </div>

      {/* Grid Pattern */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: `linear-gradient(rgba(0,212,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.3) 1px, transparent 1px)`,
        backgroundSize: "60px 60px"
      }} />

      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="bg-zb-card/50 border border-zb-border backdrop-blur-xl rounded-3xl p-8 shadow-2xl">
          {/* Logo */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center mb-6">
              <ZBLogo size="lg" />
            </div>
            <p className="text-zb-text-secondary text-sm mt-3">Privacy-preserving bridge security</p>
          </div>

          {/* Connect Button */}
          <div className="space-y-4">
            <Button
              onClick={handleConnect}
              disabled={isConnecting}
              className="w-full h-14 text-base font-semibold rounded-2xl flex items-center justify-center gap-3"
            >
              {isConnecting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Wallet className="w-5 h-5" />
                  Connect Wallet
                </>
              )}
            </Button>

            {error && (
              <div className="p-4 bg-zb-red/5 border border-zb-red/20 rounded-xl text-zb-red text-xs text-center">
                {error}
              </div>
            )}

            {/* Trust Indicators */}
            <div className="pt-6 flex items-center justify-center gap-6 text-zb-text-muted">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-semibold">
                <Shield className="w-3.5 h-3.5" /> Secure
              </div>
              <div className="h-4 w-[1px] bg-zb-border" />
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-semibold">
                <Lock className="w-3.5 h-3.5" /> ZK Protected
              </div>
              <div className="h-4 w-[1px] bg-zb-border" />
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-semibold">
                <Eye className="w-3.5 h-3.5" /> Private
              </div>
            </div>
          </div>

          {/* Footer */}
          <p className="mt-8 text-center text-xs text-zb-text-muted">
            Powered by Midnight zero-knowledge technology
          </p>
        </div>
      </div>
    </div>
  );
}
