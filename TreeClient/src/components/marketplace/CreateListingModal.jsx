import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, TreePine, Info, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import axios from 'axios';
import { useQuery } from '@tanstack/react-query';

export default function CreateListingModal({ onClose, onSuccess }) {
  const [selectedTree, setSelectedTree] = useState(null);
  const [amount, setAmount] = useState('');
  const [price, setPrice] = useState('700');
  const [duration, setDuration] = useState('14');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [step, setStep] = useState('input'); // input | success

  const { data: myTrees = [], isLoading: treesLoading } = useQuery({
    queryKey: ['my-verified-trees'],
    queryFn: async () => {
      const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/api/trees/my`);
      return data?.filter(t => t.status === 'VERIFIED' && t.credits_available > 0) || [];
    }
  });

  const subtotal = (parseFloat(amount) || 0) * (parseFloat(price) || 0);
  const fee = subtotal * 0.02;
  const earnings = subtotal - fee;

  const handleCreate = async () => {
    if (!selectedTree || !amount || !price) {
        setError("Please fill all fields correctly");
        return;
    }

    if (parseFloat(amount) > selectedTree.credits_available) {
        setError("Insufficient credits available");
        return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
        await axios.post(`${import.meta.env.VITE_API_URL}/api/marketplace/listings`, {
            tree_id: selectedTree.tree_id,
            credits_to_sell: parseFloat(amount),
            price_per_credit: parseFloat(price),
            duration_days: parseInt(duration)
        });
        setStep('success');
        setTimeout(() => onSuccess(), 2000);
    } catch (err) {
        setError(err.response?.data?.error || "Failed to create listing");
        setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden relative"
      >
        <button 
          onClick={onClose}
          className="absolute top-8 right-8 w-10 h-10 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-all z-10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-12">
            {step === 'success' ? (
                <div className="text-center py-12 space-y-6">
                    <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                        <CheckCircle2 className="w-12 h-12 text-emerald-600" />
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-3xl font-black text-slate-900 uppercase">Listing Active!</h2>
                        <p className="text-slate-500 font-medium">Your carbon credits are now available on the global marketplace.</p>
                    </div>
                </div>
            ) : (
                <div className="space-y-8">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <Plus className="w-4 h-4 text-emerald-600" />
                            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Global Asset Exchange</span>
                        </div>
                        <h2 className="text-4xl font-black text-slate-900 tracking-tight leading-none">List Your Credits</h2>
                    </div>

                    <div className="space-y-6">
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">1. Select Verified Biological Asset</label>
                            <div className="grid grid-cols-1 gap-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                                {treesLoading ? (
                                    <div className="h-20 flex items-center justify-center bg-slate-50 rounded-2xl">
                                        <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
                                    </div>
                                ) : myTrees.map(tree => (
                                    <button
                                        key={tree.id}
                                        onClick={() => setSelectedTree(tree)}
                                        className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${selectedTree?.id === tree.id ? 'border-emerald-500 bg-emerald-50/50' : 'border-slate-50 bg-slate-50 hover:border-slate-200'}`}
                                    >
                                        <div className="flex items-center gap-3 text-left">
                                            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-emerald-600 border border-slate-100">
                                                <TreePine className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <p className="text-xs font-black text-slate-900 uppercase">{tree.species}</p>
                                                <p className="text-[10px] font-mono text-slate-400 leading-none">{tree.tree_id}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs font-black text-slate-900">{tree.credits_available?.toFixed(3)}</p>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Available Credits</p>
                                        </div>
                                    </button>
                                ))}
                                {myTrees.length === 0 && !treesLoading && (
                                    <div className="bg-amber-50 p-6 rounded-2xl border border-amber-100 flex items-center gap-4">
                                        <AlertTriangle className="w-6 h-6 text-amber-600" />
                                        <p className="text-xs font-bold text-amber-700">No verified trees with available credits found. Start by verifying your planted trees.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">2. Sell Amount</label>
                                <div className="relative">
                                    <input 
                                        type="number"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        className="h-16 w-full px-6 bg-slate-50 rounded-2xl border-2 border-slate-50 focus:border-emerald-500 outline-none text-xl font-black tabular-nums transition-all"
                                        placeholder="0.00"
                                    />
                                    <span className="absolute right-6 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-300 uppercase tracking-widest">Credits</span>
                                </div>
                            </div>
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">3. Price / Credit (₹)</label>
                                <div className="relative">
                                    <input 
                                        type="number"
                                        value={price}
                                        onChange={(e) => setPrice(e.target.value)}
                                        className="h-16 w-full px-6 bg-slate-50 rounded-2xl border-2 border-slate-50 focus:border-emerald-500 outline-none text-xl font-black tabular-nums transition-all"
                                        placeholder="700"
                                    />
                                    <span className="absolute right-6 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-300 uppercase tracking-widest">INR</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-900 rounded-[2rem] p-8 text-white space-y-4">
                            <div className="flex justify-between items-center text-xs font-black uppercase tracking-widest opacity-60">
                                <span>Profit Projection</span>
                                <Info className="w-3 h-3" />
                            </div>
                            <div className="flex justify-between items-center tabular-nums">
                                <span className="opacity-60 text-xs font-bold uppercase">Estimated Gross</span>
                                <span className="text-xl font-black">₹{subtotal.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center tabular-nums text-emerald-400">
                                <span className="text-xs font-bold uppercase">Net After 2% Fee</span>
                                <div className="text-right">
                                    <span className="text-3xl font-black">₹{earnings.toLocaleString()}</span>
                                    <p className="text-[9px] font-bold opacity-60 uppercase tracking-widest mt-1">Direct to your wallet</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {error && (
                        <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-xs font-bold flex items-center gap-3">
                            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                            {error}
                        </div>
                    )}

                    <Button 
                        onClick={handleCreate}
                        disabled={isSubmitting || !selectedTree || !amount}
                        className="w-full h-16 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[11px] tracking-widest shadow-2xl shadow-emerald-900/20 disabled:opacity-50"
                    >
                        {isSubmitting ? (
                            <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                        ) : (
                            "Create Sell Listing"
                        )}
                    </Button>
                </div>
            )}
        </div>
      </motion.div>
    </div>
  );
}
