import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Analyze from "./pages/Analyze";
import Security from "./pages/Security";
import WalletPage from "./pages/Wallet";

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
  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-zb-bg">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-2 border-zb-cyan/30 border-t-zb-cyan rounded-full animate-spin" />
        <p className="text-xs text-zb-text-muted font-medium uppercase tracking-widest">Loading ZeroBridge...</p>
      </div>
    </div>
  );
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
              <Route path="analyze" element={<Analyze />} />
              <Route path="security" element={<Security />} />
              <Route path="wallet" element={<WalletPage />} />
              {/* Redirect legacy routes */}
              <Route path="planttree" element={<Navigate to="/analyze" replace />} />
              <Route path="mytrees" element={<Navigate to="/wallet" replace />} />
              <Route path="debt" element={<Navigate to="/security" replace />} />
              <Route path="carboncredits" element={<Navigate to="/wallet" replace />} />
              <Route path="marketplace" element={<Navigate to="/analyze" replace />} />
              <Route path="environment" element={<Navigate to="/dashboard" replace />} />
              <Route path="map" element={<Navigate to="/dashboard" replace />} />
              <Route path="profile" element={<Navigate to="/wallet" replace />} />
              <Route path="verification" element={<Navigate to="/security" replace />} />
              <Route path="admin" element={<Navigate to="/security" replace />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Route>
          </Routes>
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
