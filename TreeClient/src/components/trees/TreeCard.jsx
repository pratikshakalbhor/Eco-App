import React from 'react';
import { motion } from 'framer-motion';
import { TreePine, Calendar, MapPin, Award, CheckCircle, Clock, Scissors, Activity } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';

const statusColors = {
  pending:  'bg-yellow-100 text-yellow-800 border-yellow-200',
  approved: 'bg-purple-100 text-purple-800 border-purple-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
  planted:  'bg-blue-100 text-blue-800 border-blue-200',
  growing:  'bg-green-100 text-green-800 border-green-200',
  mature:   'bg-emerald-100 text-emerald-800 border-emerald-200',
  verified: 'bg-purple-100 text-purple-800 border-purple-200',
  archived: 'bg-gray-100 text-gray-800 border-gray-200',
};

function safeDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function formatDate(value, opts = { dateStyle: 'medium' }) {
  const d = safeDate(value);
  if (!d) return 'N/A';
  return d.toLocaleDateString(undefined, opts);
}

export default function TreeCard({ tree, onClick, index = 0 }) {
  const plantedDate = tree.planted_at || tree.planted_date;
  const verifiedDate = tree.verified_at || tree.verified_date;

  const ageDays = plantedDate ? Math.floor((new Date() - new Date(plantedDate)) / (1000 * 60 * 60 * 24)) : 0;
  const ageMonths = Math.floor(ageDays / 30);
  const ageString = ageDays < 30 ? `${ageDays} days` : `${ageMonths} months`;

  const oxygenGen = (tree.carbon_absorption_rate * 1.5).toFixed(1);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.1 }}
      whileHover={{ scale: 1.03, y: -5 }}
      onClick={onClick}
      className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all cursor-pointer border border-gray-200"
    >
      {/* Tree Image */}
      <div className="relative h-48 bg-gradient-to-br from-green-400 to-emerald-600">
        {tree.photo_url ? (
          <img
            src={tree.photo_url}
            alt={tree.species}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <TreePine className="w-20 h-20 text-white/80" />
          </div>
        )}

        {/* NFT Badge */}
        {tree.blockchain_token_id && !tree.blockchain_token_id.startsWith('pending-') && (
          <div className="absolute top-3 right-3">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="bg-purple-500 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-lg"
            >
              <Award className="w-3 h-3" />
              NFT #{tree.blockchain_token_id?.slice(-6)}
            </motion.div>
          </div>
        )}

        {/* Status Badge */}
        <div className="absolute top-3 left-3">
          <Badge className={`${statusColors[tree.status] || statusColors.pending} border font-semibold capitalize`}>
            {tree.status}
          </Badge>
        </div>
      </div>

      {/* Tree Details */}
      <div className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xl font-bold text-gray-900 capitalize">{tree.species}</h3>
          <span className="text-xs font-medium text-gray-400 font-mono truncate max-w-[80px]">
            #{tree.id?.slice(-8)}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-y-3 gap-x-4 mb-4">
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span>Age: {ageString}</span>
          </div>

          <div className="flex items-center gap-2 text-xs text-gray-600">
            <Activity className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="capitalize">Health: {tree.health_status || 'Excellent'}</span>
          </div>

          <div className="flex items-center gap-2 text-xs text-gray-600">
            <CheckCircle className="w-3.5 h-3.5 text-purple-600 shrink-0" />
            <span>Credits: {tree.status === 'approved' || tree.status === 'verified' ? '1.0 ECO' : '0.0'}</span>
          </div>

          <div className="flex items-center gap-2 text-xs text-gray-400">
            <MapPin className="w-3 h-3 shrink-0" />
            <span className="truncate">{tree.location_name || 'In-Situ'}</span>
          </div>
        </div>

        {/* Environmental Stats */}
        <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-bold text-gray-400">CO₂ Absorption</span>
            <span className="text-sm font-bold text-green-600">{tree.carbon_absorption_rate} kg/yr</span>
          </div>
          <div className="flex flex-col text-right">
            <span className="text-[10px] uppercase font-bold text-gray-400">Oxygen Gen</span>
            <span className="text-sm font-bold text-blue-600">{oxygenGen} kg/yr</span>
          </div>
        </div>

        {/* Action Button */}
        {(tree.status === 'approved' || tree.status === 'verified') && !tree.is_cut && (
          <div className="mt-4">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onClick && onClick('report-cut');
              }}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-rose-50 text-rose-600 rounded-xl text-xs font-black hover:bg-rose-100 transition-colors border border-rose-100 uppercase tracking-widest"
            >
              <Scissors className="w-4 h-4" />
              Report Tree Loss
            </button>
          </div>
        )}

        {/* Cut Status / Debt Info */}
        {tree.is_cut && (
          <div className="mt-4 pt-4 border-t border-rose-100 bg-rose-50/30 p-3 rounded-xl">
            <div className="flex items-center gap-2 mb-3">
                <Badge className="bg-rose-500 text-white border-0 text-[10px] font-black uppercase">Asset Removed</Badge>
                {!tree.impact_compensated && (
                    <Badge className="bg-amber-500 text-white border-0 text-[10px] font-black uppercase">Debt Active</Badge>
                )}
            </div>

            <div className="space-y-2">
                <div className="flex justify-between items-center text-[10px]">
                    <span className="text-slate-400 font-bold uppercase">Carbon Loss</span>
                    <span className="text-rose-600 font-black">-{tree.tree_cut_report?.loss_amount || 0} kg</span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                    <span className="text-slate-400 font-bold uppercase">Oxygen Deficit</span>
                    <span className="text-rose-600 font-black">-{tree.tree_cut_report?.oxygen_loss || 0} kg</span>
                </div>
                <div className="flex justify-between items-center text-[10px] border-t border-rose-100 pt-2">
                    <span className="text-slate-700 font-black uppercase">Replacement Ratio</span>
                    <span className="text-rose-700 font-black underline">{tree.tree_cut_report?.compensation_ratio || 3}:1</span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                    <span className="text-slate-700 font-black uppercase">Goal</span>
                    <span className="text-slate-800 font-black bg-white px-2 py-0.5 rounded border border-rose-100">
                        {tree.tree_cut_report?.required_trees || 0} Trees Required
                    </span>
                </div>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}