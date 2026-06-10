import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, Scissors, Loader2, AlertTriangle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Textarea } from '@/components/ui/Textarea';
import { uploadToIPFS } from '../../utils/ipfsService';
import axios from 'axios';

const REASONS = [
    "Economic Harvesting",
    "Disease Control",
    "Construction/Infrastructure",
    "Safety Hazard",
    "Natural Disaster",
    "Other"
];

export default function ReportCutModal({ tree, isOpen, onClose, onSuccess }) {
    const [reason, setReason] = useState("");
    const [notes, setNotes] = useState("");
    const [file, setFile] = useState(null);
    const [photoPreview, setPhotoPreview] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setFile(file);
            setPhotoPreview(URL.createObjectURL(file));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!reason) return setError("Please select a reason");
        if (!file) return setError("Photo evidence is required");

        setLoading(true);
        setError("");

        try {
            // 1. Upload to IPFS
            const uploadResult = await uploadToIPFS(file);
            const evidenceUrl = uploadResult.url;

            // 2. Submit to Backend
            await axios.post(`${import.meta.env.VITE_API_URL}/api/trees/${tree.id}/report-cut`, {
                reason,
                evidence_url: evidenceUrl,
                notes
            });

            onSuccess();
            onClose();
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.error || "Failed to submit report. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                    />
                    
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="relative w-full max-w-lg bg-white rounded-[2rem] shadow-2xl overflow-hidden"
                    >
                        {/* Header */}
                        <div className="bg-rose-50 p-6 flex items-center justify-between border-b border-rose-100">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-rose-500 rounded-xl">
                                    <Scissors className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-slate-800">Report Tree Removal</h3>
                                    <p className="text-xs text-rose-600 font-bold uppercase tracking-tight">Environmental Accountability Action</p>
                                </div>
                            </div>
                            <button onClick={onClose} className="p-2 hover:bg-rose-100 rounded-full transition-colors text-slate-400">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-8 space-y-6">
                            {error && (
                                <div className="p-4 bg-rose-100 border border-rose-200 text-rose-700 rounded-2xl flex items-center gap-3 text-sm font-medium">
                                    <AlertTriangle className="w-5 h-5 shrink-0" />
                                    {error}
                                </div>
                            )}

                            <div>
                                <Label className="text-slate-700 font-bold mb-2 block">Reason for Removal *</Label>
                                <select 
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-rose-500 outline-none font-medium"
                                    required
                                >
                                    <option value="">Select a reason...</option>
                                    {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                            </div>

                            <div>
                                <Label className="text-slate-700 font-bold mb-2 block">Evidence Photo *</Label>
                                {photoPreview ? (
                                    <div className="relative group">
                                        <img src={photoPreview} alt="Evidence" className="w-full h-48 object-cover rounded-2xl border-2 border-rose-200" />
                                        <button 
                                            type="button"
                                            onClick={() => { setFile(null); setPhotoPreview(null); }}
                                            className="absolute top-2 right-2 bg-rose-500 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-slate-300 rounded-2xl cursor-pointer hover:border-rose-400 hover:bg-rose-50 transition-all">
                                        <Upload className="w-10 h-10 text-slate-300 mb-2" />
                                        <span className="text-sm font-bold text-slate-500">Click to upload photo evidence</span>
                                        <input type="file" onChange={handleFileChange} className="hidden" accept="image/*" required />
                                    </label>
                                )}
                            </div>

                            <div>
                                <Label className="text-slate-700 font-bold mb-2 block">Additional Notes</Label>
                                <Textarea 
                                    placeholder="Provide more context about why the tree is being removed..."
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    className="rounded-2xl"
                                />
                            </div>

                            <div className="flex gap-4 pt-4">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={onClose}
                                    className="flex-1 rounded-xl h-12"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={loading}
                                    className="flex-1 bg-rose-500 hover:bg-rose-600 text-white rounded-xl h-12 font-black shadow-lg shadow-rose-200"
                                >
                                    {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Submit Accountability Report"}
                                </Button>
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
