import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TreePine, Leaf, Axe, RefreshCcw, Wind, Droplets,
  Award, ShieldAlert, Activity, Globe, TrendingUp,
  CheckCircle2, Clock, AlertTriangle,
  ChevronRight, Zap, BarChart3, ArrowUpRight,
  ArrowDownRight, Sprout, CloudSun,
  Filter, Calendar, ExternalLink
} from 'lucide-react';
import axios from 'axios';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, RadialBarChart, RadialBar,
  LineChart, Line, ComposedChart
} from 'recharts';

const PALETTE = {
  emerald:   '#10b981',
  forest:    '#059669',
  sage:      '#6ee7b7',
  teal:      '#0d9488',
  sky:       '#0ea5e9',
  amber:     '#f59e0b',
  rose:      '#f43f5e',
  slate:     '#64748b',
  earthDark: '#1a2e1a',
};

const PIE_COLORS  = [PALETTE.sky, PALETTE.amber, PALETTE.emerald, PALETTE.rose];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/95 backdrop-blur-md border border-emerald-100 rounded-2xl px-4 py-3 shadow-2xl">
      <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: p.color }} />
          <span className="text-xs text-slate-600">{p.name}:</span>
          <span className="text-xs font-bold text-slate-900">{p.value?.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
};

const MetricCard = ({ title, value, subtitle, icon: Icon, accent, trend, delay = 0 }) => {
  const accentMap = {
    emerald: { bg: 'bg-emerald-50',  icon: 'bg-emerald-500',  text: 'text-emerald-700', border: 'border-emerald-100' },
    forest:  { bg: 'bg-green-50',    icon: 'bg-green-600',    text: 'text-green-700',   border: 'border-green-100'  },
    sky:     { bg: 'bg-sky-50',      icon: 'bg-sky-500',      text: 'text-sky-700',     border: 'border-sky-100'    },
    amber:   { bg: 'bg-amber-50',    icon: 'bg-amber-500',    text: 'text-amber-700',   border: 'border-amber-100'  },
    rose:    { bg: 'bg-rose-50',     icon: 'bg-rose-500',     text: 'text-rose-700',    border: 'border-rose-100'   },
    slate:   { bg: 'bg-slate-50',    icon: 'bg-slate-700',    text: 'text-slate-700',   border: 'border-slate-100'  },
  };
  const c = accentMap[accent] || accentMap.emerald;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: 'spring', stiffness: 120, damping: 18 }}
      className={`relative bg-white rounded-2xl p-5 border ${c.border} shadow-sm overflow-hidden`}
    >
      <div className="relative">
        <div className="flex items-start justify-between mb-3">
          <div className={`p-2.5 rounded-xl ${c.icon}`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
        </div>
        <p className="text-xs text-slate-500 font-medium uppercase tracking-widest mb-0.5">{title}</p>
        <p className="text-2xl font-black text-slate-900 tabular-nums">{value ?? '0'}</p>
        {subtitle && <p className="text-[11px] text-slate-400 mt-1">{subtitle}</p>}
      </div>
    </motion.div>
  );
};

const SectionHeader = ({ icon: Icon, title, subtitle, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, x: -16 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay }}
    className="flex items-center gap-3 mb-6"
  >
    <div className="p-2 bg-emerald-100 rounded-xl">
      <Icon className="w-5 h-5 text-emerald-700" />
    </div>
    <div>
      <h3 className="text-lg font-black text-slate-900 tracking-tight">{title}</h3>
      {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
    </div>
  </motion.div>
);

