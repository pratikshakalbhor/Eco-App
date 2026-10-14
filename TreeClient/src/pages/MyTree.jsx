import React, { useState, useMemo } from 'react';
import API_URL from "../utils/config.js";
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  TreePine, Search, Plus, ShieldCheck, Clock, AlertCircle, MapPin, Sprout
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cleanImageUrl } from '../utils/imageUtils';

// Simple, beginner-friendly statuses.
const STATUS_CONFIG = {
  PENDING_VERIFICATION: { text: 'Awaiting Verification', dot: 'bg-amber-500', icon: Clock, ring: 'text-amber-700 bg-amber-50 border-amber-100' },
  VERIFIED:             { text: 'Verified',             dot: 'bg-emerald-500', icon: ShieldCheck, ring: 'text-emerald-700 bg-emerald-50 border-emerald-100' },
  REJECTED:             { text: 'Needs Attention',      dot: 'bg-rose-500', icon: AlertCircle, ring: 'text-rose-600 bg-rose-50 border-rose-100' },
  CUT_REPORTED:         { text: 'Needs Attention',      dot: 'bg-orange-500', icon: AlertCircle, ring: 'text-orange-600 bg-orange-50 border-orange-200' },
  CUT_CONFIRMED:        { text: 'Needs Attention',      dot: 'bg-rose-600', icon: AlertCircle, ring: 'text-rose-700 bg-rose-100 border-rose-200' },
};

export default function RedesignedMyTrees() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');

  const { data: trees = [], isLoading } = useQuery({
    queryKey: ['my-trees'],
    queryFn: async () => {
      const { data } = await axios.get(`${API_URL}/api/trees/my`);
      return Array.isArray(data) ? data : [];
    },
  });

  const stats = useMemo(() => {
    const verified = trees.filter(t => t.status === 'VERIFIED').length;
    const pending = trees.filter(t => t.status === 'PENDING_VERIFICATION').length;
    const attention = trees.filter(t => ['CUT_REPORTED', 'CUT_CONFIRMED', 'REJECTED'].includes(t.status)).length;
    return { total: trees.length, verified, pending, attention };
  }, [trees]);

  const filteredTrees = useMemo(() => {
    return trees
      .filter(t => {
        const matchesSearch = (t.species || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                             (t.location || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter = activeFilter === 'all' || t.status === activeFilter;
        return matchesSearch && matchesFilter;
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [trees, searchTerm, activeFilter]);

  return (
    <div className="min-h-screen bg-[#F8FAF9] py-10 px-6 lg:px-12">
      <div className="max-w-6xl mx-auto space-y-8">

        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">My Trees</h1>
            <p className="text-slate-500 mt-1">Track and manage all the trees you've registered.</p>
          </div>
          <Button
            onClick={() => navigate('/planttree')}
            className="h-12 px-6 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold gap-2 shadow-lg shadow-emerald-200"
          >
            <Plus className="w-5 h-5" /> Plant a Tree
          </Button>
        </div>

        {/* Simple summary */}
        <div className="grid grid-cols-3 gap-4 max-w-md">
          <SummaryStat label="All" value={stats.total} tone="text-slate-900" />
          <SummaryStat label="Verified" value={stats.verified} tone="text-emerald-600" />
          <SummaryStat label="Need attention" value={stats.attention} tone="text-rose-600" />
        </div>

        {/* Controls */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-sm border border-emerald-50">
          <div className="relative flex-1 max-w-md w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search by species or location..."
              className="pl-12 h-12 bg-slate-50 border-none focus:ring-2 focus:ring-emerald-500 rounded-xl"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl">
            {['all', 'PENDING_VERIFICATION', 'VERIFIED', 'REJECTED', 'CUT_CONFIRMED'].map(f => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${activeFilter === f ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              >
                {f === 'all' ? 'All' : f === 'CUT_CONFIRMED' ? 'Needs attention' : f.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl h-80 animate-pulse border border-slate-100" />
            ))}
          </div>
        ) : filteredTrees.length === 0 ? (
          <div className="bg-white rounded-3xl p-16 text-center border border-emerald-50">
            <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-5">
              <TreePine className="w-10 h-10 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">
              {trees.length === 0 ? "You haven't registered a tree yet" : "No trees found"}
            </h2>
            <p className="text-slate-500 mb-6 max-w-md mx-auto">
              {trees.length === 0
                ? "Start by registering your first planted tree. Once submitted, you can track its verification and environmental impact here."
                : "Try a different search or filter."}
            </p>
            {trees.length === 0 && (
              <Button
                onClick={() => navigate('/planttree')}
                className="rounded-xl border-emerald-200 text-emerald-700 h-12 px-8 font-semibold"
              >
                Plant Your First Tree
              </Button>
            )}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTrees.map((tree, i) => (
              <TreeCard key={tree.id} tree={tree} index={i} onClick={() => navigate(`/tree/${tree.tree_id || tree.id}`)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const SummaryStat = ({ label, value, tone }) => (
  <div className="bg-white rounded-2xl p-4 shadow-sm border border-emerald-50">
    <p className={`text-2xl font-bold tabular-nums ${tone}`}>{value}</p>
    <p className="text-xs text-slate-500">{label}</p>
  </div>
);

const TreeCard = ({ tree, onClick }) => {
  const status = STATUS_CONFIG[tree.status] || STATUS_CONFIG.PENDING_VERIFICATION;
  return (
    <button
      onClick={onClick}
      className="group bg-white rounded-2xl overflow-hidden border border-emerald-50 shadow-sm hover:shadow-md transition text-left"
    >
      <div className="relative h-44 overflow-hidden">
        <img src={cleanImageUrl(tree.image_url)} alt={tree.species} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
        <span className={`absolute top-3 left-3 text-xs font-medium px-2.5 py-1 rounded-full border ${status.ring}`}>
          {status.text}
        </span>
        {tree.is_replacement && (
          <span className="absolute top-3 right-3 bg-emerald-600 text-white text-[10px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1">
            <Sprout className="w-3 h-3" /> Replacement
          </span>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-semibold text-slate-800">{tree.species}</h3>
          {tree.nickname && <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 text-xs capitalize">"{tree.nickname}"</Badge>}
        </div>
        <div className="space-y-1 mt-2 text-sm text-slate-500">
          <p className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-slate-400" /> {tree.location || 'Location pending'}</p>
          <p className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-slate-400" /> Planted {new Date(tree.planted_at).toLocaleDateString()}</p>
          <p className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-slate-400" /> {tree.health_status || '—'}</p>
        </div>
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
          <span className="text-sm font-medium text-emerald-700">View Tree</span>
          <span className="text-sm text-slate-300 group-hover:text-emerald-600 transition">→</span>
        </div>
      </div>
    </button>
  );
};
