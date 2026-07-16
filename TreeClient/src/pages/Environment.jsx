import React from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { 
  Trees, Axe, Activity, Wind, 
  Droplets, AlertTriangle, ShieldCheck,
  TrendingUp, BarChart3, Globe, Layers,
  ChevronRight, Calendar, User, Search
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Legend, AreaChart, Area
} from 'recharts';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';

export default function Environment() {
  // Fetch Platform Stats
  const { data: stats } = useQuery({
    queryKey: ['env-stats'],
    queryFn: async () => {
      const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/api/environment/stats`);
      return data;
    }
  });

  // Fetch Monthly Chart Data
  const { data: chartData } = useQuery({
    queryKey: ['monthly-stats'],
    queryFn: async () => {
      const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/api/environment/monthly-stats`);
      return data;
    }
  });

  // Fetch Species Stats
  const { data: speciesStats } = useQuery({
    queryKey: ['species-stats'],
    queryFn: async () => {
      const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/api/environment/species-stats`);
      return data;
    }
  });

  const { data: activeDebts } = useQuery({
    queryKey: ['all-active-debts'],
    queryFn: async () => {
      const token = localStorage.getItem('eco_token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/api/debt/all`, { headers });
      return data;
    }
  });

  return (
    <div className="min-h-screen bg-[#F3F8F5] py-12 px-8">
      <div className="max-w-[1600px] mx-auto space-y-12">
        
        {/* Header Section */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 bg-white p-10 rounded-[3rem] shadow-xl shadow-emerald-900/5 border border-emerald-50">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-emerald-100 rounded-xl text-emerald-700">
                <Globe className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-black text-emerald-800 uppercase tracking-[0.2em]">Platform Impact Overview</span>
            </div>
            <h1 className="text-5xl font-black text-slate-900 tracking-tight">Environmental Health</h1>
            <p className="text-slate-500 mt-2 text-lg max-w-2xl">Real-time biological monitoring of global tree populations, carbon sequestration metrics, and ecosystem restoration progress.</p>
          </div>
          <div className="flex items-center gap-4">
             <Badge className="bg-emerald-500 text-white border-0 px-6 py-2.5 rounded-full text-xs font-black uppercase tracking-widest shadow-lg shadow-emerald-200">System Integrity: Nominal</Badge>
          </div>
        </div>

        {/* Global Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
          <StatCard 
            label="Trees Verified" 
            value={stats?.total_trees_verified || 0} 
            icon={ShieldCheck} 
            color="emerald" 
            unit="Assets"
          />
          <StatCard 
            label="Trees Cut" 
            value={stats?.total_trees_cut || 0} 
            icon={Axe} 
            color="rose" 
            unit="Assets"
          />
          <StatCard 
            label="CO₂ Absorbed" 
            value={Math.round(stats?.total_co2_absorbed || 0)} 
            icon={Wind} 
            color="teal" 
            unit="kg"
          />
          <StatCard 
            label="CO₂ Lost" 
            value={Math.round(stats?.total_co2_lost || 0)} 
            icon={Activity} 
            color="orange" 
            unit="kg"
          />
          <StatCard 
            label="Net CO₂ Balance" 
            value={Math.round(stats?.net_co2_balance || 0)} 
            icon={TrendingUp} 
            color={stats?.net_co2_balance >= 0 ? "emerald" : "rose"} 
            unit="kg"
          />
          <StatCard 
            label="Active Debts" 
            value={stats?.active_debts || 0} 
            icon={AlertTriangle} 
            color="amber" 
            unit="Queue"
          />
        </div>

        <div className="grid lg:grid-cols-3 gap-10">
          {/* Chart Section */}
          <div className="lg:col-span-2 bg-white p-10 rounded-[3rem] shadow-xl shadow-emerald-900/5 border border-emerald-50 space-y-8">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">CO₂ Sequestration Balance</h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Last 12 Months Biological Performance</p>
              </div>
              <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest">
                 <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-emerald-500" /> Absorbed</div>
                 <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-rose-500" /> Lost</div>
              </div>
            </div>

            <div className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorAbs" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorLost" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="month" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fontSize: 10, fontWeight: 900, fill: '#94a3b8'}} 
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fontSize: 10, fontWeight: 900, fill: '#94a3b8'}}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '20px' }}
                    itemStyle={{ fontSize: '12px', fontWeight: 900, textTransform: 'uppercase' }}
                  />
                  <Area type="monotone" dataKey="absorbed" stroke="#10b981" strokeWidth={4} fillOpacity={1} fill="url(#colorAbs)" name="CO2 Absorbed" />
                  <Area type="monotone" dataKey="lost" stroke="#f43f5e" strokeWidth={4} fillOpacity={1} fill="url(#colorLost)" name="CO2 Lost" />
                  <Line type="monotone" dataKey="net" stroke="#0ea5e9" strokeWidth={2} dot={false} strokeDasharray="5 5" name="Net Balance" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Species Impact Table */}
          <div className="bg-white p-10 rounded-[3rem] shadow-xl shadow-emerald-900/5 border border-emerald-50 h-[590px] flex flex-col">
            <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-8">Species Impact</h3>
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
              <Table>
                <TableHeader>
                  <TableRow className="border-0 bg-slate-50 rounded-xl overflow-hidden">
                    <TableHead className="text-[9px] font-black uppercase text-slate-400 py-4 pl-6">Species</TableHead>
                    <TableHead className="text-[9px] font-black uppercase text-slate-400 text-center">Net (kg)</TableHead>
                    <TableHead className="text-[9px] font-black uppercase text-slate-400 text-right pr-6">Stock</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {speciesStats?.map((s, i) => (
                    <TableRow key={s.species} className="border-b border-slate-50 hover:bg-emerald-50/30 transition-all cursor-default">
                      <TableCell className="py-5 pl-6 font-black text-slate-700">{s.species}</TableCell>
                      <TableCell className="text-center font-black">
                        <span className={s.net >= 0 ? "text-emerald-600" : "text-rose-600"}>
                          {s.net >= 0 ? '+' : ''}{Math.round(s.net)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <div className="flex items-center justify-end gap-2">
                           <span className="text-[10px] font-bold text-slate-400">{s.planted - s.cut} Live</span>
                           <BarChart3 className="w-3.5 h-3.5 text-slate-200" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        {/* Active Debts Overview */}
        <div className="bg-white p-12 rounded-[4rem] shadow-2xl shadow-emerald-900/5 border border-emerald-50">
          <div className="flex items-center justify-between mb-12">
            <div>
              <h3 className="text-3xl font-black text-slate-900 tracking-tight">Active Replantation Debts</h3>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Pending ecosystem restoration obligations</p>
            </div>
            <Button variant="outline" className="rounded-2xl border-slate-200 font-black uppercase text-[10px] tracking-widest px-8">Export Audit Logs</Button>
          </div>

          <div className="grid gap-6">
            {activeDebts?.filter(d => d.status !== 'CLEARED').map((debt) => (
              <div key={debt.id} className="flex flex-col xl:flex-row xl:items-center justify-between gap-8 p-10 bg-slate-50/50 rounded-[3rem] border border-slate-100 hover:bg-white hover:shadow-xl hover:shadow-emerald-900/5 transition-all group">
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-slate-100">
                    <User className="w-6 h-6 text-slate-400" />
                  </div>
                  <div>
                    <p className="text-[10px] font-mono text-emerald-600 font-black mb-1">{debt.owner_wallet.slice(0, 6)}...{debt.owner_wallet.slice(-4)}</p>
                    <h4 className="text-xl font-black text-slate-900 leading-none mb-2">Original: {debt.original_tree_id}</h4>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Reported: {new Date(debt.created_at).toLocaleDateString()}</p>
                  </div>
                </div>

                <div className="flex-1 max-w-md">
                   <div className="flex justify-between items-center mb-3 text-[10px] font-black uppercase tracking-widest">
                      <span className="text-slate-400">Restoration Progress</span>
                      <span className="text-slate-900">{debt.trees_verified} / {debt.trees_needed} Verified</span>
                   </div>
                   <div className="h-3 bg-white rounded-full border border-slate-100 overflow-hidden">
                      <div 
                        className="h-full bg-emerald-500 rounded-full transition-all duration-1000" 
                        style={{ width: `${(debt.trees_verified / debt.trees_needed) * 100}%` }}
                      />
                   </div>
                </div>

                <div className="flex items-center gap-6">
                  <Badge className="bg-amber-100 text-amber-700 border-amber-200 uppercase text-[10px] font-black tracking-widest px-6 py-2">
                    {debt.status.replace('_', ' ')}
                  </Badge>
                  <Button size="icon" className="w-12 h-12 bg-white border border-slate-200 text-slate-400 hover:text-emerald-600 hover:border-emerald-200 rounded-2xl transition-all">
                    <ChevronRight className="w-6 h-6" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

const StatCard = ({ label, value, icon: Icon, color, unit }) => (
  <motion.div 
    whileHover={{ y: -5 }}
    className="bg-white p-8 rounded-[2.5rem] shadow-xl shadow-emerald-900/5 border border-emerald-50 flex flex-col gap-4"
  >
    <div className={`w-12 h-12 bg-${color}-50 rounded-2xl flex items-center justify-center text-${color}-600`}>
      <Icon className="w-6 h-6" />
    </div>
    <div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-black text-slate-900 tabular-nums">{value.toLocaleString()}</span>
        <span className="text-[10px] font-black text-slate-400 uppercase">{unit}</span>
      </div>
    </div>
  </motion.div>
);
