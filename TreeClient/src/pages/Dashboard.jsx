import React, { useMemo, useState } from 'react';
import API_URL from "../utils/config.js";
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  TreePine, Leaf, RefreshCcw, Wind,
  ShieldCheck, Clock, AlertTriangle, Activity,
  CheckCircle2, ChevronDown, Sprout, Coins,
  ShoppingBag, ArrowRight, Trees as TreesIcon
} from 'lucide-react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { cleanImageUrl } from '../utils/imageUtils';

// The beginner's 5-step EcoChain journey.
const JOURNEY = [
  { step: '1', title: 'Plant a Tree', desc: 'Register a tree with a photo and location.', icon: TreePine, path: '/planttree' },
  { step: '2', title: 'Get Verified', desc: 'A verifier checks your submission.', icon: ShieldCheck, path: '/mytrees' },
  { step: '3', title: 'Track Your Tree', desc: 'Monitor your tree through its lifecycle.', icon: Activity, path: '/mytrees' },
  { step: '4', title: 'Earn Carbon Credits', desc: 'Verified impact generates ECO credits.', icon: Coins, path: '/carboncredits' },
  { step: '5', title: 'Use or Sell Credits', desc: 'Hold, use, or trade your credits.', icon: ShoppingBag, path: '/marketplace' },
];

export default function EcoChainDashboard() {
  const navigate = useNavigate();

  const { data: stats = { total: 0, pending: 0, verified: 0, rejected: 0 }, isLoading: isStatsLoading } = useQuery({
    queryKey: ['tree-stats'],
    queryFn: async () => {
      const { data } = await axios.get(`${API_URL}/api/trees/stats`);
      return data;
    },
  });

  const { data: trees = [], isLoading: isTreesLoading } = useQuery({
    queryKey: ['dashboard-trees'],
    queryFn: async () => {
      const { data } = await axios.get(`${API_URL}/api/trees`);
      return data;
    },
  });

  const { data: balance } = useQuery({
    queryKey: ['credit-balance'],
    queryFn: async () => {
      const { data } = await axios.get(`${API_URL}/api/credits/balance`);
      return data;
    },
    enabled: !!localStorage.getItem('eco_token'),
  });

  // Beginner metrics from the user's own trees.
  const myTrees = useMemo(() => (Array.isArray(trees) ? trees : []), [trees]);
  const verifiedTrees = myTrees.filter(t => t.status === 'VERIFIED');
  const needingAttention = myTrees.filter(t =>
    t.status === 'CUT_REPORTED' || t.status === 'CUT_CONFIRMED' || t.status === 'REJECTED'
  );
  const credits = balance?.available != null ? Number(balance.available) : 0;

  const loading = isStatsLoading || isTreesLoading;

  return (
    <div className="min-h-screen bg-[#f3f8f4] py-8 px-6 lg:px-10">
      <div className="max-w-[1100px] mx-auto space-y-10">

        {loading ? (
          <div className="flex items-center justify-center py-32">
            <Activity className="w-10 h-10 text-emerald-500 animate-pulse" />
          </div>
        ) : (
          <>
            {/* ── START HERE ─────────────────────────────────────── */}
            <motion.section
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0f3d2a] via-[#155c3e] to-[#0a2e1e] p-8 lg:p-12 shadow-xl"
            >
              <div className="absolute -top-16 -right-16 w-72 h-72 bg-emerald-400/10 rounded-full blur-3xl" />
              <div className="relative">
                <p className="text-emerald-300 text-xs font-semibold tracking-wide mb-3">
                  Welcome to EcoChain 🌱
                </p>
                <h1 className="text-3xl lg:text-4xl font-bold text-white leading-tight max-w-2xl">
                  Track your trees, earn verified carbon credits, and help restore forests.
                </h1>

                <div className="flex flex-wrap gap-3 mt-8">
                  <button
                    onClick={() => navigate('/planttree')}
                    className="flex items-center gap-2 bg-white text-emerald-800 font-semibold px-6 py-3 rounded-xl hover:bg-emerald-50 transition shadow-lg"
                  >
                    <TreePine className="w-5 h-5" />
                    Plant Your First Tree
                  </button>
                  <button
                    onClick={() => navigate('/mytrees')}
                    className="flex items-center gap-2 bg-white/10 text-white font-semibold px-6 py-3 rounded-xl hover:bg-white/20 transition border border-white/20"
                  >
                    <TreesIcon className="w-5 h-5" />
                    View My Trees
                  </button>
                </div>
              </div>
            </motion.section>

            {/* ── YOUR JOURNEY ───────────────────────────────────── */}
            <section>
              <h2 className="text-lg font-bold text-slate-900 mb-5">Your EcoChain Journey</h2>
              <div className="grid md:grid-cols-5 gap-3">
                {JOURNEY.map(({ step, title, desc, icon: Icon, path }, i) => (
                  <button
                    key={step}
                    onClick={() => navigate(path)}
                    className="group bg-white rounded-2xl p-5 border border-emerald-50 shadow-sm hover:shadow-md hover:border-emerald-200 transition text-left"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center justify-center">
                        {step}
                      </span>
                      {i < JOURNEY.length - 1 && (
                        <ArrowRight className="w-4 h-4 text-slate-300 hidden lg:block" />
                      )}
                    </div>
                    <Icon className="w-6 h-6 text-emerald-600 mb-2" />
                    <h3 className="font-semibold text-slate-800 text-sm leading-tight">{title}</h3>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">{desc}</p>
                  </button>
                ))}
              </div>
            </section>

            {/* ── KEY NUMBERS (beginner metrics) ─────────────────── */}
            <section>
              <h2 className="text-lg font-bold text-slate-900 mb-5">Your Progress</h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard title="My Trees" value={myTrees.length} icon={TreesIcon} accent="emerald" />
                <MetricCard title="Verified Trees" value={verifiedTrees.length} icon={ShieldCheck} accent="teal" />
                <MetricCard title="Carbon Credits" value={credits} icon={Coins} accent="sky" decimals={2} />
                <MetricCard
                  title="Need Attention"
                  value={needingAttention.length}
                  icon={AlertTriangle}
                  accent={needingAttention.length > 0 ? 'rose' : 'slate'}
                />
              </div>
            </section>

            {/* ── RECENT TREES ───────────────────────────────────── */}
            <section>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-slate-900">Your Trees</h2>
                <button
                  onClick={() => navigate('/mytrees')}
                  className="flex items-center gap-1 text-sm font-semibold text-emerald-700 hover:text-emerald-900"
                >
                  View all <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              {myTrees.length === 0 ? (
                <div className="bg-white rounded-2xl border border-emerald-50 shadow-sm p-10 text-center">
                  <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <TreePine className="w-8 h-8 text-emerald-600" />
                  </div>
                  <h3 className="font-bold text-slate-800 text-lg mb-1">You haven't registered a tree yet</h3>
                  <p className="text-slate-500 text-sm max-w-md mx-auto mb-6">
                    Start by registering your first planted tree. Once submitted, you can track its
                    verification and environmental impact here.
                  </p>
                  <button
                    onClick={() => navigate('/planttree')}
                    className="inline-flex items-center gap-2 bg-emerald-600 text-white font-semibold px-6 py-3 rounded-xl hover:bg-emerald-700 transition"
                  >
                    <TreePine className="w-5 h-5" /> Plant Your First Tree
                  </button>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {myTrees.slice(0, 6).map(tree => (
                    <TreePreviewCard key={tree.id} tree={tree} onClick={() => navigate(`/tree/${tree.tree_id || tree.id}`)} />
                  ))}
                </div>
              )}
            </section>

            {/* ── ADVANCED SECTION (collapsed for beginners) ─────── */}
            <AdvancedStats stats={stats} />
          </>
        )}
      </div>
    </div>
  );
}

