import React, { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { 
  TreePine, Upload, Loader2, CheckCircle2, MapPin, 
  Calendar, Camera, Thermometer, Info, Search, 
  ChevronDown, X, Sparkles, Globe, ShieldCheck,
  Navigation, Trash2, Sprout, AlertTriangle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Label } from "../components/ui/Label";
import { Badge } from "../components/ui/Badge";
import axios from "axios";
import { registerTreeOnChain, isSepoliaNetwork, connectWallet } from "../utils/web3Service";
import { uploadToIPFS } from "../utils/ipfsService";
import { useAuth } from "../hooks/useAuth";

const COMMON_SPECIES = [
  "Neem", "Mango", "Banyan", "Peepal", "Ashoka",
  "Jackfruit", "Coconut", "Mahogany", "Teak",
  "Sal", "Gulmohar", "Oak", "Pine", "Eucalyptus", "Bamboo"
];

const HEALTH_STATUSES = ["Excellent", "Good", "Fair", "Poor", "Critical"];

export default function RedesignedPlantTree() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryParams = new URLSearchParams(location.search);
  const debtId = queryParams.get('debt_id');
  const isReplacementParam = queryParams.get('is_replacement') === 'true';

  const [formData, setFormData] = useState({
    species: "",
    tree_name: "",
    location_name: "",
    latitude: "",
    longitude: "",
    photo_url: "",
    ipfs_hash: "",
    planted_date: new Date().toISOString().split("T")[0],
    estimated_age: "1",
    health_status: "Excellent",
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [blockchainData, setBlockchainData] = useState(null);
  const suggestionsRef = useRef(null);

  // Close suggestions when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredSpecies = COMMON_SPECIES.filter(s => 
    s.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSpeciesSelect = (name) => {
    setSearchTerm(name);
    setFormData(prev => ({ ...prev, species: name }));
    setShowSuggestions(false);
  };

  const handleCustomSpecies = (e) => {
    const val = e.target.value;
    setSearchTerm(val);
    setFormData(prev => ({ ...prev, species: val }));
  };

  const captureLocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData((prev) => ({
          ...prev,
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6),
        }));
      },
      () => setError("Could not get location. Please allow location access or enter manually.")
    );
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setError("Photo size must be less than 10MB");
      return;
    }

    setUploading(true);
    setError("");
    try {
      const result = await uploadToIPFS(file);
      setFormData((prev) => ({ ...prev, photo_url: result.url, ipfs_hash: result.hash }));
    } catch (err) {
      console.error(err);
      // Fallback for dev if Pinata keys are missing/invalid
      const localUrl = URL.createObjectURL(file);
      setFormData((prev) => ({ ...prev, photo_url: localUrl, ipfs_hash: `dev-${Date.now()}` }));
      setError("IPFS upload failed, using local fallback for registration.");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!formData.species) { setError("Tree species is required."); return; }
    if (!formData.latitude || !formData.longitude) { setError("GPS coordinates are required."); return; }
    if (!formData.photo_url) { setError("Please upload a photo of the tree."); return; }

    setSubmitting(true);
    setSuccess(false);

    try {
      // 1. Register on Blockchain
      let tokenId = "";
      let txHash = "";
      try {
        const metaURI = `ipfs://${formData.ipfs_hash}`;
        const walletAddress = user?.wallet_address || (await connectWallet()).address;
        const bcResult = await registerTreeOnChain(walletAddress, formData.ipfs_hash, metaURI);
        tokenId = bcResult.tokenId;
        txHash = bcResult.txHash;
        setBlockchainData({ tokenId, txHash });
      } catch (bcErr) {
        console.error("Blockchain Registration Failed:", bcErr);
        throw new Error("Failed to register tree on blockchain. Please ensure you have Sepolia ETH and confirm the transaction in MetaMask.");
      }

      // 2. Save to Backend with TokenID
      const payload = {
        species: formData.species,
        nickname: formData.tree_name,
        location: formData.location_name,
        latitude: parseFloat(formData.latitude),
        longitude: parseFloat(formData.longitude),
        image_url: formData.photo_url,
        ipfs_hash: formData.ipfs_hash,
        planting_date: formData.planted_date,
        age: parseInt(formData.estimated_age),
        health_status: formData.health_status,
        blockchain_token_id: tokenId,
        transaction_hash: txHash,
        is_replacement: isReplacementParam || false,
        replanted_debt_id: debtId || "",
      };

      const token = localStorage.getItem('eco_token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const { data } = await axios.post(`${import.meta.env.VITE_API_URL}/api/trees`, payload, { headers });
      
      // 3. Link to debt if applicable (backend handles some but good to be explicit or let backend do it)
      // The backend RegisterTree handles the debt linking if ReplantedDebtID is provided.

      setSuccess(true);
      setBlockchainData(prev => ({ ...prev, tree_id: data.tree.tree_id }));
      
      // Auto redirect after 3 seconds or on button click
      setTimeout(() => {
        navigate('/mytrees');
      }, 3000);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || "Registration failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-[#FDFEFF] flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white rounded-[2.5rem] p-10 shadow-2xl border border-emerald-50 text-center"
        >
          <div className="relative w-24 h-24 mx-auto mb-8">
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring" }}
              className="absolute inset-0 bg-emerald-500 rounded-full flex items-center justify-center z-10"
            >
              <CheckCircle2 className="w-12 h-12 text-white" />
            </motion.div>
            <motion.div 
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="absolute inset-0 bg-emerald-100 rounded-full opacity-50"
            />
          </div>

          <h2 className="text-3xl font-black text-slate-900 mb-2">Registration Complete</h2>
          <p className="text-slate-500 mb-8">Your tree has been minted on-chain and registered for verification.</p>

          <div className="bg-slate-50 rounded-2xl p-5 mb-8 text-left space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black text-slate-400 uppercase">Tree ID (NFT)</span>
              <span className="text-sm font-black text-emerald-600">#{blockchainData?.tokenId || "Pending"}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black text-slate-400 uppercase">Status</span>
              <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">Verification Pending</span>
            </div>
            <div className="pt-2 border-t border-slate-200 overflow-hidden">
                <span className="text-[10px] font-black text-slate-400 uppercase block mb-1">Transaction Hash</span>
                <p className="text-[10px] font-mono text-slate-400 break-all">{blockchainData?.txHash}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Button 
                variant="outline" 
                onClick={() => setSuccess(false)}
                className="rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50"
            >
                Plant Another
            </Button>
            <Button 
                onClick={() => window.location.href = '/dashboard'}
                className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-200"
            >
                View Dashboard
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAF9] py-12 px-6">
      <div className="max-w-[1000px] mx-auto">
        <div className="mb-10 text-center lg:text-left">
          <div className="inline-flex items-center gap-2 mb-4 bg-emerald-100 px-4 py-1.5 rounded-full">
            <Sprout className="w-4 h-4 text-emerald-600" />
            <span className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">Environmental Registry Portal</span>
          </div>
          <h1 className="text-4xl lg:text-5xl font-black text-slate-900 tracking-tight">Plant & Register Your Tree</h1>
          <p className="text-slate-500 mt-2 text-lg max-w-xl">Every tree registered on EcoChain helps restore our planet's carbon balance. Start your journey today.</p>
        </div>

        <div className="grid lg:grid-cols-5 gap-8">
          
          {/* Left: Form */}
          <div className="lg:col-span-3 space-y-6">
            {debtId && (
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-rose-50 border-2 border-rose-100 rounded-3xl p-6 flex items-center justify-between shadow-sm"
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-rose-600 rounded-2xl text-white">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest">Active Resolution</p>
                    <h3 className="text-sm font-black text-slate-900">Linked to Debt: {debtId.slice(0, 8)}...</h3>
                    <p className="text-[10px] text-slate-500 font-medium italic">This tree will count towards your replantation obligation.</p>
                  </div>
                </div>
                <div className="hidden sm:block">
                   <Badge className="bg-rose-100 text-rose-700 border-rose-200 uppercase text-[9px] font-black tracking-widest">Replacement Tree</Badge>
                </div>
              </motion.div>
            )}

            <form onSubmit={handleSubmit} className="bg-white rounded-[2.5rem] p-8 lg:p-10 shadow-xl shadow-emerald-900/5 border border-emerald-50 space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Searchable Species */}
                <div className="relative" ref={suggestionsRef}>
                  <Label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">
                    Tree Species <span className="text-rose-500">*</span>
                  </Label>
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      placeholder="Search or enter tree name..."
                      className="pl-12 h-14 bg-slate-50 border-transparent focus:bg-white focus:border-emerald-500 rounded-2xl transition-all"
                      value={searchTerm}
                      onChange={handleCustomSpecies}
                      onFocus={() => setShowSuggestions(true)}
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                        {searchTerm && (
                            <button type="button" onClick={() => {setSearchTerm(""); setFormData(p => ({...p, species: ""}))}}>
                                <X className="w-4 h-4 text-slate-300 hover:text-slate-500" />
                            </button>
                        )}
                        <ChevronDown className="w-4 h-4 text-slate-300" />
                    </div>
                  </div>

                  <AnimatePresence>
                    {showSuggestions && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute z-50 left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 max-h-60 overflow-y-auto p-2"
                      >
                        {filteredSpecies.length > 0 ? (
                          filteredSpecies.map(s => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => handleSpeciesSelect(s)}
                              className="w-full text-left px-4 py-3 hover:bg-emerald-50 rounded-xl text-sm font-semibold text-slate-700 transition-colors flex items-center justify-between group"
                            >
                              {s}
                              <Sparkles className="w-3 h-3 text-emerald-400 opacity-0 group-hover:opacity-100" />
                            </button>
                          ))
                        ) : (
                          <div className="p-4 text-center">
                            <p className="text-xs text-slate-400 font-bold uppercase mb-1">New Species Detected</p>
                            <p className="text-sm font-semibold text-slate-700">Add "{searchTerm}" to registry?</p>
                            <button 
                                type="button"
                                onClick={() => handleSpeciesSelect(searchTerm)}
                                className="mt-2 text-[10px] bg-emerald-600 text-white px-3 py-1.5 rounded-lg font-black uppercase"
                            >
                                Confirm Custom
                            </button>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Tree Name */}
                <div>
                  <Label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">
                    Tree Name <span className="text-slate-300 text-[10px]">(Optional)</span>
                  </Label>
                  <Input
                    placeholder="E.g. My Favorite Mango Tree"
                    className="h-14 bg-slate-50 border-transparent focus:bg-white focus:border-emerald-500 rounded-2xl transition-all"
                    value={formData.tree_name}
                    onChange={(e) => setFormData(p => ({ ...p, tree_name: e.target.value }))}
                  />
                </div>
              </div>

              {/* Location Name */}
              <div>
                <Label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">
                  Location Name <span className="text-rose-500">*</span>
                </Label>
                <Input
                  placeholder="E.g. Backyard, City Park, Street 5..."
                  className="h-14 bg-slate-50 border-transparent focus:bg-white focus:border-emerald-500 rounded-2xl transition-all"
                  value={formData.location_name}
                  onChange={(e) => setFormData(p => ({ ...p, location_name: e.target.value }))}
                />
              </div>

              {/* Location */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs font-black text-slate-400 uppercase tracking-widest block">
                    GPS Location <span className="text-rose-500">*</span>
                  </Label>
                  <button
                    type="button"
                    onClick={captureLocation}
                    className="flex items-center gap-1.5 text-[10px] font-black text-emerald-600 uppercase group"
                  >
                    <div className="relative">
                        <Navigation className="w-3 h-3 group-hover:rotate-12 transition-transform" />
                        <span className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                    </div>
                    Auto-capture
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      placeholder="Latitude"
                      className="pl-12 h-14 bg-slate-50 border-transparent focus:bg-white focus:border-emerald-500 rounded-2xl"
                      value={formData.latitude}
                      readOnly
                    />
                  </div>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      placeholder="Longitude"
                      className="pl-12 h-14 bg-slate-50 border-transparent focus:bg-white focus:border-emerald-500 rounded-2xl"
                      value={formData.longitude}
                      readOnly
                    />
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 mt-2 ml-2">Location is required for independent verification.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Date */}
                <div>
                  <Label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">
                    Planting Date
                  </Label>
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      type="date"
                      className="pl-12 h-14 bg-slate-50 border-transparent focus:bg-white focus:border-emerald-500 rounded-2xl"
                      value={formData.planted_date}
                      onChange={(e) => setFormData(p => ({ ...p, planted_date: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Age & Health */}
                <div className="grid grid-cols-2 gap-4">
                   <div>
                    <Label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">
                        Est. Age (Yrs)
                    </Label>
                    <Input
                        type="number"
                        min="0"
                        className="h-14 bg-slate-50 border-transparent focus:bg-white focus:border-emerald-500 rounded-2xl"
                        value={formData.estimated_age}
                        onChange={(e) => setFormData(p => ({ ...p, estimated_age: e.target.value }))}
                    />
                   </div>
                   <div>
                    <Label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">
                        Health
                    </Label>
                    <select
                        className="w-full h-14 bg-slate-50 border-transparent rounded-2xl px-4 text-sm font-semibold text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500 transition-all appearance-none"
                        value={formData.health_status}
                        onChange={(e) => setFormData(p => ({ ...p, health_status: e.target.value }))}
                    >
                        {HEALTH_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                   </div>
                </div>
              </div>

              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-rose-50 border border-rose-100 rounded-2xl p-4 flex items-start gap-3"
                >
                  <Info className="w-5 h-5 text-rose-500 shrink-0" />
                  <p className="text-xs font-bold text-rose-600">{error}</p>
                </motion.div>
              )}

              <Button
                type="submit"
                disabled={submitting || uploading}
                className="w-full h-16 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-2xl font-black uppercase tracking-[0.1em] shadow-xl shadow-emerald-500/20 transition-all flex items-center justify-center gap-3 disabled:opacity-70"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span>Minting on Blockchain...</span>
                  </>
                ) : (
                  <>
                    <Globe className="w-5 h-5" />
                    <span>Finalize Tree Registration</span>
                  </>
                )}
              </Button>

            </form>
          </div>

          {/* Right: Upload & Info */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Photo Upload */}
            <div className="bg-white rounded-[2.5rem] p-8 shadow-xl shadow-emerald-900/5 border border-emerald-50">
              <Label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 block text-center">
                Tree Documentation <span className="text-rose-500">*</span>
              </Label>
              
              {!formData.photo_url ? (
                <div className="relative">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    disabled={uploading}
                  />
                  <div className={`
                    border-4 border-dashed rounded-[2rem] p-10 text-center transition-all
                    ${uploading ? 'border-emerald-200 bg-emerald-50' : 'border-slate-100 hover:border-emerald-200 hover:bg-emerald-50'}
                  `}>
                    {uploading ? (
                      <div className="flex flex-col items-center">
                        <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mb-4" />
                        <p className="text-sm font-black text-emerald-800 uppercase animate-pulse">Pinning to IPFS...</p>
                      </div>
                    ) : (
                      <>
                        <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:bg-white">
                          <Camera className="w-8 h-8 text-slate-400" />
                        </div>
                        <p className="text-sm font-black text-slate-700">Drop Tree Photo Here</p>
                        <p className="text-[10px] text-slate-400 mt-2 font-bold uppercase tracking-widest">Supports PNG, JPG (10MB max)</p>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="relative group rounded-[2rem] overflow-hidden"
                >
                  <img 
                    src={formData.photo_url} 
                    alt="Tree Preview" 
                    className="w-full h-64 object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button 
                      type="button" 
                      onClick={() => setFormData(p => ({...p, photo_url: "", ipfs_hash: ""}))}
                      className="bg-white/20 backdrop-blur-md p-4 rounded-full hover:bg-rose-500 transition-colors"
                    >
                      <Trash2 className="w-6 h-6 text-white" />
                    </button>
                  </div>
                  <div className="absolute bottom-4 left-4 right-4 bg-white/20 backdrop-blur-md rounded-xl p-3 border border-white/20">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span className="text-[9px] font-black text-white uppercase tracking-[0.2em]">Verified Documentation</span>
                    </div>
                  </div>
                </motion.div>
              )}

              <div className="mt-6 space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 bg-sky-50 rounded-lg flex items-center justify-center text-sky-600">
                      <Globe className="w-4 h-4" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase">Storage Protocol</p>
                        <p className="text-xs font-bold text-slate-700">InterPlanetary File System</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center text-amber-600">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase">Integrity Hash</p>
                        <p className="text-[10px] font-mono text-slate-500 truncate w-32">
                            {formData.ipfs_hash || "Awaiting upload..."}
                        </p>
                    </div>
                  </div>
              </div>
            </div>

            {/* Verification Stats */}
            <div className="bg-[#1a2e1a] rounded-[2.5rem] p-8 text-white relative overflow-hidden">
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl" />
                <div className="relative z-10">
                    <h3 className="text-lg font-black mb-4 uppercase tracking-widest flex items-center gap-2">
                        <Thermometer className="w-5 h-5 text-emerald-400" />
                        Audit Metrics
                    </h3>
                    <div className="space-y-4">
                        <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                            <p className="text-[10px] font-black text-emerald-400 uppercase mb-1">Impact Potential</p>
                            <p className="text-sm font-bold">~21.7kg CO₂ Sequestration / Year</p>
                        </div>
                        <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                            <p className="text-[10px] font-black text-sky-400 uppercase mb-1">Oxygen Output</p>
                            <p className="text-sm font-bold">~100kg O₂ Generation / Year</p>
                        </div>
                    </div>
                    <div className="mt-8 pt-6 border-t border-white/10">
                        <p className="text-[10px] text-white/50 leading-relaxed italic">
                            By submitting this form, you acknowledge that all data provided is accurate. 
                            False reporting may lead to penalization of your sustainability score.
                        </p>
                    </div>
                </div>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}
