import React, { useState, useEffect, useRef } from "react";
import API_URL from "../utils/config.js";
import { useLocation, useNavigate } from "react-router-dom";
import {
  TreePine, Upload, Loader2, CheckCircle2, MapPin,
  Calendar, Camera, Info, Search,
  ChevronDown, ChevronLeft, ChevronRight, X, Globe, ShieldCheck,
  Navigation, Trash2, Sprout, AlertTriangle, Leaf, FileText
} from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Label } from "../components/ui/Label";
import { Badge } from "../components/ui/Badge";
import axios from "axios";
import { registerTreeOnChain, isSepoliaNetwork, connectWallet } from "../utils/web3Service";
import { uploadToIPFS } from "../utils/ipfsService";
import { useAuth } from "../hooks/useAuth";
import { isPositiveNumber, isWithinRange, isNotFutureDate, isRequiredNonEmpty } from "../utils/validation";

const COMMON_SPECIES = [
  "Neem", "Mango", "Banyan", "Peepal", "Ashoka",
  "Jackfruit", "Coconut", "Mahogany", "Teak",
  "Sal", "Gulmohar", "Oak", "Pine", "Eucalyptus", "Bamboo"
];

const HEALTH_STATUSES = ["Excellent", "Good", "Fair", "Poor", "Critical"];

// Beginner-friendly, step-by-step flow.
const STEPS = [
  { key: 'tree', title: 'Tree Information', subtitle: 'Species, name and planting date.' },
  { key: 'location', title: 'Location', subtitle: 'Where is your tree planted?' },
  { key: 'photo', title: 'Photo', subtitle: 'A clear photo of your tree.' },
  { key: 'review', title: 'Review', subtitle: 'Check everything before submitting.' },
];

