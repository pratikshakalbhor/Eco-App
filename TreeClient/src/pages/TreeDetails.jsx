import React, { useState } from 'react';
import API_URL from "../utils/config.js";
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { useAuth } from '../hooks/useAuth';
import {
  TreePine, MapPin, Calendar, Activity,
  ShieldCheck, Clock, AlertCircle, ChevronLeft,
  Award, Wind, Leaf, Axe, AlertTriangle,
  ChevronDown, Check, RefreshCw, Sprout, Coins,
  CheckCircle2, XCircle, Link2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { cleanImageUrl } from '../utils/imageUtils';

// Beginner-friendly lifecycle steps.
const LIFECYCLE_STEPS = [
  { key: 'TREE_REGISTERED', label: 'Registered',      icon: TreePine,    color: 'emerald' },
  { key: 'VERIFIED',        label: 'Verified',        icon: ShieldCheck, color: 'emerald' },
  { key: 'GROWING',         label: 'Growing',         icon: Leaf,        color: 'green'   },
  { key: 'CREDITS_EARNED',  label: 'Credits Earned',  icon: Coins,       color: 'amber'   },
  { key: 'REPLANTED',       label: 'Replanted',       icon: Sprout,      color: 'teal'    },
  { key: 'CUT_CONFIRMED',   label: 'Cut / Lost',      icon: Axe,         color: 'rose'    },
];

const EVENT_LABEL = {
  TREE_REGISTERED: 'Tree Registered',
  VERIFIED: 'Verified',
  CUT_REPORTED: 'Reported as cut',
  CUT_CONFIRMED: 'Cut confirmed',
  DEBT_CLEARED: 'Replantation resolved',
  GROWTH_UPDATE: 'Growth updated',
  CREDITS_BURNED: 'Credits used',
};

const STATUS_CONFIG = {
  PENDING_VERIFICATION: { label: 'Awaiting Verification', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100', icon: Clock },
  VERIFIED:             { label: 'Verified',               color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100', icon: ShieldCheck },
  REJECTED:             { label: 'Needs Attention',        color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-100', icon: XCircle },
  CUT_REPORTED:         { label: 'Needs Attention',        color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', icon: Axe },
  CUT_CONFIRMED:        { label: 'Needs Attention',        color: 'text-rose-700', bg: 'bg-rose-100', border: 'border-rose-300', icon: AlertTriangle },
};

export default function TreeDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showGrowthForm, setShowGrowthForm] = useState(false);
  const [growthNotes, setGrowthNotes] = useState('');
  const [growthHealth, setGrowthHealth] = useState('');
  const [showBlockchain, setShowBlockchain] = useState(false);

  const { data: tree, isLoading, isError, refetch } = useQuery({
    queryKey: ['tree', id],
    queryFn: async () => {
      const { data } = await axios.get(`${API_URL}/api/trees/${id}`);
      return data;
    },
  });

  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['tree-history', id],
    queryFn: async () => {
      const { data } = await axios.get(`${API_URL}/api/trees/${id}/history`);
      return data;
    },
    enabled: !!tree,
  });

  const { data: loss } = useQuery({
    queryKey: ['tree-loss', id],
    queryFn: async () => {
      const { data } = await axios.get(`${API_URL}/api/trees/${id}/loss`);
      return data;
    },
    enabled: !!tree && (tree.status === 'CUT_CONFIRMED' || tree.status === 'CUT_REPORTED'),
  });

  const growthMutation = useMutation({
    mutationFn: async () => {
      await axios.patch(`${API_URL}/api/trees/${tree.id}/growth`, {
        health_status: growthHealth,
        notes: growthNotes,
      });
    },
    onSuccess: () => {
      refetch();
      setShowGrowthForm(false);
      setGrowthHealth('');
      setGrowthNotes('');
    },
  });

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAF9]">
      <Activity className="w-10 h-10 text-emerald-500 animate-pulse" />
    </div>
  );

  if (isError || !tree) return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAF9]">
      <div className="text-center">
        <AlertCircle className="w-16 h-16 text-rose-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-slate-900">Tree not found</h1>
        <Button onClick={() => navigate('/mytrees')} className="mt-4">Back to My Trees</Button>
      </div>
    </div>
  );

  const status = STATUS_CONFIG[tree.status] || STATUS_CONFIG.PENDING_VERIFICATION;
  const isOwner = user?.wallet_address?.toLowerCase() === tree.owner_wallet?.toLowerCase();
  const events = historyData?.events || [];

  const activeLifecycleKeys = new Set(events.map(e => e.event_type));
  const hasCredits = tree.status === 'VERIFIED' || activeLifecycleKeys.has('CREDITS_EARNED') || activeLifecycleKeys.has('VERIFIED');

  return (
    <div className="min-h-screen bg-[#F8FAF9] py-10 px-6 lg:px-12">
      <div className="max-w-5xl mx-auto space-y-8">

        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-slate-500 hover:text-emerald-600 transition-colors font-medium text-sm"
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl p-8 border border-emerald-50 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            <img
              src={cleanImageUrl(tree.image_url)}
              className="w-28 h-28 rounded-2xl object-cover border-4 border-white shadow"
              alt={tree.species}
            />
            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap mb-2">
                <Badge className={`${status.bg} ${status.color} ${status.border} border text-xs font-medium`}>
                  {status.label}
                </Badge>
                {tree.is_replacement && (
                  <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 text-xs">
                    <Sprout className="w-3 h-3 mr-1" /> Replacement tree
                  </Badge>
                )}
              </div>
              <h1 className="text-3xl font-bold text-slate-900">{tree.species}</h1>
              {tree.nickname && <p className="text-slate-500 italic">"{tree.nickname}"</p>}
              <div className="mt-3 text-sm text-slate-600 space-y-1">
                <p className="flex items-center gap-2"><MapPin className="w-4 h-4 text-slate-400" /> {tree.location || 'Location pending'}</p>
                <p className="flex items-center gap-2"><Calendar className="w-4 h-4 text-slate-400" /> Planted {new Date(tree.planted_at).toLocaleDateString()}</p>
                <p className="flex items-center gap-2"><Activity className="w-4 h-4 text-slate-400" /> Health: {tree.health_status || '—'} · {tree.age || 0} years old</p>
              </div>
            </div>
            <div className="md:text-right">
              <p className="text-xs text-slate-400">Carbon impact</p>
              <p className="text-2xl font-bold text-slate-900">{(tree.carbon_absorption_rate || 22) * (tree.age || 1) > 0 ? `${((tree.carbon_absorption_rate || 22) * (tree.age || 1)).toFixed(0)} kg CO₂` : '—'}</p>
              <p className="text-xs text-slate-400 mt-1">~{(tree.carbon_absorption_rate || 22)} kg CO₂ / year</p>
            </div>
          </div>
        </motion.div>

        {/* Lifecycle */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="bg-white rounded-3xl p-8 border border-emerald-50 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <div className="p-2 bg-emerald-100 rounded-xl"><Activity className="w-5 h-5 text-emerald-700" /></div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Tree Timeline</h2>
              <p className="text-xs text-slate-400">The journey of this tree from registration on.</p>
            </div>
          </div>

          <div className="flex items-center justify-between mb-8 overflow-x-auto pb-2">
            {LIFECYCLE_STEPS.map((step, i) => {
              const StepIcon = step.icon;
              const isActive = activeLifecycleKeys.has(step.key) ||
                (step.key === 'GROWING' && tree.status === 'VERIFIED') ||
                (step.key === 'CREDITS_EARNED' && hasCredits);
              const isPast = events.some(e => e.event_type === step.key) ||
                (step.key === 'VERIFIED' && tree.status !== 'PENDING_VERIFICATION' && tree.status !== 'REJECTED');
              return (
                <React.Fragment key={step.key}>
                  <div className="flex flex-col items-center gap-2 min-w-[70px]">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all ` +
                      (isActive ? 'bg-emerald-100 border-2 border-emerald-300' : isPast ? 'bg-slate-50 border border-slate-200' : 'bg-slate-50 border border-slate-100')}>
                      <StepIcon className={`w-5 h-5 ${isActive ? 'text-emerald-600' : 'text-slate-300'}`} />
                    </div>
                    <p className={`text-[10px] font-medium text-center ${isActive ? 'text-slate-700' : 'text-slate-300'}`}>{step.label}</p>
                  </div>
                  {i < LIFECYCLE_STEPS.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-1 ${isActive || isPast ? 'bg-emerald-200' : 'bg-slate-100'}`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {historyLoading ? (
            <div className="flex items-center gap-3 text-slate-400 text-sm py-4">
              <RefreshCw className="w-4 h-4 animate-spin" /> Loading timeline...
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-8 opacity-40">
              <Clock className="w-10 h-10 mx-auto text-slate-300 mb-3" />
              <p className="text-sm font-medium text-slate-500">No events recorded yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {events.map((event, i) => (
                <div key={i} className="flex items-start gap-4">
                  <div className="relative z-10 shrink-0 w-9 h-9 rounded-full bg-emerald-50 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="flex-1 bg-slate-50/70 rounded-xl px-4 py-3">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <span className="text-sm font-medium text-emerald-700">{EVENT_LABEL[event.event_type] || event.event_type.replace(/_/g, ' ')}</span>
                        {event.description && <p className="text-slate-600 text-sm mt-0.5">{event.description}</p>}
                      </div>
                      <span className="text-xs text-slate-400 shrink-0">{new Date(event.at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Tree details */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="bg-white rounded-3xl p-8 border border-emerald-50 shadow-sm">
            <div className="flex items-center gap-2 mb-6">
              <div className="p-2 bg-emerald-100 rounded-xl"><TreePine className="w-5 h-5 text-emerald-700" /></div>
              <h3 className="font-bold text-slate-900">Tree Details</h3>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <InfoRow label="Location" value={tree.location || '—'} />
              <InfoRow label="Tree ID" value={tree.tree_id} />
              <InfoRow label="Coordinates" value={`${parseFloat(tree.latitude || 0).toFixed(4)}, ${parseFloat(tree.longitude || 0).toFixed(4)}`} />
              <InfoRow label="Planting date" value={new Date(tree.planted_at).toLocaleDateString()} />
            </div>
          </motion.div>

          {/* Carbon impact + status */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="space-y-6">
            <div className="bg-gradient-to-br from-[#0a2e1e] to-[#0f3d2a] rounded-3xl p-8 text-white relative overflow-hidden">
              <div className="flex items-center gap-2 mb-4">
                <Award className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold">Carbon Impact</h3>
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xs text-emerald-300 mb-1">Per year</p>
                  <p className="text-xl font-bold">{tree.carbon_absorption_rate || 22} kg</p>
                </div>
                <div>
                  <p className="text-xs text-emerald-300 mb-1">Lifetime</p>
                  <p className="text-xl font-bold">{((tree.carbon_absorption_rate || 22) * (tree.age || 1)).toFixed(0)} kg</p>
                </div>
                <div>
                  <p className="text-xs text-emerald-300 mb-1">Credits</p>
                  <p className="text-xl font-bold">{tree.status === 'VERIFIED' ? '1.0' : '—'}</p>
                </div>
              </div>
              <p className="text-[11px] text-white/50 mt-4 pt-3 border-t border-white/10">1 ECO credit = 1 tonne of CO₂ offset.</p>
            </div>

            <div className={`${status.bg} ${status.border} border rounded-3xl p-6`}>
              <div className="flex items-center gap-2">
                <status.icon className="w-5 h-5" />
                <span className={`font-semibold ${status.color}`}>{status.label}</span>
              </div>
              {tree.status === 'VERIFIED' && (
                <div className="flex flex-col gap-2 mt-4">
                  {isOwner && (
                    <button onClick={() => setShowGrowthForm(!showGrowthForm)}
                      className="w-full h-11 bg-sky-600 text-white rounded-xl text-sm font-medium hover:bg-sky-700">
                      Update Health & Growth
                    </button>
                  )}
                  {isOwner && (
                    <button onClick={() => navigate(`/tree/${id}/report-cut`)}
                      className="w-full h-11 bg-orange-600/10 text-orange-700 border border-orange-200 rounded-xl text-sm font-medium hover:bg-orange-600 hover:text-white">
                      Report this tree as cut
                    </button>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {loss && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-rose-50 border border-rose-100 rounded-3xl p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-rose-100 rounded-xl"><AlertTriangle className="w-5 h-5 text-rose-600" /></div>
              <h3 className="text-lg font-bold text-rose-900">Environmental Loss</h3>
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="bg-white rounded-xl p-4"><p className="text-xs text-slate-500">CO₂ released</p><p className="font-bold text-rose-600">{loss.co2_lost_kg}kg</p></div>
              <div className="bg-white rounded-xl p-4"><p className="text-xs text-slate-500">O₂ lost</p><p className="font-bold text-rose-600">{loss.oxygen_lost_kg}kg</p></div>
              <div className="bg-white rounded-xl p-4"><p className="text-xs text-slate-500">Replacement trees needed</p><p className="font-bold text-orange-600">{loss.replacement_trees_needed}</p></div>
            </div>
            <button onClick={() => navigate('/debt')} className="mt-4 w-full h-11 bg-rose-600 text-white rounded-xl font-medium hover:bg-rose-700">
              Manage Replantation
            </button>
          </motion.div>
        )}

        {/* Growth update form */}
        <AnimatePresence>
          {showGrowthForm && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="bg-white rounded-3xl p-6 border border-sky-50 shadow-sm overflow-hidden">
              <h3 className="font-bold text-slate-900 mb-4">Update Health & Growth</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-slate-600 mb-2">Current health</p>
                  <select value={growthHealth} onChange={e => setGrowthHealth(e.target.value)}
                    className="w-full h-12 px-4 rounded-xl border border-slate-100 bg-slate-50 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-200">
                    <option value="">Select health status</option>
                    {['Excellent', 'Good', 'Fair', 'Poor', 'Critical'].map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
                <div>
                  <p className="text-sm text-slate-600 mb-2">Notes (optional)</p>
                  <textarea value={growthNotes} onChange={e => setGrowthNotes(e.target.value)}
                    className="w-full h-24 px-4 py-3 rounded-xl border border-slate-100 bg-slate-50 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-200"
                    placeholder="Anything notable about the tree's growth..." />
                </div>
                <button onClick={() => growthMutation.mutate()} disabled={!growthHealth || growthMutation.isPending}
                  className="w-full h-12 bg-sky-600 text-white rounded-xl font-medium hover:bg-sky-700 disabled:opacity-50 flex items-center justify-center gap-2">
                  {growthMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Save Update
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Blockchain details — collapsed for beginners */}
        <div className="bg-white rounded-3xl border border-slate-100">
          <button onClick={() => setShowBlockchain(!showBlockchain)}
            className="w-full flex items-center justify-between p-5 text-left">
            <span className="flex items-center gap-2 text-sm font-medium text-slate-600"><Link2 className="w-4 h-4" /> Blockchain Details (for advanced users)</span>
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showBlockchain ? 'rotate-180' : ''}`} />
          </button>
          {showBlockchain && (
            <div className="px-5 pb-5 text-sm">
              <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3">
                <InfoRow label="Token ID" value={tree.blockchain_token_id ? `#${tree.blockchain_token_id}` : 'Pending'} />
                <InfoRow label="Tree ID" value={tree.tree_id} />
                <InfoRow label="Contract" value="EcoChainTree (NFT)" />
                <InfoRow label="Network" value="Ethereum Sepolia Testnet" />
                <InfoRow label="IPFS Hash" value={tree.ipfs_hash ? `${tree.ipfs_hash.slice(0, 24)}...` : 'Pending'} mono />
                <InfoRow label="Transaction Hash" value={tree.transaction_hash ? `${tree.transaction_hash.slice(0, 24)}...` : 'Pending'} mono />
                <InfoRow label="Owner Wallet" value={tree.owner_wallet ? `${tree.owner_wallet.slice(0, 10)}...${tree.owner_wallet.slice(-6)}` : 'N/A'} mono />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const InfoRow = ({ label, value, mono = false }) => (
  <div>
    <p className="text-xs text-slate-400">{label}</p>
    <p className={`font-medium text-slate-800 break-all ${mono ? 'font-mono text-sm' : ''}`}>{value}</p>
  </div>
);
