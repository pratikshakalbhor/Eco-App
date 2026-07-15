import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { 
  Leaf, Award, ArrowUpRight, ArrowDownRight, History, AlertCircle, 
  TrendingUp, TrendingDown, ShieldAlert, RefreshCcw,
  Wind, Zap, AlertTriangle, TreePine, Scale, BookOpen,
  Clock, CheckCircle2, XCircle, Sprout, ChevronRight,
  BarChart3, Globe, CloudSun, Droplets, FileText,
  Calculator, Activity, Ban
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { getEcoTokenBalance, getCarbonCreditBalance, isSepoliaNetwork, switchToSepolia } from '../utils/web3Service';
import { useAuth } from '../hooks/useAuth';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, ComposedChart, Line,
  RadialBarChart, RadialBar
} from 'recharts';

// ── Palette ──────────────────────────────────────────────────────────────────
const P = {
  emerald: '#10b981', forest: '#059669', teal: '#0d9488',
  sky: '#0ea5e9', amber: '#f59e0b', rose: '#f43f5e', slate: '#64748b',
};

// ── Custom Tooltip ───────────────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/95 backdrop-blur-md border border-emerald-100 rounded-2xl px-4 py-3 shadow-2xl">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-[10px] text-slate-500">{p.name}:</span>
          <span className="text-[10px] font-black text-slate-900">{typeof p.value === 'number' ? p.value.toFixed(2) : p.value}</span>
        </div>
      ))}
    </div>
  );
};

// ── Monthly Impact Data (enriched from API later) ────────────────────────────
const BASE_MONTHLY = [
  { month: 'Jan', earned: 2.1, lost: 0.3, co2: 420,  o2: 308  },
  { month: 'Feb', earned: 3.5, lost: 0.1, co2: 580,  o2: 424  },
  { month: 'Mar', earned: 4.2, lost: 0.8, co2: 740,  o2: 541  },
  { month: 'Apr', earned: 5.8, lost: 0.5, co2: 920,  o2: 673  },
  { month: 'May', earned: 7.1, lost: 0.2, co2: 1100, o2: 805  },
  { month: 'Jun', earned: 8.6, lost: 0.4, co2: 1380, o2: 1009 },
];

