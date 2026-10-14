import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import Layout from "./components/Layout";
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
import CarbonCredits from "./pages/CarbonCredits";
import AdminDashboard from "./pages/AdminDashboard";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="h-screen flex items-center justify-center bg-[#0a0a0a] text-white text-sm font-black tracking-widest uppercase animate-pulse">Loading EcoChain...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
};

// Enforces role-based access — redirects non-authorized users to dashboard
const RoleRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-50 text-sm text-slate-400 animate-pulse">Authenticating...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!allowedRoles.includes(user.role)) return <Navigate to="/dashboard" replace />;
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
              <Route path="mytrees" element={<MyTree />} />
              <Route path="tree/:id" element={<TreeDetails />} />
              <Route path="tree/:id/report-cut" element={<ReportCut />} />
              <Route path="debt" element={<Debt />} />
              <Route path="certificate/:id" element={<Certificate />} />
              <Route path="environment" element={<Environment />} />
              <Route path="marketplace" element={<Marketplace />} />
              <Route path="carboncredits" element={<CarbonCredits />} />
              <Route path="map" element={<Map />} />
              <Route path="profile" element={<Profile />} />

              {/* Verifier / Admin - role enforced */}
              <Route path="verification" element={
                <RoleRoute allowedRoles={['verifier', 'admin']}>
                  <VerificationQueue />
                </RoleRoute>
              } />

              {/* Admin only */}
              <Route path="admin" element={
                <RoleRoute allowedRoles={['admin']}>
                  <AdminDashboard />
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
