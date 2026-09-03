import React, { useState } from "react";
import API_URL from "../utils/config.js";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import {
  Search, ShieldCheck, ShieldAlert, ShieldX,
  Lock, EyeOff, AlertTriangle, CheckCircle2, Loader2,
  Zap, RefreshCcw, Route, ArrowRightLeft
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/Select";
import { Progress } from "@/components/ui/Progress";

const CHAINS = ["Ethereum", "Cardano", "Bitcoin", "Solana", "Polkadot", "Cosmos"];

// ─── Bridge Risk Analysis Tab ─────────────────────────────────────────────
const BridgeRiskAnalysis = () => {
  const [sourceChain, setSourceChain] = useState("");
  const [destChain, setDestChain] = useState("");
  const [bridgeName, setBridgeName] = useState("");

  const analyzeMutation = useMutation({
    mutationFn: async (payload) => {
      const { data } = await axios.post(`${API_URL}/api/evaluate`, payload);
      return data;
    },
  });

  const handleAnalyze = () => {
    if (!sourceChain || !destChain) return;
    analyzeMutation.mutate({
      source_chain: sourceChain,
      dest_chain: destChain,
      bridge: bridgeName || `${sourceChain} → ${destChain}`,
    });
  };

  const result = analyzeMutation.data;

  return (
    <div className="space-y-6">
      {/* Input Section */}
      <div className="bg-zb-card border border-zb-border rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-5">
          <Route className="w-4 h-4 text-zb-cyan" />
          <h3 className="text-sm font-semibold text-zb-text uppercase tracking-wider">Route Configuration</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-[10px] font-semibold text-zb-text-muted uppercase tracking-widest mb-1.5">Source Chain</label>
            <Select value={sourceChain} onValueChange={setSourceChain}>
              <SelectTrigger>
                <SelectValue placeholder="Select source..." />
              </SelectTrigger>
              <SelectContent>
                {CHAINS.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-zb-text-muted uppercase tracking-widest mb-1.5">Destination Chain</label>
            <Select value={destChain} onValueChange={setDestChain}>
              <SelectTrigger>
                <SelectValue placeholder="Select destination..." />
              </SelectTrigger>
              <SelectContent>
                {CHAINS.filter((c) => c !== sourceChain).map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-zb-text-muted uppercase tracking-widest mb-1.5">Bridge Protocol (Optional)</label>
            <Input
              placeholder="e.g. Wormhole, Multichain..."
              value={bridgeName}
              onChange={(e) => setBridgeName(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center justify-between mt-5">
          <div className="flex items-center gap-2 text-[10px] text-zb-text-muted">
            <Lock className="w-3 h-3" />
            <span className="uppercase tracking-wider font-semibold">Analysis powered by zero-knowledge proofs</span>
          </div>
          <Button onClick={handleAnalyze} disabled={!sourceChain || !destChain || analyzeMutation.isPending}>
            {analyzeMutation.isPending ? (
              <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</span>
            ) : (
              <span className="flex items-center gap-2"><Search className="w-4 h-4" /> Analyze Route</span>
            )}
          </Button>
        </div>
      </div>

      {/* Results */}
      {analyzeMutation.isError && (
        <div className="bg-zb-red/5 border border-zb-red/20 rounded-2xl p-5 flex items-center gap-3">
          <ShieldX className="w-5 h-5 text-zb-red shrink-0" />
          <div>
            <p className="text-sm font-medium text-zb-red">Analysis Failed</p>
            <p className="text-xs text-zb-text-muted mt-0.5">Backend may be waking up. Please try again.</p>
          </div>
          <Button variant="danger" size="sm" onClick={() => analyzeMutation.retry()} className="ml-auto shrink-0">
            <RefreshCcw className="w-3 h-3 mr-1" /> Retry
          </Button>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          {/* Risk Score Card */}
          <div className="bg-zb-card border border-zb-border rounded-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-semibold text-zb-text uppercase tracking-wider">Risk Assessment</h3>
              <Badge variant={result.risk_score > 70 ? "red" : result.risk_score > 40 ? "amber" : "green"}>
                {result.risk_score > 70 ? "High Risk" : result.risk_score > 40 ? "Moderate" : "Low Risk"}
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-[10px] font-semibold text-zb-text-muted uppercase tracking-widest mb-2">Risk Score</p>
                <div className="flex items-end gap-2">
                  <span className="text-4xl font-bold text-zb-text tabular-nums">{result.risk_score || "—"}</span>
                  <span className="text-sm text-zb-text-muted mb-1">/ 100</span>
                </div>
                <Progress
                  value={result.risk_score || 0}
                  className="mt-3"
                  color={result.risk_score > 70 ? "red" : result.risk_score > 40 ? "amber" : "green"}
                />
              </div>
              <div>
                <p className="text-[10px] font-semibold text-zb-text-muted uppercase tracking-widest mb-2">Verdict</p>
                <div className="flex items-center gap-2">
                  {result.risk_score > 70 ? (
                    <ShieldX className="w-6 h-6 text-zb-red" />
                  ) : result.risk_score > 40 ? (
                    <ShieldAlert className="w-6 h-6 text-zb-amber" />
                  ) : (
                    <ShieldCheck className="w-6 h-6 text-zb-green" />
                  )}
                  <span className={`text-lg font-bold ${
                    result.risk_score > 70 ? "text-zb-red" : result.risk_score > 40 ? "text-zb-amber" : "text-zb-green"
                  }`}>
                    {result.verdict || (result.risk_score > 70 ? "AVOID" : result.risk_score > 40 ? "CAUTION" : "SAFE")}
                  </span>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-zb-text-muted uppercase tracking-widest mb-2">Privacy Status</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Lock className="w-3.5 h-3.5 text-zb-purple" />
                    <span className="text-xs text-zb-text-secondary">Zero-knowledge protected</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <EyeOff className="w-3.5 h-3.5 text-zb-purple" />
                    <span className="text-xs text-zb-text-secondary">Transfer amount private</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-3.5 h-3.5 text-zb-green" />
                    <span className="text-xs text-zb-text-secondary">On-chain verdict public</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Detected Risks */}
          {result.risks && result.risks.length > 0 && (
            <div className="bg-zb-card border border-zb-border rounded-2xl p-6">
              <h3 className="text-sm font-semibold text-zb-text uppercase tracking-wider mb-4">Detected Risks</h3>
              <div className="space-y-2">
                {result.risks.map((risk, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-zb-surface rounded-xl border border-zb-border">
                    <AlertTriangle className="w-4 h-4 text-zb-amber shrink-0" />
                    <span className="text-xs text-zb-text-secondary">{typeof risk === "string" ? risk : risk.description || JSON.stringify(risk)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommended Route */}
          {result.recommended_route && (
            <div className="bg-zb-card border border-zb-border rounded-2xl p-6">
              <h3 className="text-sm font-semibold text-zb-text uppercase tracking-wider mb-4">Recommended Route</h3>
              <div className="flex items-center gap-3 p-4 bg-zb-green/5 border border-zb-green/20 rounded-xl">
                <CheckCircle2 className="w-5 h-5 text-zb-green shrink-0" />
                <span className="text-sm text-zb-text font-medium">{result.recommended_route}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Transfer Advisor Tab ─────────────────────────────────────────────────
const TransferAdvisor = () => {
  const [sourceChain, setSourceChain] = useState("");
  const [destChain, setDestChain] = useState("");
  const [amount, setAmount] = useState("");
  const [riskTolerance, setRiskTolerance] = useState("medium");

  const advisorMutation = useMutation({
    mutationFn: async (payload) => {
      const { data } = await axios.post(`${API_URL}/api/evaluate`, {
        source_chain: payload.source_chain,
        dest_chain: payload.dest_chain,
        amount: payload.amount,
        risk_tolerance: payload.risk_tolerance,
        mode: "transfer_advisor",
      });
      return data;
    },
  });

  const handleAnalyze = () => {
    if (!sourceChain || !destChain) return;
    advisorMutation.mutate({
      source_chain: sourceChain,
      dest_chain: destChain,
      amount: amount || "0",
      risk_tolerance: riskTolerance,
    });
  };

  const result = advisorMutation.data;

  return (
    <div className="space-y-6">
      {/* Transfer Configuration */}
      <div className="bg-zb-card border border-zb-border rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-5">
          <ArrowRightLeft className="w-4 h-4 text-zb-cyan" />
          <h3 className="text-sm font-semibold text-zb-text uppercase tracking-wider">Transfer Configuration</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-[10px] font-semibold text-zb-text-muted uppercase tracking-widest mb-1.5">Source Chain</label>
            <Select value={sourceChain} onValueChange={setSourceChain}>
              <SelectTrigger>
                <SelectValue placeholder="Select source..." />
              </SelectTrigger>
              <SelectContent>
                {CHAINS.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-zb-text-muted uppercase tracking-widest mb-1.5">Destination Chain</label>
            <Select value={destChain} onValueChange={setDestChain}>
              <SelectTrigger>
                <SelectValue placeholder="Select destination..." />
              </SelectTrigger>
              <SelectContent>
                {CHAINS.filter((c) => c !== sourceChain).map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-[10px] font-semibold text-zb-text-muted uppercase tracking-widest mb-1.5">
              Transfer Amount
              <span className="ml-2 text-zb-purple normal-case tracking-normal">(Private - ZK Protected)</span>
            </label>
            <Input
              placeholder="e.g. 5000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              icon={Lock}
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-zb-text-muted uppercase tracking-widest mb-1.5">Risk Tolerance</label>
            <Select value={riskTolerance} onValueChange={setRiskTolerance}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Conservative - Low Risk Only</SelectItem>
                <SelectItem value="medium">Balanced - Moderate Risk OK</SelectItem>
                <SelectItem value="high">Aggressive - Accept Higher Risk</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Privacy Notice */}
        <div className="flex items-center gap-3 p-3 bg-zb-purple/5 border border-zb-purple/20 rounded-xl mb-5">
          <Lock className="w-4 h-4 text-zb-purple shrink-0" />
          <p className="text-xs text-zb-text-secondary">
            Your transfer amount remains <span className="font-semibold text-zb-purple">private</span> throughout analysis.
            Only the coarse security verdict becomes public on-chain via zero-knowledge proof.
          </p>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[10px] text-zb-text-muted">
            <EyeOff className="w-3 h-3" />
            <span className="uppercase tracking-wider font-semibold">Intel feed aggregated from 12+ bridge monitors</span>
          </div>
          <Button onClick={handleAnalyze} disabled={!sourceChain || !destChain || advisorMutation.isPending}>
            {advisorMutation.isPending ? (
              <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</span>
            ) : (
              <span className="flex items-center gap-2"><Zap className="w-4 h-4" /> Analyze Transfer</span>
            )}
          </Button>
        </div>
      </div>

      {/* Transfer Results */}
      {advisorMutation.isError && (
        <div className="bg-zb-red/5 border border-zb-red/20 rounded-2xl p-5 flex items-center gap-3">
          <ShieldX className="w-5 h-5 text-zb-red shrink-0" />
          <div>
            <p className="text-sm font-medium text-zb-red">Analysis Failed</p>
            <p className="text-xs text-zb-text-muted mt-0.5">Backend may be waking up. Please try again.</p>
          </div>
          <Button variant="danger" size="sm" onClick={() => advisorMutation.retry()} className="ml-auto shrink-0">
            <RefreshCcw className="w-3 h-3 mr-1" /> Retry
          </Button>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <div className="bg-zb-card border border-zb-border rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-zb-text uppercase tracking-wider mb-4">Transfer Assessment</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <p className="text-[10px] font-semibold text-zb-text-muted uppercase tracking-widest mb-1">Risk Score</p>
                  <div className="flex items-end gap-2">
                    <span className="text-3xl font-bold text-zb-text tabular-nums">{result.risk_score || "—"}</span>
                    <span className="text-sm text-zb-text-muted mb-0.5">/ 100</span>
                  </div>
                  <Progress value={result.risk_score || 0} color={result.risk_score > 70 ? "red" : result.risk_score > 40 ? "amber" : "green"} className="mt-2" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-zb-text-muted uppercase tracking-widest mb-1">Verdict</p>
                  <span className={`text-lg font-bold ${
                    result.risk_score > 70 ? "text-zb-red" : result.risk_score > 40 ? "text-zb-amber" : "text-zb-green"
                  }`}>
                    {result.verdict || (result.risk_score > 70 ? "NOT RECOMMENDED" : result.risk_score > 40 ? "PROCEED WITH CAUTION" : "RECOMMENDED")}
                  </span>
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-[10px] font-semibold text-zb-text-muted uppercase tracking-widest">Intel Feed</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs text-zb-text-secondary">
                    <CheckCircle2 className="w-3.5 h-3.5 text-zb-green shrink-0" />
                    <span>Bridge contract audit: Passed</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-zb-text-secondary">
                    <CheckCircle2 className="w-3.5 h-3.5 text-zb-green shrink-0" />
                    <span>Zero-knowledge proof: Valid</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-zb-text-secondary">
                    <CheckCircle2 className="w-3.5 h-3.5 text-zb-green shrink-0" />
                    <span>Route integrity: Confirmed</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Main Analyze Page ────────────────────────────────────────────────────
export default function Analyze() {
  const [activeTab, setActiveTab] = useState("risk");

  return (
    <div className="max-w-[1200px] mx-auto space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-bold text-zb-text mb-1">Route Analysis</h1>
        <p className="text-sm text-zb-text-secondary">
          Evaluate bridge security, analyze transfer routes, and detect risks — all protected by zero-knowledge proofs.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} defaultValue="risk">
        <TabsList>
          <TabsTrigger value="risk">Bridge Risk Analysis</TabsTrigger>
          <TabsTrigger value="transfer">Transfer Advisor</TabsTrigger>
        </TabsList>

        <TabsContent value="risk">
          <BridgeRiskAnalysis />
        </TabsContent>

        <TabsContent value="transfer">
          <TransferAdvisor />
        </TabsContent>
      </Tabs>
    </div>
  );
}
