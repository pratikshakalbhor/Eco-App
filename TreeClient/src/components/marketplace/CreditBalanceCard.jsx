import React from 'react';
import { motion } from 'framer-motion';
import { Wallet, Info, ArrowUpRight, TrendingUp, ShieldAlert, Sprout } from 'lucide-react';

export default function CreditBalanceCard({ balance }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-gradient-to-br from-emerald-900 via-emerald-800 to-slate-900 rounded-[3rem] p-10 text-white shadow-2xl relative overflow-hidden"
    >
      {/* Decorative Blur */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-400/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      
      <div className="relative z-10 flex flex-col md:flex-row justify-between gap-12">
        <div className="space-y-6">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-emerald-400/20 rounded-xl">
                <Wallet className="w-5 h-5 text-emerald-400" />
             </div>
             <span className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-400">Biological Asset Wallet</span>
          </div>
          
          <div>
            <div className="flex items-baseline gap-3">
              <h2 className="text-7xl font-black tracking-tighter tabular-nums">
                {balance?.available?.toFixed(3) || '0.000'}
              </h2>
              <span className="text-2xl font-black text-emerald-400 uppercase tracking-widest">ECO</span>
            </div>
            <p className="text-emerald-400/60 font-medium text-sm mt-1">Available for immediate trade or transfer</p>
          </div>

          <div className="flex gap-4 pt-4">
             <div className="bg-white/10 px-6 py-3 rounded-2xl flex items-center gap-3 backdrop-blur-md border border-white/10">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <div>
                   <p className="text-[9px] font-black uppercase tracking-widest text-emerald-400/60">Estimated Value</p>
                   <p className="text-sm font-black tabular-nums">₹{((balance?.available || 0) * 700).toLocaleString()}</p>
                </div>
             </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 w-full md:w-auto">
           <BalanceSubItem label="Earned" value={balance?.total_earned} icon={Sprout} />
           <BalanceSubItem label="Listed" value={balance?.currently_listed} icon={ArrowUpRight} highlight />
           <BalanceSubItem label="Bought" value={balance?.total_bought} icon={TrendingUp} />
           <BalanceSubItem label="Frozen" value={balance?.frozen} icon={ShieldAlert} danger />
        </div>
      </div>
    </motion.div>
  );
}

const BalanceSubItem = ({ label, value, icon: Icon, highlight, danger }) => (
    <div className={`p-6 rounded-[2rem] border transition-all ${
        highlight ? 'bg-emerald-500 text-white border-emerald-400 shadow-xl shadow-emerald-500/20' : 
        danger ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 
        'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
    }`}>
        <div className="flex justify-between items-start mb-3">
           <Icon className="w-5 h-5" />
           <Info className="w-3 h-3 opacity-40" />
        </div>
        <p className="text-[10px] font-black uppercase tracking-[0.15em] mb-1">{label}</p>
        <p className={`text-xl font-black tabular-nums ${highlight ? 'text-white' : 'text-white'}`}>
            {value?.toFixed(3) || '0.000'}
        </p>
    </div>
);