export default function RedesignedPlantTree() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryParams = new URLSearchParams(location.search);
  const debtId = queryParams.get('debt_id');
  const isReplacementParam = queryParams.get('is_replacement') === 'true';

  const [step, setStep] = useState(0);
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
  const [showTech, setShowTech] = useState(false);
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
      setError("Location isn't supported by your browser. You can skip this for now.");
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
      () => setError("Could not get your location. Please allow location access or enter the name of the area.")
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
      const localUrl = URL.createObjectURL(file);
      setFormData((prev) => ({ ...prev, photo_url: localUrl, ipfs_hash: `dev-${Date.now()}` }));
      setError("Photo upload had an issue, using a local copy for now.");
    } finally {
      setUploading(false);
    }
  };

  const validateStep = (stepIdx) => {
    if (stepIdx === 0) {
      if (!isRequiredNonEmpty(formData.species)) { setError("Please choose a tree species."); return false; }
      if (!isNotFutureDate(formData.planted_date)) { setError("Planting date can't be in the future."); return false; }
      if (!isPositiveNumber(formData.estimated_age) || !isWithinRange(formData.estimated_age, 0, 5000)) {
        setError("Estimated age must be between 0 and 5000 years.");
        return false;
      }
      if (!HEALTH_STATUSES.includes(formData.health_status)) {
        setError("Please select a valid health status.");
        return false;
      }
    }
    if (stepIdx === 1) {
      if (formData.latitude === "" || formData.longitude === "") {
        setError("Please provide the tree's location so it can be verified.");
        return false;
      }
    }
    if (stepIdx === 2) {
      if (!formData.photo_url) {
        setError("Please upload a photo of your tree. This helps a verifier confirm it.");
        return false;
      }
    }
    return true;
  };

  const goNext = () => {
    setError("");
    if (!validateStep(step)) return;
    setStep(s => Math.min(s + 1, STEPS.length - 1));
  };

  const goBack = () => setStep(s => Math.max(s - 1, 0));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

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
        throw new Error("We couldn't finish the secure record for your tree. Please make sure you have Sepolia ETH and confirm the request in MetaMask.");
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
      const { data } = await axios.post(`${API_URL}/api/trees`, payload, { headers });

      setSuccess(true);
      setBlockchainData(prev => ({ ...prev, tree_id: data.tree.tree_id }));
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
          className="max-w-md w-full bg-white rounded-3xl p-10 shadow-2xl border border-emerald-50 text-center"
        >
          <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Tree submitted successfully 🌱</h2>
          <p className="text-slate-500 mb-8">Your tree is now waiting for verification. You'll be able to track its progress below.</p>
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              onClick={() => { setStep(0); setFormData(p => ({ ...p, species: "", tree_name: "", photo_url: "", ipfs_hash: "", latitude: "", longitude: "" })); setSuccess(false); }}
              className="rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              Plant Another
            </Button>
            <Button
              onClick={() => navigate('/mytrees')}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-200"
            >
              View My Tree
            </Button>
          </div>

          {blockchainData && (
            <button
              onClick={() => setShowTech(!showTech)}
              className="mt-6 flex items-center gap-2 text-xs font-medium text-emerald-700 hover:underline mx-auto"
            >
              <FileText className="w-4 h-4" /> Technical Details
            </button>
          )}
          {showTech && blockchainData && (
            <div className="mt-4 bg-slate-50 rounded-2xl p-5 text-left space-y-2 text-xs">
              {blockchainData.tree_id && <p className="text-slate-500">Tree ID: <span className="font-mono text-slate-700">{blockchainData.tree_id}</span></p>}
              {blockchainData.tokenId && <p className="text-slate-500">Token: <span className="font-mono text-slate-700">#{blockchainData.tokenId}</span></p>}
              {blockchainData.txHash && <p className="text-slate-500 break-all">Transaction: <span className="font-mono text-slate-700">{blockchainData.txHash}</span></p>}
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  const stepMeta = STEPS[step];
  const isLastStep = step === STEPS.length - 1;

  return (
    <div className="min-h-screen bg-[#F8FAF9] py-10 px-6">
      <div className="max-w-[800px] mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3 bg-emerald-100 px-4 py-1.5 rounded-full">
            <Sprout className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-semibold text-emerald-800">Plant a Tree</span>
          </div>
          <h1 className="text-3xl lg:text-4xl font-bold text-slate-900">Register a newly planted tree</h1>
          <p className="text-slate-500 mt-2 max-w-xl mx-auto">
            We'll guide you through a few short steps. Once submitted, your tree is checked by a verifier
            and can start earning carbon credits.
          </p>
        </div>

        {debtId && (
          <motion.div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 mb-6 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <p className="text-sm text-rose-800">
              This tree will count as a <strong>replacement tree</strong> for a tree that was lost.
            </p>
          </motion.div>
        )}

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <React.Fragment key={s.key}>
              <div className={`flex items-center gap-2 ${i <= step ? 'text-emerald-700' : 'text-slate-300'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                  i < step ? 'bg-emerald-600 text-white' :
                  i === step ? 'bg-emerald-100 text-emerald-700 border-2 border-emerald-500' :
                  'bg-slate-100 text-slate-400'
                }`}>
                  {i < step ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                </div>
              </div>
              {i < STEPS.length - 1 && <div className={`h-0.5 w-8 ${i < step ? 'bg-emerald-500' : 'bg-slate-200'}`} />}
            </React.Fragment>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-8 shadow-xl border border-emerald-50">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-900">{stepMeta.title}</h2>
            <p className="text-sm text-slate-500">{stepMeta.subtitle}</p>
          </div>

          {/* STEP 1 — Tree Information */}
          {step === 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div className="relative" ref={suggestionsRef}>
                <Label className="text-sm font-medium text-slate-700 mb-2 block">
                  Tree Species <span className="text-rose-500">*</span>
                </Label>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Search or type a tree name..."
                    className="pl-12 h-12 bg-slate-50 border-transparent focus:bg-white focus:border-emerald-500 rounded-xl transition-all"
                    value={searchTerm}
                    onChange={handleCustomSpecies}
                    onFocus={() => setShowSuggestions(true)}
                  />
                </div>
                {showSuggestions && (
                  <div className="absolute z-50 left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-slate-100 max-h-60 overflow-y-auto p-2">
                    {filteredSpecies.length > 0 ? (
                      filteredSpecies.map(s => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => handleSpeciesSelect(s)}
                          className="w-full text-left px-4 py-2.5 hover:bg-emerald-50 rounded-lg text-sm font-medium text-slate-700"
                        >
                          {s}
                        </button>
                      ))
                    ) : (
                      <div className="p-4 text-center">
                        <p className="text-sm font-medium text-slate-700">Add "{searchTerm}" as a custom species?</p>
                        <button
                          type="button"
                          onClick={() => handleSpeciesSelect(searchTerm)}
                          className="mt-2 text-sm bg-emerald-600 text-white px-4 py-1.5 rounded-lg font-medium"
                        >
                          Use "{searchTerm}"
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <Label className="text-sm font-medium text-slate-700 mb-2 block">
                  Tree Name <span className="text-slate-400 font-normal">(optional)</span>
                </Label>
                <Input
                  placeholder="E.g. My Favorite Mango Tree"
                  className="h-12 bg-slate-50 border-transparent focus:bg-white focus:border-emerald-500 rounded-xl"
                  value={formData.tree_name}
                  onChange={(e) => setFormData(p => ({ ...p, tree_name: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label className="text-sm font-medium text-slate-700 mb-2 block">Planting Date</Label>
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      type="date"
                      className="pl-12 h-12 bg-slate-50 border-transparent focus:bg-white focus:border-emerald-500 rounded-xl"
                      value={formData.planted_date}
                      onChange={(e) => setFormData(p => ({ ...p, planted_date: e.target.value }))}
                    />
                  </div>
                  <p className="text-xs text-slate-400 mt-1">Use the date the tree was planted.</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700 mb-2 block">Estimated Age (years)</Label>
                  <Input
                    type="number"
                    min="0"
                    className="h-12 bg-slate-50 border-transparent focus:bg-white focus:border-emerald-500 rounded-xl"
                    value={formData.estimated_age}
                    onChange={(e) => setFormData(p => ({ ...p, estimated_age: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium text-slate-700 mb-2 block">Health</Label>
                <select
                  className="w-full h-12 bg-slate-50 border-transparent rounded-xl px-4 text-sm font-medium text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500 transition-all"
                  value={formData.health_status}
                  onChange={(e) => setFormData(p => ({ ...p, health_status: e.target.value }))}
                >
                  {HEALTH_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </motion.div>
          )}

          {/* STEP 2 — Location */}
          {step === 1 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex items-start gap-3">
                <MapPin className="w-5 h-5 text-emerald-600 shrink-0" />
                <p className="text-sm text-emerald-800">
                  <strong>Why we need your location:</strong> a verifier uses it to confirm the tree really
                  exists at the place you describe. You can capture it automatically or type the area name.
                </p>
              </div>

              <div>
                <Label className="text-sm font-medium text-slate-700 mb-2 block">Area / Location Name</Label>
                <Input
                  placeholder="E.g. Backyard, City Park, Street 5..."
                  className="h-12 bg-slate-50 border-transparent focus:bg-white focus:border-emerald-500 rounded-xl"
                  value={formData.location_name}
                  onChange={(e) => setFormData(p => ({ ...p, location_name: e.target.value }))}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm font-medium text-slate-700 block">
                    GPS Location <span className="text-rose-500">*</span>
                  </Label>
                  <button
                    type="button"
                    onClick={captureLocation}
                    className="flex items-center gap-1.5 text-sm font-medium text-emerald-600"
                  >
                    <Navigation className="w-4 h-4" /> Use my location
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      placeholder="Latitude"
                      className="pl-12 h-12 bg-slate-50 border-transparent focus:bg-white focus:border-emerald-500 rounded-xl"
                      value={formData.latitude}
                      readOnly
                    />
                  </div>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      placeholder="Longitude"
                      className="pl-12 h-12 bg-slate-50 border-transparent focus:bg-white focus:border-emerald-500 rounded-xl"
                      value={formData.longitude}
                      readOnly
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 3 — Photo */}
          {step === 2 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex items-start gap-3">
                <Camera className="w-5 h-5 text-emerald-600 shrink-0" />
                <p className="text-sm text-emerald-800">
                  <strong>What photo do we need?</strong> A clear, recent photo of your tree. This helps
                  the verifier confirm the tree's health and location.
                </p>
              </div>

              {!formData.photo_url ? (
                <div className="relative">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    disabled={uploading}
                  />
                  <div className={`border-4 border-dashed rounded-3xl p-12 text-center transition-all ${uploading ? 'border-emerald-200 bg-emerald-50' : 'border-slate-100 hover:border-emerald-200 hover:bg-emerald-50'}`}>
                    {uploading ? (
                      <div className="flex flex-col items-center">
                        <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mb-4" />
                        <p className="text-sm font-semibold text-emerald-800">Uploading photo...</p>
                      </div>
                    ) : (
                      <>
                        <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                          <Upload className="w-8 h-8 text-slate-400" />
                        </div>
                        <p className="text-sm font-semibold text-slate-700">Tap to choose a photo</p>
                        <p className="text-xs text-slate-400 mt-2">PNG or JPG, up to 10MB</p>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="relative group rounded-3xl overflow-hidden">
                  <img src={formData.photo_url} alt="Tree Preview" className="w-full h-64 object-cover" />
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button
                      type="button"
                      onClick={() => setFormData(p => ({ ...p, photo_url: "", ipfs_hash: "" }))}
                      className="bg-white/20 backdrop-blur-md p-4 rounded-full hover:bg-rose-500 transition-colors"
                    >
                      <Trash2 className="w-6 h-6 text-white" />
                    </button>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* STEP 4 — Review */}
          {step === 3 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ReviewRow label="Species" value={formData.species} />
                <ReviewRow label="Tree Name" value={formData.tree_name || '—'} />
                <ReviewRow label="Planting Date" value={formData.planted_date} />
                <ReviewRow label="Estimated Age" value={`${formData.estimated_age} years`} />
                <ReviewRow label="Health" value={formData.health_status} />
                <ReviewRow label="Area" value={formData.location_name || '—'} />
              </div>
              {formData.photo_url && (
                <img src={formData.photo_url} alt="Tree" className="w-full h-40 object-cover rounded-2xl" />
              )}
            </motion.div>
          )}

          {error && (
            <div className="mt-4 p-4 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-3">
              <Info className="w-5 h-5 text-rose-500 shrink-0" />
              <p className="text-sm font-medium text-rose-700">{error}</p>
            </div>
          )}

          {/* Navigation buttons */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-100">
            {step > 0 ? (
              <Button
                type="button"
                onClick={goBack}
                variant="outline"
                className="rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </Button>
            ) : <span />}

            {isLastStep ? (
              <Button
                type="submit"
                disabled={submitting || uploading}
                className="h-12 px-6 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold inline-flex items-center gap-2 shadow-lg shadow-emerald-200 disabled:opacity-70"
              >
                {submitting ? (<><Loader2 className="w-5 h-5 animate-spin" /> Submitting...</>) : (<><ShieldCheck className="w-5 h-5" /> Submit My Tree</>)}
              </Button>
            ) : (
              <Button
                type="button"
                onClick={goNext}
                className="h-12 px-6 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold inline-flex items-center gap-2 shadow-lg shadow-emerald-200"
              >
                Continue <ChevronRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        </form>

        {/* Technical details — collapsed for beginners */}
        <button
          onClick={() => setShowTech(!showTech)}
          className="mt-6 mx-auto flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-emerald-700"
        >
          <Globe className="w-4 h-4" /> Technical Details (for advanced users)
        </button>
        {showTech && (
          <div className="mt-3 bg-white rounded-2xl p-6 border border-slate-100 text-sm space-y-2">
            <p className="text-slate-600">
              Your tree is recorded securely and given a unique token, with your photo stored on IPFS.
              You don't need to understand these details to use EcoChain.
            </p>
            <p className="text-xs text-slate-400">IPFS hash: <span className="font-mono">{formData.ipfs_hash || '—'}</span></p>
          </div>
        )}
      </div>
    </div>
  );
}

const ReviewRow = ({ label, value }) => (
  <div className="bg-slate-50 rounded-xl p-4">
    <p className="text-xs text-slate-500 mb-0.5">{label}</p>
    <p className="text-sm font-medium text-slate-800">{value}</p>
  </div>
);