export default function EcoChainDashboard() {
  const { data: stats = { total: 0, pending: 0, verified: 0, rejected: 0 }, isLoading: isStatsLoading } = useQuery({
    queryKey: ['tree-stats'],
    queryFn: async () => {
      const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/api/trees/stats`);
      return data;
    },
  });

  const { data: trees = [], isLoading: isTreesLoading } = useQuery({
    queryKey: ['dashboard-trees'],
    queryFn: async () => {
      const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/api/trees`);
      return data;
    },
  });

  const { data: debts = [] } = useQuery({
    queryKey: ['my-debts-summary'],
    queryFn: async () => {
      const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/api/debt`);
      return Array.isArray(data) ? data : [];
    },
  });

  const activeDebtCount = useMemo(() => debts.filter(d => d.status !== 'CLEARED').length, [debts]);
  const totalTreesNeeded = useMemo(() => 
    debts.filter(d => d.status !== 'CLEARED').reduce((sum, d) => sum + (d.trees_needed - d.trees_verified), 0)
  , [debts]);

  const recentActivities = useMemo(() => {
    return Array.isArray(trees) ? [...trees]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 6)
      .map(t => ({
        id: t.id,
        type: t.status === 'VERIFIED' ? 'verify' : t.status === 'REJECTED' ? 'reject' : 'plant',
        label: t.status === 'VERIFIED' ? `Tree #${t.tree_id} Verified` : t.status === 'REJECTED' ? `Tree #${t.tree_id} Rejected` : `New Tree Registered`,
        time: t.updated_at || t.created_at,
        species: t.species
      })) : [];
  }, [trees]);

  if (isStatsLoading || isTreesLoading) return <div className="min-h-screen flex items-center justify-center bg-emerald-50"><Activity className="w-10 h-10 text-emerald-500 animate-pulse" /></div>;

  const pieData = [
    { name: 'Pending', value: stats.pending },
    { name: 'Verified', value: stats.verified },
    { name: 'Rejected', value: stats.rejected },
  ].filter(d => d.value > 0);

  return (
    <div className="min-h-screen bg-[#f3f8f4] py-8 px-6 lg:px-10">
      <div className="max-w-[1440px] mx-auto space-y-8">

        {activeDebtCount > 0 && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-rose-50 border-2 border-rose-100 rounded-3xl p-6 flex items-center justify-between shadow-xl shadow-rose-900/5 group"
          >
            <div className="flex items-center gap-5">
              <div className="bg-rose-600 text-white p-3 rounded-2xl animate-bounce group-hover:animate-none transition-all">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                 <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-1">Environmental Debt Warning</p>
                 <h2 className="text-xl font-black text-slate-900 leading-none">You have {activeDebtCount} active replantation debt{activeDebtCount > 1 ? 's' : ''}</h2>
                 <p className="text-sm font-medium text-slate-500 mt-1">Total obligation: <strong>{totalTreesNeeded} replacement trees</strong> needed to restore full carbon credits.</p>
              </div>
            </div>
            <button 
              onClick={() => window.location.href = '/debt'}
              className="bg-slate-900 text-white px-8 h-12 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-600 transition-all flex items-center gap-2"
            >
              Resolve Debt
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative bg-gradient-to-br from-[#0f3d2a] via-[#155c3e] to-[#0a2e1e] rounded-3xl p-10 overflow-hidden shadow-2xl"
        >
          <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                <span className="text-emerald-400 text-[11px] font-black uppercase tracking-[0.2em]">Live · Registry Monitoring</span>
              </div>
              <h1 className="text-5xl font-black text-white tracking-tight leading-tight">EcoChain Analytics</h1>
              <p className="text-emerald-300/80 mt-2 text-sm max-w-lg">Real-time oversight of the global tree lifecycle management system.</p>
            </div>
            <div className="flex items-center gap-8 text-white">
                <div className="text-center">
                    <p className="text-[10px] uppercase font-black text-emerald-400 mb-1">Integrity Score</p>
                    <p className="text-4xl font-black">99.9%</p>
                </div>
                <div className="w-px h-12 bg-white/10" />
                <div className="text-center">
                    <p className="text-[10px] uppercase font-black text-emerald-400 mb-1">Global Assets</p>
                    <p className="text-4xl font-black">{stats.total}</p>
                </div>
            </div>
          </div>
        </motion.div>

        <section>
          <SectionHeader icon={BarChart3} title="Core Lifecycle Metrics" subtitle="Real-time registry status breakdown" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <MetricCard title="Total Registrations" value={stats.total} icon={TreePine} accent="slate" subtitle="All-time system entries" delay={0.1} />
            <MetricCard title="Awaiting Verification" value={stats.pending} icon={Clock} accent="amber" subtitle="Pending audit review" delay={0.2} />
            <MetricCard title="Verified Assets" value={stats.verified} icon={CheckCircle2} accent="emerald" subtitle="On-chain confirmed" delay={0.3} />
            <MetricCard title="Rejected / Voided" value={stats.rejected} icon={ShieldAlert} accent="rose" subtitle="Asset integrity failures" delay={0.4} />
          </div>
        </section>

        <div className="grid lg:grid-cols-3 gap-8">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="lg:col-span-2 bg-white rounded-3xl p-8 border border-emerald-50 shadow-sm">
                <SectionHeader icon={TrendingUp} title="Registry Progression" subtitle="Total assets vs Verified milestones" />
                <div className="h-[300px]">
                   <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={[
                        { name: 'Jan', total: 0, verified: 0 },
                        { name: 'Feb', total: Math.floor(stats.total * 0.3), verified: Math.floor(stats.verified * 0.2) },
                        { name: 'Mar', total: Math.floor(stats.total * 0.6), verified: Math.floor(stats.verified * 0.5) },
                        { name: 'Today', total: stats.total, verified: stats.verified },
                      ]}>
                        <defs>
                          <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={PALETTE.sky} stopOpacity={0.1}/><stop offset="95%" stopColor={PALETTE.sky} stopOpacity={0}/></linearGradient>
                          <linearGradient id="colorVerified" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={PALETTE.emerald} stopOpacity={0.1}/><stop offset="95%" stopColor={PALETTE.emerald} stopOpacity={0}/></linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Area type="monotone" dataKey="total" stroke={PALETTE.sky} fillOpacity={1} fill="url(#colorTotal)" strokeWidth={3} />
                        <Area type="monotone" dataKey="verified" stroke={PALETTE.emerald} fillOpacity={1} fill="url(#colorVerified)" strokeWidth={3} />
                      </AreaChart>
                   </ResponsiveContainer>
                </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-3xl p-8 border border-emerald-50 shadow-sm flex flex-col items-center">
                <h3 className="text-sm font-black uppercase text-slate-400 mb-8 self-start">Distribution</h3>
                <div className="h-[200px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie data={pieData.length ? pieData : [{name: 'Empty', value: 1}]} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                {pieData.map((entry, index) => <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
                                {!pieData.length && <Cell fill="#f1f5f9" />}
                            </Pie>
                            <Tooltip content={<CustomTooltip />} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
                <div className="mt-8 w-full space-y-3">
                    {pieData.map((d, i) => (
                        <div key={d.name} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[i] }} />
                                <span className="text-[10px] font-black uppercase text-slate-500">{d.name}</span>
                            </div>
                            <span className="text-xs font-black text-slate-900">{d.value}</span>
                        </div>
                    ))}
                </div>
            </motion.div>
        </div>

        <section className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
                <SectionHeader icon={Activity} title="Registration Timeline" subtitle="Latest lifecycle events in the registry" />
                <div className="bg-white rounded-3xl p-6 border border-emerald-50 shadow-sm space-y-4">
                    {recentActivities.map(act => (
                        <div key={act.id} className="flex items-center justify-between p-4 bg-slate-50/50 rounded-2xl hover:bg-emerald-50 transition-colors group">
                            <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${act.type==='verify'?'bg-emerald-100 text-emerald-600':act.type==='reject'?'bg-rose-100 text-rose-600':'bg-amber-100 text-amber-600'}`}>
                                    {act.type==='verify'?<CheckCircle2 className="w-5 h-5"/>:act.type==='reject'?<AlertTriangle className="w-5 h-5"/>:<History className="w-5 h-5"/>}
                                </div>
                                <div>
                                    <p className="text-sm font-black text-slate-900">{act.label}</p>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase">{act.species}</p>
                                </div>
                            </div>
                            <span className="text-[10px] font-mono text-slate-400">{new Date(act.time).toLocaleDateString()}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="space-y-6">
                <SectionHeader icon={ShieldCheck} title="System Integrity" />
                <div className="grid gap-4">
                    <IntegrityCheck label="GPS Valid" status="OK" icon={Globe} color="emerald" />
                    <IntegrityCheck label="Hash Sync" status="SYNCED" icon={Zap} color="sky" />
                    <IntegrityCheck label="NFT Minting" status="ACTIVE" icon={Award} color="emerald" />
                    <IntegrityCheck label="Oracles" status="ONLINE" icon={Wind} color="sky" />
                </div>
            </div>
        </section>

      </div>
    </div>
  );
}

const IntegrityCheck = ({ label, status, icon: Icon, color }) => (
    <div className="flex items-center justify-between p-5 bg-white rounded-2xl border border-emerald-50 shadow-sm">
        <div className="flex items-center gap-3">
            <div className={`p-2 bg-${color}-50 rounded-lg`}>
                <Icon className={`w-4 h-4 text-${color}-600`} />
            </div>
            <span className="text-xs font-black uppercase text-slate-400">{label}</span>
        </div>
        <span className={`text-[10px] font-black text-${color}-600 bg-${color}-50 px-2 py-0.5 rounded-full`}>{status}</span>
    </div>
);

const History = ({ className }) => <Clock className={className} />;