export default function CarbonAccountability() {
  const { user } = useAuth();
  const [onSepolia, setOnSepolia] = useState(true);
  const [balances, setBalances] = useState({ eco: '0.00', carbon: '0.00' });
  const [ledgerFilter, setLedgerFilter] = useState('all');

  // ── API Data — aggregated user carbon stats ─────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ['carbon-credits'],
    queryFn: async () => {
      const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/api/credits`);
      return data;
    },
    staleTime: 60_000,
  });

  // ── Credit History from ledger ──────────────────────────────────────────
  const { data: ledgerHistory = [] } = useQuery({
    queryKey: ['credit-history'],
    queryFn: async () => {
      const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/api/credits/history`);
      return data;
    },
    staleTime: 60_000,
  });

  // ── On-Chain Balances ──────────────────────────────────────────────────────
  useEffect(() => {
    const fetchBalances = async () => {
      if (!user?.wallet_address) return;
      const isSep = await isSepoliaNetwork();
      setOnSepolia(isSep);
      if (isSep) {
        try {
          const [eco, carbon] = await Promise.all([
            getEcoTokenBalance(user.wallet_address),
            getCarbonCreditBalance(user.wallet_address)
          ]);
          setBalances({ eco, carbon });
        } catch (err) { console.error(err); }
      }
    };
    fetchBalances();
    const interval = setInterval(fetchBalances, 15000);
    return () => clearInterval(interval);
  }, [user?.wallet_address]);

  // ── Destructure API Data ───────────────────────────────────────────────────
  const { 
    credits_earned = 0, credits_lost = 0,
    environmental_debt = 0, compensation_required = false,
    active_trees = 0, cut_trees = 0, replacement_trees = 0,
    co2_stats = {}, oxygen_stats = {},
    sustainability_score = 0, carbon_balance = 0,
  } = data || {};

  // Use ledgerHistory from dedicated /api/credits/history endpoint
  const history = ledgerHistory;

  const netBalance = (credits_earned - credits_lost).toFixed(2);
  const totalCO2 = (co2_stats.total_absorbed || 0).toFixed(2);
  const totalO2 = (oxygen_stats.total_generated || 0).toFixed(2);
  const compensationPending = compensation_required;
  const replacementRequired = Math.max(0, (cut_trees * 3) - replacement_trees);

  // ── Filtered History ───────────────────────────────────────────────────────
  const filteredHistory = useMemo(() => {
    if (ledgerFilter === 'all') return history;
    return history.filter(h => h.type === ledgerFilter);
  }, [history, ledgerFilter]);

  // ── Impact Chart Data ──────────────────────────────────────────────────────
  const chartData = useMemo(() => {
    const scale = credits_earned > 0 ? credits_earned / 8.6 : 1;
    return BASE_MONTHLY.map(m => ({
      ...m,
      earned: +(m.earned * scale).toFixed(2),
      lost: +(m.lost * (credits_lost > 0 ? credits_lost / 2.3 : 1)).toFixed(2),
      co2: Math.round(m.co2 * (active_trees > 0 ? active_trees / 10 : 1)),
      o2: Math.round(m.o2 * (active_trees > 0 ? active_trees / 10 : 1)),
    }));
  }, [credits_earned, credits_lost, active_trees]);

  // ── Score Radial ───────────────────────────────────────────────────────────
  const scoreData = [{ name: 'Score', value: Math.min(sustainability_score, 100), fill: P.emerald }];

  // ── Pie Distribution ───────────────────────────────────────────────────────
  const allocData = [
    { name: 'Credits Earned', value: credits_earned        || 0 },
    { name: 'Credits Lost',   value: Math.abs(credits_lost) || 0 },
    { name: 'Env. Debt',      value: environmental_debt     || 0 },
  ].filter(d => d.value > 0);
  const PIE_COLORS = [P.emerald, P.rose, P.amber];

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F3F8F5]">
        <div className="flex flex-col items-center gap-4">
          <RefreshCcw className="w-12 h-12 text-emerald-500 animate-spin" />
          <p className="text-slate-400 font-black uppercase tracking-[0.2em] text-[10px]">Reconciling Carbon Ledger...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F3F8F5] py-10 px-6 lg:px-10">
      <div className="max-w-[1440px] mx-auto space-y-10">

        {/* ═══════════════════════ HEADER BANNER ═══════════════════════ */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative bg-gradient-to-br from-[#0a2e1e] via-[#134e33] to-[#0f3d2a] rounded-[3rem] p-10 overflow-hidden shadow-2xl"
        >
          <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-400/10 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl" />
          <div className="absolute bottom-0 left-1/4 w-64 h-64 bg-teal-400/10 rounded-full translate-y-1/2 blur-2xl" />

          <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                <span className="text-emerald-400 text-[10px] font-black uppercase tracking-[0.25em]">
                  Live · Environmental Carbon Accounting
                </span>
              </div>
              <h1 className="text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
                Carbon Accountability
              </h1>
              <p className="text-emerald-300/70 mt-2 text-sm max-w-xl">
                Full-spectrum environmental impact ledger tracking carbon sequestration, credit issuance, environmental debt, and remediation obligations.
              </p>
            </div>

            {/* Sustainability Score Ring */}
            <div className="flex items-center gap-8">
              <div className="text-center">
                <div className="relative w-28 h-28">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadialBarChart innerRadius={38} outerRadius={52} data={scoreData} startAngle={90} endAngle={-270}>
                      <RadialBar dataKey="value" cornerRadius={10} fill={P.emerald} background={{ fill: '#1a4a30' }} />
                    </RadialBarChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-xl font-black text-white">{Number(sustainability_score).toFixed(0)}</span>
                    <span className="text-[8px] text-emerald-400 font-black uppercase">Score</span>
                  </div>
                </div>
                <p className="text-[10px] text-emerald-300 font-bold mt-1">Sustainability Index</p>
              </div>

              <div className="hidden md:grid grid-cols-2 gap-3">
                <HeaderQuickStat label="Net Balance" value={`${netBalance}t`} color="text-emerald-300" />
                <HeaderQuickStat label="Env. Debt" value={`${environmental_debt.toFixed(2)}t`} color="text-rose-300" />
                <HeaderQuickStat label="Active Trees" value={active_trees} color="text-teal-300" />
                <HeaderQuickStat label="Replacements" value={`${replacementRequired} due`} color="text-amber-300" />
              </div>
            </div>
          </div>
        </motion.div>

        {/* ═══════════════ NETWORK WARNING ═══════════════ */}
        {!onSepolia && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-5 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between"
          >
            <div className="flex items-center gap-3 text-amber-800">
              <AlertTriangle className="w-5 h-5" />
              <div>
                <p className="font-black text-sm">Wrong Network Detected</p>
                <p className="text-xs opacity-80">Switch to Sepolia Testnet for live on-chain balances.</p>
              </div>
            </div>
            <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white font-black rounded-xl" onClick={() => switchToSepolia()}>
              Switch Network
            </Button>
          </motion.div>
        )}

        {/* ═══════════════ PRIMARY KPI GRID (8 Metrics) ═══════════════ */}
        <section>
          <SectionLabel icon={BarChart3} title="Carbon KPI Metrics" subtitle="Core environmental accounting indicators" />
          <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-4 gap-4">
            <KPICard title="Credits Earned" value={credits_earned.toFixed(2)} unit="tCO₂e" icon={Award}   accent="emerald" trend={5.2}  subtitle="Verified sequestration credits" delay={0.05} />
            <KPICard title="Credits Lost"   value={credits_lost.toFixed(2)}   unit="tCO₂e" icon={XCircle} accent="rose"    trend={-1.8} subtitle="Deducted from removals"        delay={0.10} />
            <KPICard title="Net Carbon Balance" value={netBalance} unit="tCO₂e" icon={Scale} accent="teal" subtitle="Earned minus lost"            delay={0.15} />
            <KPICard title="Environmental Debt"  value={environmental_debt.toFixed(2)} unit="tCO₂e" icon={ShieldAlert} accent="rose" subtitle="Uncompensated loss liability" delay={0.20} alert={compensationPending} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-4 gap-4 mt-4">
            <KPICard title="CO₂ Absorbed"   value={totalCO2} unit="kg" icon={CloudSun} accent="emerald" trend={6.1}  subtitle="Total sequestration estimate" delay={0.25} />
            <KPICard title="O₂ Generated"   value={totalO2}  unit="kg" icon={Wind}     accent="sky"     trend={5.9}  subtitle="Annual oxygen output"        delay={0.30} />
            <KPICard title="Compensation Status" value={compensationPending ? 'PENDING' : 'CLEAR'} unit="" icon={Clock} accent={compensationPending ? 'amber' : 'emerald'} subtitle={compensationPending ? 'Action required' : 'No obligations'} delay={0.35} />
            <KPICard title="Replacement Trees" value={`${replacementRequired}`} unit="required" icon={Sprout} accent={replacementRequired > 0 ? 'amber' : 'emerald'} subtitle={`${replacement_trees} planted / ${cut_trees * 3} goal`} delay={0.40} />
          </div>
        </section>

        {/* ═══════════════ IMPACT CHART + PIE ═══════════════ */}
        <section>
          <SectionLabel icon={Globe} title="Environmental Impact Overview" subtitle="Carbon credit accumulation and environmental debt trends" />
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Area Chart */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="lg:col-span-2 bg-white rounded-[2.5rem] p-8 shadow-sm border border-emerald-50"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-sm font-black text-slate-800">Carbon Credit Flow</h3>
                  <p className="text-[10px] text-slate-400">Monthly earned vs lost (tCO₂e)</p>
                </div>
                <div className="flex gap-4">
                  <LegendDot color="bg-emerald-500" label="Earned" />
                  <LegendDot color="bg-rose-500" label="Lost" />
                  <LegendDot color="bg-sky-500" label="CO₂ Seq." />
                </div>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={chartData} margin={{ left: -20, right: 10 }}>
                  <defs>
                    <linearGradient id="gradEarned" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={P.emerald} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={P.emerald} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0faf4" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="earned" name="Credits Earned" stroke={P.emerald} fill="url(#gradEarned)" strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="lost" name="Credits Lost" stroke={P.rose} strokeWidth={2} strokeDasharray="5 4" dot={false} />
                  <Bar dataKey="co2" name="CO₂ (kg)" fill={P.sky} opacity={0.15} radius={[4,4,0,0]} />
                </ComposedChart>
              </ResponsiveContainer>
            </motion.div>

            {/* Carbon Allocation Pie */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-emerald-50 flex flex-col"
            >
              <h3 className="text-sm font-black text-slate-800 mb-1">Carbon Allocation</h3>
              <p className="text-[10px] text-slate-400 mb-4">Distribution of carbon accounting</p>

              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={allocData.length ? allocData : [{ name: 'No Data', value: 1 }]}
                    cx="50%" cy="50%"
                    innerRadius={52} outerRadius={75}
                    paddingAngle={allocData.length > 1 ? 6 : 0}
                    dataKey="value"
                  >
                    {(allocData.length ? allocData : [{ name: 'No Data', value: 1 }]).map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} cornerRadius={6} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>

              <div className="mt-auto pt-4 space-y-2.5">
                {(allocData.length ? allocData : [{ name: 'No Data', value: 0 }]).map((item, i) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-[10px] text-slate-500 font-bold">{item.name}</span>
                    </div>
                    <span className="text-[10px] font-black text-slate-800">{item.value.toFixed(2)} t</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        {/* ═══════════════ CARBON BALANCE SUMMARY ═══════════════ */}
        <section>
          <SectionLabel icon={Scale} title="Carbon Balance Summary" subtitle="Real-time reconciliation of environmental assets and liabilities" />
          <div className="grid lg:grid-cols-3 gap-6">
            
            {/* Balance Sheet */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="lg:col-span-2 bg-white rounded-[2.5rem] p-8 shadow-sm border border-emerald-50"
            >
              <div className="grid md:grid-cols-3 gap-6 mb-8">
                <BalanceBlock label="Total Assets" sublabel="Verified Active Trees" value={active_trees} color="emerald" icon={TreePine} />
                <BalanceBlock label="Total Liabilities" sublabel="Uncompensated Removals" value={cut_trees} color="rose" icon={Ban} />
                <BalanceBlock label="Remediation" sublabel="Replacement Trees Planted" value={replacement_trees} color="sky" icon={Sprout} />
              </div>

              {/* Balance Bar */}
              <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Carbon Net Position</span>
                  <span className={`text-sm font-black ${parseFloat(netBalance) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {parseFloat(netBalance) >= 0 ? '+' : ''}{netBalance} tCO₂e
                  </span>
                </div>
                <div className="relative h-4 bg-slate-200 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(Math.max((credits_earned / (credits_earned + Math.abs(credits_lost) + environmental_debt || 1)) * 100, 5), 100)}%` }}
                    transition={{ duration: 1.5, ease: 'easeOut' }}
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"
                  />
                </div>
                <div className="flex justify-between mt-2 text-[9px] font-black text-slate-400 uppercase">
                  <span>Deficit</span>
                  <span>Surplus</span>
                </div>
              </div>
            </motion.div>

            {/* Ecosystem Services */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-[#0a2e1e] rounded-[2.5rem] p-8 text-white relative overflow-hidden"
            >
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl" />
              <div className="relative z-10">
                <div className="flex items-center gap-2 text-emerald-400 mb-4">
                  <Zap className="w-4 h-4" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em]">Biosphere Services</span>
                </div>
                <h3 className="text-lg font-black mb-6">Ecosystem Impact</h3>

                <div className="space-y-4">
                  <EcoServiceCard label="CO₂ Sequestered" value={totalCO2} unit="kg" color="text-emerald-400" />
                  <EcoServiceCard label="Oxygen Produced" value={totalO2} unit="kg" color="text-sky-400" />
                  <EcoServiceCard label="Biomass Index" value="1.42" unit="idx" color="text-teal-400" />
                </div>

                <div className="mt-8 pt-6 border-t border-white/10">
                  <p className="text-[10px] text-white/40 leading-relaxed italic">
                    All environmental impact data is derived from verified tree registrations, satellite cross-validation, and on-chain audit trails.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ═══════════════ CARBON LEDGER (History) ═══════════════ */}
        <section>
          <SectionLabel icon={BookOpen} title="Carbon Ledger" subtitle="Full immutable accounting history of carbon transactions" />
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-[2.5rem] shadow-sm overflow-hidden border border-emerald-50"
          >
            {/* Ledger Header */}
            <div className="p-8 border-b border-slate-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-black text-slate-900 text-lg">Transaction History</h3>
                <p className="text-slate-400 text-xs">{history.length} entries recorded on environmental ledger</p>
              </div>
              <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl">
                {['all', 'earned', 'penalty', 'compensation'].map(f => (
                  <button
                    key={f}
                    onClick={() => setLedgerFilter(f)}
                    className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${ledgerFilter === f ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="py-6 pl-10 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Type</TableHead>
                    <TableHead className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Asset Reference</TableHead>
                    <TableHead className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Carbon Impact</TableHead>
                    <TableHead className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Timestamp</TableHead>
                    <TableHead className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] text-right pr-10">Verification</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredHistory.map((entry, i) => {
                    const typeConfig = {
                      earned:       { dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 border-emerald-100', icon: ArrowUpRight },
                      penalty:      { dot: 'bg-rose-500',    badge: 'bg-rose-50 text-rose-700 border-rose-100',         icon: ArrowDownRight },
                      compensation: { dot: 'bg-sky-500',     badge: 'bg-sky-50 text-sky-700 border-sky-100',           icon: RefreshCcw },
                    };
                    const cfg = typeConfig[entry.type] || typeConfig.earned;
                    const TypeIcon = cfg.icon;

                    return (
                      <motion.tr
                        key={entry.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="group hover:bg-emerald-50/30 transition-all border-b border-slate-50 last:border-0"
                      >
                        <TableCell className="py-5 pl-10">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg ${cfg.badge} border flex items-center justify-center`}>
                              <TypeIcon className="w-4 h-4" />
                            </div>
                            <span className="text-xs font-black text-slate-700 capitalize">{entry.type}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-[10px] font-mono font-bold text-slate-400">#{entry.tree_id?.slice(0, 10)}</span>
                        </TableCell>
                        <TableCell>
                          <span className={`text-sm font-black ${entry.amount > 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                            {entry.amount > 0 ? '+' : ''}{entry.amount.toFixed(4)} <span className="text-[9px] text-slate-400">tCO₂e</span>
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-[10px] text-slate-500 font-bold">
                            {new Date(entry.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                          </span>
                        </TableCell>
                        <TableCell className="text-right pr-10">
                          <a
                            href={`https://sepolia.etherscan.io/tx/${entry.transaction_hash}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 text-slate-600 hover:bg-emerald-100 hover:text-emerald-700 rounded-lg text-[10px] font-black transition-colors uppercase tracking-wider"
                          >
                            <ArrowUpRight className="w-3 h-3" />
                            On-Chain
                          </a>
                        </TableCell>
                      </motion.tr>
                    );
                  })}

                  {filteredHistory.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-28">
                        <div className="flex flex-col items-center gap-4 opacity-25">
                          <BookOpen className="w-16 h-16" />
                          <p className="font-black uppercase tracking-widest text-xs">No ledger entries found</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </motion.div>
        </section>

        {/* ═══════════════ CARBON HISTORY TIMELINE ═══════════════ */}
        <section>
          <SectionLabel icon={History} title="Carbon History Timeline" subtitle="Chronological accounting events and milestones" />
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-[2.5rem] p-10 shadow-sm border border-emerald-50"
          >
            {history.length === 0 ? (
              <div className="text-center py-16 opacity-30">
                <History className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                <p className="text-sm font-black text-slate-600 uppercase">Timeline will populate as carbon events are recorded</p>
              </div>
            ) : (
              <div className="relative">
                <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-emerald-100" />
                <div className="space-y-8">
                  {history.slice(0, 10).map((entry, i) => {
                    const isPositive = entry.amount > 0;
                    return (
                      <motion.div
                        key={entry.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.06 }}
                        className="flex items-start gap-6 pl-0"
                      >
                        <div className={`relative z-10 shrink-0 w-12 h-12 rounded-full ${isPositive ? 'bg-emerald-50' : 'bg-rose-50'} flex items-center justify-center shadow-sm`}>
                          {isPositive ? <ArrowUpRight className="w-5 h-5 text-emerald-600" /> : <ArrowDownRight className="w-5 h-5 text-rose-600" />}
                        </div>
                        <div className="flex-1 bg-slate-50/70 rounded-2xl px-6 py-4">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`text-[10px] font-black uppercase tracking-widest ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                                  {entry.type === 'earned' ? 'Credit Earned' : entry.type === 'penalty' ? 'Carbon Penalty' : 'Compensation'}
                                </span>
                                <Badge variant="outline" className="text-[8px] py-0">{entry.type}</Badge>
                              </div>
                              <p className="text-sm font-bold text-slate-800">
                                {isPositive ? '+' : ''}{entry.amount.toFixed(4)} tCO₂e
                                <span className="text-slate-400 font-normal"> · Tree #{entry.tree_id?.slice(0, 8)}</span>
                              </p>
                            </div>
                            <span className="text-[10px] text-slate-400 shrink-0 font-bold">{new Date(entry.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>
        </section>

        {/* ═══════════════ CARBON BURN / REDEMPTION ═══════════════ */}
        <CarbonBurnSection />

      </div>
    </div>
  );
}

// ── Carbon Burn Section ────────────────────────────────────────────────────────
function CarbonBurnSection() {
  const [amount, setAmount] = React.useState('');
  const [purpose, setPurpose] = React.useState('');
  const [txHash, setTxHash] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState(null);
  const [error, setError] = React.useState('');
  const queryClient = window.__queryClient; // fallback; normally use useQueryClient

  const handleBurn = async () => {
    if (!amount || parseFloat(amount) <= 0) { setError('Enter a valid amount'); return; }
    setLoading(true); setError(''); setResult(null);
    try {
      const { default: axios } = await import('axios');
      const { data } = await axios.post(`${import.meta.env.VITE_API_URL}/api/credits/burn`, {
        amount: parseFloat(amount),
        purpose: purpose || 'Carbon Offset',
        tx_hash: txHash,
      });
      setResult(data);
      setAmount(''); setPurpose(''); setTxHash('');
    } catch (err) {
      setError(err?.response?.data?.error || 'Burn failed. Check your available balance.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section>
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-orange-100 rounded-xl">
          <span className="text-orange-600 text-base font-black">🔥</span>
        </div>
        <div>
          <h2 className="text-lg font-black text-slate-900 tracking-tight">Carbon Credit Burn & Redemption</h2>
          <p className="text-[10px] text-slate-400 font-bold">Burn credits to permanently offset CO₂ — generates an on-chain proof of offset</p>
        </div>
      </div>
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-[2.5rem] p-10 shadow-sm border border-orange-50"
      >
        <div className="grid lg:grid-cols-2 gap-10">
          <div className="space-y-5">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Credits to Burn (tCO₂e)</p>
              <input
                type="number" min="0.001" step="0.001"
                placeholder="0.000"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="w-full h-14 px-6 bg-orange-50 border-2 border-orange-100 rounded-2xl text-2xl font-black text-slate-900 focus:outline-none focus:border-orange-400 transition-all"
              />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Offset Purpose</p>
              <input
                type="text"
                placeholder="e.g. Manufacturing offset, Event carbon neutral..."
                value={purpose}
                onChange={e => setPurpose(e.target.value)}
                className="w-full h-12 px-6 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-200 transition-all"
              />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">On-chain Transaction Hash (optional)</p>
              <input
                type="text"
                placeholder="0x... (from EcoToken.burn() on Sepolia)"
                value={txHash}
                onChange={e => setTxHash(e.target.value)}
                className="w-full h-12 px-5 bg-slate-50 border border-slate-100 rounded-2xl text-[11px] font-mono text-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-200 transition-all"
              />
            </div>
            {error && (
              <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-sm font-bold text-rose-700">{error}</div>
            )}
            <button
              onClick={handleBurn}
              disabled={loading || !amount}
              className="w-full h-14 bg-orange-600 hover:bg-orange-700 disabled:opacity-40 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-orange-200 transition-all"
            >
              {loading ? 'Processing Burn...' : `Burn ${amount || '0'} Credits for CO₂ Offset`}
            </button>
          </div>

          <div className="space-y-5">
            {result ? (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                className="bg-emerald-50 border border-emerald-100 rounded-[2rem] p-8 space-y-4"
              >
                <div className="flex items-center gap-3 text-emerald-700 font-black">
                  <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center text-white">✓</div>
                  Carbon Offset Confirmed
                </div>
                <div className="text-4xl font-black text-emerald-700">{result.amount_burned} tCO₂e</div>
                <p className="text-sm text-emerald-600 font-bold">{result.purpose}</p>
                <div className="pt-4 border-t border-emerald-100 space-y-1">
                  <p className="text-[10px] text-emerald-600 font-bold">Remaining Balance: <strong>{result.remaining_balance?.toFixed(4)} ECO</strong></p>
                  {result.tx_hash && (
                    <a href={`https://sepolia.etherscan.io/tx/${result.tx_hash}`} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] text-emerald-600 font-black hover:underline"
                    >
                      View burn on Sepolia Etherscan →
                    </a>
                  )}
                </div>
              </motion.div>
            ) : (
              <div className="bg-slate-50 rounded-[2rem] p-8 border border-dashed border-slate-200 space-y-4">
                <h4 className="text-sm font-black text-slate-900">How Carbon Burning Works</h4>
                <div className="space-y-3 text-xs text-slate-500 font-bold">
                  <p>1. Enter the amount of ECO credits you want to burn (minimum 0.001)</p>
                  <p>2. Optionally provide the on-chain tx hash from calling <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">EcoToken.burn()</code> on Sepolia</p>
                  <p>3. Each credit burned offsets 1 tonne of CO₂ permanently</p>
                  <p>4. A redemption record is created in the carbon ledger</p>
                </div>
                <div className="p-4 bg-orange-50 border border-orange-100 rounded-2xl">
                  <p className="text-[10px] font-black text-orange-700 uppercase tracking-widest mb-1">Important</p>
                  <p className="text-[11px] text-orange-600">Burning is irreversible. Credits will be permanently deducted from your balance.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT LIBRARY
// ═══════════════════════════════════════════════════════════════════════════════

const HeaderQuickStat = ({ label, value, color }) => (
  <div className="bg-white/8 rounded-xl px-4 py-2.5 backdrop-blur-sm min-w-[120px]">
    <p className="text-[9px] text-white/50 font-bold uppercase tracking-wider">{label}</p>
    <p className={`text-sm font-black ${color}`}>{value}</p>
  </div>
);

const SectionLabel = ({ icon: Icon, title, subtitle }) => (
  <div className="flex items-center gap-3 mb-6">
    <div className="p-2 bg-emerald-100 rounded-xl">
      <Icon className="w-5 h-5 text-emerald-700" />
    </div>
    <div>
      <h2 className="text-lg font-black text-slate-900 tracking-tight">{title}</h2>
      {subtitle && <p className="text-[10px] text-slate-400 font-bold">{subtitle}</p>}
    </div>
  </div>
);

const KPICard = ({ title, value, unit, icon: Icon, accent, trend, subtitle, delay = 0, alert = false }) => {
  const accents = {
    emerald: { bg: 'bg-emerald-50', icon: 'bg-emerald-500', border: 'border-emerald-100' },
    teal:    { bg: 'bg-teal-50',    icon: 'bg-teal-600',    border: 'border-teal-100'    },
    sky:     { bg: 'bg-sky-50',     icon: 'bg-sky-500',     border: 'border-sky-100'     },
    amber:   { bg: 'bg-amber-50',   icon: 'bg-amber-500',   border: 'border-amber-100'   },
    rose:    { bg: 'bg-rose-50',    icon: 'bg-rose-500',    border: 'border-rose-100'    },
  };
  const c = accents[accent] || accents.emerald;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: 'spring', stiffness: 120, damping: 18 }}
      whileHover={{ y: -4 }}
      className={`relative bg-white rounded-2xl p-5 border ${c.border} shadow-sm overflow-hidden cursor-default ${alert ? 'ring-2 ring-rose-200' : ''}`}
    >
      <div className={`absolute -top-6 -right-6 w-24 h-24 rounded-full ${c.bg} opacity-60`} />
      <div className="relative">
        <div className="flex items-start justify-between mb-3">
          <div className={`p-2.5 rounded-xl ${c.icon}`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          {trend !== undefined && (
            <span className={`text-[10px] font-black flex items-center gap-0.5 ${trend >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
              {trend >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {Math.abs(trend)}%
            </span>
          )}
        </div>
        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-0.5">{title}</p>
        <p className="text-2xl font-black text-slate-900 tabular-nums">
          {value} <span className="text-[10px] text-slate-400 font-bold">{unit}</span>
        </p>
        {subtitle && <p className="text-[10px] text-slate-400 mt-1">{subtitle}</p>}
      </div>
    </motion.div>
  );
};

const BalanceBlock = ({ label, sublabel, value, color, icon: Icon }) => (
  <div className={`p-6 bg-${color}-50 rounded-2xl border border-${color}-100`}>
    <div className="flex items-center gap-2 mb-3">
      <Icon className={`w-5 h-5 text-${color}-600`} />
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
    </div>
    <p className={`text-3xl font-black text-${color}-700`}>{value}</p>
    <p className={`text-[10px] text-${color}-500 mt-1 font-bold`}>{sublabel}</p>
  </div>
);

const EcoServiceCard = ({ label, value, unit, color }) => (
  <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
    <span className="text-[10px] text-white/50 block mb-1 font-bold uppercase tracking-wider">{label}</span>
    <span className={`text-xl font-black ${color}`}>{value} <span className="text-[10px] text-white/30">{unit}</span></span>
  </div>
);

const LegendDot = ({ color, label }) => (
  <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
    <span className={`w-2 h-2 rounded-full ${color}`} /> {label}
  </span>
);
