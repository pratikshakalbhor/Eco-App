import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import PlantTree from "./pages/PlantTree";
import Environment from './pages/Environment';
import Certificate from './pages/Certificate';
import MyTree from "./pages/MyTree";
import Dashboard from "./pages/Dashboard";
import Map from "./pages/Map";
import Profile from "./pages/Profile";
import VerificationQueue from "./pages/VerificationQueue";
import Login from "./pages/Login";
import TreeDetails from "./pages/TreeDetails";
import ReportCut from "./pages/ReportCut";
import Debt from "./pages/Debt";
import Marketplace from "./pages/Marketplace";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) return <div className="h-screen flex items-center justify-center bg-[#0a0a0a] text-white">Loading EcoChain...</div>;
  if (!user) return <Navigate to="/login" replace />;
  
  return children;
};

const RoleRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            
            <Route path="/" element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="planttree" element={<PlantTree />} />
              <Route path="mytree" element={<Navigate to="/mytrees" replace />} />
              <Route path="mytrees" element={<MyTree />} />
              <Route path="tree/:id" element={<TreeDetails />} />
              <Route path="tree/:id/report-cut" element={<ReportCut />} />
              <Route path="debt" element={<Debt />} />
              <Route path="certificate/:id" element={<Certificate />} />
              <Route path="environment" element={<Environment />} />
              <Route path="marketplace" element={<Marketplace />} />
              <Route path="map" element={<Map />} />
              <Route path="profile" element={<Profile />} />
              <Route path="verify" element={<VerificationQueue />} />
              
              <Route path="verification" element={
                <RoleRoute allowedRoles={['verifier', 'admin', 'user']}>
                  <VerificationQueue />
                </RoleRoute>
              } />
            </Route>
          </Routes>
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
