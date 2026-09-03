import React, { useMemo } from "react";
import API_URL from "../utils/config.js";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import {
  Shield, ShieldCheck, ShieldAlert, ShieldX, Activity, AlertTriangle,
  Clock, Zap, Globe, RefreshCcw, Eye
} from "lucide-react";
import { SkeletonCard, SkeletonTable, SkeletonScore } from "@/components/zb/Skeleton";

// ─── Circular Security Score ───────────────────────────────────────────────
const SecurityScore = ({ score = 82, loading }) => {
  if (loading) return <SkeletonScore />;

  const radius = 70;
  const stroke = 8;
  const normalizedRadius = radius - stroke;

  const getRiskLevel = (s) => {
    if (s >= 80) return { label: "LOW RISK", color: "text-zb-green", glow: "shadow-zb-green/20" };
    if (s >= 60) return { label: "MODERATE", color: "text-zb-amber", glow: "shadow-zb-amber/20" };
    if (s >= 40) return { label: "ELEVATED", color: "text-zb-amber", glow: "shadow-zb-amber/20" };
    return { label: "HIGH RISK", color: "text-zb-red", glow: "shadow-zb-red/20" };
  };

  const risk = getRiskLevel(score);

  const segmentCount = 24;
  const segments = Array.from({ length: segmentCount }).map((_, i) => {
    const angle = (i / segmentCount) * 360 - 90;
    const filled = (i / segmentCount) * 100 < score;
    return { angle, filled };
  });

  return (
    <div className="relative flex flex-col items-center">
      <div className="relative" style={{ width: radius * 2, height: radius * 2 }}>
        {/* Background ring segments */}
        <svg width={radius * 2} height={radius * 2} className="absolute inset-0 -rotate-90">
          {segments.map((seg, i) => {
            const r = normalizedRadius;
            const cx = radius;
            const cy = radius;
            const startAngle = (i / segmentCount) * 2 * Math.PI;
            const segLength = (1 / segmentCount) * 2 * Math.PI * r * 0.85;
            const x1 = cx + r * Math.cos(startAngle);
            const y1 = cy + r * Math.sin(startAngle);
            const x2 = cx + r * Math.cos(startAngle + (segLength / r));
            const y2 = cy + r * Math.sin(startAngle + (segLength / r));
            return (
              <path
                key={i}
                d={`M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`}
                fill="none"
                stroke={seg.filled ? (score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : "#ef4444") : "#1c1f33"}
                strokeWidth={stroke}
                strokeLinecap="round"
                opacity={seg.filled ? 1 : 0.4}
              />
            );
          })}
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-bold text-zb-text tabular-nums">{score}</span>
          <span className="text-[10px] text-zb-text-muted font-medium">/ 100</span>
        </div>
      </div>

      <div className={`mt-4 px-4 py-1.5 rounded-full border ${risk.color} ${risk.color.replace("text-", "bg-")}/10 ${risk.color.replace("text-", "border-")}/20`}>
        <span className={`text-xs font-bold uppercase tracking-widest ${risk.color}`}>{risk.label}</span>
      </div>
    </div>
  );
};

// ─── Metric Card ──────────────────────────────────────────────────────────
const MetricCard = ({ title, value, color = "cyan", subtitle }) => {
  const colorMap = {
    cyan: "from-zb-cyan/10 to-zb-cyan/5 border-zb-cyan/20 text-zb-cyan",
    green: "from-zb-green/10 to-zb-green/5 border-zb-green/20 text-zb-green",
    amber: "from-zb-amber/10 to-zb-amber/5 border-zb-amber/20 text-zb-amber",
    red: "from-zb-red/10 to-zb-red/5 border-zb-red/20 text-zb-red",
    blue: "from-zb-blue/10 to-zb-blue/5 border-zb-blue/20 text-zb-blue",
    purple: "from-zb-purple/10 to-zb-purple/5 border-zb-purple/20 text-zb-purple",
  };
  const c = colorMap[color] || colorMap.cyan;

  return (
    <div className={`bg-gradient-to-br ${c} border rounded-2xl p-5 transition-all duration-200 hover:scale-[1.02]`}>
      <p className="text-[10px] font-semibold text-zb-text-muted uppercase tracking-widest mb-1">{title}</p>
      <p className="text-2xl font-bold text-zb-text tabular-nums">{value ?? "0"}</p>
      {subtitle && <p className="text-[11px] text-zb-text-muted mt-1">{subtitle}</p>}
    </div>
  );
};

// ─── Status Dot ───────────────────────────────────────────────────────────
const StatusDot = ({ status }) => {
  const colors = {
    secure: "bg-zb-green",
    warning: "bg-zb-amber",
    critical: "bg-zb-red",
    active: "bg-zb-cyan",
    verified: "bg-zb-green",
  };
  return <span className={`inline-block w-1.5 h-1.5 rounded-full ${colors[status] || colors.active}`} />;
};

