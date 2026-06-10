import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { TreeDeciduous, Shield, Award, Globe, TrendingUp, Leaf } from "lucide-react";
import { Card, CardContent } from "../components/ui/Card";
import { Button } from "../components/ui/Button";



import { useQuery } from "@tanstack/react-query";
import axios from "axios";

export default function Home() {
  const { data: globalStats } = useQuery({
    queryKey: ['global-carbon-stats'],
    queryFn: async () => {
      const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/api/credits`);
      return data;
    },
  });

  const { data: trees = [] } = useQuery({
    queryKey: ['trees-all-dashboard'],
    queryFn: async () => {
      const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/api/trees/all`);
      return data;
    },
  });

  const totalCredits = globalStats?.credits_earned || 0;
  const verifiedTrees = trees.filter(t => t.status === "verified" || t.status === "approved").length;

  const stats = [
    { icon: TreeDeciduous, label: "Trees Planted", value: trees.length, color: "text-green-600" },
    { icon: Shield, label: "Trees Verified", value: verifiedTrees, color: "text-blue-600" },
    { icon: Award, label: "Carbon Credits", value: totalCredits.toFixed(1), color: "text-purple-600" },
    { icon: Globe, label: "CO₂ Reduced (kg)", value: (globalStats?.co2_stats?.total_absorbed || 0).toFixed(0), color: "text-orange-600" }
  ];

  const features = [
    {
      icon: TreeDeciduous,
      title: "Plant & Track",
      description: "Register trees with GPS coordinates and photos. Track their growth journey.",
      color: "bg-green-100 text-green-700"
    },
    {
      icon: Shield,
      title: "Verification System",
      description: "NGO and government verifiers validate plantations for authenticity.",
      color: "bg-blue-100 text-blue-700"
    },
    {
      icon: Award,
      title: "NFT Certificates",
      description: "Each verified tree receives a unique digital certificate with QR code.",
      color: "bg-purple-100 text-purple-700"
    },
    {
      icon: TrendingUp,
      title: "Carbon Credits",
      description: "Earn tradeable carbon credits based on CO₂ absorption calculations.",
      color: "bg-orange-100 text-orange-700"
    }
  ];

  return (
    <div className="min-h-screen">

      {/*  Hero Section */}
      <div className="relative bg-gradient-to-r from-green-600 to-emerald-600 text-white overflow-hidden">

        <div
          className="absolute inset-0 bg-cover bg-center opacity-20" style={{ backgroundImage: "url('/ho.jpg')" }}
       ></div>

  
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              Welcome to EcoChain 
            </h1>
            <p className="text-xl md:text-2xl mb-8 text-green-50 max-w-3xl mx-auto">
              Join EcoChain today to plant trees, earn carbon credits, and make a real environmental impact with blockchain transparency.
            </p>


            <div className="flex flex-wrap gap-4 justify-center">
              <Link to="/planttree">
                <Button size="lg" className="bg-white text-green-600 hover:bg-green-50">
                  <TreeDeciduous className="w-5 h-5 mr-2" />
                  Plant a Tree
                </Button>
              </Link>
              <Link to="/dashboard">
                <Button size="lg" variant="outline" className="text-white border-white hover:bg-white/10">
                  View Dashboard
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </div>

      {/*  Stats Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-16 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <motion.div key={index} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }}>
                <Card className="bg-white shadow-lg">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-2">
                      <Icon className={`w-8 h-8 ${stat.color}`} />
                      <span className="text-3xl font-bold">{stat.value}</span>
                    </div>
                    <p className="text-gray-600 text-sm">{stat.label}</p>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/*  Features Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            How EcoChain Works
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            A complete ecosystem for transparent tree plantation tracking and carbon credit management.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.div key={index} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }}>
                <Card className="h-full hover:shadow-xl transition-shadow">
                  <CardContent className="p-6">
                    <div className={`w-12 h-12 rounded-lg ${feature.color} flex items-center justify-center mb-4`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2 text-gray-900">{feature.title}</h3>
                    <p className="text-gray-600">{feature.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/*  CTA Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <Card className="bg-gradient-to-r from-green-600 to-emerald-600 text-white text-center">
          <CardContent className="p-12">
            <Leaf className="w-16 h-16 mx-auto mb-6" />
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Join the Green Revolution</h2>
            <p className="text-xl mb-8 text-green-50 max-w-2xl mx-auto">
              Start planting trees today and earn carbon credits while making a real environmental impact.
            </p>
            <Link to="/planttree">
              <Button size="lg" className="bg-white text-green-600 hover:bg-green-50">
                Get Started Now
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
