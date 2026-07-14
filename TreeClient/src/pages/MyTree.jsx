import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  TreePine, Search, Filter, Plus, 
  Leaf, Activity, MapPin, Award, 
  Wind, ShieldCheck, Clock, AlertCircle, Calendar, Axe,
  ExternalLink, LayoutGrid, List,
  ChevronRight, ArrowUpRight, TrendingUp, Sprout
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

const STATUS_CONFIG = {
  PENDING_VERIFICATION: { color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100', icon: Clock },
  VERIFIED:             { color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100', icon: ShieldCheck },
  REJECTED:             { color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-100', icon: AlertCircle },
  CUT_REPORTED:         { color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', icon: Clock },
  CUT_CONFIRMED:        { color: 'text-rose-800', bg: 'bg-rose-100', border: 'border-rose-300', icon: AlertCircle },
};

export default function RedesignedMyTrees() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [viewMode, setViewMode] = useState('grid'); 

  const { data: trees = [], isLoading } = useQuery({
    queryKey: ['my-trees'],
    queryFn: async () => {
      const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/api/trees/my`);
      return Array.isArray(data) ? data : [];
    },
  });

  const stats = useMemo(() => {
    const verified = trees.filter(t => t.status === 'VERIFIED').length;
    const pending = trees.filter(t => t.status === 'PENDING_VERIFICATION').length;
    const cut = trees.filter(t => t.status === 'CUT_REPORTED' || t.status === 'CUT_CONFIRMED').length;
    const total = trees.length;
    return { total, verified, pending, cut, rejected: total - verified - pending - cut };
  }, [trees]);

  const filteredTrees = useMemo(() => {
    return trees
      .filter(t => {
        const matchesSearch = (t.species || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                             (t.location || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                             (t.tree_id || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter = activeFilter === 'all' || t.status === activeFilter;
        return matchesSearch && matchesFilter;
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [trees, searchTerm, activeFilter]);

  return (
    <div className="min-h-screen bg-[#F8FAF9] py-10 px-6 lg:px-12">
      <div className="max-w-7xl mx-auto space-y-10">

        {/* ── Header & Stats ────────────────────────────────────────────── */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
            <div>
                <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="inline-flex items-center gap-2 mb-4 bg-emerald-100 px-4 py-1.5 rounded-full"
                >
                    <Sprout className="w-4 h-4 text-emerald-600" />
                    <span className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">My Tree Registry</span>
                </motion.div>
                <h1 className="text-4xl font-black text-slate-900 tracking-tight">EcoChain Portfolio</h1>
                <p className="text-slate-500 mt-2 text-lg">Manage and monitor your verified biological assets.</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 w-full lg:w-auto">
                <MetricSmall label="Total" value={stats.total} icon={TreePine} color="emerald" />
                <MetricSmall label="Verified" value={stats.verified} icon={ShieldCheck} color="emerald" />
                <MetricSmall label="Queue" value={stats.pending} icon={Clock} color="amber" />
                <MetricSmall label="Voided" value={stats.rejected} icon={AlertCircle} color="rose" />
                <MetricSmall label="Cut" value={stats.cut} icon={Axe} color="orange" />
            </div>
        </div>

        {/* ── Controls ─────────────────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-white p-4 rounded-[2rem] shadow-sm border border-emerald-50">
            <div className="flex flex-1 items-center gap-4 w-full">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input 
                        placeholder="Search trees by species, location or ID..."
                        className="pl-12 h-12 bg-slate-50 border-none focus:ring-2 focus:ring-emerald-500 rounded-2xl"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                 <div className="hidden md:flex items-center gap-2 bg-slate-50 p-1 rounded-xl">
                    {['all', 'PENDING_VERIFICATION', 'VERIFIED', 'REJECTED', 'CUT_REPORTED', 'CUT_CONFIRMED'].map(f => (
                        <button
                            key={f}
                            onClick={() => setActiveFilter(f)}
                            className={`
                                px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all
                                ${activeFilter === f ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}
                            `}
                        >
                            {f === 'all' ? 'All' : f === 'CUT_REPORTED' ? '🟠 Cut Reported' : f === 'CUT_CONFIRMED' ? '🔴 Cut Confirmed' : f.replace('_', ' ')}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex items-center gap-4 shrink-0">
                <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl">
                    <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400'}`}>
                        <LayoutGrid className="w-4 h-4" />
                    </button>
                    <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400'}`}>
                        <List className="w-4 h-4" />
                    </button>
                </div>
                <Button 
                    onClick={() => navigate('/planttree')}
                    className="h-12 px-6 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black uppercase tracking-widest gap-2 shadow-lg shadow-emerald-200"
                >
                    <Plus className="w-5 h-5" />
                    Plant Tree
                </Button>
            </div>
        </div>

        {/* ── Tree Gallery ─────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
            {isLoading ? (
                <div key="loading" className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className="bg-white rounded-[2.5rem] h-96 animate-pulse border border-slate-100" />
                    ))}
                </div>
            ) : filteredTrees.length === 0 ? (
                <motion.div 
                    key="empty"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-[3rem] p-24 text-center border border-emerald-50"
                >
                    <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-8">
                        <TreePine className="w-12 h-12 text-emerald-600" />
                    </div>
                    <h2 className="text-3xl font-black text-slate-900 mb-2">Registry Empty</h2>
                    <p className="text-slate-500 mb-8 max-w-sm mx-auto">No trees found matching your criteria. Start by registering a new biological asset.</p>
                    <Button 
                        onClick={() => navigate('/planttree')}
                        variant="outline"
                        className="rounded-2xl border-emerald-200 text-emerald-700 h-14 px-8 font-black uppercase tracking-widest"
                    >
                        Register Asset
                    </Button>
                </motion.div>
            ) : (
                <motion.div 
                    key={viewMode}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className={viewMode === 'grid' ? "grid md:grid-cols-2 lg:grid-cols-3 gap-8" : "space-y-4"}
                >
                    {filteredTrees.map((tree, i) => (
                        viewMode === 'grid' ? (
                            <PremiumTreeCard 
                                key={tree.id} 
                                tree={tree} 
                                index={i} 
                                onClick={() => navigate(`/tree/${tree.tree_id || tree.id}`)}
                            />
                        ) : (
                            <TreeListItem 
                                key={tree.id} 
                                tree={tree} 
                                onClick={() => navigate(`/tree/${tree.tree_id || tree.id}`)}
                            />
                        )
                    ))}
                </motion.div>
            )}
        </AnimatePresence>

      </div>
    </div>
  );
}

const MetricSmall = ({ label, value, icon: Icon, color }) => (
    <div className="bg-white px-5 py-4 rounded-2xl shadow-sm border border-emerald-50 min-w-[140px]">
        <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
            <Icon className={`w-3.5 h-3.5 text-${color}-500`} />
        </div>
        <p className="text-xl font-black text-slate-900 tabular-nums">{value}</p>
    </div>
);

const PremiumTreeCard = ({ tree, index, onClick }) => {
    const status = STATUS_CONFIG[tree.status] || STATUS_CONFIG.PENDING_VERIFICATION;
    const StatusIcon = status.icon;

    return (
        <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            whileHover={{ y: -8 }}
            className="group bg-white rounded-[2.5rem] overflow-hidden border border-emerald-50 shadow-sm hover:shadow-2xl hover:shadow-emerald-900/5 transition-all duration-500 cursor-pointer"
            onClick={onClick}
        >
            <div className="relative h-64 overflow-hidden">
                <img 
                    src={tree.image_url || '/placeholder-tree.jpg'} 
                    alt={tree.species}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />
                
                <div className={`absolute top-4 left-4 ${status.bg} ${status.color} px-3 py-1.5 rounded-full border ${status.border} flex items-center gap-1.5 shadow-xl`}>
                    <StatusIcon className="w-3 h-3" />
                    <span className="text-[9px] font-black uppercase tracking-wider">{tree.status.replace('_', ' ')}</span>
                </div>

                <div className="absolute bottom-6 left-6 right-6">
                    <p className="text-[10px] text-emerald-400 font-black uppercase tracking-[0.2em] mb-1">{tree.location || 'Central Registry'}</p>
                    <h3 className="text-2xl font-black text-white leading-tight">{tree.species}</h3>
                    {tree.nickname && <p className="text-white/60 text-xs italic mt-1">"{tree.nickname}"</p>}
                </div>

                {tree.is_replacement && (
                    <div className="absolute top-4 right-4 bg-emerald-500 text-white px-3 py-1 rounded-full flex items-center gap-1.5 shadow-xl">
                        <Sprout className="w-3 h-3" />
                        <span className="text-[8px] font-black uppercase">Replacement</span>
                    </div>
                )}

                {(tree.status === 'CUT_REPORTED' || tree.status === 'CUT_CONFIRMED') && !tree.is_replacement && (
                    <div className="absolute top-4 right-4 bg-rose-600 text-white p-2.5 rounded-xl shadow-xl animate-pulse">
                        <Axe className="w-4 h-4" />
                    </div>
                )}
            </div>

            <div className="p-8 space-y-6">
                <div className="flex justify-between items-center bg-slate-50/50 rounded-2xl px-5 py-3">
                    <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-0.5">Asset ID</p>
                        <p className="text-xs font-mono font-black text-emerald-700">{tree.tree_id || 'Pending'}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-0.5">Health</p>
                        <p className={`text-xs font-black ${tree.status === 'CUT_CONFIRMED' ? 'text-rose-600' : 'text-slate-700'}`}>
                            {tree.status === 'CUT_CONFIRMED' ? 'REMOVED' : tree.health_status || 'Stable'}
                        </p>
                    </div>
                </div>

                {tree.status === 'CUT_CONFIRMED' && tree.environmental_loss && (
                    <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100 flex items-center justify-between">
                        <div>
                            <p className="text-[8px] font-black text-rose-600 uppercase tracking-widest">CO₂ Lost</p>
                            <p className="text-sm font-black text-slate-900">{Math.round(tree.environmental_loss.co2_lost_kg)} kg</p>
                        </div>
                        <Button 
                            variant="link" 
                            className="text-rose-600 text-[10px] font-black uppercase p-0 h-auto"
                            onClick={(e) => { e.stopPropagation(); window.location.href='/debt'; }}
                        >
                            View Debt →
                        </Button>
                    </div>
                )}

                <div className="flex gap-3">
                    <Button 
                        className="flex-1 rounded-xl h-12 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all"
                        onClick={onClick}
                    >
                        View Assessment
                    </Button>
                    
                    {tree.status === 'VERIFIED' && (
                        <Button 
                            className="h-12 w-12 rounded-xl bg-orange-50 text-orange-600 border border-orange-100 hover:bg-orange-600 hover:text-white transition-all p-0"
                            onClick={(e) => {
                                e.stopPropagation();
                                window.location.href = `/tree/${tree.tree_id}/report-cut`;
                            }}
                            title="Report Tree Cut"
                        >
                            <Axe className="w-5 h-5" />
                        </Button>
                    )}
                </div>
            </div>
        </motion.div>
    );
};

const ImpactMetric = ({ icon: Icon, label, value, color }) => (
    <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
        <div className={`w-8 h-8 rounded-lg bg-${color}-50 flex items-center justify-center text-${color}-600 shrink-0`}>
            <Icon className="w-4 h-4" />
        </div>
        <div>
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider leading-none mb-1">{label}</p>
            <p className="text-[10px] font-black text-slate-800 leading-none truncate max-w-[80px]">{value}</p>
        </div>
    </div>
);

const TreeListItem = ({ tree, onClick }) => {
    const status = STATUS_CONFIG[tree.status] || STATUS_CONFIG.PENDING_VERIFICATION;
    const StatusIcon = status.icon;

    return (
        <motion.div 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={onClick}
            className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-4 rounded-[2rem] border border-emerald-50 hover:shadow-xl hover:shadow-emerald-900/5 transition-all group cursor-pointer"
        >
            <div className="flex items-center gap-6">
                <div className="w-20 h-20 rounded-2xl overflow-hidden shrink-0 shadow-inner relative">
                    <img src={tree.image_url} className="w-full h-full object-cover" alt="" />
                    {(tree.status === 'CUT_REPORTED' || tree.status === 'CUT_CONFIRMED') && (
                        <div className="absolute inset-0 bg-rose-600/40 flex items-center justify-center">
                            <Axe className="w-6 h-6 text-white" />
                        </div>
                    )}
                </div>
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-mono text-emerald-600 font-bold">{tree.tree_id}</span>
                        <div className={`${status.bg} ${status.color} px-2 py-0.5 rounded-full text-[8px] font-black uppercase`}>
                           {tree.status.replace('_', ' ')}
                        </div>
                        {tree.is_replacement && (
                            <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100 flex items-center gap-1 px-2 py-0 h-4 rounded-full">
                                <Sprout className="w-2.5 h-2.5" />
                                <span className="text-[7px] font-black uppercase">Replacement</span>
                            </Badge>
                        )}
                    </div>
                    <h3 className="text-lg font-black text-slate-900">{tree.species}</h3>
                    <div className="flex items-center gap-2 text-slate-400 mt-1">
                        <MapPin className="w-3 h-3" />
                        <span className="text-[10px] uppercase font-black">{tree.location}</span>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-12 px-6 hidden lg:flex">
                <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Planted</p>
                    <p className="text-xs font-black text-slate-800">{new Date(tree.planting_date).toLocaleDateString()}</p>
                </div>
                <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Estimated Age</p>
                    <p className="text-xs font-black text-slate-800">{tree.age} Years</p>
                </div>
            </div>

            <div className="flex items-center gap-3 pl-6">
                {tree.status === 'VERIFIED' && (
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            window.location.href = `/tree/${tree.tree_id}/report-cut`;
                        }}
                        className="h-12 w-12 flex items-center justify-center rounded-2xl bg-orange-50 text-orange-600 border border-orange-100 hover:bg-orange-600 hover:text-white transition-all shadow-sm"
                        title="Report Tree Cut"
                    >
                        <Axe className="w-5 h-5" />
                    </button>
                )}
                <button className="h-12 w-12 flex items-center justify-center rounded-2xl bg-slate-900 text-white hover:bg-emerald-600 transition-all shadow-lg shadow-slate-200">
                    <ExternalLink className="w-5 h-5" />
                </button>
            </div>
        </motion.div>
    );
};