const MetricCard = ({ title, value, icon: Icon, accent = 'emerald', decimals = 0 }) => {
  const accents = {
    emerald: 'bg-emerald-50 text-emerald-700',
    teal: 'bg-teal-50 text-teal-700',
    sky: 'bg-sky-50 text-sky-700',
    rose: 'bg-rose-50 text-rose-700',
    slate: 'bg-slate-50 text-slate-600',
  };
  return (
    <div className="bg-white rounded-2xl p-5 border border-emerald-50 shadow-sm">
      <div className={`w-9 h-9 rounded-xl ${accents[accent]} flex items-center justify-center mb-3`}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-xs text-slate-500 mb-0.5">{title}</p>
      <p className="text-2xl font-bold text-slate-900 tabular-nums">{Number(value).toFixed(decimals)}</p>
    </div>
  );
};

const STATUS_LABEL = {
  PENDING_VERIFICATION: { text: 'Awaiting Verification', color: 'text-amber-600 bg-amber-50' },
  VERIFIED: { text: 'Verified', color: 'text-emerald-700 bg-emerald-50' },
  REJECTED: { text: 'Needs Attention', color: 'text-rose-600 bg-rose-50' },
  CUT_REPORTED: { text: 'Reported', color: 'text-orange-600 bg-orange-50' },
  CUT_CONFIRMED: { text: 'Needs Attention', color: 'text-rose-600 bg-rose-50' },
};

const TreePreviewCard = ({ tree, onClick }) => {
  const s = STATUS_LABEL[tree.status] || STATUS_LABEL.PENDING_VERIFICATION;
  return (
    <button
      onClick={onClick}
      className="group bg-white rounded-2xl overflow-hidden border border-emerald-50 shadow-sm hover:shadow-md transition text-left"
    >
      <div className="h-36 overflow-hidden">
        <img src={cleanImageUrl(tree.image_url)} alt={tree.species} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-semibold text-slate-800">{tree.species}</h3>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${s.color}`}>{s.text}</span>
        </div>
        <p className="text-xs text-slate-500">{tree.location || 'Location pending'}</p>
      </div>
    </button>
  );
};

// Advanced registry analytics — collapsed by default to keep the beginner view calm.
const AdvancedStats = ({ stats }) => {
  const [open, setOpen] = useState(false);
  return (
    <section className="border-t border-slate-200 pt-6">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-700"
      >
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        Advanced Registry Overview
      </button>
      {open && (
        <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard title="Total Registered" value={stats.total || 0} icon={TreesIcon} accent="emerald" />
          <MetricCard title="Verified" value={stats.verified || 0} icon={ShieldCheck} accent="teal" />
          <MetricCard title="Pending Review" value={stats.pending || 0} icon={Clock} accent="slate" />
          <MetricCard title="Cut / Reported" value={stats.cut_confirmed || 0} icon={RefreshCcw} accent="rose" />
        </div>
      )}
    </section>
  );
};
