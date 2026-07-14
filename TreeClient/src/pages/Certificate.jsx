import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { 
  ShieldCheck, Leaf, Wind, Droplets, 
  Download, Share2, ChevronLeft, Globe,
  Shield, Award, Activity, Calendar,
  TreePine, FileCheck
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';

export default function Certificate() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: cert, isLoading } = useQuery({
    queryKey: ['certificate', id],
    queryFn: async () => {
      const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/api/debt/${id}/certificate`);
      return data;
    }
  });

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Activity className="w-12 h-12 text-emerald-500 animate-pulse" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F3F8F5] py-20 px-8 flex flex-col items-center">
      <div className="max-w-4xl w-full">
        
        <button 
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-slate-500 hover:text-emerald-700 transition-colors font-black uppercase text-[10px] tracking-widest mb-12"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Debt Overview
        </button>

        <motion.div 
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-[4rem] shadow-2xl shadow-emerald-900/10 border border-emerald-50 overflow-hidden relative"
        >
          {/* Decorative Corner */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-bl-[10rem] -z-0" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/5 rounded-tr-[10rem] -z-0" />

          {/* Certificate Content */}
          <div className="relative z-10 p-16 md:p-24 flex flex-col items-center text-center space-y-12">
            
            <div className="flex flex-col items-center gap-6">
                <div className="relative">
                    <div className="w-32 h-32 bg-emerald-100 rounded-full flex items-center justify-center">
                        <FileCheck className="w-16 h-16 text-emerald-600" />
                    </div>
                    <motion.div 
                        animate={{ rotate: 360 }}
                        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                        className="absolute -inset-4 border-2 border-dashed border-emerald-200 rounded-full"
                    />
                </div>
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight uppercase leading-none">Restoration Certificate</h1>
                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.4em] mt-4">Verified Ecological Integrity Protocol</p>
                </div>
            </div>

            <div className="w-full max-w-2xl space-y-10">
                <div className="space-y-4">
                    <p className="text-slate-400 font-bold uppercase text-[11px] tracking-widest">Document Registry ID</p>
                    <p className="text-2xl font-mono font-black text-slate-700 bg-slate-50 py-4 px-8 rounded-2xl border border-slate-100 inline-block">{cert.certificate_id}</p>
                </div>

                <div className="space-y-6">
                    <p className="text-xl text-slate-600 font-medium leading-relaxed">
                        This document certifies that the environmental obligation incurred by <br />
                        the removal of <strong>{cert.original_tree.species}</strong> (ID: {cert.original_tree.id}) <br />
                        at <strong>{cert.original_tree.location}</strong> has been officially resolved.
                    </p>
                </div>

                <div className="grid grid-cols-2 gap-8 py-10 border-y border-slate-100">
                    <div className="text-left">
                        <p className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Original Cut Date</p>
                        <p className="text-lg font-black text-slate-800">{new Date(cert.cut_date).toLocaleDateString()}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Restoration Unified</p>
                        <p className="text-lg font-black text-emerald-600">{new Date(cert.cleared_date).toLocaleDateString()}</p>
                    </div>
                </div>

                <div className="py-6">
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-6 tracking-widest">Replacement Asset Inventory</p>
                    <div className="flex flex-wrap justify-center gap-3">
                        {cert.replacement_trees.map(treeId => (
                            <Badge key={treeId} className="bg-emerald-50 text-emerald-700 border-emerald-100 px-4 py-2 rounded-xl text-[10px] font-black font-mono">
                                {treeId}
                            </Badge>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                    <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex items-center gap-4">
                        <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-white">
                            <Wind className="w-6 h-6" />
                        </div>
                        <div className="text-left">
                            <p className="text-[10px] font-black text-slate-400 uppercase">CO₂ Restored</p>
                            <p className="text-xl font-black text-slate-900">{cert.co2_restored_kg} kg</p>
                        </div>
                    </div>
                    <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex items-center gap-4">
                        <div className="w-12 h-12 bg-sky-500 rounded-2xl flex items-center justify-center text-white">
                            <Droplets className="w-6 h-6" />
                        </div>
                        <div className="text-left">
                            <p className="text-[10px] font-black text-slate-400 uppercase">Credits Restored</p>
                            <p className="text-xl font-black text-slate-900">{cert.credits_restored} ECO</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="pt-12 flex flex-col items-center gap-8">
                <div className="flex items-center gap-4 bg-emerald-900 text-white px-10 py-5 rounded-[2rem] shadow-2xl">
                    <Globe className="w-10 h-10 text-emerald-400" />
                    <div className="text-left border-l border-white/20 pl-4">
                        <p className="text-[9px] font-black uppercase text-emerald-400 leading-none mb-1">Blockchain Hash</p>
                        <p className="text-[10px] font-mono opacity-60 break-all w-60">Verified on Ethereum Sepolia Node Cluster...</p>
                    </div>
                </div>

                <div className="flex gap-4">
                    <Button className="h-14 px-10 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] tracking-widest gap-2 flex shadow-xl shadow-emerald-200">
                        <Download className="w-4 h-4" />
                        Download PDF
                    </Button>
                    <Button variant="outline" className="h-14 px-10 rounded-2xl border-slate-200 text-slate-600 font-black uppercase text-[10px] tracking-widest gap-2 flex hover:bg-slate-50 transition-all">
                        <Share2 className="w-4 h-4" />
                        Share Social
                    </Button>
                </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
