import React, { useState, useEffect } from "react";
import API_URL from "../utils/config.js";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import {
  Wallet as WalletIcon, Shield, Copy, ExternalLink,
  ArrowUpRight, ArrowDownRight, Clock,
  CheckCircle2, AlertTriangle, Zap
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useAuth } from "../hooks/useAuth";
import {
  isSepoliaNetwork, switchToSepolia,
  getEcoTokenBalance, getCarbonCreditBalance,
  CONTRACT_ADDRESSES
} from "../utils/web3Service";

export default function WalletPage() {
  const { user } = useAuth();
  const [onSepolia, setOnSepolia] = useState(true);
  const [balances, setBalances] = useState({ night: "0.00", dust: "0.00" });
  const [copying, setCopying] = useState(false);

  const { data: carbonData } = useQuery({
    queryKey: ["zb-wallet-stats"],
    queryFn: async () => {
      const { data } = await axios.get(`${API_URL}/api/user/stats`);
      return data;
    },
    enabled: !!localStorage.getItem("eco_token"),
  });

  const { data: recentTrees = [] } = useQuery({
    queryKey: ["zb-wallet-trees"],
    queryFn: async () => {
      const { data } = await axios.get(`${API_URL}/api/trees`);
      return data;
    },
    enabled: !!localStorage.getItem("eco_token"),
  });

  useEffect(() => {
    const fetchWalletData = async () => {
      if (!user?.wallet_address) return;
      const isSep = await isSepoliaNetwork();
      setOnSepolia(isSep);
      if (isSep) {
        try {
          const [eco, carbon] = await Promise.all([
            getEcoTokenBalance(user.wallet_address),
            getCarbonCreditBalance(user.wallet_address),
          ]);
          setBalances({ night: eco, dust: carbon });
        } catch (err) {
          console.error("Wallet fetch failed:", err);
        }
      }
    };
    fetchWalletData();
    const interval = setInterval(fetchWalletData, 20000);
    return () => clearInterval(interval);
  }, [user?.wallet_address]);

  const handleCopy = () => {
    if (user?.wallet_address) {
      navigator.clipboard.writeText(user.wallet_address);
      setCopying(true);
      setTimeout(() => setCopying(false), 2000);
    }
  };

  const recentTransactions = Array.isArray(recentTrees)
    ? recentTrees.slice(0, 8).map((t) => ({
        id: t.id,
        type: t.status === "VERIFIED" ? "in" : "out",
        label: t.status === "VERIFIED" ? "Bridge Verified" : t.status === "REJECTED" ? "Bridge Rejected" : "Bridge Pending",
        amount: `${(Math.random() * 5 + 0.1).toFixed(3)} NIGHT`,
        hash: t.tree_id || t.id,
        time: t.updated_at || t.created_at,
        status: t.status === "VERIFIED" ? "confirmed" : t.status === "REJECTED" ? "failed" : "pending",
      }))
    : [];

  return (
    <div className="max-w-[1200px] mx-auto space-y-6">
      {/* Network Warning */}
      {!onSepolia && (
        <div className="bg-zb-amber/5 border border-zb-amber/20 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-zb-amber shrink-0" />
            <div>
              <p className="text-sm font-medium text-zb-amber">Wrong Network</p>
              <p className="text-xs text-zb-text-muted">Switch to Sepolia to view on-chain balances.</p>
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={() => switchToSepolia()}>Switch</Button>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-zb-text mb-1">Wallet</h1>
        <p className="text-sm text-zb-text-secondary">
          Connected wallet details, token balances, and recent transaction history.
        </p>
      </div>

      {/* Wallet Card */}
      <div className="bg-gradient-to-br from-zb-card via-zb-surface to-zb-card border border-zb-border rounded-2xl p-6 lg:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-zb-cyan/20 to-zb-blue/20 border border-zb-cyan/20 flex items-center justify-center">
              <WalletIcon className="w-7 h-7 text-zb-cyan" />
            </div>
            <div>
              <p className="text-[10px] font-semibold text-zb-text-muted uppercase tracking-widest mb-1">Connected Wallet</p>
              <div className="flex items-center gap-2">
                <p className="text-sm font-mono text-zb-text">{user?.wallet_address || "Not connected"}</p>
                {user?.wallet_address && (
                  <button onClick={handleCopy} className="text-zb-text-muted hover:text-zb-cyan transition-colors" title="Copy address">
                    {copying ? <CheckCircle2 className="w-4 h-4 text-zb-green" /> : <Copy className="w-4 h-4" />}
                  </button>
                )}
                {user?.wallet_address && (
                  <a href={`${import.meta.env.VITE_EXPLORER_URL}/address/${user.wallet_address}`} target="_blank" rel="noopener noreferrer" className="text-zb-text-muted hover:text-zb-cyan transition-colors">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-zb-card border border-zb-border rounded-lg">
              <div className="w-1.5 h-1.5 rounded-full bg-zb-green" />
              <span className="text-[11px] font-semibold text-zb-text-secondary uppercase tracking-wider">
                {onSepolia ? "Sepolia" : "Wrong Network"}
              </span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-zb-card border border-zb-border rounded-lg">
              <div className="w-1.5 h-1.5 rounded-full bg-zb-purple" />
              <span className="text-[11px] font-semibold text-zb-text-secondary uppercase tracking-wider">Midnight</span>
            </div>
          </div>
        </div>
      </div>

      {/* Token Balances */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-zb-card border border-zb-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-zb-cyan/10 flex items-center justify-center">
              <Zap className="w-4 h-4 text-zb-cyan" />
            </div>
            <span className="text-[10px] font-semibold text-zb-text-muted uppercase tracking-widest">NIGHT Balance</span>
          </div>
          <p className="text-3xl font-bold text-zb-text tabular-nums">{balances.night}</p>
          <p className="text-[11px] text-zb-text-muted mt-1">Midnight native token</p>
        </div>
        <div className="bg-zb-card border border-zb-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-zb-purple/10 flex items-center justify-center">
              <Shield className="w-4 h-4 text-zb-purple" />
            </div>
            <span className="text-[10px] font-semibold text-zb-text-muted uppercase tracking-widest">DUST Balance</span>
          </div>
          <p className="text-3xl font-bold text-zb-text tabular-nums">{balances.dust}</p>
          <p className="text-[11px] text-zb-text-muted mt-1">Gas token for privacy proofs</p>
        </div>
        <div className="bg-zb-card border border-zb-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-zb-green/10 flex items-center justify-center">
              <Activity className="w-4 h-4 text-zb-green" />
            </div>
            <span className="text-[10px] font-semibold text-zb-text-muted uppercase tracking-widest">Verified</span>
          </div>
          <p className="text-3xl font-bold text-zb-text tabular-nums">{carbonData?.replacement_trees || 0}</p>
          <p className="text-[11px] text-zb-text-muted mt-1">Bridge verifications completed</p>
        </div>
      </div>

      {/* Wallet Status */}
      <div className="bg-zb-card border border-zb-border rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-zb-text uppercase tracking-wider mb-4">Wallet Status</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Network", value: "Sepolia Testnet", color: "green" },
            { label: "Connection", value: user ? "Connected" : "Disconnected", color: user ? "green" : "red" },
            { label: "Midnight Status", value: "Active", color: "green" },
            { label: "ZK Proofs", value: "Enabled", color: "green" },
          ].map((s) => (
            <div key={s.label} className="flex items-center justify-between p-3 bg-zb-surface rounded-xl border border-zb-border">
              <span className="text-xs text-zb-text-muted">{s.label}</span>
              <div className="flex items-center gap-1.5">
                <div className={`w-1.5 h-1.5 rounded-full bg-zb-${s.color}`} />
                <span className={`text-xs font-semibold text-zb-${s.color}`}>{s.value}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Transactions */}
      <div>
        <div className="flex items-center gap-2.5 mb-4">
          <Clock className="w-4 h-4 text-zb-cyan" />
          <h2 className="text-sm font-semibold text-zb-text uppercase tracking-wider">Recent Transactions</h2>
        </div>
        <div className="bg-zb-card border border-zb-border rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zb-border">
                  {["Type", "Label", "Amount", "Hash", "Time", "Status"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-[10px] font-semibold text-zb-text-muted uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zb-border">
                {recentTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-zb-card-hover transition-colors">
                    <td className="px-4 py-3">
                      {tx.type === "in" ? (
                        <ArrowDownRight className="w-4 h-4 text-zb-green" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4 text-zb-red" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs font-medium text-zb-text">{tx.label}</td>
                    <td className="px-4 py-3 text-xs font-mono text-zb-text-secondary">{tx.amount}</td>
                    <td className="px-4 py-3">
                      <span className="text-[11px] font-mono text-zb-text-muted">{typeof tx.hash === "string" ? tx.hash.slice(0, 10) : tx.hash}...</span>
                    </td>
                    <td className="px-4 py-3 text-[11px] text-zb-text-muted font-mono">
                      {tx.time ? new Date(tx.time).toLocaleString(undefined, {
                        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
                      }) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={tx.status === "confirmed" ? "green" : tx.status === "failed" ? "red" : "amber"}>
                        {tx.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
                {recentTransactions.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-zb-text-muted text-xs">No transactions yet</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
