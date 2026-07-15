import React from 'react';
import { NavLink } from 'react-router-dom';
import { menuItemsData, adminMenuItems } from '../data/menuItemsData.jsx';
import { useAuth } from '../hooks/useAuth';

const MenuItems = ({ setSidebarOpen }) => {
  const { user } = useAuth();

  return (
    <div className="px-4 text-gray-600 space-y-0.5 font-medium py-4">
      {menuItemsData.map(({ id, path, label, Icon }) => (
        <NavLink
          key={id}
          to={path}
          onClick={() => setSidebarOpen(false)}
          className={({ isActive }) =>
            `px-4 py-2.5 flex items-center gap-3 rounded-xl transition-all text-sm ${
              isActive
                ? 'bg-emerald-50 text-emerald-700 font-semibold'
                : 'hover:bg-gray-50 text-gray-600'
            }`
          }
        >
          {Icon && <Icon className="w-4 h-4 shrink-0" />}
          {label}
        </NavLink>
      ))}

      {/* Admin-only items */}
      {(user?.role === 'admin') && (
        <>
          <div className="px-4 pt-4 pb-1">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Admin</p>
          </div>
          {adminMenuItems.map(({ id, path, label, Icon }) => (
            <NavLink
              key={id}
              to={path}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `px-4 py-2.5 flex items-center gap-3 rounded-xl transition-all text-sm ${
                  isActive
                    ? 'bg-rose-50 text-rose-700 font-semibold'
                    : 'hover:bg-gray-50 text-gray-600'
                }`
              }
            >
              {Icon && <Icon className="w-4 h-4 shrink-0" />}
              {label}
            </NavLink>
          ))}
        </>
      )}
    </div>
  );
};

export default MenuItems;