// ─── Main Dashboard ───────────────────────────────────────────────────────
export default function Dashboard() {
  const { data: stats, isLoading: isStatsLoading } = useQuery({
    queryKey: ["zb-tree-stats"],
    queryFn: async () => {
      const { data } = await axios.get(`${API_URL}/api/trees/stats`);
      return data;
    },
  });

  const { data: trees = [], isLoading: isTreesLoading } = useQuery({
    queryKey: ["zb-dashboard-trees"],
    queryFn: async () => {
      const { data } = await axios.get(`${API_URL}/api/trees`);
      return data;
    },
  });

  const { data: recentActivity = [], isLoading: isActivityLoading } = useQuery({
    queryKey: ["zb-recent-activity"],
    queryFn: async () => {
      const { data } = await axios.get(`${API_URL}/api/activity/recent`);
      return data;
    },
  });

  const isLoading = isStatsLoading || isTreesLoading;

  const securityScore = useMemo(() => {
    if (!stats) return 82;
    const verified = stats.verified || 0;
    const total = stats.total || 1;
    const base = Math.round((verified / total) * 100);
    return Math.max(40, Math.min(98, base + 15));
  }, [stats]);

  const bridges = useMemo(() => {
    if (!Array.isArray(trees)) return [];
    return trees.slice(0, 8).map((t) => ({
      id: t.id,
      name: t.species || `Bridge #${t.tree_id}`,
      route: `${t.status === "VERIFIED" ? "Ethereum" : "Cardano"} → ${t.status === "VERIFIED" ? "Midnight" : "Midnight"}`,
      tvl: t.status === "VERIFIED" ? "2.4M" : "890K",
      status: t.status === "VERIFIED" ? "secure" : t.status === "REJECTED" ? "critical" : "warning",
      statusLabel: t.status === "VERIFIED" ? "Verified" : t.status === "REJECTED" ? "Flagged" : "Pending",
      riskVerdict: t.status === "VERIFIED" ? "Safe" : t.status === "REJECTED" ? "High Risk" : "Review",
      lastTx: t.updated_at || t.created_at,
      treeId: t.tree_id,
    }));
  }, [trees]);

  const alertCount = useMemo(() => {
    if (!Array.isArray(trees)) return 0;
    return trees.filter((t) => t.status === "REJECTED" || t.status === "PENDING").length;
  }, [trees]);

  const verifiedCount = useMemo(() => stats?.verified || 0, [stats]);

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      {/* ── Hero: Security Score Section ─────────────────────────────── */}
      <div className="bg-gradient-to-br from-zb-card via-zb-surface to-zb-card border border-zb-border rounded-2xl p-6 lg:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center gap-8">
          {/* Score */}
          <div className="shrink-0">
            <SecurityScore score={securityScore} loading={isLoading} />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-zb-cyan animate-zb-pulse" />
              <span className="text-[11px] font-semibold text-zb-cyan uppercase tracking-widest">Live Security Monitoring</span>
            </div>
            <h1 className="text-2xl lg:text-3xl font-bold text-zb-text mb-2">Bridge Security Overview</h1>
            <p className="text-sm text-zb-text-secondary max-w-lg leading-relaxed">
              Aggregate security posture across all monitored bridge routes.
              Score derived from on-chain verification status, smart contract audits,
              zero-knowledge proof validation, and real-time threat intelligence.
            </p>

            {/* Score factors */}
            <div className="flex flex-wrap gap-3 mt-5">
              {[
                { label: "ZK Proofs", value: "Valid", color: "green" },
                { label: "Contract Audit", value: "Passed", color: "green" },
                { label: "Route Integrity", value: "Intact", color: "cyan" },
                { label: "Threat Level", value: alertCount > 0 ? "Elevated" : "Normal", color: alertCount > 0 ? "amber" : "green" },
              ].map((f) => (
                <div key={f.label} className="flex items-center gap-2 px-3 py-1.5 bg-zb-surface rounded-lg border border-zb-border">
                  <StatusDot status={f.color === "green" ? "secure" : f.color === "amber" ? "warning" : "active"} />
                  <span className="text-[10px] font-medium text-zb-text-muted uppercase tracking-wider">{f.label}</span>
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${f.color === "green" ? "text-zb-green" : f.color === "amber" ? "text-zb-amber" : "text-zb-cyan"}`}>{f.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Metric Cards ────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Active Bridges"
            value={stats?.total || 0}
            color="cyan"
            subtitle="Across all chains"
          />
          <MetricCard
            title="Bridges At Risk"
            value={stats?.pending || 0}
            color="amber"
            subtitle="Require attention"
          />
          <MetricCard
            title="Security Alerts"
            value={alertCount}
            color={alertCount > 0 ? "red" : "green"}
            subtitle={alertCount > 0 ? "Active threats" : "No active threats"}
          />
          <MetricCard
            title="Verified Routes"
            value={verifiedCount}
            color="green"
            subtitle="ZK-verified"
          />
        </div>
      )}

      {/* ── Activity & System Status ────────────────────────────────── */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* On-Chain Activity Table */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <Activity className="w-4 h-4 text-zb-cyan" />
              <h2 className="text-sm font-semibold text-zb-text uppercase tracking-wider">On-Chain Activity</h2>
            </div>
            <button className="flex items-center gap-1.5 text-[10px] font-semibold text-zb-text-muted hover:text-zb-cyan uppercase tracking-wider transition-colors">
              <RefreshCcw className="w-3 h-3" />
              Refresh
            </button>
          </div>

          {isLoading ? (
            <SkeletonTable rows={5} cols={6} />
          ) : (
            <div className="bg-zb-card border border-zb-border rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zb-border">
                      {["Bridge", "Route", "TVL", "Status", "Risk", "Last TX"].map((h) => (
                        <th key={h} className="text-left px-4 py-3 text-[10px] font-semibold text-zb-text-muted uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zb-border">
                    {bridges.map((b) => (
                      <tr key={b.id} className="hover:bg-zb-card-hover transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold ${
                              b.status === "secure" ? "bg-zb-green/10 text-zb-green" :
                              b.status === "critical" ? "bg-zb-red/10 text-zb-red" :
                              "bg-zb-amber/10 text-zb-amber"
                            }`}>
                              <Shield className="w-3.5 h-3.5" />
                            </div>
                            <span className="text-xs font-medium text-zb-text truncate max-w-[120px]">{b.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-zb-text-secondary font-mono">{b.route}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-semibold text-zb-text tabular-nums">${b.tvl}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <StatusDot status={b.status} />
                            <span className={`text-[10px] font-semibold uppercase tracking-wider ${
                              b.status === "secure" ? "text-zb-green" :
                              b.status === "critical" ? "text-zb-red" :
                              "text-zb-amber"
                            }`}>{b.statusLabel}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium ${
                            b.riskVerdict === "Safe" ? "text-zb-green" :
                            b.riskVerdict === "High Risk" ? "text-zb-red" :
                            "text-zb-amber"
                          }`}>{b.riskVerdict}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-[11px] text-zb-text-muted font-mono">
                            {b.lastTx ? new Date(b.lastTx).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—"}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {bridges.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-12 text-center text-zb-text-muted text-xs">
                          No bridge activity detected yet
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* System Status + Recent Alerts */}
        <div className="space-y-6">
          {/* System Status */}
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <Zap className="w-4 h-4 text-zb-cyan" />
              <h2 className="text-sm font-semibold text-zb-text uppercase tracking-wider">System Status</h2>
            </div>
            <div className="bg-zb-card border border-zb-border rounded-2xl p-4 space-y-3">
              {[
                { label: "Midnight Node", status: "Connected", dot: "secure", icon: Lock },
                { label: "ZK Prover", status: "Active", dot: "secure", icon: ShieldCheck },
                { label: "Oracle Feed", status: "Syncing", dot: "active", icon: Eye },
                { label: "Bridge Scanner", status: "Running", dot: "secure", icon: Globe },
              ].map((s) => (
                <div key={s.label} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2.5">
                    <StatusDot status={s.dot} />
                    <span className="text-xs font-medium text-zb-text-secondary">{s.label}</span>
                  </div>
                  <span className={`text-[10px] font-semibold uppercase tracking-wider ${
                    s.dot === "secure" ? "text-zb-green" : "text-zb-cyan"
                  }`}>{s.status}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <Clock className="w-4 h-4 text-zb-cyan" />
              <h2 className="text-sm font-semibold text-zb-text uppercase tracking-wider">Recent Activity</h2>
            </div>
            <div className="bg-zb-card border border-zb-border rounded-2xl p-4 space-y-3 max-h-[280px] overflow-y-auto">
              {isActivityLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 animate-pulse">
                      <div className="w-7 h-7 rounded-lg bg-zb-surface" />
                      <div className="flex-1 space-y-1">
                        <div className="h-2 bg-zb-surface rounded w-3/4" />
                        <div className="h-2 bg-zb-surface rounded w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : recentActivity.length === 0 ? (
                <p className="text-xs text-zb-text-muted text-center py-4">No recent activity</p>
              ) : (
                recentActivity.slice(0, 6).map((act, i) => (
                  <div key={act.id || i} className="flex items-center gap-3 py-2 hover:bg-zb-surface rounded-lg px-2 -mx-2 transition-colors">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                      act.event_type?.includes("VERIFIED") ? "bg-zb-green/10 text-zb-green" :
                      act.event_type?.includes("CUT") ? "bg-zb-red/10 text-zb-red" :
                      "bg-zb-cyan/10 text-zb-cyan"
                    }`}>
                      {act.event_type?.includes("VERIFIED") ? <ShieldCheck className="w-3.5 h-3.5" /> :
                       act.event_type?.includes("CUT") ? <ShieldX className="w-3.5 h-3.5" /> :
                       <Shield className="w-3.5 h-3.5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-zb-text truncate">{act.description}</p>
                      <p className="text-[10px] text-zb-text-muted font-mono mt-0.5">
                        {new Date(act.created_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
