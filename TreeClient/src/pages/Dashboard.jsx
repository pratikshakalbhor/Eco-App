import React from 'react';
import { ClerkProvider } from '@clerk/clerk-react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { LayoutDashboard, TreePine, Award, TrendingUp, Leaf, Activity } from 'lucide-react';
import axios from 'axios';
import StatsCard from '../components/shared/StatsCard';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b'];

export default function Dashboard() {
  const { data: userStats } = useQuery({
    queryKey: ['user-stats'],
    queryFn: async () => {
      const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/api/user/stats`);
      return data;
    },
  });

  const { data: trees = [], isLoading } = useQuery({
    queryKey: ['trees'],
    queryFn: async () => {
      const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/api/trees`);
      return data;
    },
  });

  const stats = {
    totalTrees: userStats?.total_trees || 0,
    verifiedTrees: userStats?.verified_trees || 0,
    totalCredits: (userStats?.carbon_credits || 0).toFixed(2),
    nftsMinted: userStats?.nfts_minted || 0,
  };

  const statusData = Object.entries(
    trees.reduce((acc, tree) => {
      acc[tree.status] = (acc[tree.status] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value }));

  const speciesData = Object.entries(
    trees.reduce((acc, tree) => {
      acc[tree.species] = (acc[tree.species] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value }));

  const monthlyData = [
    { month: 'Jan', trees: 2, credits: 1.2 },
    { month: 'Feb', trees: 5, credits: 3.4 },
    { month: 'Mar', trees: 8, credits: 5.8 },
    { month: 'Apr', trees: 12, credits: 8.9 },
    { month: 'May', trees: trees.length, credits: parseFloat(stats.totalCredits) },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold text-gray-900 flex items-center gap-3 mb-3">
            <LayoutDashboard className="w-10 h-10 text-green-600" />
            Analytics Dashboard
          </h1>
          <p className="text-gray-600">Comprehensive view of your environmental impact</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatsCard
            title="Total Trees"
            value={stats.totalTrees}
            icon={TreePine}
            color="green"
            delay={0}
          />
          <StatsCard
            title="Carbon Credits"
            value={`${stats.totalCredits}t`}
            icon={Leaf}
            color="blue"
            delay={0.1}
          />
          <StatsCard
            title="NFTs Minted"
            value={stats.nftsMinted}
            icon={Award}
            color="purple"
            delay={0.2}
          />
          <StatsCard
            title="Verified Trees"
            value={stats.verifiedTrees}
            icon={TrendingUp}
            color="orange"
            delay={0.3}
          />
        </div>

        <div className="grid lg:grid-cols-2 gap-8 mb-8">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200"
          >
            <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Activity className="w-5 h-5 text-green-600" />
              Growth Trend
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="trees" stroke="#10b981" strokeWidth={2} />
                <Line type="monotone" dataKey="credits" stroke="#3b82f6" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200"
          >
            <h3 className="text-xl font-bold text-gray-900 mb-6">Tree Status Distribution</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => entry.name}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200"
        >
          <h3 className="text-xl font-bold text-gray-900 mb-6">Species Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={speciesData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>
    </div>
  );
}


