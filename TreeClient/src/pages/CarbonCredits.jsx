import React, { useState, useEffect, useMemo } from 'react';
import API_URL from "../utils/config.js";
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import {
  Leaf, TreePine, Award, ArrowUpRight, ArrowDownRight, Sprout,
  AlertTriangle, RefreshCcw, Info, ChevronDown,
  TrendingUp, ShieldCheck, Coins, BookOpen, CheckCircle2
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { getEcoTokenBalance, getCarbonCreditBalance, isSepoliaNetwork, switchToSepolia } from '../utils/web3Service';
import { useAuth } from '../hooks/useAuth';

// How carbon credits work, explained simply.
const HOW_IT_WORKS = [
  { icon: TreePine, title: 'Your trees absorb CO₂', text: 'Every verified tree captures carbon dioxide (CO₂) from the air as it grows.' },
  { icon: Award, title: 'Credits are issued', text: 'Each tonne of CO₂ your trees offset becomes 1 carbon credit (ECO token) you can use or trade.' },
  { icon: Coins, title: 'Use or sell your credits', text: 'Burn credits to prove you offset emissions, or sell them in the marketplace to earn.' },
];

const LEDGER_TYPE_CONFIG = {
  earned:       { label: 'Credits Earned',   color: 'text-emerald-600', bg: 'bg-emerald-50',   border: 'border-emerald-100', icon: ArrowUpRight,   dot: 'bg-emerald-500' },
  penalty:      { label: 'Credits Deducted', color: 'text-rose-600',    bg: 'bg-rose-50',      border: 'border-rose-100',    icon: ArrowDownRight, dot: 'bg-rose-500' },
  compensation: { label: 'Credits Used',     color: 'text-sky-600',     bg: 'bg-sky-50',       border: 'border-sky-100',     icon: Sprout,         dot: 'bg-sky-500' },
};

export default function CarbonCredits() {
  const { user } = useAuth();
  const [onSepolia, setOnSepolia] = useState(true);
  const [balances, setBalances] = useState({ eco: '0.00', carbonCredit: '0.00' });
  const [ledgerFilter, setLedgerFilter] = useState('all');
  const [showBurn, setShowBurn] = useState(false);
  const [showOnChain, setShowOnChain] = useState(false);

  // ── Aggregated carbon stats ────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ['carbon-credits'],
    queryFn: async () => {
      const token = localStorage.getItem('eco_token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const { data } = await axios.get(`${API_URL}/api/credits`, { headers });
      return data;
    },
    staleTime: 60_000,
  });

  // ── Credit history / ledger ────────────────────────────────
  const { data: ledgerHistory = [] } = useQuery({
    queryKey: ['credit-history'],
    queryFn: async () => {
      const token = localStorage.getItem('eco_token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const { data } = await axios.get(`${API_URL}/api/credits/history`, { headers });
      return data;
    },
    staleTime: 60_000,
  });

  const history = ledgerHistory;

  // ── On-chain balance ───────────────────────────────────────
  useEffect(() => {
    const fetchBalances = async () => {
      if (!user?.wallet_address) return;
      const isSep = await isSepoliaNetwork();
      setOnSepolia(isSep);
      if (isSep) {
        try {
          const [eco, carbonCredit] = await Promise.all([
            getEcoTokenBalance(user.wallet_address).catch(() => '0.00'),
            getCarbonCreditBalance(user.wallet_address).catch(() => '0.00'),
          ]);
          setBalances({ eco, carbonCredit });
        } catch (err) { console.error(err); }
      }
    };
    fetchBalances();
    const interval = setInterval(fetchBalances, 15000);
    return () => clearInterval(interval);
  }, [user?.wallet_address]);

  const {
    credits_earned = 0, credits_lost = 0,
    environmental_debt = 0, compensation_required = false,
    active_trees = 0, cut_trees = 0, replacement_trees = 0,
    co2_stats = {}, carbon_balance = 0, sustainability_score = 0,
  } = data || {};

  const netAvailable = Math.max(0, (Number(balances.eco) || 0)).toFixed(2);
  const carbonCreditBalance = Math.max(0, (Number(balances.carbonCredit) || 0)).toFixed(2);
  const totalCO2 = (co2_stats.total_absorbed || 0).toFixed(2);
  const used = history.filter(h => h.type === 'compensation' || h.type === 'penalty').reduce((s, h) => s + Math.abs(h.amount || 0), 0);

  const filteredHistory = useMemo(() => {
    if (ledgerFilter === 'all') return history;
    return history.filter(h => h.type === ledgerFilter);
  }, [history, ledgerFilter]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAF9]">
        <div className="flex flex-col items-center gap-4">
          <RefreshCcw className="w-10 h-10 text-emerald-500 animate-spin" />
          <p className="text-slate-400 text-sm font-medium">Loading your carbon impact...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAF9] py-10 px-6 lg:px-12">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* Header */}
        <div className="text-center max-w-2xl mx-auto pt-4">
          <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-semibold px-4 py-1.5 rounded-full mb-4">
            <Leaf className="w-3.5 h-3.5" /> Carbon Credits
          </div>
          <h1 className="text-4xl font-bold text-slate-900">Your Carbon Impact</h1>
          <p className="text-slate-500 mt-2">Your trees remove carbon from the air — and that work is turned into credits you control.</p>
        </div>

        {!onSepolia && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-amber-800">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <div>
                <p className="font-semibold text-sm">Wrong network detected</p>
                <p className="text-xs opacity-80">Switch to Sepolia Testnet to see your live credit balance.</p>
              </div>
            </div>
            <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl shrink-0" onClick={() => switchToSepolia()}>
              Switch Network
            </Button>
          </motion.div>
        )}

        {/* Simple metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard icon={Coins} label="Available" value={netAvailable} sub="ECO credits" tone="emerald" center />
          <MetricCard icon={Award} label="Total Earned" value={credits_earned.toFixed(2)} sub="credits issued" tone="teal" />
          <MetricCard icon={BookOpen} label="Used" value={used.toFixed(2)} sub="offset or deducted" tone="sky" />
          <MetricCard icon={RefreshCcw} label="CO₂ Absorbed" value={`${totalCO2} kg`} sub="from your trees" tone="green" />
        </div>

        {/* How it works */}
        <div className="bg-white rounded-3xl p-8 border border-emerald-50 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 mb-6">How carbon credits work</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {HOW_IT_WORKS.map((step, i) => (
              <div key={i} className="flex gap-4">
                <div className="w-11 h-11 shrink-0 rounded-2xl bg-emerald-50 flex items-center justify-center">
                  <step.icon className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800 text-sm">{step.title}</p>
                  <p className="text-sm text-slate-500 mt-1">{step.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Live on-chain balance card */}
        <div className="bg-gradient-to-br from-[#0a2e1e] to-[#0f3d2a] rounded-3xl p-8 text-white relative overflow-hidden">
          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-8">
              <div>
                <p className="text-emerald-300 text-sm font-medium">ECO Token Balance (on-chain)</p>
                <p className="text-4xl font-bold mt-1">{netAvailable} <span className="text-lg text-emerald-300">ECO</span></p>
                <p className="text-xs text-white/50 mt-1">1 ECO token = 1 tonne of CO₂ offset</p>
              </div>
              <div className="sm:border-l sm:border-emerald-800/60 sm:pl-8">
                <p className="text-emerald-300 text-sm font-medium">Carbon Credit Balance (on-chain)</p>
                <p className="text-4xl font-bold mt-1">{carbonCreditBalance} <span className="text-lg text-emerald-300">CC</span></p>
                <p className="text-xs text-white/50 mt-1">Verified on-chain carbon credits</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-emerald-300 shrink-0">
              <ShieldCheck className="w-4 h-4" /> Auditable on the blockchain
            </div>
          </div>
        </div>

        {/* Burn / offset section */}
        <div className="bg-white rounded-3xl border border-slate-100">
          <button onClick={() => setShowBurn(!showBurn)}
            className="w-full flex items-center justify-between p-5 text-left">
            <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <TrendingUp className="w-4 h-4 text-emerald-600" /> Offset emissions with your credits
            </span>
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showBurn ? 'rotate-180' : ''}`} />
          </button>
          {showBurn && <BurnForm onDone={() => { setShowBurn(false); }} />}
        </div>

        {/* Ledger history */}
        <div className="bg-white rounded-3xl p-8 border border-emerald-50 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Your Credit Activity</h2>
              <p className="text-sm text-slate-400">{history.length} entries</p>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl">
              {['all', 'earned', 'penalty', 'compensation'].map(f => (
                <button key={f} onClick={() => setLedgerFilter(f)}
                  className={`px-3.5 py-2 rounded-lg text-xs font-medium transition-all ${ledgerFilter === f ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                  {f === 'all' ? 'All' : LEDGER_TYPE_CONFIG[f]?.label.replace('Credits ', '') || f}
                </button>
              ))}
            </div>
          </div>

          {filteredHistory.length === 0 ? (
            <div className="text-center py-14 opacity-50">
              <BookOpen className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p className="text-sm font-medium text-slate-500">No credit activity yet</p>
              <p className="text-xs text-slate-400 mt-1">Once your trees are verified, credits will appear here.</p>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute left-[21px] top-2 bottom-2 w-0.5 bg-emerald-100" />
              <div className="space-y-5">
                {filteredHistory.map((entry, i) => {
                  const cfg = LEDGER_TYPE_CONFIG[entry.type] || LEDGER_TYPE_CONFIG.earned;
                  const TypeIcon = cfg.icon;
                  const positive = Number(entry.amount) > 0;
                  return (
                    <motion.div key={entry.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                      className="flex items-start gap-5">
                      <div className={`relative z-10 w-11 h-11 rounded-full ${cfg.bg} flex items-center justify-center shrink-0`}>
                        <TypeIcon className={`w-5 h-5 ${cfg.color}`} />
                      </div>
                      <div className="flex-1 bg-slate-50/70 rounded-2xl px-5 py-4">
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                          <div>
                            <span className="text-sm font-semibold text-slate-800">{cfg.label}</span>
                            <span className="text-xs text-slate-400 ml-2">#{String(entry.tree_id || '').slice(0, 8)}</span>
                          </div>
                          <span className={`text-sm font-bold ${positive ? 'text-emerald-600' : 'text-rose-500'}`}>
                            {positive ? '+' : ''}{Number(entry.amount).toFixed(4)} tCO₂e
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">{new Date(entry.created_at).toLocaleDateString()}</p>
                        {entry.transaction_hash && (
                          <a href={`https://sepolia.etherscan.io/tx/${entry.transaction_hash}`} target="_blank" rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:underline mt-1">
                            <ShieldCheck className="w-3 h-3" /> View on Etherscan
                          </a>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* On-chain / technical details collapsed */}
        <div className="bg-white rounded-3xl border border-slate-100">
          <button onClick={() => setShowOnChain(!showOnChain)}
            className="w-full flex items-center justify-between p-5 text-left">
            <span className="flex items-center gap-2 text-sm font-medium text-slate-600">
              <Info className="w-4 h-4" /> Advanced details (for developers)
            </span>
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showOnChain ? 'rotate-180' : ''}`} />
          </button>
          {showOnChain && (
            <div className="px-5 pb-5 grid sm:grid-cols-2 lg:grid-cols-4 gap-6 text-sm">
              <div><p className="text-xs text-slate-400">Environmental Debt</p><p className="font-medium text-slate-800">{environmental_debt.toFixed(2)} t</p></div>
              <div><p className="text-xs text-slate-400">Active Trees</p><p className="font-medium text-slate-800">{active_trees}</p></div>
              <div><p className="text-xs text-slate-400">Cut Trees</p><p className="font-medium text-slate-800">{cut_trees}</p></div>
              <div><p className="text-xs text-slate-400">Replacements</p><p className="font-medium text-slate-800">{replacement_trees}</p></div>
              <div className="sm:col-span-2"><p className="text-xs text-slate-400">Sustainability Score</p><p className="font-medium text-slate-800">{Number(sustainability_score).toFixed(0)} / 100</p></div>
              <div className="sm:col-span-2"><p className="text-xs text-slate-400">Carbon Balance</p><p className="font-medium text-slate-800">{Number(carbon_balance).toFixed(2)} t</p></div>
            </div>
          )}
        </div>

        {compensation_required && (
          <div className="p-5 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-800">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <p className="text-sm"><span className="font-semibold">Action needed:</span> some trees were cut and need replanting to balance your environmental impact. <span className="underline cursor-pointer" onClick={() => window.location.hash = '/debt'}>View replantation</span></p>
          </div>
        )}

      </div>
    </div>
  );
}

function BurnForm({ onDone }) {
  const [amount, setAmount] = useState('');
  const [purpose, setPurpose] = useState('');
  const [txHash, setTxHash] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const handleBurn = async () => {
    const val = parseFloat(amount);
    if (!amount || isNaN(val) || val <= 0) { setError('Enter a valid amount'); return; }
    setLoading(true); setError(''); setResult(null);
    try {
      const token = localStorage.getItem('eco_token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const { data } = await axios.post(`${API_URL}/api/credits/burn`, {
        amount: val,
        purpose: purpose || 'Carbon Offset',
        tx_hash: txHash,
      }, { headers });
      setResult(data);
      setAmount(''); setPurpose(''); setTxHash('');
    } catch (err) {
      setError(err?.response?.data?.error || 'Could not complete. Check your available balance.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-5 pb-6 grid lg:grid-cols-2 gap-8">
      <div className="space-y-4">
        <div>
          <p className="text-xs font-semibold text-slate-500 mb-1.5">Credits to offset (tCO₂e)</p>
          <input type="number" min="0.001" step="0.001" placeholder="0.000"
            value={amount} onChange={e => setAmount(e.target.value)}
            className="w-full h-12 px-4 bg-emerald-50 border-2 border-emerald-100 rounded-xl text-xl font-bold text-slate-900 focus:outline-none focus:border-emerald-400" />
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-500 mb-1.5">What are you offsetting? (optional)</p>
          <input type="text" placeholder="e.g. My flight, event travel..."
            value={purpose} onChange={e => setPurpose(e.target.value)}
            className="w-full h-12 px-4 bg-slate-50 border border-slate-100 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-200" />
        </div>
        <input type="text" placeholder="On-chain tx hash (optional)" value={txHash} onChange={e => setTxHash(e.target.value)}
          className="w-full h-12 px-4 bg-slate-50 border border-slate-100 rounded-xl text-xs font-mono text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-200" />
        {error && <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-sm font-medium text-rose-700">{error}</div>}
        <button onClick={handleBurn} disabled={loading || !amount}
          className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
          {loading ? 'Processing...' : 'Offset Emissions'}
        </button>
      </div>
      <div className="space-y-4">
        {result ? (
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6 space-y-2">
            <div className="flex items-center gap-2 text-emerald-700 font-semibold"><CheckCircle2 className="w-5 h-5" /> Offsetting confirmed</div>
            <p className="text-3xl font-bold text-emerald-700">{result.amount_burned} tCO₂e</p>
            <p className="text-sm text-emerald-600">{result.purpose}</p>
            {result.tx_hash && (
              <a href={`https://sepolia.etherscan.io/tx/${result.tx_hash}`} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1 text-sm text-emerald-600 hover:underline">View proof on Etherscan</a>
            )}
          </div>
        ) : (
          <div className="bg-slate-50 rounded-2xl p-6 border border-dashed border-slate-200">
            <h4 className="text-sm font-semibold text-slate-700 mb-3">What happens when you offset?</h4>
            <div className="space-y-2 text-sm text-slate-500">
              <p>1. Enter how many credits you want to use to offset CO₂.</p>
              <p>2. Each credit permanently offsets 1 tonne of CO₂.</p>
              <p>3. A permanent, verifiable record is stored on the blockchain.</p>
            </div>
            <div className="p-3 mt-3 bg-orange-50 border border-orange-100 rounded-xl">
              <p className="text-xs font-semibold text-orange-700">Please note: this is irreversible. Credits used cannot be recovered.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const MetricCard = ({ icon: Icon, label, value, sub, tone = 'emerald', center = false }) => (
  <div className={`bg-white rounded-2xl p-5 border border-emerald-50 shadow-sm ${center ? 'text-center' : ''}`}>
    <div className={`inline-flex w-9 h-9 rounded-xl items-center justify-center mb-3 ${tone === 'green' ? 'bg-green-50 text-green-600' : tone === 'sky' ? 'bg-sky-50 text-sky-600' : tone === 'teal' ? 'bg-teal-50 text-teal-600' : 'bg-emerald-50 text-emerald-600'}`}>
      <Icon className="w-4 h-4" />
    </div>
    <p className="text-xs text-slate-400">{label}</p>
    <p className="text-2xl font-bold text-slate-900 mt-0.5">{value}</p>
    {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
  </div>
);
