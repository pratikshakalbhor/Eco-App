import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { 
  ShoppingBag, History, Tag, Search, 
  Filter, TrendingUp, BarChart3, Globe,
  Activity, ArrowUpRight, Zap, Info,
  Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';

import ListingCard from '@/components/marketplace/ListingCard';
import BuyModal from '@/components/marketplace/BuyModal';
import CreateListingModal from '@/components/marketplace/CreateListingModal';
import TransactionRow from '@/components/marketplace/TransactionRow';
import CreditBalanceCard from '@/components/marketplace/CreditBalanceCard';

export default function Marketplace() {
  const [activeTab, setActiveTab] = useState('browse'); // browse | my-listings | history
  const [activeBuy, setActiveBuy] = useState(null);
  const [isListingModalOpen, setIsListingModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [speciesFilter, setSpeciesFilter] = useState('All');
  
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: listings = [], isLoading: listingsLoading } = useQuery({
    queryKey: ['marketplace-listings', speciesFilter],
    queryFn: async () => {
      const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/api/marketplace/listings`, {
        params: { status: 'ACTIVE', species: speciesFilter }
      });
      return data;
    },
    enabled: !!user
  });

  const { data: myTransactions = [] } = useQuery({
    queryKey: ['my-transactions'],
    queryFn: async () => {
      const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/api/marketplace/transactions`);
      return data;
    },
    enabled: !!user
  });

  const { data: balance } = useQuery({
    queryKey: ['credit-balance'],
    queryFn: async () => {
      const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/api/credits/balance`);
      return data;
    },
    enabled: !!user
  });

  const { data: stats } = useQuery({
    queryKey: ['marketplace-stats'],
    queryFn: async () => {
      const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/api/marketplace/stats`);
      return data;
    },
    enabled: !!user
  });

  const filteredListings = useMemo(() => {
    return listings.filter(l => 
        l.species.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.tree_id.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [listings, searchTerm]);

  return (
    <div className="min-h-screen bg-[#F8FAF9] py-12 px-6 lg:px-12">
      <div className="max-w-7xl mx-auto space-y-12">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-emerald-100 rounded-xl">
                        <ShoppingBag className="w-5 h-5 text-emerald-600" />
                    </div>
                    <span className="text-[10px] font-black text-emerald-700 uppercase tracking-[0.2em]">Eco-Asset Marketplace</span>
                </div>
                <h1 className="text-6xl font-black text-slate-900 tracking-tighter">Carbon Exchange</h1>
                <p className="text-slate-500 font-medium text-lg max-w-xl">Trade verified carbon credits from global biological assets. Support reforestation while offsetting your footprint.</p>
            </div>

            <div className="flex bg-slate-100 p-1.5 rounded-[1.5rem] border border-slate-200 shadow-sm">
                <TabButton active={activeTab === 'browse'} onClick={() => setActiveTab('browse')} icon={Globe} label="Browse" />
                <TabButton active={activeTab === 'my-listings'} onClick={() => setActiveTab('my-listings')} icon={Tag} label="My Listings" />
                <TabButton active={activeTab === 'history'} onClick={() => setActiveTab('history')} icon={History} label="History" />
            </div>
        </div>

        {/* Global Balance Widget */}
        <CreditBalanceCard balance={balance} />

        {/* Market Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <StatSmall label="Market Price" value={`₹${stats?.avg_price?.toFixed(0) || '700'}/cr`} icon={TrendingUp} color="emerald" />
            <StatSmall label="24h Volume" value={`${stats?.volume_24h?.toFixed(2) || '0.00'} cr`} icon={Activity} color="sky" />
            <StatSmall label="Active Deals" value={stats?.active_listings || '0'} icon={Zap} color="amber" />
            <StatSmall label="Your Equity" value={`₹${((balance?.available || 0) * 700).toLocaleString()}`} icon={BarChart3} color="emerald" />
        </div>

        {/* Sub-Header & Controls */}
        <div className="flex flex-col md:flex-row justify-between gap-6 items-center pt-8 border-t border-slate-100">
            <div className="relative w-full md:w-96">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                <input 
                    type="text" 
                    placeholder="Search credits by species..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full h-16 pl-14 pr-8 bg-white rounded-2xl border border-slate-100 focus:ring-4 ring-emerald-500/5 focus:border-emerald-500 transition-all font-bold text-slate-900"
                />
            </div>
            
            <div className="flex items-center gap-4 w-full md:w-auto">
                <Button 
                    variant="outline" 
                    className="h-16 px-8 rounded-2xl border-slate-100 bg-white gap-3 font-black uppercase text-[10px] tracking-widest text-slate-600 hover:bg-slate-50"
                >
                    <Filter className="w-4 h-4" />
                    Filters
                </Button>
                <Button 
                    onClick={() => setIsListingModalOpen(true)}
                    className="flex-1 md:flex-none h-16 px-10 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-2xl shadow-slate-900/10 gap-3"
                >
                    <Plus className="w-5 h-5" />
                    Create Listing
                </Button>
            </div>
        </div>

        {/* Main Content Area */}
        <AnimatePresence mode="wait">
            {activeTab === 'browse' && (
                <motion.div 
                    key="browse"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
                >
                    {filteredListings.map(listing => (
                        <ListingCard 
                            key={listing.id} 
                            listing={listing} 
                            onBuy={setActiveBuy}
                            isOwnListing={listing.seller_wallet.toLowerCase() === user?.walletAddress?.toLowerCase()}
                        />
                    ))}
                    {filteredListings.length === 0 && !listingsLoading && (
                        <EmptyState message="No active listings found for your search." />
                    )}
                </motion.div>
            )}

            {activeTab === 'my-listings' && (
                <motion.div 
                    key="my-listings"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-6"
                >
                    <h3 className="text-sm font-black uppercase text-slate-400 tracking-widest px-2">Managed Listings</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {listings.filter(l => l.seller_wallet.toLowerCase() === user?.walletAddress?.toLowerCase()).map(listing => (
                            <ListingCard key={listing.id} listing={listing} onBuy={() => {}} isOwnListing={true} />
                        ))}
                    </div>
                </motion.div>
            )}

            {activeTab === 'history' && (
                <motion.div 
                    key="history"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm"
                >
                    <div className="flex justify-between items-center mb-10">
                        <h3 className="text-2xl font-black text-slate-900 tracking-tight">Transaction Ledger</h3>
                        <Button variant="ghost" className="text-emerald-600 font-bold flex items-center gap-2">
                            Download CSV <ArrowUpRight className="w-4 h-4" />
                        </Button>
                    </div>
                    <div className="space-y-4">
                        {myTransactions.map((tx, idx) => (
                            <TransactionRow 
                                key={tx.id} 
                                tx={tx} 
                                wallet={user?.walletAddress} 
                                delay={idx * 0.05} 
                            />
                        ))}
                        {myTransactions.length === 0 && (
                            <EmptyState message="No transactions recorded yet." />
                        )}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>

      </div>

      {/* Modals */}
      <AnimatePresence>
        {activeBuy && (
          <BuyModal 
            listing={activeBuy} 
            onClose={() => setActiveBuy(null)} 
            onSuccess={() => {
                setActiveBuy(null);
                queryClient.invalidateQueries(['marketplace-listings']);
                queryClient.invalidateQueries(['credit-balance']);
                queryClient.invalidateQueries(['my-transactions']);
            }}
          />
        )}
        {isListingModalOpen && (
          <CreateListingModal 
            onClose={() => setIsListingModalOpen(false)} 
            onSuccess={() => {
                setIsListingModalOpen(false);
                queryClient.invalidateQueries(['marketplace-listings']);
                queryClient.invalidateQueries(['credit-balance']);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

const TabButton = ({ active, onClick, icon: Icon, label }) => (
    <button 
        onClick={onClick}
        className={`flex items-center gap-3 px-8 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.1em] transition-all ${active ? 'bg-white text-slate-900 shadow-xl shadow-slate-900/5' : 'text-slate-400 hover:text-slate-600'}`}
    >
        <Icon className={`w-4 h-4 ${active ? 'text-emerald-500' : 'text-slate-300'}`} />
        {label}
    </button>
);

const StatSmall = ({ label, value, icon: Icon, color }) => (
    <div className="bg-white p-6 rounded-3xl border border-slate-50 shadow-sm flex items-center gap-4 group hover:border-emerald-100 transition-all">
        <div className={`w-12 h-12 bg-${color}-50 rounded-2xl flex items-center justify-center text-${color}-600 group-hover:scale-110 transition-transform`}>
            <Icon className="w-5 h-5" />
        </div>
        <div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
            <p className="text-lg font-black text-slate-900 tabular-nums">{value}</p>
        </div>
    </div>
);

const EmptyState = ({ message }) => (
    <div className="py-24 text-center w-full col-span-full">
        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Info className="w-8 h-8 text-slate-200" />
        </div>
        <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">{message}</p>
    </div>
);
