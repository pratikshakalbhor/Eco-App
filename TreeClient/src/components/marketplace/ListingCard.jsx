import React from 'react';
import { motion } from 'framer-motion';
import { TreePine, User, ArrowUpRight, Leaf, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

export default function ListingCard({ listing, onBuy, isOwnListing }) {
  const availableCredits = listing.credits_total - listing.credits_sold;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-emerald-900/5 transition-all group relative overflow-hidden ${isOwnListing ? 'ring-2 ring-emerald-500/20' : ''}`}
    >
      {isOwnListing && (
        <div className="absolute top-0 right-0 bg-emerald-500 text-white px-6 py-1.5 rounded-bl-3xl text-[9px] font-black uppercase tracking-widest">
            Your Listing
        </div>
      )}

      <div className="space-y-6">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
              <TreePine className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase">{listing.species} Credits</h3>
              <div className="flex items-center gap-1.5 text-slate-400 mt-0.5">
                <User className="w-3 h-3" />
                <span className="text-[10px] font-mono leading-none">{listing.seller_wallet.slice(0, 6)}...{listing.seller_wallet.slice(-4)}</span>
              </div>
            </div>
          </div>
          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 px-4 py-1.5 rounded-xl uppercase text-[9px] font-black">
            Verified Tree
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
             <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Available</p>
             <p className="text-xl font-black text-slate-900 tabular-nums">{availableCredits.toFixed(3)} <span className="text-[10px] text-slate-400 uppercase">cr</span></p>
          </div>
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
             <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Price / Credit</p>
             <p className="text-xl font-black text-emerald-600 tabular-nums">₹{listing.price_per_credit}</p>
          </div>
        </div>

        <div className="pt-4 flex items-center justify-between border-t border-slate-50">
           <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Impact Rating</p>
              <div className="flex items-center gap-1">
                 {[...Array(5)].map((_, i) => (
                    <Leaf key={i} className={`w-3 h-3 ${i < 4 ? 'text-emerald-500 fill-emerald-500' : 'text-slate-200'}`} />
                 ))}
              </div>
           </div>
           
           <Button 
             onClick={() => onBuy(listing)}
             disabled={isOwnListing}
             className={`h-12 px-8 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center gap-2 transition-all shadow-xl ${
               isOwnListing 
               ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none' 
               : 'bg-slate-900 text-white hover:bg-emerald-600 shadow-slate-900/10'
             }`}
           >
             {isOwnListing ? 'Own Asset' : 'Purchase'}
             <ArrowUpRight className="w-4 h-4" />
           </Button>
        </div>
      </div>
    </motion.div>
  );
}
