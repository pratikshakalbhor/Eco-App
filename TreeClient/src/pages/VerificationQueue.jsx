import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { 
  Check, X, ShieldCheck, TreePine, 
  Calendar, MapPin, Activity, 
  Search, Filter, Globe, History, Users,
  Calculator, Zap, Layers, ChevronRight,
  ClipboardCheck, Clock, FileSearch, Trash2,
  Sprout, Ban, CheckCircle2, Award, ExternalLink, Axe, History
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { verifyTreeOnChain } from '../utils/web3Service';
import { motion, AnimatePresence } from 'framer-motion';

const AUDIT_STATUSES = [
  { id: 'PENDING_VERIFICATION',  label: 'Pending Queue',  icon: Clock,         color: 'amber' },
  { id: 'VERIFIED',              label: 'Verified Trees', icon: CheckCircle2,  color: 'emerald' },
  { id: 'REJECTED',              label: 'Rejected / Void', icon: Ban,           color: 'rose'    },
  { id: 'CUT_REPORTS',           label: 'Cut Reports',    icon: Axe,           color: 'orange'  },
];

export default function UnifiedVerificationHub() {
  const queryClient = useQueryClient();
  const [activeStatus, setActiveStatus] = useState('PENDING_VERIFICATION');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAsset, setSelectedAsset] = useState(null);

  // Fetch All Trees
  const { data: trees = [], isLoading: treesLoading } = useQuery({
    queryKey: ['verification-trees'],
    queryFn: async () => {
      const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/api/trees`); 
      return data;
    },
  });

  // Fetch Cut Reports
  const { data: cutReports = [], isLoading: reportsLoading } = useQuery({
    queryKey: ['cut-reports'],
    queryFn: async () => {
      const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/api/trees/cut-reports?status=PENDING`);
      return data;
    },
    enabled: activeStatus === 'CUT_REPORTS'
  });

  const verifyTreeMutation = useMutation({
    mutationFn: async ({ id, status, notes }) => {
      await axios.post(`${import.meta.env.VITE_API_URL}/api/trees/${id}/verify`, { status, notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['verification-trees']);
      setSelectedAsset(null);
    }
  });

  const confirmCutMutation = useMutation({
    mutationFn: async ({ treeId, approved }) => {
      const endpoint = approved ? 'confirm' : 'reject';
      await axios.post(`${import.meta.env.VITE_API_URL}/api/trees/${treeId}/cut/${endpoint}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['cut-reports']);
      queryClient.invalidateQueries(['verification-trees']);
      setSelectedAsset(null);
    }
  });

  const displayedItems = useMemo(() => {
    if (activeStatus === 'CUT_REPORTS') {
        return cutReports.filter(r => {
            const searchMatch = (r.tree_id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                                (r.owner_wallet || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                                (r.reason || '').toLowerCase().includes(searchTerm.toLowerCase());
            return searchMatch;
        });
    }

    return trees.filter(t => {
      const statusMatch = t.status === activeStatus;
      const searchMatch = (t.species || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (t.tree_id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (t.owner_wallet || '').toLowerCase().includes(searchTerm.toLowerCase());
      return statusMatch && searchMatch;
    });
  }, [activeStatus, trees, cutReports, searchTerm]);

  const getStatusBadge = (status) => {
    const config = {
      PENDING_VERIFICATION: 'bg-amber-100 text-amber-700 border-amber-200',
      VERIFIED: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      REJECTED: 'bg-rose-100 text-rose-700 border-rose-200',
      CUT_REPORTED: 'bg-orange-100 text-orange-700 border-orange-200',
      CUT_CONFIRMED: 'bg-rose-100 text-rose-700 border-rose-200',
    };
    return <Badge className={`uppercase text-[9px] font-black tracking-widest ${config[status] || config.PENDING_VERIFICATION}`}>{status.replace('_', ' ')}</Badge>;
  };

  if (treesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <Activity className="w-12 h-12 text-emerald-500 animate-pulse" />
          <p className="text-slate-500 font-black uppercase tracking-widest text-[10px]">Synchronizing Audit Protocol...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F3F8F5] py-12 px-8">
      <div className="max-w-[1600px] mx-auto space-y-10">

        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 bg-white p-10 rounded-[3rem] shadow-xl shadow-emerald-900/5 border border-emerald-50">
           <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 bg-emerald-100 rounded-xl">
                  <ShieldCheck className="w-5 h-5 text-emerald-700" />
                </div>
                <span className="text-[10px] font-black text-emerald-800 uppercase tracking-[0.2em]">Tree Lifecycle Verification</span>
              </div>
              <h1 className="text-5xl font-black text-slate-900 tracking-tight">Audit Queue</h1>
              <p className="text-slate-500 mt-2 text-lg max-w-2xl">Verify tree registrations to ensure biological integrity and secure carbon sequestration records.</p>
           </div>

           <div className="flex items-center gap-6">
              <AuditSummaryStat label="Pending" value={trees.filter(t=>t.status==='PENDING_VERIFICATION').length} icon={Clock} color="amber" />
              <div className="h-12 w-px bg-slate-100" />
              <AuditSummaryStat label="Verified" value={trees.filter(t=>t.status==='VERIFIED').length} icon={CheckCircle2} color="emerald" />
              <div className="h-12 w-px bg-slate-100" />
              <AuditSummaryStat label="Cut Queue" value={cutReports.length} icon={Axe} color="orange" />
           </div>
        </div>

        <div className="flex flex-col xl:flex-row items-center gap-6">
            <div className="flex items-center gap-1 bg-slate-100 p-1.5 rounded-[2rem] w-full xl:w-auto">
                {AUDIT_STATUSES.map(stat => (
                    <button
                        key={stat.id}
                        onClick={() => setActiveStatus(stat.id)}
                        className={`
                            flex items-center gap-2 px-6 py-2.5 rounded-[1.5rem] transition-all
                            ${activeStatus === stat.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}
                        `}
                    >
                        <stat.icon className={`w-3.5 h-3.5 text-${stat.color}-500`} />
                        <span className="text-[10px] font-black uppercase tracking-wider">{stat.label}</span>
                    </button>
                ))}
            </div>

            <div className="relative flex-1 w-full xl:w-auto">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input 
                    placeholder="Search by Tree ID, Species or Wallet..."
                    className="h-16 pl-14 bg-white border-transparent focus:bg-white focus:ring-2 focus:ring-emerald-500 rounded-[2rem] shadow-md shadow-emerald-900/5 text-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
        </div>

        <div className="bg-white rounded-[3rem] shadow-2xl shadow-emerald-900/5 overflow-hidden border border-emerald-50 min-h-[500px]">
            <Table>
                <TableHeader>
                    <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                        <TableHead className="py-8 pl-12 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Tree Record</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Species & Info</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Owner Wallet</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Metadata</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-right pr-12">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    <AnimatePresence mode="popLayout">
                        {displayedItems.map((item, i) => (
                            <motion.tr 
                                key={item.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.03 }}
                                className="group hover:bg-emerald-50/30 transition-all border-b border-slate-50 last:border-0"
                            >
                                 <TableCell className="py-6 pl-12">
                                    <div className="flex items-center gap-5">
                                        <div className="relative shrink-0">
                                            <img src={(activeStatus === 'CUT_REPORTS' ? item.evidence_image_url : item.image_url) || '/placeholder-tree.jpg'} className="w-16 h-16 rounded-2xl object-cover shadow-inner" />
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">ID / Ref</p>
                                            <p className="text-xs font-mono font-black text-slate-700">{item.tree_id || 'Pending'}</p>
                                            <div className="mt-1 flex items-center gap-2">
                                                {getStatusBadge(activeStatus === 'CUT_REPORTS' ? 'CUT_REPORTED' : item.status)}
                                            </div>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div>
                                        {activeStatus === 'CUT_REPORTS' ? (
                                            <>
                                                <p className="text-sm font-black text-slate-900 uppercase">Reason: {item.reason}</p>
                                                <div className="flex items-center gap-1.5 text-slate-400 mt-1">
                                                    <Calendar className="w-3 h-3" />
                                                    <span className="text-[10px] font-bold uppercase truncate max-w-[150px]">Cut: {new Date(item.cut_date).toLocaleDateString()}</span>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <p className="text-sm font-black text-slate-900 uppercase">{item.species}</p>
                                                <div className="flex items-center gap-1.5 text-slate-400 mt-1">
                                                    <MapPin className="w-3 h-3" />
                                                    <span className="text-[10px] font-bold uppercase truncate max-w-[150px]">{item.location}</span>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white text-[10px] font-black">
                                            {item.owner_wallet ? item.owner_wallet.slice(2, 4) : 'U'}
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-slate-400 font-mono tracking-tighter">{item.owner_wallet}</p>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="space-y-1.5">
                                        {activeStatus === 'CUT_REPORTS' ? (
                                            <div className="flex items-center gap-2">
                                                <History className="w-3 h-3 text-orange-500" />
                                                <span className="text-[10px] font-bold text-slate-600 uppercase italic">"{item.description || 'No description'}"</span>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="flex items-center gap-2">
                                                    <Calendar className="w-3 h-3 text-emerald-500" />
                                                    <span className="text-[10px] font-bold text-slate-600 uppercase">Planted: <strong>{new Date(item.planting_date).toLocaleDateString()}</strong></span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Activity className="w-3 h-3 text-sky-400" />
                                                    <span className="text-[10px] font-bold text-slate-600 uppercase">Health: <strong>{item.health_status}</strong></span>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell className="pr-12 text-right">
                                    <div className="flex items-center justify-end gap-3">
                                        <Button 
                                            size="sm" 
                                            variant="outline" 
                                            className="h-10 px-5 rounded-xl border-slate-200 text-slate-600 text-[10px] font-black uppercase hover:bg-slate-50 transition-all gap-2"
                                            onClick={() => setSelectedAsset(activeStatus === 'CUT_REPORTS' ? { ...item.tree, cut_report: item } : item)}
                                        >
                                            <FileSearch className="w-4 h-4" />
                                            Details
                                        </Button>
                                        
                                        {activeStatus === 'PENDING_VERIFICATION' && (
                                            <div className="flex gap-2">
                                                <button 
                                                    onClick={() => verifyTreeMutation.mutate({id: item.id, status: 'VERIFIED'})}
                                                    className="w-10 h-10 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                                                    title="Approve"
                                                >
                                                    <Check className="w-5 h-5" />
                                                </button>
                                                <button 
                                                    onClick={() => verifyTreeMutation.mutate({id: item.id, status: 'REJECTED'})}
                                                    className="w-10 h-10 bg-rose-100 text-rose-700 rounded-xl flex items-center justify-center hover:bg-rose-600 hover:text-white transition-all shadow-sm"
                                                    title="Reject"
                                                >
                                                    <X className="w-5 h-5" />
                                                </button>
                                            </div>
                                        )}

                                        {activeStatus === 'CUT_REPORTS' && (
                                            <div className="flex gap-2">
                                                <button 
                                                    onClick={() => confirmCutMutation.mutate({treeId: item.tree_id, approved: true})}
                                                    className="w-10 h-10 bg-orange-100 text-orange-700 rounded-xl flex items-center justify-center hover:bg-orange-600 hover:text-white transition-all shadow-sm"
                                                    title="Confirm Cut"
                                                >
                                                    <Check className="w-5 h-5" />
                                                </button>
                                                <button 
                                                    onClick={() => confirmCutMutation.mutate({treeId: item.tree_id, approved: false})}
                                                    className="w-10 h-10 bg-slate-100 text-slate-700 rounded-xl flex items-center justify-center hover:bg-slate-600 hover:text-white transition-all shadow-sm"
                                                    title="Reject Report"
                                                >
                                                    <XCircle className="w-5 h-5" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </TableCell>
                            </motion.tr>
                        ))}
                    </AnimatePresence>

                    {displayedItems.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={5} className="py-40 text-center">
                                <div className="flex flex-col items-center gap-6 opacity-30">
                                    <ClipboardCheck className="w-20 h-20 text-slate-300" />
                                    <div>
                                        <p className="text-xl font-black text-slate-800 uppercase tracking-widest">Registry Clear</p>
                                        <p className="text-sm font-bold text-slate-500 uppercase mt-1">No trees found in this status</p>
                                    </div>
                                </div>
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>

        {/* ── Asset Evidence Modal ─────────────────────────── */}
        <AnimatePresence>
          {selectedAsset && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4"
              onClick={() => setSelectedAsset(null)}
            >
              <motion.div 
                initial={{ scale: 0.9, y: 30 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-white rounded-[3rem] w-full max-w-5xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col border border-emerald-50"
                onClick={e => e.stopPropagation()}
              >
                 <div className="flex-1 overflow-y-auto">
                    <div className="relative h-48 bg-[#0a2e1e] overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-emerald-900/80 to-transparent z-10" />
                        <div className="relative z-20 p-12 flex items-end justify-between h-full">
                            <div>
                                <Badge className="bg-emerald-500 text-white border-0 mb-3 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest">Verification Audit</Badge>
                                <h2 className="text-4xl font-black text-white capitalize">{selectedAsset.species}</h2>
                                <p className="text-emerald-400 font-mono text-xs mt-1">Registry Ref: {selectedAsset.tree_id}</p>
                            </div>
                            <button onClick={() => setSelectedAsset(null)} className="p-4 bg-white/10 backdrop-blur-md rounded-2xl text-white hover:bg-white hover:text-emerald-900 transition-all border border-white/20">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                    </div>

                    <div className="p-12">
                        <div className="grid lg:grid-cols-5 gap-12">
                            <div className="lg:col-span-2 space-y-8">
                                <div className="relative rounded-[2.5rem] overflow-hidden shadow-2xl group border-4 border-white">
                                    <img src={(selectedAsset.cut_report ? selectedAsset.cut_report.evidence_image_url : selectedAsset.image_url) || '/placeholder-tree.jpg'} className="w-full aspect-[4/5] object-cover" />
                                    {selectedAsset.cut_report && (
                                        <div className="absolute top-4 right-4 bg-orange-600 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl">
                                            Cut Evidence
                                        </div>
                                    )}
                                </div>
                                {selectedAsset.cut_report && (
                                    <div className="relative rounded-[2rem] overflow-hidden shadow-lg group border-2 border-slate-100 opacity-80">
                                        <img src={selectedAsset.image_url || '/placeholder-tree.jpg'} className="w-full aspect-video object-cover" />
                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                            <p className="text-white text-[10px] font-black uppercase tracking-widest">Original Record</p>
                                        </div>
                                    </div>
                                )}
                                <div className="mt-6 p-6 bg-slate-50 rounded-3xl border border-slate-100 flex items-center gap-4">
                                    <Globe className="w-10 h-10 text-emerald-600 shrink-0" />
                                    <div className="min-w-0">
                                        <p className="text-[9px] font-black text-slate-400 uppercase mb-1">IPFS CID</p>
                                        <p className="text-[10px] font-mono text-slate-500 truncate">{selectedAsset.ipfs_hash || 'Pending'}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="lg:col-span-3 space-y-10">
                                <div className="grid grid-cols-2 gap-6">
                                    <DetailBox label="Species" value={selectedAsset.species} icon={TreePine} />
                                    <DetailBox label="Nickname" value={selectedAsset.nickname || 'N/A'} icon={Award} />
                                    <DetailBox label="Location" value={selectedAsset.location} icon={MapPin} />
                                    <DetailBox label="Coordinates" value={`${selectedAsset.latitude}, ${selectedAsset.longitude}`} icon={Globe} />
                                    <DetailBox label="Planting Date" value={new Date(selectedAsset.planting_date).toLocaleDateString()} icon={Calendar} />
                                    <DetailBox label="Estimated Age" value={`${selectedAsset.age} Years`} icon={Clock} />
                                    <DetailBox label="Health Status" value={selectedAsset.health_status} icon={Activity} />
                                    <DetailBox label="Owner Wallet" value={selectedAsset.owner_wallet?.slice(0, 10) + '...'} icon={Users} />
                                </div>

                                {selectedAsset.status === 'PENDING_VERIFICATION' && (
                                    <div className="pt-10 border-t border-slate-100 flex flex-col sm:flex-row gap-4">
                                        <Button 
                                            onClick={() => verifyTreeMutation.mutate({id: selectedAsset.id, status: 'VERIFIED'})}
                                            className="flex-1 h-16 bg-emerald-600 hover:bg-emerald-700 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-emerald-200"
                                        >
                                            Approve Asset
                                        </Button>
                                        <Button 
                                            variant="destructive"
                                            className="flex-1 h-16 rounded-2xl text-[10px] font-black uppercase tracking-[0.1em] shadow-xl shadow-rose-200"
                                            onClick={() => verifyTreeMutation.mutate({id: selectedAsset.id, status: 'REJECTED'})}
                                        >
                                            Reject Asset
                                        </Button>
                                    </div>
                                )}

                                {selectedAsset.cut_report && selectedAsset.cut_report.status === 'PENDING' && (
                                    <div className="pt-10 border-t border-slate-100 flex flex-col sm:flex-row gap-4">
                                        <Button 
                                            onClick={() => confirmCutMutation.mutate({treeId: selectedAsset.tree_id, approved: true})}
                                            className="flex-1 h-16 bg-orange-600 hover:bg-orange-700 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-orange-200"
                                        >
                                            Confirm Cut
                                        </Button>
                                        <Button 
                                            variant="outline"
                                            className="flex-1 h-16 rounded-2xl text-[10px] font-black uppercase tracking-[0.1em] border-slate-200"
                                            onClick={() => confirmCutMutation.mutate({treeId: selectedAsset.tree_id, approved: false})}
                                        >
                                            Reject Report
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                 </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}

const AuditSummaryStat = ({ label, value, icon: Icon, color }) => (
    <div className="flex items-center gap-4">
        <div className={`p-3 bg-${color}-50 rounded-2xl`}>
            <Icon className={`w-5 h-5 text-${color}-600`} />
        </div>
        <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{label}</p>
            <p className="text-xl font-black text-slate-800 tabular-nums leading-none">{value}</p>
        </div>
    </div>
);

const DetailBox = ({ label, value, icon: Icon }) => (
    <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
        <div className="flex items-center gap-2 mb-2">
            <Icon className="w-3.5 h-3.5 text-emerald-600" />
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
        </div>
        <p className="text-sm font-black text-slate-800 truncate">{value}</p>
    </div>
);
