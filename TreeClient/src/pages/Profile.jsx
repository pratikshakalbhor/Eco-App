import React, { useState, useEffect } from "react";
import { 
    Award, Shield, Leaf, Calendar, Wallet as WalletIcon, 
    User as UserIcon, TrendingUp, TrendingDown, Scissors,
    RefreshCcw, ShieldAlert, FileText, Download, Activity, AlertTriangle, Zap, ArrowUpRight
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Badge } from "@/components/ui/Badge";
import { motion } from "framer-motion";
import { 
    getEcoTokenBalance, 
    getCarbonCreditBalance, 
    getEcoTreeBalance, 
    isSepoliaNetwork, 
    switchToSepolia,
    CONTRACT_ADDRESSES
} from "../utils/web3Service";
import { Button } from "@/components/ui/Button";
import CreditBalanceCard from '@/components/marketplace/CreditBalanceCard';

const ImpactMetric = ({ label, value, subLabel, icon: Icon, color }) => (
    <div className="bg-slate-50/50 border border-slate-100 p-6 rounded-3xl group hover:bg-white hover:shadow-xl transition-all duration-500">
        <div className={`w-12 h-12 rounded-2xl bg-${color}-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
            <Icon className={`w-6 h-6 text-${color}-600`} />
        </div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
        <p className="text-3xl font-black text-slate-800">{value}</p>
        <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">{subLabel}</p>
    </div>
);

const Profile = () => {
  const { user } = useAuth();
  const [onSepolia, setOnSepolia] = useState(true);
  const [web3Data, setWeb3Data] = useState({ 
    ecoBalance: "0.00", 
    carbonBalance: "0.00", 
    nftCount: "0" 
  });

  const { data: carbonData } = useQuery({
    queryKey: ['user-stats-profile'],
    queryFn: async () => {
      const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/api/user/stats`);
      return data;
    },
  });

  const { data: balance } = useQuery({
    queryKey: ['credit-balance-profile'],
    queryFn: async () => {
      const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/api/credits/balance`);
      return data;
    },
  });

  useEffect(() => {
    const fetchWeb3Data = async () => {
      if (!user?.wallet_address) return;
      const isSep = await isSepoliaNetwork();
      setOnSepolia(isSep);
      if (isSep) {
        try {
          const [eco, carbon, nfts] = await Promise.all([
            getEcoTokenBalance(user.wallet_address),
            getCarbonCreditBalance(user.wallet_address),
            getEcoTreeBalance(user.wallet_address)
          ]);
          setWeb3Data({ ecoBalance: eco, carbonBalance: carbon, nftCount: nfts });
        } catch (err) {
          console.error("Profile Web3 fetch failed:", err);
        }
      }
    };
    fetchWeb3Data();
    const inv = setInterval(fetchWeb3Data, 20000);
    return () => clearInterval(inv);
  }, [user?.wallet_address]);

  const stats = carbonData || {};

  return (
    <div className="min-h-screen bg-white pb-24">
      {/* Network Warning Bar */}
      {!onSepolia && (
        <div className="bg-amber-500 text-white py-2 px-10 flex items-center justify-between text-xs font-black uppercase tracking-widest">
            <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                MetaMask is not on Sepolia. Real-time assets are hidden.
            </div>
            <button onClick={() => switchToSepolia()} className="underline hover:text-slate-900 transition-colors">
                Switch Network
            </button>
        </div>
      )}

      {/* Dynamic Header with Wave Pattern */}
      <div className="bg-slate-900 h-64 relative overflow-hidden flex items-end px-10 pb-10">
          <div className="absolute top-0 right-0 p-10 opacity-10">
              <Leaf className="w-64 h-64 text-white" />
          </div>
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-8 relative z-10"
          >
              <div className="w-32 h-32 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-[2.5rem] flex items-center justify-center text-5xl font-black text-white shadow-2xl border-4 border-slate-900">
                  {user?.full_name?.[0] || 'E'}
              </div>
              <div>
                  <div className="flex items-center gap-3 mb-1">
                      <h1 className="text-4xl font-black text-white">{user?.full_name || 'Eco Warrior'}</h1>
                      <Badge className="bg-emerald-500 text-[10px]">{user?.role?.toUpperCase()}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-slate-400 font-mono text-sm">{user?.wallet_address}</p>
                    <a 
                      href={`${import.meta.env.VITE_EXPLORER_URL}/address/${user?.wallet_address}`}
                      target="_blank"
                      className="text-emerald-500 hover:text-emerald-400 transition-colors"
                    >
                      <ArrowUpRight className="w-4 h-4" />
                    </a>
                  </div>
              </div>
          </motion.div>
      </div>

      <div className="max-w-7xl mx-auto px-10 mt-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          
          {/* Main Accounting Stats */}
          <div className="lg:col-span-2 space-y-10">
            
            <section className="space-y-6">
                <div className="flex items-center justify-between">
                    <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                        <Activity className="w-5 h-5 text-emerald-500" />
                        Carbon Credit Portfolio
                    </h3>
                    <div className="flex items-center gap-2 px-4 py-2 bg-slate-900 rounded-xl text-white text-[10px] font-black uppercase">
                        Active Listings: {balance?.currently_listed?.toFixed(2) || '0.00'}
                    </div>
                </div>
                
                <CreditBalanceCard balance={balance} />
            </section>

            <section className="bg-slate-900 rounded-[3rem] p-10 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                    <ShieldAlert className="w-32 h-32 text-rose-500" />
                </div>
                <div className="relative z-10">
                    <h3 className="text-2xl font-black mb-2">Accountability Audit</h3>
                    <p className="text-slate-400 text-sm mb-8">Summary of environmental loss and required compensation actions.</p>
                    
                    <div className="grid md:grid-cols-3 gap-10">
                        <div>
                            <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-1">Tree Loss</p>
                            <p className="text-4xl font-black">{stats.cut_trees || 0}</p>
                            <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500 mt-2">
                                <Scissors className="w-3 h-3" /> SANCTIONED CUTTING
                            </div>
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Replaced</p>
                            <p className="text-4xl font-black">{stats.replacement_trees || 0}</p>
                            <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500 mt-2">
                                <RefreshCcw className="w-3 h-3" /> RESTORATION LOGS
                            </div>
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-1">Environmental Debt</p>
                            <p className="text-4xl font-black text-amber-500">{(stats.environmental_debt || 0).toFixed(2)}t</p>
                            <div className={`flex items-center gap-1 text-[10px] font-black mt-2 ${stats.compensation_required ? 'text-rose-500 animate-pulse' : 'text-slate-500'}`}>
                                <ShieldAlert className="w-3 h-3" /> {stats.compensation_required ? 'ACTION REQUIRED' : 'NO DEBT DETECTED'}
                            </div>
                        </div>
                    </div>
                </div>
            </section>
          </div>

          {/* Sidebar / Certificate */}
          <div className="space-y-10">
            <div className="bg-slate-50 border border-slate-100 rounded-[3rem] p-10">
                <div className="flex flex-col items-center text-center mb-8">
                    <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center shadow-xl mb-6 border border-slate-100">
                        <Award className="w-10 h-10 text-emerald-500" />
                    </div>
                    <h4 className="text-xl font-black text-slate-800 leading-tight">Environmental<br/>Impact NFT</h4>
                    <p className="text-slate-400 text-[10px] font-bold uppercase mt-2 tracking-widest">Digital Asset v4.1</p>
                </div>
                
                <div className="space-y-4 mb-10">
                    <div className="flex justify-between items-center text-xs font-bold py-3 border-b border-slate-200/50">
                        <span className="text-slate-400 uppercase">Impact Class</span>
                        <span className="text-slate-800">ALPHA PRIME</span>
                    </div>
                    <div className="flex justify-between items-center text-xs font-bold py-3 border-b border-slate-200/50">
                        <span className="text-slate-400 uppercase">Audit Status</span>
                        <span className="text-emerald-600">CERTIFIED</span>
                    </div>
                    <div className="flex justify-between items-center text-xs font-bold py-3">
                        <span className="text-slate-400 uppercase">On-Chain ID</span>
                        <span className="text-slate-800 font-mono text-[8px]">
                            {CONTRACT_ADDRESSES.ecoChainTree?.slice(0, 10)}...
                        </span>
                    </div>
                </div>

                <button className="w-full bg-slate-900 text-white h-14 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl flex items-center justify-center gap-2 hover:bg-emerald-600 transition-all">
                    <Download className="w-4 h-4" /> Download Certificate
                </button>
            </div>

            <div className="p-8 bg-emerald-50 rounded-[2.5rem] border border-emerald-100">
                <h5 className="font-black text-emerald-800 text-xs uppercase tracking-widest mb-4">Network Growth</h5>
                <p className="text-emerald-700/70 text-xs leading-relaxed font-bold">
                    You are in the top 5% of environmental custodians in the Maharashtra region. 
                    Plant 2 more trees to reach Level 12.
                </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Profile;
