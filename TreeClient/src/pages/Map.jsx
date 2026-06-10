import React, { useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { 
    Search, MapPin, CheckCircle, Clock, 
    Filter, Scissors, Leaf, ShieldCheck,
    Navigation, Layers, Activity, X, Globe
} from "lucide-react";
import L from "leaflet";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";

const createCustomIcon = (color, iconType, isSelected = false) => {
  const size = isSelected ? 48 : 36;
  const iconHtml = `
    <div style="position: relative; width: ${size}px; height: ${size}px;">
      ${isSelected ? `
        <div style="
          position: absolute;
          inset: -8px;
          background-color: ${color};
          opacity: 0.2;
          border-radius: 50%;
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        "></div>
      ` : ''}
      <div style="
        background-color: white;
        width: 100%;
        height: 100%;
        border-radius: 20% 80% 20% 80% / 20% 80% 20% 80%;
        transform: rotate(45deg);
        border: 3px solid ${color};
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
        transition: all 0.3s ease;
      ">
        <div style="transform: rotate(-45deg); display: flex; align-items: center; justify-content: center;">
          <svg width="${size/2}" height="${size/2}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            ${iconType === 'leaf' ? '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 3.5 1.1 9.2A7 7 0 0 1 11 20Z"/><path d="M11 20v-5"/><path d="M7 15l2-2"/><path d="M13 13l2-2"/>' : 
              iconType === 'scissors' ? '<circle cx="6" cy="6" r="3"/><path d="M8.12 8.12 12 12"/><circle cx="6" cy="18" r="3"/><path d="M14.8 14.8 20 20"/><path d="M8.12 15.88 16 8"/><path d="M6 15h0"/>' :
              '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>'}
          </svg>
        </div>
      </div>
    </div>
  `;
  return L.divIcon({
    html: iconHtml,
    className: 'custom-map-icon',
    iconSize: [size, size],
    iconAnchor: [size/2, size],
  });
};

const MapPage = () => {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedTree, setSelectedTree] = useState(null);
  const [mapType, setMapType] = useState("satellite"); 

  const { data: trees = [], isLoading } = useQuery({
    queryKey: ['map-trees'],
    queryFn: async () => {
      const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/api/trees/all`);
      return data;
    },
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
    retry: 1,
  });

  const filteredTrees = React.useMemo(() => {
    return trees.filter((tree) => {
      const hasCoords = tree.latitude !== undefined && tree.longitude !== undefined && 
                       (tree.latitude !== 0 || tree.longitude !== 0);
      
      const statusMatch = filter === "all" || 
                         (filter === "verified" && tree.status === 'verified' && !tree.is_cut) ||
                         (filter === "cut" && tree.is_cut) ||
                         (filter === "pending" && tree.status === 'pending');
      
      return hasCoords && statusMatch && tree.species.toLowerCase().includes(search.toLowerCase());
    });
  }, [trees, filter, search]);

  const handleImageError = (e) => {
    e.target.src = "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&q=80&w=100";
    e.target.onerror = null;
  };

  const mapUrls = {
    satellite: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    dark: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    light: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
  };

  if (isLoading) return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-900 text-white overflow-hidden">
        <motion.div 
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
            className="mb-8"
        >
            <Globe className="w-20 h-20 text-emerald-400 opacity-20" />
        </motion.div>
        <div className="flex flex-col items-center">
            <h2 className="text-2xl font-black tracking-tighter mb-2">EcoChain GIS Core</h2>
            <p className="text-slate-500 font-bold text-xs uppercase tracking-widest animate-pulse">Synchronizing Global Asset Ledger...</p>
        </div>
    </div>
  );

  return (
    <div className="relative h-screen w-full bg-slate-900 overflow-hidden font-sans">
      
      {/* Floating Controls Dashboard */}
      <div className="absolute top-8 left-8 z-[1000] flex flex-col gap-6 pointer-events-none w-[420px] max-h-[calc(100vh-64px)]">
        
        {/* Header Widget */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-[2rem] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.3)] pointer-events-auto border border-white/20"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-600 rounded-2xl shadow-lg shadow-emerald-200">
                    <Navigation className="w-5 h-5 text-white" />
                </div>
                <div>
                    <h2 className="text-xl font-black text-slate-900 leading-none">Impact Explorer</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Real-time Biosphere Audit</p>
                </div>
            </div>
            <div className="flex bg-slate-100 p-1 rounded-xl">
                {['satellite', 'dark', 'light'].map((type) => (
                    <button 
                        key={type}
                        onClick={() => setMapType(type)}
                        className={`p-2 rounded-lg transition-all ${mapType === type ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        {type === 'satellite' ? <Layers className="w-4 h-4" /> : type === 'dark' ? <div className="w-4 h-4 bg-slate-900 rounded-full" /> : <div className="w-4 h-4 bg-white border border-slate-200 rounded-full" />}
                    </button>
                ))}
            </div>
          </div>

          <div className="space-y-4">
             <div className="relative group">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                <input 
                    type="text"
                    placeholder="Search by species or location..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-slate-50 border-2 border-transparent focus:border-emerald-500/20 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-slate-800 transition-all outline-none"
                />
             </div>
             
             <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                {['all', 'verified', 'cut', 'pending'].map((f) => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                            filter === f ? 'bg-slate-900 text-white shadow-xl shadow-slate-900/20' : 'bg-white border border-slate-100 text-slate-400 hover:border-slate-300'
                        }`}
                    >
                        {f}
                    </button>
                ))}
             </div>
          </div>
        </motion.div>

        {/* Global Stats Widget */}
        <motion.div 
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-2 gap-4 pointer-events-auto"
        >
            <div className="bg-white/90 backdrop-blur-xl p-5 rounded-[2rem] border border-white/20 shadow-xl">
                <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Assets On Map</p>
                <div className="flex items-end gap-2">
                    <span className="text-3xl font-black text-slate-900">{filteredTrees.length}</span>
                    <span className="text-[10px] font-bold text-emerald-500 mb-1">+{trees.length - filteredTrees.length} Hidden</span>
                </div>
            </div>
            <div className="bg-white/90 backdrop-blur-xl p-5 rounded-[2rem] border border-white/20 shadow-xl">
                <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Carbon Shield</p>
                <div className="flex items-end gap-2">
                    <span className="text-3xl font-black text-slate-900">{filteredTrees.reduce((acc, t) => acc + (t.carbon_absorption_rate || 0), 0).toFixed(0)}</span>
                    <span className="text-[10px] font-bold text-slate-400 mb-1">kg/yr</span>
                </div>
            </div>
        </motion.div>

        {/* Dynamic Detail Panel */}
        <AnimatePresence>
            {selectedTree ? (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="bg-slate-900/95 backdrop-blur-2xl rounded-[2.5rem] p-8 text-white border border-white/10 shadow-[0_30px_60px_rgba(0,0,0,0.5)] pointer-events-auto"
                >
                    <div className="flex items-center justify-between mb-6">
                        <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-tighter ${selectedTree.is_cut ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'}`}>
                            {selectedTree.status?.toUpperCase()} ASSET
                        </div>
                        <button 
                            onClick={() => setSelectedTree(null)} 
                            className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    
                    <div className="flex gap-6 mb-8">
                        <div className="relative">
                            <img 
                                src={selectedTree.photo_url} 
                                onError={handleImageError}
                                className="w-32 h-32 rounded-[2rem] object-cover border-2 border-white/10 shadow-2xl" 
                            />
                            <div className="absolute -bottom-2 -right-2 bg-emerald-500 p-2 rounded-xl border-4 border-slate-900">
                                <ShieldCheck className="w-4 h-4 text-white" />
                            </div>
                        </div>
                        <div className="flex-1">
                            <h3 className="text-3xl font-black tracking-tighter mb-1 capitalize">{selectedTree.species}</h3>
                            <p className="text-slate-400 text-sm flex items-center gap-2 mb-4">
                                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                {selectedTree.location_name || 'Geo-Locked Asset'}
                            </p>
                            <div className="flex items-center gap-4">
                                <div className="p-2 bg-white/5 rounded-xl text-center flex-1">
                                    <p className="text-[9px] font-black text-slate-500 uppercase">Sequestration</p>
                                    <p className="text-sm font-black text-emerald-400">{selectedTree.carbon_absorption_rate || 22} kg</p>
                                </div>
                                <div className="p-2 bg-white/5 rounded-xl text-center flex-1">
                                    <p className="text-[9px] font-black text-slate-500 uppercase">Age</p>
                                    <p className="text-sm font-black text-blue-400">2.4 Yrs</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <button className="bg-white text-slate-900 h-14 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-400 transition-colors border-0">
                            View Audit History
                        </button>
                        <button className="bg-slate-800 text-white h-14 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-white/5">
                            Verify Geo-Fence
                        </button>
                    </div>
                </motion.div>
            ) : (
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="bg-white/80 backdrop-blur-md p-6 rounded-[2rem] border border-white/20 shadow-lg pointer-events-auto"
                >
                    <div className="flex items-center gap-4 text-slate-500">
                        <Activity className="w-5 h-5 text-emerald-500" />
                        <p className="text-xs font-bold italic">Select an asset on the map to begin technical audit.</p>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
      </div>

      {/* Map Section */}
      <div className="absolute inset-0 z-0">
        <MapContainer
          center={[20.5937, 78.9629]}
          zoom={5}
          zoomControl={false}
          style={{ height: "100%", width: "100%", background: '#020617' }}
        >
          <TileLayer
            url={mapUrls[mapType]}
            attribution='&copy; <a href="https://ecochain.earth">EcoChain GIS</a>'
            maxZoom={19}
            subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
          />
          {filteredTrees.map((tree) => (
            <Marker
              key={tree.id}
              position={[tree.latitude, tree.longitude]}
              icon={
                tree.is_cut ? createCustomIcon('#f43f5e', 'scissors', selectedTree?.id === tree.id) : 
                tree.status === 'verified' || tree.status === 'approved' ? createCustomIcon('#10b981', 'leaf', selectedTree?.id === tree.id) :
                createCustomIcon('#64748b', 'shield', selectedTree?.id === tree.id)
              }
              eventHandlers={{
                click: (e) => {
                    setSelectedTree(tree);
                    e.target._map.panTo([tree.latitude, tree.longitude]);
                }
              }}
            />
          ))}
        </MapContainer>

        {/* Dynamic Global HUD */}
        <div className="absolute bottom-10 right-10 z-[1000] flex flex-col gap-4 items-end">
             <motion.div 
                whileHover={{ scale: 1.05 }}
                className="bg-slate-900/90 backdrop-blur-2xl rounded-[2rem] px-8 py-5 border border-white/10 text-white shadow-2xl flex items-center gap-6"
             >
                <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Active Guardians</span>
                    <span className="text-2xl font-black text-white">2,842</span>
                </div>
                <div className="w-px h-8 bg-white/10" />
                <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">System Health</span>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-lg font-black text-emerald-400">99.8%</span>
                    </div>
                </div>
             </motion.div>

             <div className="bg-white/90 backdrop-blur-xl rounded-[1.5rem] p-4 border border-white/10 text-slate-700 shadow-xl w-64">
                <p className="text-[10px] font-black uppercase tracking-widest mb-3 opacity-60">GIS Legend</p>
                <div className="space-y-2">
                    <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-md bg-emerald-500 rotate-45" />
                        <span className="text-[10px] font-bold uppercase tracking-tight">Verified Carbon Assets</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-md bg-rose-500 rotate-45" />
                        <span className="text-[10px] font-bold uppercase tracking-tight">Reported Environmental Loss</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-md bg-slate-400 rotate-45" />
                        <span className="text-[10px] font-bold uppercase tracking-tight">Pending Validation</span>
                    </div>
                </div>
             </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes pulse {
          0% { transform: scale(0.95); opacity: 0.5; }
          70% { transform: scale(1.5); opacity: 0; }
          100% { transform: scale(0.95); opacity: 0; }
        }
        .leaflet-container {
            background: #020617 !important;
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0,0,0,0.1);
          border-radius: 10px;
        }
      `}} />
    </div>
  );
};

export default MapPage;
