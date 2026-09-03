import React, { useState, useEffect, useRef } from "react";
import API_URL from "../utils/config.js";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Bell, Clock, LogOut, Settings, ChevronDown, Wifi, WifiOff } from "lucide-react";
import { AnimatePresence } from "framer-motion";

const TopHeader = ({ setSidebarOpen }) => {
  const { logout, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const notifRef = useRef(null);
  const userMenuRef = useRef(null);

  const { data: notifications = [], refetch: refetchNotifications } = useQuery({
    queryKey: ["zb-notifications"],
    queryFn: async () => {
      const { data } = await axios.get(`${API_URL}/api/notifications`);
      return data;
    },
    refetchInterval: 15000,
    enabled: !authLoading && !!user,
  });

  useEffect(() => {
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifications(false);
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setShowUserMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleLogout = async () => {
    logout();
    navigate("/login");
  };

  const unseenCount = notifications.length;

  return (
    <header className="h-16 bg-zb-surface/80 backdrop-blur-xl border-b border-zb-border flex items-center justify-between px-4 lg:px-6 shrink-0 z-20">
      {/* Left: Mobile menu + Network */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 rounded-lg text-zb-text-secondary hover:text-zb-text hover:bg-zb-card lg:hidden transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Network indicator */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-zb-card border border-zb-border rounded-lg">
          <div className="w-1.5 h-1.5 rounded-full bg-zb-green animate-zb-pulse" />
          <span className="text-[11px] font-semibold text-zb-text-secondary uppercase tracking-wider hidden sm:inline">Preprod</span>
          <span className="text-[11px] font-semibold text-zb-text-secondary uppercase tracking-wider sm:hidden">Testnet</span>
        </div>

        {/* Midnight Status */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-zb-card border border-zb-border rounded-lg">
          <div className="w-1.5 h-1.5 rounded-full bg-zb-purple" />
          <span className="text-[11px] font-semibold text-zb-text-secondary uppercase tracking-wider">Midnight</span>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2" ref={notifRef}>
        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => { setShowNotifications(!showNotifications); setShowUserMenu(false); }}
            className={`relative p-2.5 rounded-xl border transition-all ${
              showNotifications
                ? "bg-zb-cyan/10 text-zb-cyan border-zb-cyan/20"
                : "bg-zb-card text-zb-text-muted border-zb-border hover:text-zb-text-secondary hover:border-zb-border-light"
            }`}
          >
            <Bell className="w-4 h-4" />
            {unseenCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-zb-amber rounded-full flex items-center justify-center text-[9px] font-bold text-zb-bg border-2 border-zb-surface">
                {unseenCount > 9 ? "9+" : unseenCount}
              </span>
            )}
          </button>

          <AnimatePresence>
            {showNotifications && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                className="absolute right-0 mt-2 w-80 bg-zb-card border border-zb-border rounded-2xl shadow-2xl overflow-hidden z-50"
              >
                <div className="p-4 border-b border-zb-border flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-zb-text">Security Alerts</h4>
                    <p className="text-[10px] text-zb-text-muted uppercase tracking-wider mt-0.5">System Notifications</p>
                  </div>
                  <button onClick={() => refetchNotifications()} className="text-[10px] font-semibold text-zb-cyan hover:text-zb-cyan-dim uppercase tracking-wider">
                    Refresh
                  </button>
                </div>
                <div className="max-h-[280px] overflow-y-auto divide-y divide-zb-border">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center">
                      <Bell className="w-8 h-8 mx-auto mb-2 text-zb-text-muted opacity-40" />
                      <p className="text-[11px] font-medium text-zb-text-muted uppercase tracking-wider">No alerts</p>
                    </div>
                  ) : (
                    notifications.map((notif, i) => (
                      <div key={i} className="p-3.5 hover:bg-zb-card-hover transition-colors flex items-start gap-3">
                        <div className="w-7 h-7 rounded-lg bg-zb-cyan/10 text-zb-cyan flex items-center justify-center shrink-0 mt-0.5">
                          <Bell className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="inline-block px-1.5 py-0.5 bg-zb-surface rounded text-[9px] font-semibold uppercase text-zb-cyan tracking-wider mb-1">
                            {notif.event_type}
                          </span>
                          <p className="text-xs text-zb-text-secondary font-medium leading-relaxed">{notif.description}</p>
                          <div className="flex items-center gap-1 mt-1 text-[10px] text-zb-text-muted">
                            <Clock className="w-3 h-3" />
                            {new Date(notif.created_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* User Menu */}
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => { setShowUserMenu(!showUserMenu); setShowNotifications(false); }}
            className="flex items-center gap-2 pl-2 pr-2.5 py-1.5 bg-zb-card border border-zb-border rounded-xl hover:border-zb-border-light transition-all"
          >
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-zb-cyan/20 to-zb-blue/20 border border-zb-cyan/20 flex items-center justify-center text-zb-cyan text-[10px] font-bold">
              {user?.wallet_address?.slice(2, 4).toUpperCase() || "ZB"}
            </div>
            <span className="text-xs font-medium text-zb-text-secondary hidden sm:inline max-w-[80px] truncate">
              {user?.wallet_address ? `${user.wallet_address.slice(0, 6)}...${user.wallet_address.slice(-4)}` : "Connect"}
            </span>
            <ChevronDown className="w-3 h-3 text-zb-text-muted" />
          </button>

          <AnimatePresence>
            {showUserMenu && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                className="absolute right-0 mt-2 w-56 bg-zb-card border border-zb-border rounded-xl shadow-2xl overflow-hidden z-50"
              >
                <div className="p-3 border-b border-zb-border">
                  <p className="text-xs font-medium text-zb-text truncate">{user?.full_name || "User"}</p>
                  <p className="text-[10px] text-zb-text-muted font-mono truncate mt-0.5">{user?.wallet_address}</p>
                </div>
                <div className="p-1.5">
                  <button
                    onClick={() => { navigate("/wallet"); setShowUserMenu(false); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-zb-text-secondary hover:text-zb-text hover:bg-zb-card-hover transition-colors"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    Settings
                  </button>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-zb-red hover:bg-zb-red/10 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Disconnect
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
};

export default TopHeader;
