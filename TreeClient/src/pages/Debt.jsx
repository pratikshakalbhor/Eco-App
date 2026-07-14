import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { 
  AlertTriangle, Sprout, Axe, Wind, Droplets, 
  CheckCircle2, Clock, ArrowUpRight, Plus,
  Link as LinkIcon, FileCheck, ChevronRight,
  Calculator, History, Search, TreePine, 
  AlertCircle, ShieldCheck, Activity, Leaf, Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useNavigate } from 'react-router-dom';

export default function Debt() {
  const [activeTab, setActiveTab] = useState('active'); // active | cleared
  const [isLinking, setIsLinking] = useState(null); // debt_id
  const [searchTerm, setSearchTerm] = useState('');
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: debts = [], isLoading: debtsLoading } = useQuery({
    queryKey: ['my-debts'],
    queryFn: async () => {
      const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/api/debt`);
      return Array.isArray(data) ? data : [];
    }
  });

  const { data: myTrees = [] } = useQuery({
    queryKey: ['my-verified-trees'],
    queryFn: async () => {
      const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/api/trees/my`);
      return data?.filter(t => t.status === 'VERIFIED' && !t.is_replacement) || [];
    }
  });

  const linkTreeMutation = useMutation({
    mutationFn: async ({ debtId, treeId }) => {
      await axios.post(`${import.meta.env.VITE_API_URL}/api/debt/${debtId}/link-tree`, { tree_id: treeId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['my-debts']);
      queryClient.invalidateQueries(['my-verified-trees']);
      setIsLinking(null);
    }
  });

  const filteredDebts = useMemo(() => {
    return debts.filter(d => activeTab === 'active' ? d.status !== 'CLEARED' : d.status === 'CLEARED');
  }, [debts, activeTab]);

  const availableTrees = useMemo(() => {
    return myTrees.filter(t => 
      t.species.toLowerCase().includes(searchTerm.toLowerCase()) || 
      t.tree_id.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [myTrees, searchTerm]);

  return (
    <div className="min-h-screen bg-[#F8FAF9] py-12 px-6 lg:px-12">
      <div className="max-w-7xl mx-auto space-y-10">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-rose-100 rounded-xl">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <span className="text-[10px] font-black text-rose-800 uppercase tracking-[0.2em]">Replantation Obligations</span>
            </div>
            <h1 className="text-5xl font-black text-slate-900 tracking-tight">Environmental Debt</h1>
            <p className="text-slate-500 mt-2 text-lg">Manage and resolve ecosystem replacement debts to restore your carbon credit integrity.</p>
          </div>

          <div className="flex bg-slate-100 p-1.5 rounded-2xl">
            <button 
              onClick={() => setActiveTab('active')}
              className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'active' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Active Debts ({debts.filter(d => d.status !== 'CLEARED').length})
            </button>
            <button 
              onClick={() => setActiveTab('cleared')}
              className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'cleared' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Cleared ({debts.filter(d => d.status === 'CLEARED').length})
            </button>
          </div>
        </div>

        {/* Debt Cards Grid */}
        <div className="grid gap-6">
          <AnimatePresence mode="popLayout">
            {filteredDebts.map((debt, index) => (
              <DebtCard 
                key={debt.id} 
                debt={debt} 
                onLink={() => setIsLinking(debt.id)}
                onPlant={() => navigate(`/planttree?debt_id=${debt.id}&is_replacement=true`)}
                onViewCert={() => navigate(`/certificate/${debt.id}`)}
                delay={index * 0.1}
              />
            ))}
          </AnimatePresence>
          {filteredDebts.length === 0 && !debtsLoading && (
            <div className="py-32 text-center bg-white rounded-[3rem] border border-dashed border-slate-200">
               <CheckCircle2 className="w-16 h-16 text-emerald-100 mx-auto mb-4" />
               <p className="text-slate-400 font-black uppercase tracking-widest text-sm">No {activeTab} debts found.</p>
            </div>
          )}
        </div>

      </div>

      {/* Linking Modal */}
      <AnimatePresence>
        {isLinking && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              <div className="p-10 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                <div>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight">Link Replacement Tree</h3>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Select from your verified biological assets</p>
                </div>
                <button onClick={() => setIsLinking(null)} className="w-12 h-12 rounded-2xl bg-white border border-slate-100 flex items-center justify-center hover:bg-slate-50 transition-colors">
                  <Plus className="w-6 h-6 rotate-45 text-slate-400" />
                </button>
              </div>

              <div className="p-10 flex-1 overflow-y-auto space-y-6">
                <div className="relative">
                  <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Search trees by Species or ID..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full h-16 pl-14 pr-6 bg-slate-100 rounded-2xl border-none text-slate-900 font-bold placeholder:text-slate-400 focus:ring-2 ring-emerald-500/20 transition-all"
                  />
                </div>

                <div className="grid gap-4">
                  {availableTrees.map(tree => (
                    <button 
                      key={tree.id}
                      onClick={() => linkTreeMutation.mutate({ debtId: isLinking, treeId: tree.tree_id })}
                      disabled={linkTreeMutation.isLoading}
                      className="flex items-center justify-between p-6 bg-white border border-slate-100 rounded-3xl hover:border-emerald-500 hover:shadow-lg hover:shadow-emerald-900/5 transition-all text-left group"
                    >
                      <div className="flex items-center gap-4">
                        <img src={tree.image_url} className="w-14 h-14 rounded-2xl object-cover" />
                        <div>
                          <p className="text-sm font-black text-slate-900 uppercase">{tree.species}</p>
                          <p className="text-[10px] font-mono text-slate-400">{tree.tree_id}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge className="bg-emerald-50 text-emerald-600 border-0 uppercase text-[9px] font-black">Verified Asset</Badge>
                        <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-white transition-all">
                          {linkTreeMutation.isLoading ? <Activity className="w-4 h-4 animate-spin" /> : <LinkIcon className="w-4 h-4" />}
                        </div>
                      </div>
                    </button>
                  ))}
                  {availableTrees.length === 0 && (
                    <div className="py-10 text-center text-slate-400 font-black uppercase text-xs tracking-widest">
                      No matching verified trees found.
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

const DebtCard = ({ debt, onLink, onPlant, onViewCert, delay }) => {
  const isCleared = debt.status === 'CLEARED';
  const progress = (debt.trees_verified / debt.trees_needed) * 100;
  
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
      className={`bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden group hover:shadow-xl hover:shadow-slate-200/50 transition-all ${isCleared ? 'opacity-80 grayscale-[0.5]' : ''}`}
    >
      <div className={`h-2 w-full ${isCleared ? 'bg-emerald-500' : 'bg-rose-500'}`} />
      
      <div className="p-10 space-y-8">
        {/* Header Section */}
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Badge className={`uppercase text-[10px] font-black tracking-widest px-4 py-1.5 ${isCleared ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                {isCleared ? 'Debt Fully Resolved' : 'Active Ecological Obligation'}
              </Badge>
              <span className="text-xs font-mono font-bold text-slate-400">Ref: {debt.original_tree_id}</span>
            </div>
            <h3 className="text-3xl font-black text-slate-900 tracking-tight">Replantation for {debt.original_tree_id}</h3>
            <div className="flex flex-wrap gap-4">
               <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                 <Calendar className="w-3.5 h-3.5" />
                 Reported: {new Date(debt.created_at).toLocaleDateString()}
               </div>
               {isCleared && (
                 <div className="flex items-center gap-2 text-[10px] font-black text-emerald-600 uppercase tracking-widest">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Resolved: {new Date(debt.cleared_at).toLocaleDateString()}
                 </div>
               )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Resolution Progress</p>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-black text-slate-900 tracking-tighter">{debt.trees_verified}</span>
              <span className="text-lg font-black text-slate-300">/ {debt.trees_needed}</span>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-3">
          <div className="flex justify-between items-end">
            <div className="flex gap-1.5">
              {[...Array(debt.trees_needed)].map((_, i) => (
                <div key={i} className={`w-4 h-4 rounded-md ${i < debt.trees_verified ? 'bg-emerald-500' : i < debt.trees_planted ? 'bg-amber-400 animate-pulse' : 'bg-slate-100'}`} />
              ))}
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase">Verification Progress ({Math.round(progress)}%)</span>
          </div>
          <div className="h-4 bg-slate-50 rounded-2xl overflow-hidden border border-slate-100 relative">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              className={`h-full ${isCleared ? 'bg-emerald-500' : 'bg-rose-500'} relative z-10`}
            />
            <div className="absolute inset-0 bg-slate-200/20" style={{ backgroundImage: 'linear-gradient(45deg, rgba(255,255,255,.15) 25%, transparent 25%, transparent 50%, rgba(255,255,255,.15) 50%, rgba(255,255,255,.15) 75%, transparent 75%, transparent)', backgroundSize: '1rem 1rem' }} />
          </div>
        </div>

        {/* Replacement Trees List */}
        {debt.replacement_trees?.length > 0 && (
          <div className="space-y-4">
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Replacement Inventory</p>
             <div className="flex flex-wrap gap-3">
                {debt.replacement_trees.map((rt) => (
                  <div key={rt.id} className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
                    <Leaf className="w-3 h-3 text-emerald-500" />
                    <span className="text-[10px] font-mono font-black text-slate-700">{rt.tree_id}</span>
                  </div>
                ))}
             </div>
          </div>
        )}

        {/* Action Bar */}
        <div className="pt-8 border-t border-slate-50 flex flex-col sm:flex-row items-center justify-between gap-6">
           <div className="flex items-center gap-6">
              <ImpactStat icon={Wind} label="CO2 Restored" value={`${Math.round(debt.environmental_loss?.co2_lost_kg || 0)}kg`} color="sky" />
              <div className="w-px h-8 bg-slate-100" />
              <ImpactStat icon={Droplets} label="O2 Restored" value={`${Math.round(debt.environmental_loss?.oxygen_lost_kg || 0)}kg`} color="emerald" />
           </div>

           <div className="flex items-center gap-4 w-full sm:w-auto">
              {isCleared ? (
                <Button 
                  onClick={onViewCert}
                  className="w-full sm:w-auto h-14 px-10 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-emerald-900/10 flex items-center gap-2"
                >
                  <FileCheck className="w-4 h-4" />
                  View Certificate
                </Button>
              ) : (
                <>
                  <Button 
                    variant="outline"
                    onClick={onLink}
                    className="flex-1 sm:flex-none h-14 px-8 border-slate-200 text-slate-600 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2"
                  >
                    <LinkIcon className="w-4 h-4" />
                    Link Existing
                  </Button>
                  <Button 
                    onClick={onPlant}
                    className="flex-1 sm:flex-none h-14 px-10 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-slate-900/20 flex items-center gap-2"
                  >
                    <Sprout className="w-4 h-4" />
                    Plant New
                  </Button>
                </>
              )}
           </div>
        </div>
      </div>
    </motion.div>
  );
};

const ImpactStat = ({ icon: Icon, label, value, color }) => (
  <div className="flex items-center gap-3">
    <div className={`p-2 bg-${color}-50 rounded-lg text-${color}-600`}>
      <Icon className="w-4 h-4" />
    </div>
    <div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{label}</p>
      <p className="text-sm font-black text-slate-900 leading-none">{value}</p>
    </div>
  </div>
);

