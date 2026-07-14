import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { LogOut, Coins } from "lucide-react";

const Navbar = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const { data: balance } = useQuery({
    queryKey: ['credit-balance-nav'],
    queryFn: async () => {
      const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/api/credits/balance`);
      return data;
    },
    refetchInterval: 30000
  });

  const handleLogout = async () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="flex items-center gap-6">
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
