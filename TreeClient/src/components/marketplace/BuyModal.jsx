import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, CreditCard, ShieldCheck, Zap, 
  Activity, Info, AlertCircle, CheckCircle2 
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { fetchEthInrRate, payWithMetaMask } from '@/utils/payment';
import axios from 'axios';

export default function BuyModal({ listing, onClose, onSuccess }) {
  const [amount, setAmount] = useState('');
  const [ethRate, setEthRate] = useState(0);
  const [isPaying, setIsPaying] = useState(false);
  const [error, setError] = useState(null);
  const [step, setStep] = useState('input'); // input | paying | success

  const available = listing.credits_total - listing.credits_sold;
  const subtotal = (parseFloat(amount) || 0) * listing.price_per_credit;
  const fee = subtotal * 0.02;
  const total = subtotal + fee;

  useEffect(() => {
    fetchEthInrRate().then(setEthRate);
  }, []);

  const ethEquivalent = ethRate ? (total / ethRate).toFixed(8) : '...';

  const handleBuy = async () => {
    if (!amount || parseFloat(amount) <= 0 || parseFloat(amount) > available) {
        setError("Invalid credit amount");
        return;
    }

    setIsPaying(true);
    setError(null);
    setStep('paying');

    try {
        const paymentResult = await payWithMetaMask(import.meta.env.VITE_PLATFORM_WALLET, total);
        
        await axios.post(`${import.meta.env.VITE_API_URL}/api/marketplace/buy`, {
            listing_id: listing.id,
            amount_to_buy: parseFloat(amount),
            tx_hash: paymentResult.txHash,
            eth_amount: parseFloat(paymentResult.ethAmount),
            eth_rate_at_time: paymentResult.ethRate
        });

        setStep('success');
        setTimeout(() => onSuccess(), 2000);
    } catch (err) {
        console.error(err);
        setError(err.message || "Payment failed");
        setIsPaying(false);
        setStep('input');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white w-full max-w-xl rounded-[3rem] shadow-2xl overflow-hidden relative"
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
                        <h2 className="text-3xl font-black text-slate-900">Purchase Successful!</h2>
                        <p className="text-slate-500 font-medium">Your credits are being transferred to your wallet.</p>
                    </div>
                </div>
            ) : (
                <div className="space-y-10">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <CreditCard className="w-4 h-4 text-emerald-600" />
                            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Verify & Purchase</span>
                        </div>
                        <h2 className="text-4xl font-black text-slate-900 tracking-tight">Buy Carbon Credits</h2>
                        <p className="text-slate-400 font-medium text-sm mt-1">Listing: <span className="text-slate-700 font-bold">{listing.species} Tree Credits</span></p>
                    </div>

                    <div className="space-y-6">
                        <div className="space-y-3">
                            <div className="flex justify-between items-end">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Enter Amount (Credits)</label>
                                <span className="text-[10px] font-bold text-emerald-600 uppercase">Max: {available.toFixed(3)}</span>
                            </div>
                            <div className="relative">
                                <input 
                                    type="number"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    placeholder="0.000"
                                    className="w-full h-20 px-8 bg-slate-50 rounded-3xl border-2 border-slate-50 focus:border-emerald-500 focus:bg-white text-3xl font-black tabular-nums transition-all outline-none"
                                />
                                <div className="absolute right-8 top-1/2 -translate-y-1/2 text-slate-300 font-black uppercase text-xs tracking-widest">ECO</div>
                            </div>
                        </div>

                        <div className="bg-slate-50 rounded-[2rem] p-8 space-y-5 border border-slate-100">
                            <div className="flex justify-between items-center tabular-nums">
                                <span className="text-xs font-bold text-slate-500 uppercase">Subtotal</span>
                                <span className="text-lg font-black text-slate-900">₹{subtotal.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center tabular-nums">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-bold text-slate-500 uppercase">Platform Fee</span>
                                    <Info className="w-3 h-3 text-slate-300" />
                                </div>
                                <span className="text-lg font-black text-slate-900">₹{fee.toFixed(2)}</span>
                            </div>
                            <div className="h-px bg-slate-200" />
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-black text-emerald-600 uppercase">Total to Pay</span>
                                <div className="text-right">
                                    <p className="text-3xl font-black text-slate-900 tabular-nums leading-none">₹{total.toLocaleString()}</p>
                                    <p className="text-xs font-bold text-slate-400 mt-2 uppercase tracking-tight">≈ {ethEquivalent} ETH</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {error && (
                        <motion.div 
                            initial={{ opacity: 0, x: -10 }} 
                            animate={{ opacity: 1, x: 0 }}
                            className="bg-rose-50 p-4 rounded-2xl flex items-center gap-3 border border-rose-100"
                        >
                            <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
                            <p className="text-xs font-bold text-rose-600">{error}</p>
                        </motion.div>
                    )}

                    <div className="pt-2">
                        <Button 
                            onClick={handleBuy}
                            disabled={isPaying || !amount}
                            className="w-full h-16 rounded-2xl bg-slate-900 hover:bg-emerald-600 text-white font-black uppercase text-[11px] tracking-widest shadow-2xl shadow-slate-900/20 gap-3 flex items-center transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isPaying ? (
                                <>
                                    <Activity className="w-5 h-5 animate-spin" />
                                    Confirming MetaMask...
                                </>
                            ) : (
                                <>
                                    <Zap className="w-5 h-5" />
                                    Complete Purchase
                                </>
                            )}
                        </Button>
                        <p className="text-center text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-6 flex items-center justify-center gap-2">
                            <ShieldCheck className="w-3 h-3" />
                            Secured by MetaMask · Platform Ledger Sync Enabled
                        </p>
                    </div>
                </div>
            )}
        </div>
      </motion.div>
    </div>
  );
}
