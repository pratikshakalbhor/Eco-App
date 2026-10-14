import React, { useState } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, Wallet, Loader2, ArrowRight, TreePine } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";

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
      console.error("Login Error:", err);
      if (err.message?.includes("MetaMask is not detected") || err.message?.includes("No wallet connected")) {
        setError(err.message);
      } else if (err.code === "ERR_NETWORK" || !err.response) {
        setError("Backend server is unreachable. Please ensure the API is running at " + import.meta.env.VITE_API_URL);
      } else {
        setError(err.response?.data?.error || err.message || "Failed to connect wallet. Ensure MetaMask is installed and unlocked.");
      }
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] text-white overflow-hidden relative">
      {/* Background Gradients */}
      <div className="absolute top-0 left-0 w-full h-full">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-900/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-green-900/20 blur-[120px] rounded-full" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md p-8 bg-white/5 border border-white/10 backdrop-blur-xl rounded-[2.5rem] shadow-2xl"
      >
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-emerald-500/10 rounded-3xl mb-6 border border-emerald-500/20">
            <TreePine className="w-10 h-10 text-emerald-400" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-3">EcoChain</h1>
          <p className="text-gray-400 text-lg">Decentralized Tree Plantation & Carbon Credits</p>
        </div>

        <div className="space-y-4">
          <Button
            onClick={handleConnect}
            disabled={isConnecting}
            className="w-full h-16 bg-emerald-500 hover:bg-emerald-600 text-black font-bold text-lg rounded-2xl transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
          >
            {isConnecting ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <>
                <Wallet className="w-6 h-6" />
                Connect MetaMask
              </>
            )}
          </Button>

          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center"
            >
              {error}
            </motion.div>
          )}

          <div className="pt-6 flex items-center justify-center gap-6 text-gray-500">
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest font-semibold">
              <ShieldCheck className="w-4 h-4" /> Secure
            </div>
            <div className="h-4 w-[1px] bg-white/10" />
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest font-semibold">
              <ArrowRight className="w-4 h-4" /> Web3 Native
            </div>
          </div>
        </div>

        <p className="mt-10 text-center text-sm text-gray-500">
          New to Web3? <a href="https://metamask.io" target="_blank" className="text-emerald-400 hover:underline">Get MetaMask</a>
        </p>
      </motion.div>
    </div>
  );
}
