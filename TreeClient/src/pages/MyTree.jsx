import React from 'react';
import { ClerkProvider } from '@clerk/clerk-react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Trees as TreesIcon } from 'lucide-react';
import TreeCard from '../components/trees/TreeCard';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import axios from 'axios';

export default function Trees() {
  const [activeFilter, setActiveFilter] = React.useState('all');

  const { data: user } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => ClerkProvider.auth.me(),
  });

  const { data: trees = [], isLoading } = useQuery({
    queryKey: ['trees'],
    queryFn: async () => {
      const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/api/trees`);
      return data;
    },
    initialData: [],
  });

  const filteredTrees = activeFilter === 'all' 
    ? trees 
    : trees.filter(tree => tree.status === activeFilter);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 flex items-center gap-3">
                <TreesIcon className="w-10 h-10 text-green-600" />
                My Trees
              </h1>
              <p className="text-gray-600 mt-2">Total: {trees.length} trees planted</p>
            </div>

            <Tabs value={activeFilter} onValueChange={setActiveFilter}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="planted">Planted</TabsTrigger>
                <TabsTrigger value="growing">Growing</TabsTrigger>
                <TabsTrigger value="verified">Verified</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </motion.div>

        {isLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl h-96 animate-pulse" />
            ))}
          </div>
        ) : filteredTrees.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-20"
          >
            <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <TreesIcon className="w-12 h-12 text-green-600" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3">No trees found</h3>
            <p className="text-gray-600">
              {activeFilter === 'all' 
                ? 'Start by planting your first tree!' 
                : `No trees with status: ${activeFilter}`}
            </p>
          </motion.div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTrees.map((tree, index) => (
              <TreeCard key={tree.id} tree={tree} index={index} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


