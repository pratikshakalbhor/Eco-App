import React from "react";
import { NavLink } from "react-router-dom";
import { menuItemsData } from "../data/menuItemsData.jsx";
import { useAuth } from "../hooks/useAuth";
import ZBLogo from "./zb/ZBLogo";
import { LogOut, ChevronLeft } from "lucide-react";

const Sidebar = ({ setSidebarOpen, collapsed, setCollapsed }) => {
  const { user, logout } = useAuth();

  return (
    <div className={`h-screen bg-zb-surface border-r border-zb-border flex flex-col justify-between relative z-40 transition-all duration-300 ${collapsed ? "w-[72px]" : "w-64"}`}>
      <div className="flex flex-col flex-1">
        {/* Logo */}
        <div className={`h-16 flex items-center border-b border-zb-border shrink-0 ${collapsed ? "justify-center px-2" : "px-5"}`}>
          {!collapsed ? (
            <ZBLogo />
          ) : (
            <div className="bg-gradient-to-br from-zb-cyan to-zb-blue rounded-lg w-8 h-8 flex items-center justify-center shadow-lg shadow-zb-cyan/20">
              <span className="text-zb-bg font-bold text-sm">Z</span>
            </div>
          )}
        </div>

        {/* Nav Items */}
        <nav className="flex-1 py-4 px-3 space-y-1">
          {menuItemsData.map((item) => (
            <NavLink
              key={item.id}
              to={item.path}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl transition-all duration-200 text-sm font-medium ${
                  collapsed ? "justify-center px-2 py-3" : "px-3.5 py-2.5"
                } ${
                  isActive
                    ? "bg-zb-cyan/10 text-zb-cyan border border-zb-cyan/20"
                    : "text-zb-text-secondary hover:text-zb-text hover:bg-zb-card border border-transparent"
                }`
              }
            >
              <item.Icon className="w-[18px] h-[18px] shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Collapse Toggle - Desktop only */}
        <div className="hidden lg:flex px-3 pb-2">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-zb-text-muted hover:text-zb-text-secondary hover:bg-zb-card transition-all text-xs"
          >
            <ChevronLeft className={`w-4 h-4 transition-transform duration-200 ${collapsed ? "rotate-180" : ""}`} />
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </div>

      {/* User / Logout */}
      <div className={`border-t border-zb-border p-3 ${collapsed ? "px-2" : "px-4"}`}>
        {!collapsed ? (
          <div className="flex items-center justify-between">
            <div className="flex gap-2.5 items-center overflow-hidden min-w-0">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-zb-cyan/20 to-zb-blue/20 border border-zb-cyan/20 flex items-center justify-center text-zb-cyan text-xs font-bold shrink-0">
                {user?.wallet_address?.slice(2, 4).toUpperCase() || "ZB"}
              </div>
              <div className="overflow-hidden min-w-0">
                <p className="text-xs font-medium text-zb-text truncate">{user?.full_name || "User"}</p>
                <p className="text-[10px] text-zb-text-muted truncate font-mono">{user?.wallet_address ? `${user.wallet_address.slice(0, 6)}...${user.wallet_address.slice(-4)}` : "Not connected"}</p>
              </div>
            </div>
            <button
              onClick={logout}
              className="p-2 rounded-lg text-zb-text-muted hover:text-zb-red hover:bg-zb-red/10 transition-all shrink-0 cursor-pointer"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={logout}
            className="w-full flex items-center justify-center p-2 rounded-lg text-zb-text-muted hover:text-zb-red hover:bg-zb-red/10 transition-all cursor-pointer"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
