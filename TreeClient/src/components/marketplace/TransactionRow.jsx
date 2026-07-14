import React from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight, ArrowDownLeft, ExternalLink, Globe, Activity } from 'lucide-react';

export default function TransactionRow({ tx, wallet, delay }) {
  const isBuyer = tx.buyer_wallet.toLowerCase() === wallet.toLowerCase();
  
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
      className="flex flex-col md:flex-row md:items-center justify-between p-6 bg-white border border-slate-100 rounded-3xl hover:border-emerald-200 hover:shadow-xl hover:shadow-emerald-900/5 transition-all group"
    >
      <div className="flex items-center gap-6">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isBuyer ? 'bg-sky-50 text-sky-600' : 'bg-emerald-50 text-emerald-600'}`}>
          {isBuyer ? <ArrowDownLeft className="w-6 h-6" /> : <ArrowUpRight className="w-6 h-6" />}
        </div>
        <div>
          <div className="flex items-center gap-3">
             <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                {isBuyer ? 'Purchased Credits' : 'Sold Credits'}
             </h4>
             <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${isBuyer ? 'bg-sky-100 text-sky-700' : 'bg-emerald-100 text-emerald-700'}`}>
                {tx.credits_amount.toFixed(3)} cr
             </span>
          </div>
          <div className="flex items-center gap-1.5 mt-1 text-slate-400">
             <Activity className="w-3 h-3" />
             <span className="text-[10px] font-mono leading-none">
                {isBuyer ? `From ${tx.seller_wallet.slice(0, 10)}...` : `To ${tx.buyer_wallet.slice(0, 10)}...`}
             </span>
             <span className="text-slate-200">|</span>
             <span className="text-[10px] font-black uppercase tracking-widest">{new Date(tx.created_at).toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-8 mt-4 md:mt-0 pt-4 md:pt-0 border-t md:border-0 border-slate-50">
        <div className="text-right">
           <p className={`text-lg font-black tabular-nums ${isBuyer ? 'text-rose-600' : 'text-emerald-600'}`}>
              {isBuyer ? '-' : '+'}₹{isBuyer ? tx.total_inr.toLocaleString() : tx.seller_received_inr.toLocaleString()}
           </p>
           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              {isBuyer ? `Incl. ₹${tx.platform_fee_inr} Fee` : `Net Earnings`}
           </p>
        </div>
        
        <a 
          href={`https://sepolia.etherscan.io/tx/${tx.tx_hash}`} 
          target="_blank" 
          rel="noopener noreferrer"
          className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 hover:bg-slate-900 hover:text-white transition-all group/link"
        >
          <ExternalLink className="w-5 h-5" />
        </a>
      </div>
    </motion.div>
  );
}
