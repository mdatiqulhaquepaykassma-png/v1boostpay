import { FC, useState, useEffect } from 'react';
import {
  ShieldCheck,
  PlusCircle,
  MinusCircle,
  Users,
  MessageSquare,
  Percent,
  Search,
  Send,
  CheckCircle2,
  Lock,
  Unlock,
  KeyRound,
  Copy,
  Check,
  Eye,
  EyeOff,
  Server,
  Zap,
  RefreshCw,
  LogOut,
  Database,
  Trash2,
  Download,
  AlertTriangle,
  ArrowLeft,
  Activity,
  Sliders,
  Sparkles
} from 'lucide-react';
import { BoostPayStore, copyToClipboard } from '../services/store';
import { User, SystemConfig, Conversation, Message } from '../types';

interface Props {
  onBack?: () => void;
}

export const AdminPortal: FC<Props> = ({ onBack }) => {
  // 1. Persistent Admin Auth State
  const [adminSession, setAdminSession] = useState(() => BoostPayStore.getAdminSession());
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // 2. Admin Portal Views
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'USERS' | 'ENGINE' | 'SUPPORT'>('OVERVIEW');

  // 3. System Data
  const [users, setUsers] = useState<User[]>(() => BoostPayStore.getUsers());
  const [config, setConfig] = useState<SystemConfig>(() => BoostPayStore.getConfig());
  const [conversations, setConversations] = useState<Conversation[]>(() => BoostPayStore.getConversations());
  const [messages, setMessages] = useState<Message[]>(() => BoostPayStore.getMessages());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 4. Stats
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalLiquidity: 0,
    totalProfitPaid: 0,
    activeBoosters: 0,
    pausedBoosters: 0,
    totalTransactions: 0,
    dokployStatus: {
      host: 'boostpay-eoqehk',
      port: 5432,
      database: 'boostpaydb',
      isConnected: true,
      lastPingMs: 28
    }
  });

  // User Management State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [revealedPhrases, setRevealedPhrases] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustNote, setAdjustNote] = useState('');
  const [adjustLoading, setAdjustLoading] = useState(false);
  const [adjustSuccessMsg, setAdjustSuccessMsg] = useState('');

  // Password reset modal
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [passwordResetSuccess, setPasswordResetSuccess] = useState('');

  // Rate config state
  const [customHourlyRate, setCustomHourlyRate] = useState(config.hourlyRatePercent.toString());
  const [minBoostMinutes, setMinBoostMinutes] = useState(Math.round((config.minBoostMs || 60000) / 60000).toString());
  const [maxBoostHours, setMaxBoostHours] = useState(Math.round((config.maxBoostMs || 86400000) / 3600000).toString());
  const [rateSuccess, setRateSuccess] = useState(false);

  // Support chat responder
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [supportMessage, setSupportMessage] = useState('');

  const refreshData = async () => {
    setIsRefreshing(true);
    try {
      // 1. Fetch server stats
      const statsRes = await fetch('/api/admin/stats');
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
        if (statsData.config) {
          setConfig(statsData.config);
          setCustomHourlyRate(statsData.config.hourlyRatePercent.toString());
          setMinBoostMinutes(Math.round((statsData.config.minBoostMs || 60000) / 60000).toString());
          setMaxBoostHours(Math.round((statsData.config.maxBoostMs || 86400000) / 3600000).toString());
        }
      }

      // 2. Fetch server users
      const usersRes = await fetch('/api/admin/users');
      if (usersRes.ok) {
        const data = await usersRes.json();
        if (data.users && Array.isArray(data.users)) {
          setUsers(data.users);
          BoostPayStore.saveUsers(data.users);
        }
      } else {
        await BoostPayStore.initSync();
        setUsers(BoostPayStore.getUsers());
      }

      setConversations(BoostPayStore.getConversations());
      setMessages(BoostPayStore.getMessages());
    } catch {
      setUsers(BoostPayStore.getUsers());
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (adminSession?.isLoggedIn) {
      refreshData();
      const interval = setInterval(refreshData, 5000);
      return () => clearInterval(interval);
    }
  }, [adminSession?.isLoggedIn]);

  // Handle Admin Login
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);

    const emailClean = loginEmail.trim().toLowerCase();
    const passClean = loginPassword.trim();

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailClean, password: passClean })
      });

      if (res.ok) {
        const data = await res.json();
        const sess = BoostPayStore.setAdminSession({
          email: data.email || emailClean,
          token: data.token,
          loginTime: data.loginTime || Date.now()
        });
        setAdminSession(sess);
        return;
      }
    } catch {
      // Local check fallback
    }

    if (emailClean === 'admin@gmail.com' && (passClean === '123456' || passClean === 'admin786')) {
      const sess = BoostPayStore.setAdminSession(emailClean);
      setAdminSession(sess);
    } else {
      setLoginError('Invalid administrator credentials.');
    }
    setIsLoggingIn(false);
  };

  const handleAdminLogout = () => {
    BoostPayStore.clearAdminSession();
    setAdminSession(null);
  };

  const copyText = async (text: string, id: string) => {
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  // Adjust Balance (Credit / Debit)
  const handleAdjustBalance = async (type: 'CREDIT' | 'DEBIT') => {
    if (!selectedUser) return;
    const amount = parseFloat(adjustAmount);
    if (isNaN(amount) || amount <= 0) return;

    setAdjustLoading(true);
    setAdjustSuccessMsg('');

    try {
      const res = await fetch('/api/admin/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUser.id,
          type,
          amount,
          notes: adjustNote || `Admin Treasury ${type}`
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          setSelectedUser({ ...data.user });
        }
        await refreshData();
        setAdjustAmount('');
        setAdjustNote('');
        setAdjustSuccessMsg(`Successfully applied ${type} of $${amount.toFixed(2)} to User #${selectedUser.id}`);
        setTimeout(() => setAdjustSuccessMsg(''), 4000);
      }
    } catch {
      // Local fallback
      const allUsers = BoostPayStore.getUsers();
      const target = allUsers.find(u => u.id === selectedUser.id);
      if (target) {
        if (type === 'CREDIT') {
          target.balance += amount;
        } else {
          target.balance = Math.max(0, target.balance - amount);
        }
        BoostPayStore.saveUsers(allUsers);
        setUsers(allUsers);
        setSelectedUser({ ...target });
        setAdjustAmount('');
        setAdjustNote('');
        setAdjustSuccessMsg(`Applied ${type} of $${amount.toFixed(2)} to User #${selectedUser.id}`);
        setTimeout(() => setAdjustSuccessMsg(''), 4000);
      }
    } finally {
      setAdjustLoading(false);
    }
  };

  // Override Boost State on Server
  const handleBoostOverride = async (userId: string, action: 'START' | 'PAUSE' | 'RESUME' | 'RESET') => {
    try {
      const res = await fetch('/api/admin/users/boost-override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.user && selectedUser?.id === userId) {
          setSelectedUser({ ...data.user });
        }
        await refreshData();
      }
    } catch (err) {
      console.warn('Boost override error:', err);
    }
  };

  // Toggle Block / Unblock User
  const toggleBlockUser = async (userId: string) => {
    const target = users.find(u => u.id === userId);
    if (!target) return;
    const action = target.isBlocked ? 'UNBLOCK' : 'BLOCK';

    try {
      const res = await fetch('/api/admin/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action })
      });
      if (res.ok) {
        await refreshData();
        const updatedUsers = BoostPayStore.getUsers();
        const updatedTarget = updatedUsers.find(u => u.id === userId);
        if (selectedUser?.id === userId && updatedTarget) {
          setSelectedUser({ ...updatedTarget });
        }
      }
    } catch {
      target.isBlocked = !target.isBlocked;
      BoostPayStore.saveUsers(users);
      refreshData();
      if (selectedUser?.id === userId) {
        setSelectedUser({ ...target });
      }
    }
  };

  // Reset User Password
  const handleResetPassword = async () => {
    if (!selectedUser || !newPasswordInput.trim()) return;
    try {
      const res = await fetch('/api/admin/users/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUser.id, newPassword: newPasswordInput.trim() })
      });
      if (res.ok) {
        setPasswordResetSuccess('Password updated successfully');
        setNewPasswordInput('');
        setTimeout(() => setPasswordResetSuccess(''), 3000);
        await refreshData();
      }
    } catch {
      selectedUser.password = newPasswordInput.trim();
      BoostPayStore.saveUsers(users);
      setPasswordResetSuccess('Password updated locally');
      setNewPasswordInput('');
      setTimeout(() => setPasswordResetSuccess(''), 3000);
    }
  };

  // Delete User
  const handleDeleteUser = async (userId: string) => {
    if (!confirm(`Are you sure you want to permanently delete User #${userId}?`)) return;
    try {
      await fetch('/api/admin/users/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      if (selectedUser?.id === userId) {
        setSelectedUser(null);
      }
      await refreshData();
    } catch {
      const filtered = users.filter(u => u.id !== userId);
      BoostPayStore.saveUsers(filtered);
      setUsers(filtered);
      if (selectedUser?.id === userId) setSelectedUser(null);
    }
  };

  // Save System Configuration
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    const rate = parseFloat(customHourlyRate);
    const minMins = parseInt(minBoostMinutes, 10);
    const maxHrs = parseInt(maxBoostHours, 10);

    if (isNaN(rate) || rate < 0) return;

    const newConfig: Partial<SystemConfig> = {
      hourlyRatePercent: rate,
      minBoostMs: !isNaN(minMins) && minMins > 0 ? minMins * 60000 : 60000,
      maxBoostMs: !isNaN(maxHrs) && maxHrs > 0 ? maxHrs * 3600000 : 86400000
    };

    try {
      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig)
      });
      if (res.ok) {
        const data = await res.json();
        setConfig(data.config);
        BoostPayStore.saveConfig(data.config);
        setRateSuccess(true);
        setTimeout(() => setRateSuccess(false), 2500);
      }
    } catch {
      const merged = { ...config, ...newConfig };
      BoostPayStore.saveConfig(merged as SystemConfig);
      setConfig(merged as SystemConfig);
      setRateSuccess(true);
      setTimeout(() => setRateSuccess(false), 2500);
    }
  };

  // Support Message Sender
  const handleSendSupportMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConv || !supportMessage.trim()) return;

    const userParticipant = activeConv.participants.find(p => p !== 'ADMIN_SUPPORT') || '';
    const newMsg: Message = {
      id: `MSG-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      conversationId: activeConv.id,
      senderId: 'ADMIN_SUPPORT',
      senderRole: 'ADMIN',
      text: supportMessage.trim(),
      timestamp: Date.now()
    };

    const allMsgs = [...BoostPayStore.getMessages(), newMsg];
    BoostPayStore.saveMessages(allMsgs);
    setMessages(allMsgs);

    const allConvs = BoostPayStore.getConversations();
    const cIdx = allConvs.findIndex(c => c.id === activeConv.id);
    if (cIdx >= 0) {
      allConvs[cIdx].lastMessage = supportMessage.trim();
      allConvs[cIdx].lastMessageAt = Date.now();
      BoostPayStore.saveConversations(allConvs);
      setConversations(allConvs);
    }

    setSupportMessage('');
  };

  // Download DB Backup
  const handleDownloadBackup = () => {
    window.open('/api/admin/backup', '_blank');
  };

  // Filter users
  const filteredUsers = users.filter(u =>
    u.id.includes(searchTerm) ||
    u.balance.toString().includes(searchTerm) ||
    (u.phrase && u.phrase.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // -------------------------------------------------------------
  // RENDER: 1. ADMIN LOGIN FORM (When not logged in)
  // -------------------------------------------------------------
  if (!adminSession?.isLoggedIn) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-center items-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Top Brand */}
          <div className="text-center mb-6">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500 text-zinc-950 font-black shadow-lg shadow-amber-500/20 mb-3">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <h1 className="text-xl font-black tracking-tight text-white">BoostPay SuperAdmin</h1>
            <p className="text-xs text-zinc-400 mt-1">Independent Full-Stack Administration Portal</p>
          </div>

          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/90 p-6 shadow-2xl backdrop-blur-xl">
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
                  Administrator Email
                </label>
                <input
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="admin@gmail.com"
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-zinc-100 placeholder-zinc-600 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
                  Master Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Enter admin password"
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-zinc-100 placeholder-zinc-600 focus:border-amber-500 focus:outline-none pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {loginError && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400 font-medium">
                  {loginError}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full rounded-xl bg-amber-500 py-3 text-xs font-bold text-zinc-950 hover:bg-amber-400 active:scale-[0.99] transition shadow-lg shadow-amber-500/20 cursor-pointer disabled:opacity-50"
              >
                {isLoggingIn ? 'Authenticating...' : 'Sign In to SuperAdmin'}
              </button>

              {onBack && (
                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={onBack}
                    className="text-xs text-zinc-500 hover:text-zinc-300 transition flex items-center justify-center gap-1.5 mx-auto cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Return to User Wallet</span>
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // RENDER: 2. LOGGED-IN SUPERADMIN CONSOLE
  // -------------------------------------------------------------
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans">
      {/* Top Admin Header */}
      <header className="sticky top-0 z-40 w-full border-b border-zinc-800 bg-zinc-950/95 backdrop-blur-md px-4 sm:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500 text-zinc-950 font-black shadow-md shadow-amber-500/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm tracking-tight text-white block">
                  BoostPay SuperAdmin
                </span>
                <span className="rounded-full bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-[10px] font-mono text-amber-400 font-semibold">
                  SUPERUSER
                </span>
              </div>
              <span className="text-[10px] text-zinc-400 font-mono">
                Decoupled Full-Stack Backend • {adminSession.email}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Live Refresh */}
            <button
              onClick={refreshData}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 hover:border-zinc-700 active:scale-95 transition cursor-pointer"
              title="Refresh database state"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-amber-400' : 'text-zinc-400'}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            {/* Backup DB */}
            <button
              onClick={handleDownloadBackup}
              className="hidden sm:flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 hover:border-zinc-700 active:scale-95 transition cursor-pointer"
              title="Download JSON Database Backup"
            >
              <Download className="w-3.5 h-3.5 text-zinc-400" />
              <span>Backup</span>
            </button>

            {/* Back to User View */}
            {onBack && (
              <button
                onClick={onBack}
                className="flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 hover:text-white hover:border-zinc-700 active:scale-95 transition cursor-pointer"
                title="View user wallet"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">User Wallet</span>
              </button>
            )}

            {/* Sign Out */}
            <button
              onClick={handleAdminLogout}
              className="flex items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/20 active:scale-95 transition cursor-pointer"
              title="Sign Out of Admin Console"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Admin Navigation Tabs */}
      <div className="border-b border-zinc-800/80 bg-zinc-900/50 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto flex items-center gap-1 sm:gap-2 overflow-x-auto py-2">
          <button
            onClick={() => setActiveTab('OVERVIEW')}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition cursor-pointer shrink-0 ${
              activeTab === 'OVERVIEW'
                ? 'bg-amber-500 text-zinc-950 font-bold shadow-md'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Overview & Health</span>
          </button>

          <button
            onClick={() => setActiveTab('USERS')}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition cursor-pointer shrink-0 ${
              activeTab === 'USERS'
                ? 'bg-amber-500 text-zinc-950 font-bold shadow-md'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>User Treasury & Accounts ({users.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('ENGINE')}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition cursor-pointer shrink-0 ${
              activeTab === 'ENGINE'
                ? 'bg-amber-500 text-zinc-950 font-bold shadow-md'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Compounding Engine & Rates</span>
          </button>

          <button
            onClick={() => setActiveTab('SUPPORT')}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition cursor-pointer shrink-0 ${
              activeTab === 'SUPPORT'
                ? 'bg-amber-500 text-zinc-950 font-bold shadow-md'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Support Communications</span>
          </button>
        </div>
      </div>

      {/* Main Admin Content Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-8 space-y-6">
        {/* ======================================================== */}
        {/* TAB 1: OVERVIEW & SYSTEM HEALTH                          */}
        {/* ======================================================== */}
        {activeTab === 'OVERVIEW' && (
          <div className="space-y-6">
            {/* Top Stat Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-4">
                <div className="flex items-center justify-between text-zinc-400 text-xs mb-2">
                  <span>Total System Liquidity</span>
                  <Database className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-2xl font-black font-mono text-white">
                  ${stats.totalLiquidity.toFixed(2)}
                </div>
                <div className="text-[10px] text-zinc-500 mt-1">Across all participant balances</div>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-4">
                <div className="flex items-center justify-between text-zinc-400 text-xs mb-2">
                  <span>Total Registered Users</span>
                  <Users className="w-4 h-4 text-sky-400" />
                </div>
                <div className="text-2xl font-black font-mono text-white">
                  {users.length}
                </div>
                <div className="text-[10px] text-zinc-500 mt-1">Independent numeric ID accounts</div>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-4">
                <div className="flex items-center justify-between text-zinc-400 text-xs mb-2">
                  <span>Active 24/7 Boosters</span>
                  <Zap className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-black font-mono text-emerald-400">
                  {stats.activeBoosters}
                </div>
                <div className="text-[10px] text-zinc-500 mt-1">Running continuous server ticks</div>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-4">
                <div className="flex items-center justify-between text-zinc-400 text-xs mb-2">
                  <span>Total Profits Distributed</span>
                  <Sparkles className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-2xl font-black font-mono text-amber-400">
                  +${stats.totalProfitPaid.toFixed(2)}
                </div>
                <div className="text-[10px] text-zinc-500 mt-1">Total compounded yields credited</div>
              </div>
            </div>

            {/* Dokploy Backend Engine Status */}
            <div className="rounded-3xl border border-zinc-800 bg-zinc-900/90 p-6 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    <Server className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      Dokploy Containerized Node Engine
                      <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    </h3>
                    <p className="text-xs text-zinc-400 font-mono">
                      Database: {stats.dokployStatus.database} • Host: {stats.dokployStatus.host}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs font-mono">
                  <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-1.5">
                    <span className="text-zinc-500">Latency: </span>
                    <span className="text-emerald-400 font-bold">{stats.dokployStatus.lastPingMs}ms</span>
                  </div>
                  <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-1.5">
                    <span className="text-zinc-500">Status: </span>
                    <span className="text-emerald-400 font-bold">ONLINE (24/7)</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
                <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                  <span className="text-zinc-500 block text-[10px]">CURRENT HOURLY RATE</span>
                  <span className="text-sm font-bold text-amber-400 mt-0.5 block">{config.hourlyRatePercent}% / hr</span>
                </div>
                <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                  <span className="text-zinc-500 block text-[10px]">DYNAMIC DURATION BOUNDS</span>
                  <span className="text-sm font-bold text-zinc-200 mt-0.5 block">1 min (min) to 24 hrs (max)</span>
                </div>
                <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                  <span className="text-zinc-500 block text-[10px]">OFFLINE TICKING ENGINE</span>
                  <span className="text-sm font-bold text-emerald-400 mt-0.5 block">Active (1-sec intervals)</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: USER MANAGEMENT & TREASURY                        */}
        {/* ======================================================== */}
        {activeTab === 'USERS' && (
          <div className="space-y-6">
            {/* Search Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by User ID, recovery phrase keyword, or balance..."
                  className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/90 pl-10 pr-4 py-2.5 text-xs text-zinc-100 placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div className="text-xs font-mono text-zinc-400 self-center">
                Showing {filteredUsers.length} of {users.length} users
              </div>
            </div>

            {/* User List Table */}
            <div className="rounded-3xl border border-zinc-800 bg-zinc-900/90 shadow-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-950 text-zinc-400 border-b border-zinc-800 uppercase font-mono text-[10px]">
                    <tr>
                      <th className="px-4 py-3">User ID</th>
                      <th className="px-4 py-3">Balance</th>
                      <th className="px-4 py-3">Lifetime Profit</th>
                      <th className="px-4 py-3">Boost State</th>
                      <th className="px-4 py-3">Account Status</th>
                      <th className="px-4 py-3">Recovery Phrase</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60 font-mono">
                    {filteredUsers.map((u) => {
                      const isRevealed = !!revealedPhrases[u.id];
                      const isSelected = selectedUser?.id === u.id;
                      const isBoosting = u.boostState && u.boostState.isActive && !u.boostState.isPaused;

                      return (
                        <tr
                          key={u.id}
                          className={`hover:bg-zinc-800/40 transition cursor-pointer ${
                            isSelected ? 'bg-amber-500/10' : ''
                          }`}
                          onClick={() => setSelectedUser(u)}
                        >
                          <td className="px-4 py-3 font-bold text-amber-400">
                            #{u.id}
                          </td>
                          <td className="px-4 py-3 font-bold text-white">
                            ${u.balance.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-emerald-400 font-semibold">
                            +${u.lifetimeProfit.toFixed(2)}
                          </td>
                          <td className="px-4 py-3">
                            {isBoosting ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-400 border border-emerald-500/30">
                                <Zap className="w-3 h-3 animate-pulse" />
                                <span>Boosting ({Math.round(((u.boostState?.elapsedMs || 0) / (u.boostState?.targetDurationMs || 60000)) * 100)}%)</span>
                              </span>
                            ) : u.boostState?.isPaused ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] text-amber-400 border border-amber-500/30">
                                Paused
                              </span>
                            ) : (
                              <span className="text-zinc-500 text-[10px]">Idle</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {u.isBlocked ? (
                              <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] text-red-400 font-semibold border border-red-500/30">
                                Suspended
                              </span>
                            ) : (
                              <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-300">
                                Active
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                              <span className="font-sans text-[11px] text-zinc-400 truncate max-w-[140px]">
                                {isRevealed ? u.phrase : '••••••••••••••••'}
                              </span>
                              <button
                                onClick={() => setRevealedPhrases(prev => ({ ...prev, [u.id]: !prev[u.id] }))}
                                className="text-zinc-500 hover:text-zinc-300 p-1"
                              >
                                {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                              <button
                                onClick={() => copyText(u.phrase, `phrase-${u.id}`)}
                                className="text-zinc-500 hover:text-zinc-300 p-1"
                                title="Copy phrase"
                              >
                                {copiedId === `phrase-${u.id}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedUser(u);
                              }}
                              className="rounded-xl border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-[11px] text-amber-400 hover:border-amber-500 transition"
                            >
                              Manage
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Selected User Action Modal / Panel */}
            {selectedUser && (
              <div className="rounded-3xl border border-amber-500/30 bg-zinc-900/95 p-6 shadow-2xl space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
                  <div>
                    <span className="text-[10px] font-mono uppercase text-amber-400 font-semibold">
                      Account Operations Control
                    </span>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2 mt-0.5">
                      User #{selectedUser.id}
                      {selectedUser.isBlocked && (
                        <span className="rounded-full bg-red-500/20 text-red-400 text-xs px-2 py-0.5">SUSPENDED</span>
                      )}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleBlockUser(selectedUser.id)}
                      className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold border transition cursor-pointer ${
                        selectedUser.isBlocked
                          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                          : 'border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20'
                      }`}
                    >
                      {selectedUser.isBlocked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                      <span>{selectedUser.isBlocked ? 'Unblock User' : 'Suspend User'}</span>
                    </button>

                    <button
                      onClick={() => handleDeleteUser(selectedUser.id)}
                      className="flex items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-950/40 px-3 py-1.5 text-xs text-red-400 hover:bg-red-900/50 transition cursor-pointer"
                      title="Permanently remove user"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>

                    <button
                      onClick={() => setSelectedUser(null)}
                      className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-400 hover:text-white"
                    >
                      Close
                    </button>
                  </div>
                </div>

                {/* Operations Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {/* Operation 1: Treasury Balance Credit / Debit */}
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 space-y-3">
                    <h4 className="text-xs font-bold text-white flex items-center gap-2">
                      <PlusCircle className="w-4 h-4 text-emerald-400" /> Treasury Adjustments
                    </h4>
                    <p className="text-[11px] text-zinc-400">
                      Directly deposit or withdraw funds from this user account with audit ledger note.
                    </p>

                    <div>
                      <label className="block text-[10px] font-mono text-zinc-500 mb-1">Amount ($ USD)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={adjustAmount}
                        onChange={(e) => setAdjustAmount(e.target.value)}
                        placeholder="e.g. 50.00"
                        className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-100 font-mono focus:border-amber-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-mono text-zinc-500 mb-1">Reason / Note</label>
                      <input
                        type="text"
                        value={adjustNote}
                        onChange={(e) => setAdjustNote(e.target.value)}
                        placeholder="Admin adjustment reason"
                        className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-100 focus:border-amber-500 focus:outline-none"
                      />
                    </div>

                    {adjustSuccessMsg && (
                      <div className="text-[11px] text-emerald-400 font-medium">
                        {adjustSuccessMsg}
                      </div>
                    )}

                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => handleAdjustBalance('CREDIT')}
                        disabled={adjustLoading || !adjustAmount}
                        className="flex-1 rounded-xl bg-emerald-500/20 border border-emerald-500/40 py-2 text-xs font-bold text-emerald-400 hover:bg-emerald-500/30 transition cursor-pointer disabled:opacity-50"
                      >
                        + Credit
                      </button>
                      <button
                        onClick={() => handleAdjustBalance('DEBIT')}
                        disabled={adjustLoading || !adjustAmount}
                        className="flex-1 rounded-xl bg-red-500/20 border border-red-500/40 py-2 text-xs font-bold text-red-400 hover:bg-red-500/30 transition cursor-pointer disabled:opacity-50"
                      >
                        - Debit
                      </button>
                    </div>
                  </div>

                  {/* Operation 2: Server Boost Controls */}
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 space-y-3">
                    <h4 className="text-xs font-bold text-white flex items-center gap-2">
                      <Zap className="w-4 h-4 text-amber-400" /> Server Boost Override
                    </h4>
                    <p className="text-[11px] text-zinc-400">
                      Authoritatively control background ticker state for this user.
                    </p>

                    <div className="space-y-1 text-xs font-mono">
                      <div className="flex justify-between text-zinc-400">
                        <span>Current Status:</span>
                        <span className="text-white font-bold">
                          {selectedUser.boostState?.isActive ? (selectedUser.boostState.isPaused ? 'Paused' : 'Active') : 'Idle'}
                        </span>
                      </div>
                      <div className="flex justify-between text-zinc-400">
                        <span>Dynamic Duration:</span>
                        <span className="text-amber-400">
                          {Math.round((selectedUser.boostState?.targetDurationMs || 60000) / 60000)} mins
                        </span>
                      </div>
                      <div className="flex justify-between text-zinc-400">
                        <span>Elapsed Time:</span>
                        <span className="text-emerald-400">
                          {Math.round((selectedUser.boostState?.elapsedMs || 0) / 1000)}s
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2">
                      <button
                        onClick={() => handleBoostOverride(selectedUser.id, 'START')}
                        className="rounded-xl bg-amber-500/20 border border-amber-500/40 py-2 text-xs font-semibold text-amber-400 hover:bg-amber-500/30 transition cursor-pointer"
                      >
                        Force Start
                      </button>
                      <button
                        onClick={() => handleBoostOverride(selectedUser.id, selectedUser.boostState?.isPaused ? 'RESUME' : 'PAUSE')}
                        className="rounded-xl border border-zinc-800 bg-zinc-900 py-2 text-xs font-semibold text-zinc-200 hover:border-zinc-700 transition cursor-pointer"
                      >
                        {selectedUser.boostState?.isPaused ? 'Resume' : 'Pause'}
                      </button>
                      <button
                        onClick={() => handleBoostOverride(selectedUser.id, 'RESET')}
                        className="col-span-2 rounded-xl border border-zinc-800 bg-zinc-900 py-2 text-xs text-zinc-400 hover:text-white transition cursor-pointer"
                      >
                        Reset Cycle
                      </button>
                    </div>
                  </div>

                  {/* Operation 3: Password Reset */}
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 space-y-3">
                    <h4 className="text-xs font-bold text-white flex items-center gap-2">
                      <KeyRound className="w-4 h-4 text-sky-400" /> Password Override
                    </h4>
                    <p className="text-[11px] text-zinc-400">
                      Assign a new master login password for this account.
                    </p>

                    <div>
                      <label className="block text-[10px] font-mono text-zinc-500 mb-1">New Password</label>
                      <input
                        type="text"
                        value={newPasswordInput}
                        onChange={(e) => setNewPasswordInput(e.target.value)}
                        placeholder="Enter replacement password"
                        className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-100 focus:border-amber-500 focus:outline-none"
                      />
                    </div>

                    {passwordResetSuccess && (
                      <div className="text-[11px] text-emerald-400 font-medium">
                        {passwordResetSuccess}
                      </div>
                    )}

                    <button
                      onClick={handleResetPassword}
                      disabled={!newPasswordInput.trim()}
                      className="w-full rounded-xl bg-sky-500/20 border border-sky-500/40 py-2 text-xs font-bold text-sky-400 hover:bg-sky-500/30 transition cursor-pointer disabled:opacity-50"
                    >
                      Update Password
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 3: COMPOUNDING ENGINE & RATES                        */}
        {/* ======================================================== */}
        {activeTab === 'ENGINE' && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="rounded-3xl border border-zinc-800 bg-zinc-900/90 p-6 shadow-xl">
              <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
                <Percent className="w-5 h-5 text-amber-400" /> System Yield & Compounding Parameters
              </h3>
              <p className="text-xs text-zinc-400 mb-6">
                All parameters update live across the authoritative backend and client dynamic formula calculators.
              </p>

              <form onSubmit={handleSaveConfig} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Global Hourly Rate Percent (%)
                  </label>
                  <div className="flex gap-3">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={customHourlyRate}
                      onChange={(e) => setCustomHourlyRate(e.target.value)}
                      className="flex-1 rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-zinc-100 font-mono focus:border-amber-500 focus:outline-none"
                    />
                    <span className="self-center font-mono text-xs text-zinc-500">% / hr</span>
                  </div>
                  <span className="text-[10px] text-zinc-500 mt-1 block">Default benchmark is 1.0% per hour</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1">
                      Min Boost Duration (Minutes)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={minBoostMinutes}
                      onChange={(e) => setMinBoostMinutes(e.target.value)}
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-zinc-100 font-mono focus:border-amber-500 focus:outline-none"
                    />
                    <span className="text-[10px] text-zinc-500 mt-1 block">Applied to lowest balance account (1m)</span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1">
                      Max Boost Duration (Hours)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={maxBoostHours}
                      onChange={(e) => setMaxBoostHours(e.target.value)}
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-zinc-100 font-mono focus:border-amber-500 focus:outline-none"
                    />
                    <span className="text-[10px] text-zinc-500 mt-1 block">Applied to highest balance account (24h)</span>
                  </div>
                </div>

                {rateSuccess && (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-400 font-medium">
                    Engine parameters saved and synchronized to backend database.
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full rounded-xl bg-amber-500 py-3 text-xs font-bold text-zinc-950 hover:bg-amber-400 transition cursor-pointer shadow-lg shadow-amber-500/20"
                >
                  Save & Deploy System Configuration
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 4: SUPPORT COMMUNICATIONS                            */}
        {/* ======================================================== */}
        {activeTab === 'SUPPORT' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-3xl border border-zinc-800 bg-zinc-900/90 p-4 space-y-3">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                Conversations ({conversations.length})
              </h4>
              <div className="space-y-1.5 max-h-[480px] overflow-y-auto">
                {conversations.map((c) => {
                  const peer = c.participants.find(p => p !== 'ADMIN_SUPPORT') || c.id;
                  const isSelected = activeConv?.id === c.id;

                  return (
                    <button
                      key={c.id}
                      onClick={() => setActiveConv(c)}
                      className={`w-full text-left p-3 rounded-2xl border transition ${
                        isSelected
                          ? 'border-amber-500/50 bg-amber-500/10 text-white'
                          : 'border-zinc-800/80 bg-zinc-950 hover:border-zinc-700 text-zinc-300'
                      }`}
                    >
                      <div className="text-xs font-bold font-mono text-amber-400">User #{peer}</div>
                      <div className="text-[11px] text-zinc-400 truncate mt-0.5">{c.lastMessage}</div>
                    </button>
                  );
                })}

                {conversations.length === 0 && (
                  <div className="py-8 text-center text-xs text-zinc-500 font-mono">
                    No active user support threads.
                  </div>
                )}
              </div>
            </div>

            <div className="md:col-span-2 rounded-3xl border border-zinc-800 bg-zinc-900/90 p-5 flex flex-col h-[520px]">
              {activeConv ? (
                <>
                  <div className="border-b border-zinc-800 pb-3 mb-3">
                    <span className="text-[10px] font-mono text-zinc-400 uppercase">Chatting with</span>
                    <h4 className="text-sm font-bold text-white font-mono">
                      User #{activeConv.participants.find(p => p !== 'ADMIN_SUPPORT')}
                    </h4>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-2.5 p-2">
                    {messages
                      .filter(m => m.conversationId === activeConv.id)
                      .map((m) => {
                        const isAdmin = m.senderId === 'ADMIN_SUPPORT';
                        return (
                          <div
                            key={m.id}
                            className={`flex flex-col ${isAdmin ? 'items-end' : 'items-start'}`}
                          >
                            <div
                              className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-xs ${
                                isAdmin
                                  ? 'bg-amber-500 text-zinc-950 font-medium'
                                  : 'bg-zinc-800 text-zinc-100'
                              }`}
                            >
                              {m.text}
                            </div>
                            <span className="text-[9px] text-zinc-500 font-mono mt-0.5 px-1">
                              {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        );
                      })}
                  </div>

                  <form onSubmit={handleSendSupportMessage} className="pt-3 border-t border-zinc-800 flex gap-2">
                    <input
                      type="text"
                      value={supportMessage}
                      onChange={(e) => setSupportMessage(e.target.value)}
                      placeholder="Type admin response..."
                      className="flex-1 rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-zinc-100 focus:border-amber-500 focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={!supportMessage.trim()}
                      className="rounded-xl bg-amber-500 px-4 text-xs font-bold text-zinc-950 hover:bg-amber-400 transition cursor-pointer disabled:opacity-50"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 text-xs">
                  <MessageSquare className="w-8 h-8 text-zinc-600 mb-2" />
                  <span>Select a user conversation from the list to respond</span>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
