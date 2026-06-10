import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { 
  TreePine, MapPin, Calendar, Activity, 
  ShieldCheck, Clock, AlertCircle, ChevronLeft,
  Globe, Award, User, Tag, Wind, Leaf
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

const STATUS_CONFIG = {
  pending_verification: { label: 'In Verification Queue', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100', icon: Clock },
  verified: { label: 'Verified & Registered', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100', icon: ShieldCheck },
  rejected: { label: 'Rejected / Invalid', color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-100', icon: AlertCircle },
};

export default function TreeDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: tree, isLoading, isError } = useQuery({
    queryKey: ['tree', id],
    queryFn: async () => {
      const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/api/trees/${id}`);
      return data;
    },
  });

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Activity className="w-12 h-12 text-emerald-500 animate-pulse" />
    </div>
  );

  if (isError || !tree) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
            <AlertCircle className="w-16 h-16 text-rose-500 mx-auto mb-4" />
            <h1 className="text-2xl font-black text-slate-900">Asset Not Found</h1>
            <Button onClick={() => navigate('/mytrees')} className="mt-4">Back to Registry</Button>
        </div>
    </div>
  );

  const status = STATUS_CONFIG[tree.status] || STATUS_CONFIG.pending_verification;

  return (
    <div className="min-h-screen bg-[#F8FAF9] py-12 px-6 lg:px-12">
      <div className="max-w-6xl mx-auto space-y-8">
        
        <button 
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-slate-500 hover:text-emerald-600 transition-colors font-black uppercase text-[10px] tracking-widest"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Selection
        </button>

        <div className="grid lg:grid-cols-2 gap-12">
            {/* Image Section */}
            <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
            >
                <div className="relative rounded-[3rem] overflow-hidden shadow-2xl border-4 border-white aspect-[4/5]">
                    <img src={tree.image_url || '/placeholder-tree.jpg'} className="w-full h-full object-cover" alt={tree.species} />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-40" />
                </div>
                
                <div className="bg-white p-8 rounded-[2.5rem] border border-emerald-50 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Registration Status</p>
                        <div className={`flex items-center gap-2 ${status.color}`}>
                            <status.icon className="w-5 h-5" />
                            <span className="text-lg font-black">{status.label}</span>
                        </div>
                    </div>
                    {tree.status === 'verified' && (
                        <div className="bg-emerald-500 text-white p-3 rounded-2xl shadow-lg shadow-emerald-200">
                            <ShieldCheck className="w-6 h-6" />
                        </div>
                    )}
                </div>
            </motion.div>

            {/* Details Section */}
            <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-8"
            >
                <div>
                   <div className="flex items-center gap-3 mb-4">
                        <Badge className="bg-emerald-100 text-emerald-700 border-0 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest">
                            Biological Asset
                        </Badge>
                        <span className="text-[10px] font-mono font-bold text-slate-400">ID: {tree.tree_id}</span>
                   </div>
                   <h1 className="text-6xl font-black text-slate-900 tracking-tight leading-none mb-2">{tree.species}</h1>
                   <p className="text-2xl font-black text-emerald-600 italic">"{tree.nickname || 'Unnamed Heirloom'}"</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <InfoCard icon={MapPin} label="Location" value={tree.location} />
                    <InfoCard icon={Globe} label="Coordinates" value={`${parseFloat(tree.latitude).toFixed(6)}, ${parseFloat(tree.longitude).toFixed(6)}`} />
                    <InfoCard icon={Calendar} label="Date Planted" value={new Date(tree.planting_date).toLocaleDateString()} />
                    <InfoCard icon={Tag} label="Estimated Age" value={`${tree.age} Years`} />
                    <InfoCard icon={Activity} label="Health Status" value={tree.health_status} />
                    <InfoCard icon={User} label="Owner Wallet" value={tree.owner_wallet?.slice(0, 8) + '...' + tree.owner_wallet?.slice(-6)} />
                </div>

                <div className="bg-emerald-900 rounded-[3rem] p-10 text-white relative overflow-hidden shadow-2xl">
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                        <TreePine className="w-32 h-32" />
                    </div>
                    <h3 className="text-lg font-black uppercase tracking-widest mb-6 flex items-center gap-2">
                        <Award className="w-5 h-5 text-emerald-400" />
                        Environmental Metrics
                    </h3>
                    <div className="grid grid-cols-2 gap-8">
                        <div>
                            <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-2">Sequestration</p>
                            <div className="flex items-end gap-2">
                                <span className="text-4xl font-black tracking-tighter">21.8</span>
                                <span className="text-xs font-bold text-emerald-400 mb-1.5 uppercase">kg CO₂/y</span>
                            </div>
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-2">Oxygen Output</p>
                            <div className="flex items-end gap-2">
                                <span className="text-4xl font-black tracking-tighter">100.4</span>
                                <span className="text-xs font-bold text-emerald-400 mb-1.5 uppercase">kg O₂/y</span>
                            </div>
                        </div>
                    </div>
                    
                    <div className="mt-10 pt-10 border-t border-white/10">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">Carbon Credits</p>
                                <p className="text-2xl font-black">{tree.status === 'verified' ? '1.0 ECO' : 'Pending Verification'}</p>
                            </div>
                            <Wind className="w-10 h-10 text-emerald-400 opacity-40 animate-pulse" />
                        </div>
                    </div>
                </div>

                {tree.status === 'verified' && (
                    <div className="p-8 bg-white rounded-[2.5rem] border border-emerald-50 shadow-sm">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-emerald-600" />
                            Blockchain Evidence
                        </p>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-slate-500 font-bold">Transaction Hash</span>
                                <span className="font-mono text-emerald-600 font-black">{tree.tx_hash?.slice(0, 16)}...</span>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-slate-500 font-bold">Token ID</span>
                                <span className="font-mono text-emerald-600 font-black">#{tree.token_id || 'REGISTERED'}</span>
                            </div>
                        </div>
                    </div>
                )}
            </motion.div>
        </div>
      </div>
    </div>
  );
}

const InfoCard = ({ icon: Icon, label, value }) => (
    <div className="bg-white p-6 rounded-3xl border border-emerald-50 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
            <Icon className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
        </div>
        <p className="text-sm font-black text-slate-800 truncate">{value}</p>
    </div>
);
