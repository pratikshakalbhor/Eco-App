import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { 
  TreePine, MapPin, Calendar, Activity, 
  ShieldCheck, Clock, AlertCircle, ChevronLeft,
  Globe, Award, User, Tag, Wind, Leaf, Axe, AlertTriangle, 
  ArrowUpRight, ExternalLink, QrCode, Hash, Coins,
  CheckCircle2, XCircle, Sprout, RefreshCw, Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useAuth } from '@/hooks/useAuth';

// Lifecycle steps definition
const LIFECYCLE_STEPS = [
  { key: 'TREE_REGISTERED',  label: 'NFT Minted',        icon: Hash,         color: 'emerald' },
  { key: 'VERIFIED',         label: 'Verified',          icon: ShieldCheck,  color: 'emerald' },
  { key: 'GROWING',          label: 'Growing',           icon: TreePine,     color: 'green'   },
  { key: 'CUT_CONFIRMED',    label: 'Cut Confirmed',     icon: Axe,          color: 'rose'    },
  { key: 'REPLANTED',        label: 'Replanted',         icon: Sprout,       color: 'teal'    },
  { key: 'CREDITS_EARNED',   label: 'Credits Earned',    icon: Coins,        color: 'amber'   },
];

const EVENT_STYLES = {
  TREE_REGISTERED:  { dot: 'bg-emerald-500', label: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  VERIFIED:         { dot: 'bg-emerald-600', label: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  CUT_REPORTED:     { dot: 'bg-orange-500',  label: 'bg-orange-50 text-orange-700 border-orange-100'   },
  CUT_CONFIRMED:    { dot: 'bg-rose-600',    label: 'bg-rose-50 text-rose-700 border-rose-100'         },
  DEBT_CLEARED:     { dot: 'bg-teal-500',    label: 'bg-teal-50 text-teal-700 border-teal-100'         },
  GROWTH_UPDATE:    { dot: 'bg-sky-500',     label: 'bg-sky-50 text-sky-700 border-sky-100'            },
  CREDITS_BURNED:   { dot: 'bg-amber-500',   label: 'bg-amber-50 text-amber-700 border-amber-100'      },
  DEFAULT:          { dot: 'bg-slate-400',   label: 'bg-slate-50 text-slate-600 border-slate-100'      },
};

const STATUS_CONFIG = {
  PENDING_VERIFICATION: { label: 'In Verification Queue', color: 'text-amber-600',  bg: 'bg-amber-50',   border: 'border-amber-100',  icon: Clock        },
  VERIFIED:             { label: 'Verified & Active',     color: 'text-emerald-600',bg: 'bg-emerald-50', border: 'border-emerald-100',icon: ShieldCheck  },
  REJECTED:             { label: 'Rejected / Invalid',    color: 'text-rose-600',   bg: 'bg-rose-50',    border: 'border-rose-100',   icon: XCircle      },
  CUT_REPORTED:         { label: 'Cut Reported',          color: 'text-orange-600', bg: 'bg-orange-50',  border: 'border-orange-200', icon: Axe          },
  CUT_CONFIRMED:        { label: 'Cut Confirmed',         color: 'text-rose-800',   bg: 'bg-rose-100',   border: 'border-rose-300',   icon: AlertTriangle},
};

export default function TreeDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [showGrowthForm, setShowGrowthForm] = useState(false);
  const [growthNotes, setGrowthNotes] = useState('');
  const [growthHealth, setGrowthHealth] = useState('');

  // Main tree data
  const { data: tree, isLoading, isError, refetch } = useQuery({
    queryKey: ['tree', id],
    queryFn: async () => {
      const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/api/trees/${id}`);
      return data;
    },
  });

  // Lifecycle history
  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['tree-history', id],
    queryFn: async () => {
      const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/api/trees/${id}/history`);
      return data;
    },
    enabled: !!tree,
  });

  // Environmental loss (only for cut trees)
  const { data: loss } = useQuery({
    queryKey: ['tree-loss', id],
    queryFn: async () => {
      const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/api/trees/${id}/loss`);
      return data;
    },
    enabled: !!tree && (tree.status === 'CUT_CONFIRMED' || tree.status === 'CUT_REPORTED'),
  });

  // Growth update mutation
  const growthMutation = useMutation({
    mutationFn: async () => {
      await axios.patch(`${import.meta.env.VITE_API_URL}/api/trees/${tree.id}/growth`, {
        health_status: growthHealth,
        notes: growthNotes,
      });
    },
    onSuccess: () => {
      refetch();
      setShowGrowthForm(false);
    },
  });

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAF9]">
      <div className="flex flex-col items-center gap-4">
        <Activity className="w-10 h-10 text-emerald-500 animate-pulse" />
        <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">Loading Asset...</p>
      </div>
    </div>
  );

  if (isError || !tree) return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAF9]">
      <div className="text-center">
        <AlertCircle className="w-16 h-16 text-rose-500 mx-auto mb-4" />
        <h1 className="text-2xl font-black text-slate-900">Asset Not Found</h1>
        <Button onClick={() => navigate('/mytrees')} className="mt-4">Back to Registry</Button>
      </div>
    </div>
  );

  const status = STATUS_CONFIG[tree.status] || STATUS_CONFIG.PENDING_VERIFICATION;
  const isOwner = user?.wallet_address?.toLowerCase() === tree.owner_wallet?.toLowerCase();
  const etherscanBase = `https://sepolia.etherscan.io`;
  const events = historyData?.events || [];

  // Determine which lifecycle steps are active
  const activeLifecycleKeys = new Set(events.map(e => e.event_type));
  const hasCredits = tree.status === 'VERIFIED' || activeLifecycleKeys.has('CREDITS_EARNED') || activeLifecycleKeys.has('VERIFIED');

  return (
    <div className="min-h-screen bg-[#F8FAF9] py-10 px-6 lg:px-12">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Back button */}
        <button 
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-slate-500 hover:text-emerald-600 transition-colors font-black uppercase text-[10px] tracking-widest"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>

        {/* ── Header Banner ─────────────────────────────────── */}
        <motion.div 
          initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="relative bg-gradient-to-br from-[#0a2e1e] via-[#0f3d2a] to-[#134e33] rounded-[3rem] p-10 overflow-hidden shadow-2xl"
        >
          <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-400/10 rounded-full -translate-y-1/3 translate-x-1/4 blur-3xl" />
          <div className="relative flex flex-col lg:flex-row gap-8">
            {/* Image */}
            <div className="relative shrink-0">
              <img 
                src={tree.image_url || '/placeholder-tree.jpg'} 
                className="w-40 h-40 lg:w-48 lg:h-48 rounded-[2rem] object-cover border-4 border-white/10 shadow-2xl" 
                alt={tree.species}
              />
              <div className={`absolute -bottom-3 -right-3 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider shadow-xl ${
                tree.status === 'VERIFIED' ? 'bg-emerald-500 text-white' :
                tree.status === 'CUT_CONFIRMED' ? 'bg-rose-600 text-white' :
                'bg-amber-500 text-white'
              }`}>
                {tree.status.replace('_', ' ')}
              </div>
            </div>

            {/* Header Info */}
            <div className="flex-1 text-white">
              <div className="flex items-center gap-3 mb-2">
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px] font-black uppercase tracking-widest">
                  Biological NFT Asset
                </Badge>
                {tree.blockchain_token_id && (
                  <Badge className="bg-white/10 text-white/70 border-white/20 text-[10px] font-mono">
                    Token #{tree.blockchain_token_id}
                  </Badge>
                )}
              </div>
              <h1 className="text-5xl font-black tracking-tight leading-none mb-1">{tree.species}</h1>
              <p className="text-emerald-300/80 italic text-lg mb-6">"{tree.nickname || 'Unnamed Heirloom'}"</p>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <QuickStat label="CO₂/Year" value={`${tree.carbon_absorption_rate || 22} kg`} />
                <QuickStat label="Age" value={`${tree.age || 0} yrs`} />
                <QuickStat label="Carbon Score" value={`${((tree.carbon_absorption_rate || 22) * (tree.age || 1)).toFixed(0)} kg`} />
                <QuickStat label="Species" value={tree.species} />
              </div>
            </div>

            {/* Blockchain quick links */}
            {(tree.transaction_hash || tree.blockchain_token_id) && (
              <div className="flex flex-col gap-3 shrink-0">
                {tree.transaction_hash && (
                  <a
                    href={`${etherscanBase}/tx/${tree.transaction_hash}`}
                    target="_blank" rel="noreferrer"
                    className="flex items-center gap-2 px-5 py-3 bg-white/10 backdrop-blur-sm rounded-2xl text-white text-[10px] font-black uppercase tracking-wider hover:bg-white/20 transition-all border border-white/10"
                  >
                    <ExternalLink className="w-4 h-4" />
                    View on Etherscan
                  </a>
                )}
                {tree.ipfs_hash && (
                  <a
                    href={`https://gateway.pinata.cloud/ipfs/${tree.ipfs_hash}`}
                    target="_blank" rel="noreferrer"
                    className="flex items-center gap-2 px-5 py-3 bg-white/10 backdrop-blur-sm rounded-2xl text-white text-[10px] font-black uppercase tracking-wider hover:bg-white/20 transition-all border border-white/10"
                  >
                    <Globe className="w-4 h-4" />
                    IPFS Metadata
                  </a>
                )}
              </div>
            )}
          </div>
        </motion.div>

        {/* ── Lifecycle Timeline ──────────────────────────────── */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-white rounded-[3rem] p-10 border border-emerald-50 shadow-sm"
        >
          <div className="flex items-center gap-2 mb-8">
            <div className="p-2 bg-emerald-100 rounded-xl"><Activity className="w-5 h-5 text-emerald-700" /></div>
            <div>
              <h2 className="text-lg font-black text-slate-900">Tree Lifecycle</h2>
              <p className="text-[10px] text-slate-400 font-bold">Full on-chain and off-chain provenance record</p>
            </div>
          </div>
          
          {/* Visual steps */}
          <div className="flex items-center justify-between mb-10 overflow-x-auto pb-2">
            {LIFECYCLE_STEPS.map((step, i) => {
              const StepIcon = step.icon;
              const isActive = activeLifecycleKeys.has(step.key) ||
                (step.key === 'GROWING'       && tree.status === 'VERIFIED') ||
                (step.key === 'CREDITS_EARNED' && hasCredits);
              const isPast = i < LIFECYCLE_STEPS.findIndex(s => 
                s.key === (tree.status === 'VERIFIED' ? 'GROWING' : tree.status));
              
              return (
                <React.Fragment key={step.key}>
                  <div className="flex flex-col items-center gap-2 min-w-[72px]">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                      isActive ? `bg-${step.color}-100 border-2 border-${step.color}-400 shadow-lg shadow-${step.color}-100` : 
                      'bg-slate-50 border-2 border-slate-100'
                    }`}>
                      <StepIcon className={`w-5 h-5 ${isActive ? `text-${step.color}-600` : 'text-slate-300'}`} />
                    </div>
                    <p className={`text-[9px] font-black uppercase tracking-wider text-center ${isActive ? 'text-slate-700' : 'text-slate-300'}`}>
                      {step.label}
                    </p>
                  </div>
                  {i < LIFECYCLE_STEPS.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-2 ${isActive ? 'bg-emerald-200' : 'bg-slate-100'}`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {/* Timeline events */}
          {historyLoading ? (
            <div className="flex items-center gap-3 text-slate-400 text-sm py-4">
              <RefreshCw className="w-4 h-4 animate-spin" />
              Loading event history...
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-10 opacity-30">
              <Clock className="w-10 h-10 mx-auto text-slate-300 mb-3" />
              <p className="text-xs font-black text-slate-600 uppercase">No events recorded yet</p>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-emerald-50" />
              <div className="space-y-6">
                {events.map((event, i) => {
                  const style = EVENT_STYLES[event.event_type] || EVENT_STYLES.DEFAULT;
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-start gap-5"
                    >
                      <div className={`relative z-10 shrink-0 w-10 h-10 rounded-full ${style.dot}/10 border-2 ${style.dot.replace('bg-', 'border-')} flex items-center justify-center`}>
                        <div className={`w-2.5 h-2.5 rounded-full ${style.dot}`} />
                      </div>
                      <div className="flex-1 bg-slate-50/70 rounded-2xl px-5 py-3">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <span className={`inline-flex px-3 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${style.label} mb-1`}>
                              {event.event_type.replace(/_/g, ' ')}
                            </span>
                            <p className="text-sm font-bold text-slate-800">{event.description}</p>
                            {event.actor && event.actor !== 'undefined' && (
                              <p className="text-[10px] text-slate-400 font-mono mt-1 truncate max-w-xs">{event.actor}</p>
                            )}
                            {event.tx_hash && (
                              <a
                                href={`${etherscanBase}/tx/${event.tx_hash}`}
                                target="_blank" rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[10px] text-emerald-600 font-black hover:underline mt-1"
                              >
                                <ExternalLink className="w-3 h-3" />
                                {event.tx_hash.slice(0, 18)}...
                              </a>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 font-bold shrink-0">
                            {new Date(event.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}
        </motion.div>

        {/* ── Two-column detail grid ─────────────────────────── */}
        <div className="grid lg:grid-cols-2 gap-8">

          {/* NFT & Metadata Block */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="space-y-6">

            {/* NFT Block */}
            <div className="bg-white rounded-[2.5rem] p-8 border border-emerald-50 shadow-sm">
              <div className="flex items-center gap-2 mb-6">
                <div className="p-2 bg-violet-100 rounded-xl"><Hash className="w-4 h-4 text-violet-700" /></div>
                <h3 className="font-black text-slate-900">NFT & Blockchain</h3>
              </div>
              <div className="space-y-4">
                <DataRow label="Token ID"        value={tree.blockchain_token_id ? `#${tree.blockchain_token_id}` : 'Pending'} mono />
                <DataRow label="Contract"        value="EcoChainTree (ERC-721)" />
                <DataRow label="Network"         value="Ethereum Sepolia Testnet" />
                <DataRow label="IPFS Hash"       value={tree.ipfs_hash ? `${tree.ipfs_hash.slice(0, 20)}...` : 'Pending'} mono />
                <DataRow label="TX Hash"         value={tree.transaction_hash ? `${tree.transaction_hash.slice(0, 20)}...` : 'Pending'} mono />
                <DataRow label="Owner Wallet"    value={tree.owner_wallet ? `${tree.owner_wallet.slice(0, 10)}...${tree.owner_wallet.slice(-6)}` : 'N/A'} mono />

                {/* Action buttons */}
                <div className="flex gap-3 pt-2">
                  {tree.transaction_hash && (
                    <a href={`${etherscanBase}/tx/${tree.transaction_hash}`} target="_blank" rel="noreferrer"
                      className="flex-1 flex items-center justify-center gap-2 h-11 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-wider hover:bg-slate-800 transition-all"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Etherscan
                    </a>
                  )}
                  {tree.ipfs_hash && (
                    <a href={`https://gateway.pinata.cloud/ipfs/${tree.ipfs_hash}`} target="_blank" rel="noreferrer"
                      className="flex-1 flex items-center justify-center gap-2 h-11 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-wider hover:bg-emerald-700 transition-all"
                    >
                      <Globe className="w-4 h-4" />
                      IPFS
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Tree Info */}
            <div className="bg-white rounded-[2.5rem] p-8 border border-emerald-50 shadow-sm">
              <div className="flex items-center gap-2 mb-6">
                <div className="p-2 bg-emerald-100 rounded-xl"><TreePine className="w-4 h-4 text-emerald-700" /></div>
                <h3 className="font-black text-slate-900">Tree Details</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <InfoCard icon={MapPin}    label="Location"      value={tree.location}                                                          />
                <InfoCard icon={Globe}     label="Coordinates"   value={`${parseFloat(tree.latitude || 0).toFixed(4)}, ${parseFloat(tree.longitude || 0).toFixed(4)}`} />
                <InfoCard icon={Calendar}  label="Planted"       value={new Date(tree.planting_date).toLocaleDateString()}                      />
                <InfoCard icon={Tag}       label="Age"           value={`${tree.age || 0} Years`}                                              />
                <InfoCard icon={Activity}  label="Health"        value={tree.health_status}                                                     />
                <InfoCard icon={User}      label="Tree ID"       value={tree.tree_id}                                                           />
              </div>
            </div>

            {/* Growth Update (owner only, verified trees) */}
            {isOwner && tree.status === 'VERIFIED' && (
              <div className="bg-white rounded-[2.5rem] p-8 border border-sky-50 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-sky-100 rounded-xl"><Leaf className="w-4 h-4 text-sky-600" /></div>
                    <h3 className="font-black text-slate-900">Growth Update</h3>
                  </div>
                  <button onClick={() => setShowGrowthForm(!showGrowthForm)}
                    className="text-[10px] font-black uppercase tracking-wider text-sky-600 hover:text-sky-800 transition-colors">
                    {showGrowthForm ? 'Cancel' : 'Update'}
                  </button>
                </div>
                <AnimatePresence>
                  {showGrowthForm && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                      className="space-y-4"
                    >
                      <select
                        value={growthHealth}
                        onChange={e => setGrowthHealth(e.target.value)}
                        className="w-full h-12 px-4 rounded-2xl border border-slate-100 bg-slate-50 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-200"
                      >
                        <option value="">Select Health Status</option>
                        {['Excellent', 'Good', 'Fair', 'Poor', 'Critical'].map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => growthMutation.mutate()}
                        disabled={!growthHealth || growthMutation.isPending}
                        className="w-full h-12 bg-sky-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-wider hover:bg-sky-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                      >
                        {growthMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        Submit Update
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </motion.div>

          {/* Right column */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 }} className="space-y-6">

            {/* Carbon Scorecard */}
            <div className="bg-gradient-to-br from-[#0a2e1e] to-[#0f3d2a] rounded-[2.5rem] p-10 text-white relative overflow-hidden shadow-2xl">
              <div className="absolute top-0 right-0 p-8 opacity-5"><TreePine className="w-40 h-40" /></div>
              <div className="flex items-center gap-2 mb-6">
                <Award className="w-5 h-5 text-emerald-400" />
                <h3 className="text-lg font-black uppercase tracking-widest">Carbon Score</h3>
              </div>
              <div className="grid grid-cols-2 gap-8 mb-8">
                <div>
                  <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">Annual Rate</p>
                  <div className="flex items-end gap-2">
                    <span className="text-4xl font-black">{tree.carbon_absorption_rate || 22}</span>
                    <span className="text-xs text-emerald-400 mb-1.5 uppercase font-bold">kg CO₂/yr</span>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">Lifetime Score</p>
                  <div className="flex items-end gap-2">
                    <span className="text-4xl font-black">{((tree.carbon_absorption_rate || 22) * (tree.age || 1)).toFixed(0)}</span>
                    <span className="text-xs text-emerald-400 mb-1.5 uppercase font-bold">kg total</span>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">O₂ Generated</p>
                  <div className="flex items-end gap-2">
                    <span className="text-3xl font-black">{((tree.carbon_absorption_rate || 22) * 1.5).toFixed(1)}</span>
                    <span className="text-xs text-emerald-400 mb-1 uppercase font-bold">kg/yr</span>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">Carbon Credits</p>
                  <div className="flex items-end gap-2">
                    <span className="text-3xl font-black">
                      {tree.status === 'VERIFIED' ? '1.0' :
                       tree.status === 'CUT_REPORTED' ? '🔒' :
                       tree.status === 'CUT_CONFIRMED' ? '0.0' : '—'}
                    </span>
                    <span className="text-xs text-emerald-400 mb-1 uppercase font-bold">ECO</span>
                  </div>
                </div>
              </div>
              <div className="border-t border-white/10 pt-6 flex items-center justify-between">
                <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">1 ECO Credit = 1 tonne CO₂ offset</p>
                {tree.status === 'VERIFIED' && (
                  <div className="flex items-center gap-2 px-4 py-1.5 bg-emerald-500/20 rounded-full">
                    <Wind className="w-3 h-3 text-emerald-400 animate-pulse" />
                    <span className="text-[10px] text-emerald-400 font-black">Active Sequestration</span>
                  </div>
                )}
              </div>
            </div>

            {/* Environmental Loss (cut trees only) */}
            {loss && (
              <div className="bg-rose-50 border border-rose-100 rounded-[2.5rem] p-10 space-y-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-rose-100 rounded-xl"><AlertTriangle className="w-5 h-5 text-rose-600" /></div>
                  <h3 className="text-xl font-black text-rose-900">Environmental Loss</h3>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <LossCard label="CO₂ Released"  value={`${loss.co2_lost_kg}kg`}              color="rose" />
                  <LossCard label="O₂ Lost"       value={`${loss.oxygen_lost_kg}kg`}           color="rose" />
                  <LossCard label="Trees Owed"    value={`${loss.replacement_trees_needed}`}   color="orange" />
                </div>
                <button 
                  onClick={() => navigate('/debt')}
                  className="w-full h-12 bg-rose-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-rose-700 transition-all flex items-center justify-center gap-2"
                >
                  Manage Replantation Debt
                  <ArrowUpRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Status panel */}
            <div className={`${status.bg} ${status.border} border rounded-[2.5rem] p-8`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Current Status</p>
                  <div className={`flex items-center gap-2 ${status.color}`}>
                    <status.icon className="w-5 h-5" />
                    <span className="text-lg font-black">{status.label}</span>
                  </div>
                </div>
                {tree.status === 'VERIFIED' && (
                  <div className="bg-emerald-500 text-white p-3 rounded-2xl shadow-lg shadow-emerald-200">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                )}
              </div>

              {tree.status === 'VERIFIED' && tree.owner_wallet?.toLowerCase() === user?.wallet_address?.toLowerCase() && (
                <button 
                  onClick={() => navigate(`/tree/${id}/report-cut`)}
                  className="w-full mt-6 h-12 bg-orange-600/10 text-orange-700 border border-orange-200 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-orange-600 hover:text-white transition-all flex items-center justify-center gap-2"
                >
                  <Axe className="w-4 h-4" />
                  Report Tree Cut
                </button>
              )}
            </div>

            {/* QR Code hint */}
            <div className="bg-white rounded-[2.5rem] p-8 border border-emerald-50 shadow-sm text-center">
              <QrCode className="w-8 h-8 text-slate-300 mx-auto mb-3" />
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Tree QR Code</p>
              <p className="text-xs text-slate-400 mb-4">Scan to verify this asset on Sepolia</p>
              <code className="text-[10px] font-mono bg-slate-50 px-4 py-2 rounded-xl text-slate-500 block break-all">
                {`${window.location.host}/tree/${id}`}
              </code>
              <a 
                href={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(window.location.href)}`}
                target="_blank" rel="noreferrer"
                className="mt-4 inline-flex items-center gap-2 text-[10px] font-black text-emerald-600 hover:underline uppercase tracking-widest"
              >
                <QrCode className="w-3 h-3" />
                Generate QR Code
              </a>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────

const QuickStat = ({ label, value }) => (
  <div className="bg-white/8 rounded-2xl px-4 py-3 backdrop-blur-sm">
    <p className="text-[9px] text-white/50 font-bold uppercase tracking-wider">{label}</p>
    <p className="text-sm font-black text-white truncate">{value}</p>
  </div>
);

const DataRow = ({ label, value, mono }) => (
  <div className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0">
    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
    <span className={`text-xs font-bold text-slate-800 max-w-[180px] truncate text-right ${mono ? 'font-mono' : ''}`}>{value}</span>
  </div>
);

const InfoCard = ({ icon: Icon, label, value }) => (
  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
    <div className="flex items-center gap-1.5 mb-1.5">
      <Icon className="w-3 h-3 text-emerald-600" />
      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
    </div>
    <p className="text-xs font-black text-slate-800 truncate">{value}</p>
  </div>
);

const LossCard = ({ label, value, color }) => (
  <div className={`text-center p-4 bg-white rounded-2xl border border-${color}-100`}>
    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">{label}</p>
    <p className={`text-lg font-black text-${color}-600`}>{value}</p>
  </div>
);
