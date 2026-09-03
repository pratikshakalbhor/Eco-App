import React, { useMemo } from "react";
import API_URL from "../utils/config.js";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import {
  ShieldAlert, ShieldCheck, ShieldX, AlertTriangle, Clock,
  Globe, Flag
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { SkeletonTable } from "@/components/zb/Skeleton";

const getRiskColor = (risk) => {
  if (!risk) return "default";
  const r = risk.toLowerCase();
  if (r.includes("high") || r.includes("critical") || r.includes("danger")) return "red";
  if (r.includes("medium") || r.includes("moderate") || r.includes("warning")) return "amber";
  if (r.includes("low") || r.includes("safe") || r.includes("secure")) return "green";
  return "default";
};

export default function Security() {
  const { data: trees = [], isLoading } = useQuery({
    queryKey: ["zb-security-trees"],
    queryFn: async () => {
      const { data } = await axios.get(`${API_URL}/api/trees`);
      return data;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["zb-security-stats"],
    queryFn: async () => {
      const { data } = await axios.get(`${API_URL}/api/trees/stats`);
      return data;
    },
  });

  const alerts = useMemo(() => {
    if (!Array.isArray(trees)) return [];
    return trees
      .filter((t) => t.status === "REJECTED" || t.status === "PENDING")
      .slice(0, 20)
      .map((t, i) => ({
        id: t.id || i,
        bridge: t.species || `Bridge #${t.tree_id}`,
        status: t.status,
        riskLevel: t.status === "REJECTED" ? "HIGH" : "MODERATE",
        reason: t.status === "REJECTED"
          ? "Bridge contract verification failed — suspicious activity detected"
          : "Bridge verification pending — awaiting on-chain confirmation",
        timestamp: t.updated_at || t.created_at,
        treeId: t.tree_id,
      }));
  }, [trees]);

  const flaggedBridges = useMemo(() => {
    if (!Array.isArray(trees)) return [];
    return trees
      .filter((t) => t.status === "REJECTED")
      .map((t) => ({
        id: t.id,
        name: t.species || `Bridge #${t.tree_id}`,
        flagReason: "Smart contract vulnerability detected",
        flagTime: t.updated_at || t.created_at,
        treeId: t.tree_id,
      }));
  }, [trees]);

  const allVerified = useMemo(() => {
    if (!Array.isArray(trees)) return [];
    return trees.filter((t) => t.status === "VERIFIED").length;
  }, [trees]);

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-zb-text mb-1">Security Center</h1>
        <p className="text-sm text-zb-text-secondary">
          Real-time bridge security monitoring, threat detection, and risk assessment.
        </p>
      </div>

      {/* Summary Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Monitored", value: stats?.total || 0, icon: Globe, color: "text-zb-cyan" },
          { label: "Verified Secure", value: allVerified, icon: ShieldCheck, color: "text-zb-green" },
          { label: "Active Alerts", value: alerts.length, icon: AlertTriangle, color: alerts.length > 0 ? "text-zb-red" : "text-zb-green" },
          { label: "Flagged Bridges", value: flaggedBridges.length, icon: Flag, color: flaggedBridges.length > 0 ? "text-zb-amber" : "text-zb-green" },
        ].map((m) => (
          <div key={m.label} className="bg-zb-card border border-zb-border rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <m.icon className={`w-4 h-4 ${m.color}`} />
              <span className="text-[10px] font-semibold text-zb-text-muted uppercase tracking-widest">{m.label}</span>
            </div>
            <p className="text-2xl font-bold text-zb-text tabular-nums">{m.value}</p>
          </div>
        ))}
      </div>

      {/* Active Security Alerts */}
      <div>
        <div className="flex items-center gap-2.5 mb-4">
          <ShieldAlert className="w-4 h-4 text-zb-red" />
          <h2 className="text-sm font-semibold text-zb-text uppercase tracking-wider">Active Security Alerts</h2>
          {alerts.length > 0 && (
            <span className="px-2 py-0.5 bg-zb-red/10 text-zb-red text-[10px] font-bold rounded-full">{alerts.length}</span>
          )}
        </div>

        {isLoading ? (
          <SkeletonTable rows={4} cols={5} />
        ) : alerts.length === 0 ? (
          <div className="bg-zb-card border border-zb-border rounded-2xl p-12 text-center">
            <ShieldCheck className="w-12 h-12 text-zb-green mx-auto mb-3 opacity-50" />
            <h3 className="text-sm font-semibold text-zb-text mb-1">All Clear</h3>
            <p className="text-xs text-zb-text-muted">No active security alerts detected across monitored bridges.</p>
          </div>
        ) : (
          <div className="bg-zb-card border border-zb-border rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zb-border">
                    {["Bridge", "Risk Level", "Detection Reason", "Timestamp", "Status"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-[10px] font-semibold text-zb-text-muted uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zb-border">
                  {alerts.map((alert) => (
                    <tr key={alert.id} className="hover:bg-zb-card-hover transition-colors">
                      <td className="px-4 py-3">
                        <span className="text-xs font-medium text-zb-text">{alert.bridge}</span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={getRiskColor(alert.riskLevel)}>
                          {alert.riskLevel}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-zb-text-secondary max-w-[240px] block truncate">{alert.reason}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[11px] text-zb-text-muted font-mono">
                          {alert.timestamp ? new Date(alert.timestamp).toLocaleString(undefined, {
                            month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
                          }) : "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={alert.status === "REJECTED" ? "red" : "amber"}>
                          {alert.status === "REJECTED" ? "Flagged" : "Pending Review"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Flagged Bridges */}
      <div>
        <div className="flex items-center gap-2.5 mb-4">
          <Flag className="w-4 h-4 text-zb-amber" />
          <h2 className="text-sm font-semibold text-zb-text uppercase tracking-wider">Flagged Bridges</h2>
        </div>

        {flaggedBridges.length === 0 ? (
          <div className="bg-zb-card border border-zb-border rounded-2xl p-8 text-center">
            <Flag className="w-10 h-10 text-zb-text-muted mx-auto mb-2 opacity-30" />
            <p className="text-xs text-zb-text-muted">No bridges currently flagged.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {flaggedBridges.map((b) => (
              <div key={b.id} className="bg-zb-card border border-zb-red/20 rounded-2xl p-5 hover:border-zb-red/40 transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-zb-red/10 flex items-center justify-center">
                      <ShieldX className="w-4 h-4 text-zb-red" />
                    </div>
                    <span className="text-sm font-medium text-zb-text">{b.name}</span>
                  </div>
                  <Badge variant="red">Flagged</Badge>
                </div>
                <p className="text-xs text-zb-text-secondary mb-3">{b.flagReason}</p>
                <div className="flex items-center gap-1 text-[10px] text-zb-text-muted">
                  <Clock className="w-3 h-3" />
                  {b.flagTime ? new Date(b.flagTime).toLocaleString(undefined, {
                    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
                  }) : "—"}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
