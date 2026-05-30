import React from 'react';
import { motion } from 'framer-motion';

export default function StatsCard({ title, value, icon: Icon, color = 'green', trend, delay = 0 }) {
  const colorClasses = {
    green: 'from-green-500 to-emerald-600',
    blue: 'from-blue-500 to-cyan-600',
    purple: 'from-purple-500 to-pink-600',
    orange: 'from-orange-500 to-amber-600',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      whileHover={{ scale: 1.02, y: -5 }}
      className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-gray-200/50 relative overflow-hidden"
    >
      {/* Background Gradient */}
      <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${colorClasses[color]} opacity-10 rounded-full transform translate-x-12 -translate-y-12`} />
      
      <div className="relative">
        <div className="flex justify-between items-start mb-4">
          <div>
            <p className="text-sm text-gray-600 font-medium">{title}</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
          </div>
          <div className={`p-3 rounded-xl bg-gradient-to-br ${colorClasses[color]} shadow-lg`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
        </div>
        
        {trend && (
          <div className="flex items-center gap-1 text-sm">
            <span className="text-green-600 font-semibold">{trend}</span>
            <span className="text-gray-500">vs last month</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}