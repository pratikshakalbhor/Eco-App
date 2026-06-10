import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { 
    Check, X, Scissors, ShieldAlert, AlertTriangle, 
    Eye, MapPin, TreePine, Calculator, Zap, Activity
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { motion, AnimatePresence } from 'framer-motion';

export default function CutVerificationQueue() {
    const queryClient = useQueryClient();

    const { data: reports = [], isLoading } = useQuery({
        queryKey: ['cut-reports-pending'],
        queryFn: async () => {
            const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/api/cut-reports/pending`);
            return data;
        }
    });

    const verifyMutation = useMutation({
        mutationFn: async ({ id, status }) => {
            await axios.post(`${import.meta.env.VITE_API_URL}/api/cut-reports/${id}/verify`, { status });
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['cut-reports-pending']);
            queryClient.invalidateQueries(['trees-all-dashboard']);
        }
    });

    if (isLoading) return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
            <Activity className="w-8 h-8 text-rose-500 animate-spin" />
        </div>
    );

    return (
        <div className="min-h-screen bg-[#FDFEFF] py-12 px-8">
            <div className="max-w-7xl mx-auto">
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="mb-12"
                >
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-1.5 bg-rose-100 rounded-lg">
                            <ShieldAlert className="w-4 h-4 text-rose-600" />
                        </div>
                        <span className="text-rose-700 font-black text-[10px] uppercase tracking-widest">Loss Management Protocol</span>
                    </div>
                    <h1 className="text-5xl font-black text-slate-900 tracking-tight">Cut Verification</h1>
                    <p className="text-slate-500 mt-2 text-lg">Inventory of reported tree removals pending environmental debt assessment.</p>
                </motion.div>

                <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200/50 overflow-hidden border border-slate-100">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-slate-50/50">
                                <TableHead className="py-6 pl-10 text-[10px] font-black uppercase text-slate-400">Target Asset</TableHead>
                                <TableHead className="text-[10px] font-black uppercase text-slate-400">Evidence</TableHead>
                                <TableHead className="text-[10px] font-black uppercase text-slate-400">Reason / Details</TableHead>
                                <TableHead className="text-[10px] font-black uppercase text-slate-400 pr-10 text-right">Sanction Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {reports.map((report) => (
                                <TableRow key={report.id} className="hover:bg-slate-50/50 transition-all border-b border-slate-50 group">
                                    <TableCell className="py-8 pl-10">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
                                                <TreePine className="w-6 h-6 text-slate-400" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-slate-400 uppercase">Tree ID</p>
                                                <p className="font-mono text-sm text-slate-800">#{report.tree_id.split('-')[0]}</p>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <a href={report.evidence_url} target="_blank" rel="noreferrer" className="relative group/img block w-24 h-16 rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
                                            <img src={report.evidence_url} alt="Evidence" className="w-full h-full object-cover transition-transform group-hover/img:scale-110" />
                                            <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity">
                                                <Eye className="w-5 h-5 text-white" />
                                            </div>
                                        </a>
                                    </TableCell>
                                    <TableCell>
                                        <div>
                                            <Badge className="bg-rose-100 text-rose-700 border-rose-200 mb-2 uppercase text-[9px] font-black">
                                                {report.reason}
                                            </Badge>
                                            <p className="text-xs text-slate-500 italic">Reported on {new Date(report.created_at).toLocaleDateString()}</p>
                                        </div>
                                    </TableCell>
                                    <TableCell className="pr-10 text-right">
                                        <div className="flex gap-2 justify-end">
                                            <Button 
                                                onClick={() => verifyMutation.mutate({ id: report.id, status: 'approved' })}
                                                className="bg-rose-600 hover:bg-rose-700 h-10 text-[10px] font-black px-6 rounded-xl shadow-lg shadow-rose-100"
                                            >
                                                <Scissors className="w-4 h-4 mr-2" />
                                                SANCTION LOSS
                                            </Button>
                                            <Button 
                                                variant="outline"
                                                onClick={() => verifyMutation.mutate({ id: report.id, status: 'rejected' })}
                                                className="h-10 text-[10px] font-black px-6 rounded-xl border-slate-200"
                                            >
                                                DISMISS
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {reports.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-32">
                                        <div className="flex flex-col items-center gap-4 opacity-20">
                                            <ShieldAlert className="w-16 h-16 text-slate-300" />
                                            <p className="font-black uppercase tracking-widest text-xs">No pending loss reports</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* Audit Context */}
                <div className="mt-12 grid md:grid-cols-3 gap-8">
                    <AuditMetric icon={Calculator} label="Automatic Assessment" detail="AI-driven CO2 loss estimation active" />
                    <AuditMetric icon={Zap} label="Direct Sanction" detail="Approval instantly increments User Debt" />
                    <AuditMetric icon={AlertTriangle} label="Recovery Ratios" detail="Species-specific 3:1 to 10:1 enforced" />
                </div>
            </div>
        </div>
    );
}

const AuditMetric = ({ icon: Icon, label, detail }) => (
    <div className="bg-white p-6 rounded-3xl border border-slate-100 flex items-start gap-4">
        <div className="p-3 bg-slate-50 rounded-2xl">
            <Icon className="w-5 h-5 text-slate-400" />
        </div>
        <div>
            <p className="text-xs font-black text-slate-800 uppercase tracking-tight mb-1">{label}</p>
            <p className="text-xs text-slate-400 font-medium leading-relaxed">{detail}</p>
        </div>
    </div>
);
