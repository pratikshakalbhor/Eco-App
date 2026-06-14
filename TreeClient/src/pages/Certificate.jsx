import React, { useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { 
  ShieldCheck, Award, Download, Share2, 
  ChevronLeft, TreePine, MapPin, Calendar,
  Leaf, Wind, Activity, CheckCircle2, Globe
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

export default function Certificate() {
  const { id } = useParams();
  const navigate = useNavigate();
  const certRef = useRef(null);

  const { data: cert, isLoading, isError } = useQuery({
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

  if (isError || !cert) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
            <h1 className="text-2xl font-black text-slate-900">Certificate Not Found</h1>
            <Button onClick={() => navigate('/debt')} className="mt-4">Back to Debts</Button>
        </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F3F7F5] py-12 px-6 lg:px-12">
      <div className="max-w-5xl mx-auto space-y-8">
        
        <button 
          onClick={() => navigate('/debt')}
          className="flex items-center gap-2 text-slate-500 hover:text-emerald-600 transition-colors font-black uppercase text-[10px] tracking-widest"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Obligations
        </button>

        <div className="grid lg:grid-cols-4 gap-8">
          {/* Certificate Display */}
          <div className="lg:col-span-3">
             <motion.div 
               initial={{ opacity: 0, y: 30 }}
               animate={{ opacity: 1, y: 0 }}
               ref={certRef}
               className="bg-white rounded-[3rem] p-16 shadow-2xl relative overflow-hidden border-[12px] border-emerald-50"
             >
                {/* Decorative Elements */}
                <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
                  <Globe className="w-96 h-96" />
                </div>
                <div className="absolute top-0 left-0 w-32 h-32 bg-emerald-500/5 rounded-br-full" />
                <div className="absolute bottom-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-tl-full" />

                {/* Content */}
                <div className="relative z-10 space-y-12 text-center">
                   <div className="flex flex-col items-center gap-4">
                      <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 shadow-inner">
                        <ShieldCheck className="w-12 h-12" />
                      </div>
                      <div>
                        <h2 className="text-emerald-600 text-sm font-black uppercase tracking-[0.4em] mb-1">EcoChain Protocol</h2>
                        <h1 className="text-4xl font-black text-slate-900 tracking-tight italic text-emerald-900 mb-2">Restoration Certificate</h1>
                        <p className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">Certificate ID: {cert.certificate_id} </p>
                      </div>
                   </div>

                   <div className="h-px w-32 bg-slate-100 mx-auto" />

                   <div className="space-y-6 max-w-2xl mx-auto">
                      <p className="text-xl font-medium text-slate-600 leading-relaxed">
                         This document officially certifies that the environmental obligation incurred by the removal of biological asset 
                         <strong className="text-slate-900 px-2">#{cert.original_tree.id} ({cert.original_tree.species})</strong> 
                         has been fully resolved and neutralized.
                      </p>
                      <p className="text-xl font-medium text-slate-600 leading-relaxed">
                         Issued to wallet address:
                         <span className="block mt-4 font-mono font-black text-2xl text-emerald-700 bg-emerald-50 py-3 rounded-2xl border border-emerald-100">{cert.issued_to}</span>
                      </p>
                   </div>

                   <div className="grid grid-cols-3 gap-8 py-10">
                      <div className="text-center">
                         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">CO₂ Restoration</p>
                         <p className="text-3xl font-black text-slate-900 tracking-tight">{cert.co2_restored_kg}kg</p>
                      </div>
                      <div className="text-center">
                         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Replacements</p>
                         <p className="text-3xl font-black text-slate-900 tracking-tight">{cert.replacement_trees.length} Trees</p>
                      </div>
                      <div className="text-center">
                         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Resolution Date</p>
                         <p className="text-3xl font-black text-slate-900 tracking-tight">{new Date(cert.cleared_date).toLocaleDateString()}</p>
                      </div>
                   </div>

                   <div className="bg-slate-50 p-8 rounded-3xl space-y-4 text-left border border-slate-100">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        Verified Replacement Assets:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {cert.replacement_trees.map(id => (
                          <Badge key={id} variant="outline" className="bg-white border-slate-200 text-slate-600 font-mono font-bold text-[10px] py-1 px-3">
                            {id}
                          </Badge>
                        ))}
                      </div>
                   </div>

                   <div className="pt-12 flex justify-between items-end border-t border-slate-50">
                      <div className="text-left">
                        <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">Blockchain Hash</p>
                        <p className="text-[10px] font-mono font-bold text-emerald-600">0x8a7f...d9e1</p>
                      </div>
                      <div className="text-center">
                         <div className="w-16 h-16 bg-slate-900 rounded-2xl mx-auto flex items-center justify-center text-white mb-2">
                           <Award className="w-8 h-8" />
                         </div>
                         <p className="text-[9px] font-black text-slate-900 uppercase tracking-widest leading-none">Official Seal</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">Issue Date</p>
                        <p className="text-[10px] font-mono font-bold text-slate-600">{new Date(cert.issued_at).toLocaleDateString()}</p>
                      </div>
                   </div>
                </div>
             </motion.div>
          </div>

          {/* Action Sidebar */}
          <div className="space-y-6">
             <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm space-y-6">
                <h3 className="text-lg font-black text-slate-900 tracking-tight">Certification Actions</h3>
                <Button className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center gap-2">
                   <Download className="w-4 h-4" />
                   Download PDF
                </Button>
                <Button variant="outline" className="w-full h-12 border-slate-200 text-slate-600 rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center gap-2">
                   <Share2 className="w-4 h-4" />
                   Share on Social
                </Button>
             </div>

             <div className="bg-emerald-900 rounded-[2rem] p-8 text-white relative overflow-hidden">
                <Wind className="absolute -bottom-4 -right-4 w-24 h-24 opacity-10" />
                <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em] mb-4">Integrity Restored</h4>
                <p className="text-sm font-medium leading-relaxed">
                   By resolving this debt, your sustainability score has been restored to 100% and your carbon credits are now unfrozen for trading.
                </p>
             </div>
          </div>
        </div>

      </div>
    </div>
  );
}
