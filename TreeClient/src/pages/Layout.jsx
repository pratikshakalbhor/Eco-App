import React, { useState } from "react";
import Sidebar from "../components/Sidebar.jsx";
import Navbar from "../components/Navbar.jsx";
import LoadingComponent from "../components/Loading.jsx";
import { Outlet } from "react-router-dom";
import { Menu, X } from "lucide-react";

const Layout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLoading] = useState(false);

  if (isLoading) {
    return <LoadingComponent />;
  }

  return (
    <div className="flex h-screen overflow-hidden relative">
      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-40 transform transition-transform duration-300 
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} 
        sm:relative sm:translate-x-0`}
      >
        <Sidebar setSidebarOpen={setSidebarOpen} />
      </div>

      {/* Overlay for mobile (click to close) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black opacity-40 z-30 sm:hidden"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      {/* Main content area */}
      <div className="flex-1 flex flex-col bg-slate-50 overflow-y-auto relative z-10">
        <Navbar />
        <main className="p-6 flex-1">
          <Outlet />
        </main>
      </div>

      {/* Mobile Toggle Buttons */}
      {sidebarOpen ? (
        <X
          className="absolute top-3 right-3 p-2 z-50 bg-white rounded-md shadow w-10 h-10 text-gray-600 sm:hidden cursor-pointer"
          onClick={() => setSidebarOpen(false)}
        />
      ) : (
        <Menu
          className="absolute top-3 right-3 p-2 z-50 bg-white rounded-md shadow w-10 h-10 text-gray-600 sm:hidden cursor-pointer"
          onClick={() => setSidebarOpen(true)}
        />
      )}
    </div>
  );
};

export default Layout;
