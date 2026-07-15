import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { 
  Shield, Users, TreePine, Award, Scale, HelpCircle, 
  Settings, RefreshCw, Search, ToggleLeft, ToggleRight, 
  UserCheck, Ban, Edit, Check, AlertTriangle, Eye, ShieldAlert,
  Download, FileSpreadsheet, TreeDeciduous, Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [userSearch, setUserSearch] = useState('');
  const [updatingUserId, setUpdatingUserId] = useState(null);
  const queryClient = useQueryClient();

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/api/admin/stats`);
      return data;
    },
  });

  const { data: users = [], isLoading: usersLoading, refetch: refetchUsers } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/api/admin/users`);
      return data;
    },
  });

  const { data: activity = [], isLoading: activityLoading } = useQuery({
    queryKey: ['recent-activity-admin'],
    queryFn: async () => {
      const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/api/activity/recent?limit=25`);
      return data;
    },
  });

  // ── Mutations ────────────────────────────────────────────────────────────
  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, newRole }) => {
      await axios.put(`${import.meta.env.VITE_API_URL}/api/admin/users/${userId}/role`, {
        role: newRole,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-users']);
      queryClient.invalidateQueries(['admin-stats']);
      setUpdatingUserId(null);
    },
  });

  const handleRoleChange = (userId, currentRole) => {
    // User roles cycle: user -> verifier -> admin -> user
    const rolesCycle = { 'user': 'verifier', 'verifier': 'admin', 'admin': 'user' };
    const newRole = rolesCycle[currentRole] || 'user';
    setUpdatingUserId(userId);
    updateRoleMutation.mutate({ userId, newRole });
  };

  const handleRefresh = () => {
    refetchStats();
    refetchUsers();
  };

  const filteredUsers = users.filter(u => 
    u.full_name?.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.wallet_address?.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.role?.toLowerCase().includes(userSearch.toLowerCase())
  );

  if (statsLoading || usersLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F3F8F5]">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-12 h-12 text-emerald-600 animate-spin" />
          <p className="text-slate-400 font-black uppercase tracking-[0.2em] text-[10px]">Loading Admin Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F3F8F5] py-10 px-6 lg:px-10">
      <div className="max-w-[1440px] mx-auto space-y-10">

        {/* ── Header ────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-5 h-5 text-emerald-600" />
              <span className="text-[10px] font-black uppercase tracking-[0.25em] text-emerald-600">Administrative Portal</span>
            </div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">Ecosystem Control Center</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              className="flex items-center gap-2 px-5 h-12 bg-white hover:bg-slate-50 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all border border-slate-100 shadow-sm"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh Node
            </button>
            <button
              className="flex items-center gap-2 px-5 h-12 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all shadow-lg shadow-emerald-100"
            >
              <Download className="w-4 h-4" />
              Export ESG Ledger
            </button>
          </div>
        </div>

        {/* ── Sub Navigation Tabs ───────────────────────────── */}
        <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl w-fit">
          {[
            { id: 'overview', label: 'Ecosystem KPIs', icon: Shield },
            { id: 'users', label: 'Role & User Registry', icon: Users },
            { id: 'activity', label: 'Ecosystem Events', icon: Activity },
          ].map(tab => {
            const TabIcon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                  activeTab === tab.id 
                    ? 'bg-white text-emerald-600 shadow-sm' 
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <TabIcon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* ── TAB CONTENT: OVERVIEW ─────────────────────────── */}
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-10"
            >
              {/* Primary Stats Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <AdminStatCard title="Total Citizens" value={stats?.total_users || 0} subtitle="Registered Wallets" icon={Users} color="emerald" />
                <AdminStatCard title="Total Forest Assets" value={stats?.total_trees || 0} subtitle="Sum of Registered Trees" icon={TreePine} color="teal" />
                <AdminStatCard title="Total Carbon Issued" value={`${stats?.total_credits?.toFixed(2) || '0.00'}`} unit="t" subtitle="Carbon Sequestration Tokens" icon={Award} color="emerald" />
                <AdminStatCard title="Ecosystem Volume" value={`$${stats?.total_market_volume?.toFixed(2) || '0.00'}`} subtitle="Marketplace Credit Transacted" icon={Scale} color="sky" />
              </div>

              {/* Lifecycle & Queues */}
              <div className="grid lg:grid-cols-3 gap-6">
                
                {/* Visual Status Breakdown */}
                <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-emerald-50 space-y-6">
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-2">Ecosystem Health</h3>
                  
                  <ProgressBarLabel label="Verified & Protected" value={stats?.verified_trees || 0} total={stats?.total_trees || 1} color="bg-emerald-500" />
                  <ProgressBarLabel label="Pending Verification" value={stats?.pending_trees || 0} total={stats?.total_trees || 1} color="bg-amber-400" />
                  <ProgressBarLabel label="Physical Debris / Cuts" value={stats?.cut_trees || 0} total={stats?.total_trees || 1} color="bg-rose-500" />
                  <ProgressBarLabel label="Rejected / Flagged" value={stats?.rejected_trees || 0} total={stats?.total_trees || 1} color="bg-slate-400" />
                </div>

                {/* Audit & Queues Alerts */}
                <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-emerald-50 space-y-5">
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-2">Pending Audits</h3>
                  
                  <QueueRow label="Tree Verification Queue" count={stats?.pending_trees || 0} desc="Requires manual verification & carbon score assignment." alert={stats?.pending_trees > 0} link="/verification" />
                  <QueueRow label="Illegal Cut Notification Audit" count={stats?.pending_cut_reports || 0} desc="Open cut reports waiting for administrative validation." alert={stats?.pending_cut_reports > 0} link="/verification" />
                </div>

                {/* Accountability Liabilities */}
                <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-emerald-50 space-y-6">
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-2">Compensation Outstanding</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-orange-50 rounded-2xl border border-orange-100 text-center">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Active Debts</p>
                      <p className="text-4xl font-black text-orange-700">{stats?.active_debts || 0}</p>
                      <p className="text-[10px] text-orange-600/70 mt-1 font-bold">Awaiting Restoration</p>
                    </div>
                    <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 text-center">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Cleared Debts</p>
                      <p className="text-4xl font-black text-emerald-700">{stats?.cleared_debts || 0}</p>
                      <p className="text-[10px] text-emerald-600/70 mt-1 font-bold">100% Compensated</p>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl text-center">
                    <p className="text-[10px] text-slate-400 font-bold">Average restoration compliance rate is <strong>92.5%</strong> globally.</p>
                  </div>
                </div>

              </div>
            </motion.div>
          )}

          {/* ── TAB CONTENT: USERS ────────────────────────────── */}
          {activeTab === 'users' && (
            <motion.div
              key="users"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="bg-white rounded-[2.5rem] shadow-sm border border-emerald-50 overflow-hidden"
            >
              {/* Search Bar */}
              <div className="p-8 border-b border-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h3 className="font-black text-slate-900 text-lg">Tree Citizen Registry</h3>
                  <p className="text-slate-400 text-xs">Manage system-wide permissions and roles programmatically.</p>
                </div>
                <div className="relative w-full sm:w-80">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search wallet, name, role..."
                    value={userSearch}
                    onChange={e => setUserSearch(e.target.value)}
                    className="w-full h-12 pl-11 pr-5 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-200 transition-all"
                  />
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="py-6 pl-10 text-[10px] font-black text-slate-400 uppercase tracking-wider">Citizen / Name</TableHead>
                      <TableHead className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Wallet Address</TableHead>
                      <TableHead className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Authorization Role</TableHead>
                      <TableHead className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Planter Experience</TableHead>
                      <TableHead className="text-[10px] font-black text-slate-400 uppercase tracking-wider text-right pr-10">Administrative Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user, i) => (
                      <TableRow key={user.id} className="hover:bg-emerald-50/20 border-b border-slate-50 last:border-0">
                        <TableCell className="py-5 pl-10">
                          <div>
                            <p className="font-bold text-slate-800">{user.full_name || 'Anonymous Planter'}</p>
                            <p className="text-[10px] text-slate-400 font-bold">Citizen since {new Date(user.created_at).toLocaleDateString()}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <code className="text-xs font-mono text-slate-500">{user.wallet_address}</code>
                        </TableCell>
                        <TableCell>
                          <Badge className={`${
                            user.role === 'admin' ? 'bg-orange-50 text-orange-700 border-orange-100' :
                            user.role === 'verifier' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                            'bg-slate-50 text-slate-600 border-slate-100'
                          } border text-[9px] font-black uppercase tracking-wider`}>
                            {user.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs font-bold text-slate-700">{user.xp_points || 0} XP</span>
                        </TableCell>
                        <TableCell className="text-right pr-10">
                          <button
                            onClick={() => handleRoleChange(user.id, user.role)}
                            disabled={updatingUserId === user.id}
                            className="inline-flex items-center gap-1.5 px-4 h-9 bg-slate-900 border border-slate-150 hover:bg-slate-800 text-white rounded-lg text-[10px] font-black transition-all uppercase tracking-wider disabled:opacity-40"
                          >
                            {updatingUserId === user.id ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <>
                                <Edit className="w-3.5 h-3.5" />
                                Cycle Role
                              </>
                            )}
                          </button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredUsers.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-20">
                          <p className="text-slate-400 font-black uppercase text-xs">No matching verified tree citizens found</p>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </motion.div>
          )}

          {/* ── TAB CONTENT: ACTIVITY ────────────────────────── */}
          {activeTab === 'activity' && (
            <motion.div
              key="activity"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="bg-white rounded-[2.5rem] p-8 border border-emerald-50 shadow-sm space-y-6"
            >
              <div>
                <h3 className="font-black text-slate-900 text-lg">Ecosystem Operations Stream</h3>
                <p className="text-slate-400 text-xs">Audit log of system events, on-chain notifications and transactions.</p>
              </div>

              {activity.length === 0 ? (
                <div className="text-center py-20 opacity-30">
                  <Activity className="w-12 h-12 mx-auto text-slate-300 mb-4 animate-pulse" />
                  <p className="text-xs font-black text-slate-600 uppercase">Awaiting incoming events...</p>
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-emerald-50" />
                  <div className="space-y-6">
                    {activity.map((event, i) => (
                      <div key={i} className="flex items-start gap-4">
                        <div className="relative z-10 shrink-0 w-12 h-12 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center">
                          <span className="text-base text-emerald-600">🌿</span>
                        </div>
                        <div className="flex-1 bg-slate-50/70 p-4 rounded-xl">
                          <div className="flex justify-between items-start gap-4">
                            <div>
                              <span className="inline-block px-2.5 py-0.5 bg-white border border-slate-100 rounded-full text-[9px] font-black uppercase text-emerald-700 tracking-wider mb-1">
                                {event.event_type}
                              </span>
                              <p className="text-sm font-bold text-slate-800">{event.description}</p>
                              {event.actor && (
                                <code className="text-[10px] text-slate-400 font-mono block mt-1">Actor: {event.actor}</code>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400 font-bold shrink-0">
                              {new Date(event.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}

// ── Shared Subcomponents ────────────────────────────────────────

const AdminStatCard = ({ title, value, subtitle, icon: Icon, color, unit }) => {
  const colors = {
    emerald: 'bg-emerald-500 text-emerald-50 text-emerald-600 border-emerald-100',
    teal: 'bg-teal-600 text-teal-50 text-teal-600 border-teal-100',
    sky: 'bg-sky-500 text-sky-50 text-sky-600 border-sky-150',
  };

  return (
    <div className="bg-white rounded-3xl p-6 border border-emerald-50 shadow-sm relative overflow-hidden">
      <div className="absolute top-0 right-0 p-6 opacity-5"><Icon className="w-24 h-24" /></div>
      <div className="relative flex items-center gap-4">
        <div className={`p-3 rounded-2xl bg-slate-50 border border-slate-100`}>
          <Icon className="w-6 h-6 text-slate-700" />
        </div>
        <div>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{title}</p>
          <h2 className="text-2xl font-black text-slate-900 leading-none mt-1">
            {value} {unit && <span className="text-xs text-slate-400 font-bold">{unit}</span>}
          </h2>
          <p className="text-[10px] text-slate-400 mt-1 font-bold">{subtitle}</p>
        </div>
      </div>
    </div>
  );
};

const ProgressBarLabel = ({ label, value, total, color }) => {
  const percentage = Math.min(((value / total) * 100), 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center text-xs">
        <span className="font-bold text-slate-700">{label}</span>
        <span className="font-black text-slate-900">{value} <span className="text-[10px] text-slate-400 font-normal">({percentage.toFixed(1)}%)</span></span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
};

const QueueRow = ({ label, count, desc, alert, link }) => (
  <div className={`p-4 rounded-2xl flex items-center justify-between border ${alert ? 'bg-orange-50/50 border-orange-100' : 'bg-slate-50 border-slate-100'}`}>
    <div className="flex-1 min-w-0 pr-4">
      <div className="flex items-center gap-2 mb-0.5">
        <span className="text-xs font-black text-slate-800">{label}</span>
        {count > 0 && <span className="px-2 py-0.5 bg-orange-600 text-white rounded-full text-[9px] font-black">{count}</span>}
      </div>
      <p className="text-[10px] text-slate-500 font-bold truncate max-w-xs">{desc}</p>
    </div>
    {link && count > 0 && (
      <a href={link} className="flex items-center gap-1 h-9 px-3 bg-slate-900 text-white rounded-lg text-[9px] font-black uppercase tracking-wider hover:bg-slate-800 transition-colors">
        Verify
      </a>
    )}
  </div>
);
