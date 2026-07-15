import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { LogOut, Coins, Bell, Clock, Eye } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const Navbar = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);
  const dropdownRef = useRef(null);

  const { data: balance } = useQuery({
    queryKey: ['credit-balance-nav'],
    queryFn: async () => {
      const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/api/credits/balance`);
      return data;
    },
    refetchInterval: 30000
  });

  const { data: notifications = [], refetch: refetchNotifications } = useQuery({
    queryKey: ['my-notifications-nav'],
    queryFn: async () => {
      const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/api/notifications`);
      return data;
    },
    refetchInterval: 10000
  });

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    logout();
    navigate("/login");
  };

  const unseenCount = notifications.length; // Simple simulation or count

  return (
    <div className="flex items-center gap-6 relative" ref={dropdownRef}>
      
      {/* ── Carbon Balance Quick View ─────────────────────────────────── */}
      <div className="hidden md:flex items-center gap-3 px-6 py-2.5 bg-emerald-50 border border-emerald-100 rounded-2xl group hover:bg-emerald-100 transition-all cursor-pointer shadow-sm">
        <div className="w-8 h-8 bg-emerald-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
          <Coins className="w-4 h-4" />
        </div>
        <div>
          <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest leading-none mb-1">Balance</p>
          <div className="flex items-baseline gap-1">
            <span className="text-sm font-black text-slate-900 tabular-nums">{balance?.available?.toFixed(3) || '0.000'}</span>
            <span className="text-[9px] font-black text-emerald-500 uppercase">ECO</span>
          </div>
        </div>
      </div>

      {/* ── Notifications Bell ─────────────────────────────────────────── */}
      <div className="relative">
        <button
          onClick={() => setShowNotifications(!showNotifications)}
          className={`flex items-center justify-center w-12 h-12 rounded-2xl border transition-all relative ${
            showNotifications 
              ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
              : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100 hover:text-slate-600'
          }`}
        >
          <Bell className="w-5 h-5" />
          {unseenCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-orange-600 border-2 border-white rounded-full flex items-center justify-center text-[9px] font-black text-white shadow-lg shadow-orange-500/30 animate-pulse">
              {unseenCount}
            </span>
          )}
        </button>

        {/* Dropdown Popover */}
        <AnimatePresence>
          {showNotifications && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute right-0 mt-3 w-80 bg-white border border-slate-100 rounded-3xl shadow-2xl overflow-hidden z-50 pointer-events-auto"
            >
              <div className="p-5 border-b border-slate-50 flex items-center justify-between">
                <div>
                  <h4 className="font-black text-slate-800 text-sm">Actionable Alerts</h4>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Ecosystem Status Updates</p>
                </div>
                <button 
                  onClick={() => refetchNotifications()}
                  className="text-[9px] font-black text-emerald-600 hover:text-emerald-800 uppercase tracking-widest"
                >
                  Refresh
                </button>
              </div>

              <div className="max-h-[320px] overflow-y-auto divide-y divide-slate-50">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-slate-300">
                    <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-[10px] font-black uppercase tracking-wider">Inbox Clean</p>
                  </div>
                ) : (
                  notifications.map((notif, i) => (
                    <div key={i} className="p-4 hover:bg-slate-50 transition-colors flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center text-sm shrink-0">
                        🌿
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="inline-block px-2 py-0.5 bg-white border border-slate-100 rounded-full text-[8px] font-black uppercase text-emerald-600 tracking-wider mb-1">
                          {notif.event_type}
                        </span>
                        <p className="text-xs text-slate-700 font-bold leading-normal">{notif.description}</p>
                        <div className="flex items-center gap-1 mt-1 text-[9px] text-slate-400 font-bold">
                          <Clock className="w-3 h-3" />
                          {new Date(notif.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
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

      {/* ── Logout Button ─────────────────────────────────────────────── */}
      <button
        onClick={handleLogout}
        className="flex items-center justify-center w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 text-slate-400 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-100 transition-all"
        title="Logout"
      >
        <LogOut className="w-5 h-5" />
      </button>
    </div>
  );
};

export default Navbar;

