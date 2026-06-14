import React from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { 
  Globe, TreePine, Axe, Wind, Droplets, 
  BarChart3, TrendingUp, TrendingDown,
  Activity, AlertTriangle, ChevronRight,
  Calculator, Zap, Layers, Beaker
} from 'lucide-react';
import { motion } from 'framer-motion';
import { 
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, 
  CartesianGrid, Tooltip, Legend, AreaChart, Area 
} from 'recharts';
import { Badge } from '@/components/ui/Badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';

const StatCard = ({ title, value, unit, icon: Icon, color, delay }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
    className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all group"
  >
    <div className="flex items-center justify-between mb-4">
      <div className={`p-3 rounded-2xl bg-${color}-50 text-${color}-600 group-hover:scale-110 transition-transform`}>
        <Icon className="w-6 h-6" />
      </div>
      <Badge variant="outline" className="border-slate-100 text-slate-400 font-bold uppercase text-[9px] tracking-widest">Global</Badge>
    </div>
    <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">{title}</p>
    <div className="flex items-baseline gap-1">
      <span className="text-3xl font-black text-slate-900">{value}</span>
      {unit && <span className="text-xs font-bold text-slate-400">{unit}</span>}
    </div>
  </motion.div>
);

export default function Environment() {
  const { data: stats } = useQuery({
    queryKey: ['env-stats'],
    queryFn: async () => {
      const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/api/environment/stats`);
      return data;
    }
  });

  const { data: monthlyData } = useQuery({
    queryKey: ['env-monthly'],
    queryFn: async () => {
      const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/api/environment/monthly-stats`);
      return data;
    }
  });

  const { data: speciesStats } = useQuery({
    queryKey: ['env-species'],
    queryFn: async () => {
      const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/api/environment/species-stats`);
      return data;
    }
  });

  const { data: activeDebts } = useQuery({
    queryKey: ['env-debts'],
    queryFn: async () => {
      const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/api/debt/all`);
      return data?.filter(d => d.status !== 'CLEARED') || [];
    }
  });

  return (
    <div className="min-h-screen bg-[#F8FAF9] py-8 px-6 lg:px-10">
      <div className="max-w-[1600px] mx-auto space-y-10">
        
        {/* Header */}
        <div className="bg-emerald-900 rounded-[3rem] p-12 text-white relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 p-12 opacity-10">
            <Globe className="w-64 h-64" />
          </div>
          <div className="relative z-10 max-w-3xl">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-3 h-3 bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-emerald-400 text-xs font-black uppercase tracking-[0.3em]">Environment Protocol V4.0</span>
            </div>
            <h1 className="text-6xl font-black tracking-tight leading-none mb-6">Biological Integrity Dashboard</h1>
            <p className="text-emerald-100/60 text-lg font-medium leading-relaxed">
              Real-time auditing of carbon sequestration assets, environmental losses, and replantation obligations across the EcoChain network.
            </p>
          </div>
        </div>

        {/* Top Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
          <StatCard title="Trees Verified" value={stats?.total_trees_verified || 0} icon={TreePine} color="emerald" delay={0.1} />
          <StatCard title="Trees Cut" value={stats?.total_trees_cut || 0} icon={Axe} color="rose" delay={0.2} />
          <StatCard title="CO2 Absorbed" value={Math.round(stats?.total_co2_absorbed_kg || 0)} unit="kg" icon={Wind} color="sky" delay={0.3} />
          <StatCard title="CO2 Lost" value={Math.round(stats?.total_co2_lost_kg || 0)} unit="kg" icon={TrendingDown} color="orange" delay={0.4} />
          <StatCard 
            title="Net Balance" 
            value={Math.round(stats?.net_co2_balance_kg || 0)} 
            unit="kg" 
            icon={TrendingUp} 
            color={stats?.net_co2_balance_kg >= 0 ? 'emerald' : 'rose'} 
            delay={0.5} 
          />
          <StatCard title="Active Debts" value={stats?.active_replantation_debts || 0} icon={AlertTriangle} color="amber" delay={0.6} />
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Chart Section */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="lg:col-span-2 bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-sm"
          >
            <div className="flex items-center justify-between mb-10">
              <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">CO₂ Dynamic Balance</h3>
                <p className="text-slate-400 text-sm font-bold uppercase tracking-wider mt-1">Last 12 Month Sequestration vs Loss</p>
              </div>
              <div className="flex gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-emerald-500 rounded-full" />
                  <span className="text-[10px] font-black uppercase text-slate-500">Absorbed</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-rose-500 rounded-full" />
                  <span className="text-[10px] font-black uppercase text-slate-500">Lost</span>
                </div>
              </div>
            </div>
            
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis 
                    dataKey="month" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 11, fontWeight: 'bold', fill: '#94A3B8' }} 
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 11, fontWeight: 'bold', fill: '#94A3B8' }}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                    itemStyle={{ fontWeight: 'black', fontSize: '12px' }}
                  />
                  <Line type="monotone" dataKey="absorbed" stroke="#10B981" strokeWidth={4} dot={{ r: 6, fill: '#10B981', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 8 }} />
                  <Line type="monotone" dataKey="lost" stroke="#F43F5E" strokeWidth={4} dot={{ r: 6, fill: '#F43F5E', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 8 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Species Table */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-sm overflow-hidden"
          >
            <h3 className="text-xl font-black text-slate-900 tracking-tight mb-8">Species Impact Mapping</h3>
            <div className="space-y-6">
              {speciesStats?.map((s, i) => (
                <div key={s.species} className="flex flex-col gap-3 pb-6 border-b border-slate-50 last:border-0 grow">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center font-black text-slate-400">
                        {s.species[0]}
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-800">{s.species}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase">{s.trees_planted} Planted | {s.trees_cut} Cut</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-black ${s.net >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {s.net >= 0 ? '+' : ''}{Math.round(s.net)} kg
                      </p>
                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-tighter">Net CO₂</p>
                    </div>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${s.net >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`} 
                      style={{ width: `${Math.min(100, Math.abs((s.net / (stats?.total_co2_absorbed_kg || 1)) * 500))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Active Debts Overview */}
        <section>
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-xl">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">Active Environmental Debts</h3>
            </div>
          </div>
          
          <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow className="border-b border-slate-100">
                  <TableHead className="font-black uppercase text-[10px] tracking-widest pl-10 h-16">Owner</TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest h-16">Original Asset</TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest h-16 text-center">Needed / Verified</TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest h-16">Progress</TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest h-16 text-right pr-10">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeDebts?.map((debt) => (
                  <TableRow key={debt.id} className="hover:bg-slate-50/50 transition-colors border-b border-slate-100 last:border-0">
                    <TableCell className="pl-10 h-20">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white text-[10px] font-black">
                          {debt.owner_wallet?.slice(2, 4).toUpperCase()}
                        </div>
                        <span className="text-[11px] font-mono font-bold text-slate-400">{debt.owner_wallet?.slice(0, 6)}...{debt.owner_wallet?.slice(-4)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="text-xs font-black text-slate-800">{debt.original_tree_id}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Cut: {new Date(debt.created_at).toLocaleDateString()}</p>
                    </TableCell>
                    <TableCell className="text-center font-black text-slate-700">
                      {debt.trees_verified} / {debt.trees_needed}
                    </TableCell>
                    <TableCell className="w-[300px]">
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[9px] font-black uppercase text-slate-400">
                          <span>Replantation Progress</span>
                          <span>{Math.round((debt.trees_verified / debt.trees_needed) * 100)}%</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${(debt.trees_verified / debt.trees_needed) * 100}%` }}
                            className="h-full bg-amber-500" 
                          />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right pr-10">
                      <Badge className={`uppercase text-[9px] font-black tracking-[0.1em] ${debt.status === 'IN_PROGRESS' ? 'bg-sky-100 text-sky-700' : 'bg-amber-100 text-amber-700'}`}>
                        {debt.status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {!activeDebts?.length && (
              <div className="py-20 text-center text-slate-400 font-black uppercase tracking-widest text-xs">
                No active environmental obligations found
              </div>
            )}
          </div>
        </section>

      </div>
    </div>
  );
}
