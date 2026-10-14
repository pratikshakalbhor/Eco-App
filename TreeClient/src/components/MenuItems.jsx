import React from 'react';
import { NavLink } from 'react-router-dom';
import { menuItemsData, journeyMenuItems, exploreMenuItems, adminMenuItems } from '../data/menuItemsData.jsx';
import { useAuth } from '../hooks/useAuth';

const GroupLabel = ({ children }) => (
  <p className="px-4 pt-5 pb-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
    {children}
  </p>
);

const MenuLink = ({ item, setSidebarOpen }) => {
  const { path, label, Icon } = item;
  return (
    <NavLink
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
  );
};

const MenuItems = ({ setSidebarOpen }) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isVerifier = user?.role === 'verifier';

  return (
    <div className="px-4 text-gray-600 space-y-0.5 font-medium py-4">
      {menuItemsData.map((item) => (
        <MenuLink key={item.id} item={item} setSidebarOpen={setSidebarOpen} />
      ))}

      <GroupLabel>Get Started</GroupLabel>
      {journeyMenuItems.map((item) => (
        <MenuLink key={item.id} item={item} setSidebarOpen={setSidebarOpen} />
      ))}

      <GroupLabel>Explore</GroupLabel>
      {exploreMenuItems.map((item) => (
        <MenuLink key={item.id} item={item} setSidebarOpen={setSidebarOpen} />
      ))}

      {/* Verifier / Admin tools — kept separate so normal users are not confused */}
      {(isAdmin || isVerifier) && (
        <>
          <GroupLabel>Admin & Review</GroupLabel>
          {adminMenuItems.map((item) => (
            <NavLink
              key={item.id}
              to={item.path}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `px-4 py-2.5 flex items-center gap-3 rounded-xl transition-all text-sm ${
                  isActive
                    ? 'bg-rose-50 text-rose-700 font-semibold'
                    : 'hover:bg-gray-50 text-gray-600'
                }`
              }
            >
              {item.Icon && <item.Icon className="w-4 h-4 shrink-0" />}
              {item.label}
            </NavLink>
          ))}
        </>
      )}
    </div>
  );
};

export default MenuItems;
