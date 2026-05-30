import React from "react";
import { useNavigate } from "react-router-dom";
import MenuItems from "./MenuItems";
import { User, LogOut } from "lucide-react";
import { useAuth } from "../hooks/useAuth";

const Sidebar = ({ setSidebarOpen }) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  return (
    <div
      className="w-64 h-screen bg-white shadow-lg flex flex-col justify-between relative z-40"
    >
      {/* Logo */}
      <div className="p-4 border-b border-gray-100">
        <img
          onClick={() => navigate("/")}
          src="/logo.png"
          alt="EcoChain Logo"
          className="w-28 mx-auto cursor-pointer hover:scale-105 transition-transform"
        />
      </div>

      {/* Menu Items */}
      <div className="flex-1 overflow-y-auto">
        <MenuItems setSidebarOpen={setSidebarOpen} />
      </div>

      {/* User Info + Logout */}
      <div className="w-full border-t border-gray-200 p-4 px-6 flex items-center justify-between">
        <div className="flex gap-2 items-center overflow-hidden">
          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold shrink-0">
            {user?.wallet_address?.slice(2, 4).toUpperCase() || "U"}
          </div>
          <div className="overflow-hidden">
            <h1 className="text-sm font-medium truncate">
              {user?.full_name || "User"}
            </h1>
            <p className="text-[10px] text-gray-500 truncate font-mono">
              {user?.wallet_address}
            </p>
          </div>
        </div>
        <LogOut
          onClick={logout}
          className="w-5 text-gray-400 hover:text-red-500 transition cursor-pointer shrink-0"
        />
      </div>
    </div>
  );
};

export default Sidebar;
