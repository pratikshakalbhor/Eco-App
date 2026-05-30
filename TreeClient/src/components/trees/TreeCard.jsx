import React from 'react';
import { motion } from 'framer-motion';
import { TreePine, Calendar, MapPin, Award, CheckCircle, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { format } from 'date-fns';

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  planted: 'bg-blue-100 text-blue-800 border-blue-200',
  growing: 'bg-green-100 text-green-800 border-green-200',
  mature: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  verified: 'bg-purple-100 text-purple-800 border-purple-200',
  archived: 'bg-gray-100 text-gray-800 border-gray-200',
};

export default function TreeCard({ tree, onClick, index = 0 }) {
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
        {tree.nft_minted && (
          <div className="absolute top-3 right-3">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="bg-purple-500 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-lg"
            >
              <Award className="w-3 h-3" />
              NFT #{tree.nft_token_id}
            </motion.div>
          </div>
        )}

        {/* Status Badge */}
        <div className="absolute top-3 left-3">
          <Badge className={`${statusColors[tree.status]} border font-semibold`}>
            {tree.status}
          </Badge>
        </div>
      </div>

      {/* Tree Details */}
      <div className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xl font-bold text-gray-900">{tree.species}</h3>
          <span className="text-sm font-medium text-gray-500">ID: {tree.tree_id}</span>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <MapPin className="w-4 h-4 text-green-600" />
            <span>{tree.location}</span>
          </div>
          
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Calendar className="w-4 h-4 text-blue-600" />
            <span>Planted: {format(new Date(tree.planted_date), 'MMM d, yyyy')}</span>
          </div>

          {tree.age_years && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Clock className="w-4 h-4 text-orange-600" />
              <span>Age: {tree.age_years} years</span>
            </div>
          )}
        </div>

        {/* Carbon Credits */}
        {tree.carbon_credits && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Carbon Credits</span>
              <span className="text-lg font-bold text-green-600">{tree.carbon_credits} tons</span>
            </div>
          </div>
        )}

        {/* Verified Badge */}
        {tree.status === 'verified' && (
          <div className="mt-3 flex items-center gap-2 text-sm text-purple-600">
            <CheckCircle className="w-4 h-4" />
            <span>Verified on {format(new Date(tree.verified_date), 'MMM d')}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}