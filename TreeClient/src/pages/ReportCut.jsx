import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { motion } from 'framer-motion';
import {
  Axe, MapPin, Calendar, AlertTriangle,
  CloudUpload, ChevronLeft, CheckCircle2,
  Loader2, ShieldAlert, TreePine
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

const cleanImageUrl = (url) => (url && typeof url === 'string' && !url.startsWith('blob:') ? url : '/placeholder-tree.jpg');

const REASONS = [
  { value: 'Storm', label: '🌪️ Storm Damage' },
  { value: 'Construction', label: '🏗️ Construction / Development' },
  { value: 'Disease', label: '🦠 Disease / Pest Infestation' },
  { value: 'Other', label: '📋 Other' },
];

const API = import.meta.env.VITE_API_URL;
const PINATA_JWT = import.meta.env.VITE_PINATA_JWT;

export default function ReportCut() {
  const { id } = useParams();       // tree_id from URL
  const navigate = useNavigate();

  const [form, setForm] = useState({
    reason: '',
    cut_date: new Date().toISOString().split('T')[0],
    description: '',
    evidence_image_url: '',
    latitude: null,
    longitude: null,
  });
  const [evidenceFile, setEvidenceFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // Fetch the tree to show context info
  const { data: tree, isLoading } = useQuery({
    queryKey: ['tree', id],
    queryFn: async () => {
      const { data } = await axios.get(`${API}/api/trees/${id}`);
      return data;
    },
  });

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) setEvidenceFile(file);
  };

  const captureLocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setForm(prev => ({
          ...prev,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }));
      },
      () => setError("Could not get location. Please allow location access for verification.")
    );
  };

  const uploadEvidence = async () => {
    if (!evidenceFile) return null;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', evidenceFile);
      const res = await axios.post(
        'https://api.pinata.cloud/pinning/pinFileToIPFS',
        formData,
        {
          headers: {
            Authorization: `Bearer ${PINATA_JWT}`,
            'Content-Type': 'multipart/form-data',
          },
        }
      );
      return `https://gateway.pinata.cloud/ipfs/${res.data.IpfsHash}`;
    } catch (err) {
      console.error('IPFS upload error:', err);
      // If Pinata fails, use a placeholder so submission still works
      return `ipfs-pending-${Date.now()}`;
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.reason) { setError('Please select a reason for cutting.'); return; }
    if (!form.cut_date) { setError('Cut date is required.'); return; }
    if (!evidenceFile) { setError('Please upload photo evidence.'); return; }
    if (form.cut_date > new Date().toISOString().split('T')[0]) {
      setError('Cut date cannot be in the future.');
      return;
    }

    setSubmitting(true);
    try {
      const evidenceUrl = await uploadEvidence();

      await axios.post(`${API}/api/trees/${id}/report-cut`, {
        reason: form.reason,
        cut_date: form.cut_date,
        description: form.description,
        evidence_image_url: evidenceUrl,
        latitude: form.latitude,
        longitude: form.longitude,
      });

      setSuccess(true);
      setTimeout(() => navigate('/mytrees'), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
    </div>
  );

  if (success) return (
    <div className="min-h-screen flex items-center justify-center bg-amber-50 px-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-[3rem] p-16 text-center max-w-lg w-full shadow-2xl border border-amber-100"
      >
        <div className="w-20 h-20 bg-amber-100 rounded-3xl flex items-center justify-center mx-auto mb-8">
          <CheckCircle2 className="w-10 h-10 text-amber-600" />
        </div>
        <h1 className="text-3xl font-black text-slate-900 mb-3">Report Submitted</h1>
        <p className="text-slate-500 mb-2">Tree cut reported successfully.</p>
        <p className="text-slate-500 text-sm">
          Your carbon credits have been <strong>frozen</strong> pending admin confirmation.
          You'll be redirected shortly…
        </p>
      </motion.div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#fdf9f4] py-12 px-6 lg:px-16">
      <div className="max-w-2xl mx-auto space-y-8">

        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-slate-400 hover:text-amber-600 transition-colors text-[10px] font-black uppercase tracking-widest"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="p-3 bg-amber-100 rounded-2xl">
              <Axe className="w-6 h-6 text-amber-700" />
            </div>
            <div>
              <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Tree Cut Report</p>
              <h1 className="text-3xl font-black text-slate-900">Report Tree Cut</h1>
            </div>
          </div>
        </motion.div>

        {/* Tree Context Card */}
        {tree && (
          <div className="flex items-center gap-5 bg-white border border-amber-100 rounded-3xl p-5 shadow-sm">
            <img
              src={cleanImageUrl(tree.image_url)}
              className="w-16 h-16 rounded-2xl object-cover shrink-0"
              alt={tree.species}
            />
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{tree.tree_id}</p>
              <h3 className="text-lg font-black text-slate-900">{tree.species}</h3>
              <div className="flex items-center gap-1.5 text-slate-400 mt-1">
                <MapPin className="w-3 h-3" />
                <span className="text-[10px] font-bold">{tree.location || 'Unknown location'}</span>
              </div>
            </div>
            <div className="ml-auto">
              <span className="text-[9px] font-black bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full uppercase">
                Currently Verified
              </span>
            </div>
          </div>
        )}

        {/* ⚠ Warning Banner */}
        <div className="flex items-start gap-4 bg-amber-50 border border-amber-200 rounded-3xl p-6">
          <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-black text-amber-800 text-sm mb-1">Important Notice</p>
            <p className="text-amber-700 text-xs leading-relaxed">
              Reporting a tree cut will <strong>freeze all carbon credits</strong> for this tree pending admin review.
              False reports may result in account penalties.
            </p>
          </div>
        </div>

        {/* Form */}
        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={handleSubmit}
          className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-xl shadow-slate-900/5 space-y-8"
        >
          {/* Reason */}
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
              Reason for Cutting *
            </label>
            <div className="grid grid-cols-2 gap-3">
              {REASONS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, reason: r.value }))}
                  className={`p-4 rounded-2xl border-2 text-left transition-all text-sm font-bold ${
                    form.reason === r.value
                      ? 'border-amber-500 bg-amber-50 text-amber-800'
                      : 'border-slate-100 text-slate-600 hover:border-amber-300'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Cut Date */}
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
              <Calendar className="inline w-3.5 h-3.5 mr-1" />
              Cut Date *
            </label>
            <input
              type="date"
              value={form.cut_date}
              max={new Date().toISOString().split('T')[0]}
              onChange={(e) => setForm(f => ({ ...f, cut_date: e.target.value }))}
              className="w-full h-14 bg-slate-50 border border-slate-200 rounded-2xl px-5 text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          {/* Evidence Photo */}
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
              <CloudUpload className="inline w-3.5 h-3.5 mr-1" />
              Photo Evidence *
            </label>
            <label className="flex flex-col items-center justify-center w-full h-44 bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl cursor-pointer hover:border-amber-400 hover:bg-amber-50 transition-all">
              {evidenceFile ? (
                <div className="text-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                  <p className="text-sm font-black text-slate-700">{evidenceFile.name}</p>
                  <p className="text-xs text-slate-400 mt-1">Click to change</p>
                </div>
              ) : (
                <div className="text-center">
                  <CloudUpload className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm font-bold text-slate-500">Upload evidence photo</p>
                  <p className="text-xs text-slate-300 mt-1">JPG, PNG, WEBP</p>
                </div>
              )}
              <input type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
            </label>
          </div>

          {/* Description */}
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
              Description (Optional)
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
              maxLength={500}
              rows={4}
              placeholder="Provide any additional context about the cutting..."
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-5 text-slate-700 font-medium text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            <p className="text-[10px] text-slate-300 text-right mt-1">{form.description.length}/500</p>
          </div>

          {/* GPS Confirmation */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
               <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">GPS Confirmation *</p>
                  <p className="text-[10px] text-slate-500 font-medium">Verify your current location</p>
               </div>
               <button 
                  type="button" 
                  onClick={captureLocation}
                  className="bg-white border border-slate-200 px-4 py-2 rounded-xl text-[9px] font-black uppercase text-amber-600 hover:border-amber-400 transition-all"
               >
                  Auto-Capture
               </button>
            </div>
            {form.latitude ? (
               <div className="flex items-center gap-3 text-emerald-600">
                  <div className="p-2 bg-emerald-100 rounded-lg">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-black tabular-nums">{form.latitude.toFixed(6)}, {form.longitude.toFixed(6)}</p>
                    <p className="text-[9px] font-bold uppercase opacity-70">Location Captured Successfully</p>
                  </div>
               </div>
            ) : (
               <div className="flex items-center gap-3 text-slate-400">
                  <div className="p-2 bg-slate-100 rounded-lg">
                    <Navigation className="w-4 h-4" />
                  </div>
                  <p className="text-[10px] font-bold uppercase">Location Not Yet Captured</p>
               </div>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-3 bg-rose-50 border border-rose-100 rounded-2xl p-4">
              <ShieldAlert className="w-5 h-5 text-rose-500 shrink-0" />
              <p className="text-sm font-bold text-rose-600">{error}</p>
            </div>
          )}

          <Button
            type="submit"
            disabled={submitting || uploading}
            className="w-full h-16 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl shadow-amber-200 disabled:opacity-60"
          >
            {uploading ? 'Uploading Evidence...' : submitting ? 'Submitting Report...' : (
              <span className="flex items-center gap-2 justify-center">
                <Axe className="w-5 h-5" />
                Submit Cut Report
              </span>
            )}
          </Button>
        </motion.form>

      </div>
    </div>
  );
}
