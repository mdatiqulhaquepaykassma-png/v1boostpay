import { FC, useState } from 'react';
import { ShieldCheck, PlusCircle, MinusCircle, Users, MessageSquare, Percent, Search, Send, CheckCircle2, Lock, Unlock, KeyRound, Copy, Check, Eye, EyeOff } from 'lucide-react';
import { BoostPayStore, copyToClipboard } from '../services/store';
import { User, SystemConfig, Conversation, Message } from '../types';

interface Props {
  onBack: () => void;
}

export const AdminPortal: FC<Props> = ({ onBack }) => {
  const [users, setUsers] = useState<User[]>(() => {
    BoostPayStore.initSync();
    return BoostPayStore.getUsers();
  });
  const [config, setConfig] = useState<SystemConfig>(BoostPayStore.getConfig());
  const [conversations, setConversations] = useState<Conversation[]>(BoostPayStore.getConversations());
  const [messages, setMessages] = useState<Message[]>(BoostPayStore.getMessages());

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [revealedPhrases, setRevealedPhrases] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Rate config state
  const [customHourlyRate, setCustomHourlyRate] = useState(config.hourlyRatePercent.toString());
  const [rateSuccess, setRateSuccess] = useState(false);

  // Manual Credit / Debit Treasury modal
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustNote, setAdjustNote] = useState('');

  // Support chat responder
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [supportMessage, setSupportMessage] = useState('');

  const refreshData = async () => {
    await BoostPayStore.initSync();
    setUsers(BoostPayStore.getUsers());
    setConfig(BoostPayStore.getConfig());
    setConversations(BoostPayStore.getConversations());
    setMessages(BoostPayStore.getMessages());
  };

  const handleSaveRate = async (e: React.FormEvent) => {
    e.preventDefault();
    const rate = parseFloat(customHourlyRate);
    if (isNaN(rate) || rate < 0) return;

    try {
      const res = await fetch('/api/admin/rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hourlyRatePercent: rate })
      });
      if (res.ok) {
        const data = await res.json();
        setConfig(data.config);
        BoostPayStore.saveConfig(data.config);
        setRateSuccess(true);
        setTimeout(() => setRateSuccess(false), 2500);
      }
    } catch {
      const newCfg = { ...config, hourlyRatePercent: rate };
      BoostPayStore.saveConfig(newCfg);
      setConfig(newCfg);
      setRateSuccess(true);
      setTimeout(() => setRateSuccess(false), 2500);
    }
  };

  const handleAdjustBalance = async (type: 'CREDIT' | 'DEBIT') => {
    if (!selectedUser) return;
    const amount = parseFloat(adjustAmount);
    if (isNaN(amount) || amount <= 0) return;

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
        await refreshData();
        const updatedUsers = BoostPayStore.getUsers();
        const target = updatedUsers.find(u => u.id === selectedUser.id);
        if (target) setSelectedUser({ ...target });
        setAdjustAmount('');
        setAdjustNote('');
      }
    } catch {
      // Local fallback
      const allUsers = BoostPayStore.getUsers();
      const target = allUsers.find(u => u.id === selectedUser.id);
      if (!target) return;

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
      refreshData();
    }
  };

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

  const toggleTempLock = async (userId: string) => {
    const target = users.find(u => u.id === userId);
    if (!target) return;
    const action = target.isTempLocked ? 'UNLOCK' : 'LOCK';

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
      target.isTempLocked = !target.isTempLocked;
      BoostPayStore.saveUsers(users);
      refreshData();
      if (selectedUser?.id === userId) {
        setSelectedUser({ ...target });
      }
    }
  };

  const toggleRevealPhrase = (userId: string) => {
    setRevealedPhrases(prev => ({ ...prev, [userId]: !prev[userId] }));
  };

  const copyText = (text: string, id: string) => {
    copyToClipboard(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSendSupportMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConv || !supportMessage.trim()) return;

    const newMsg: Message = {
      id: 'MSG-' + Date.now(),
      conversationId: activeConv.id,
      senderId: 'ADMIN_SUPPORT',
      senderRole: 'ADMIN',
      text: supportMessage.trim(),
      timestamp: Date.now()
    };

    const allMsgs = [...messages, newMsg];
    BoostPayStore.saveMessages(allMsgs);
    setMessages(allMsgs);

    const allConvs = conversations.map(c => {
      if (c.id === activeConv.id) {
        return {
          ...c,
          lastMessage: `[Support] ${supportMessage.trim()}`,
          lastMessageAt: Date.now()
        };
      }
      return c;
    });

    BoostPayStore.saveConversations(allConvs);
    setConversations(allConvs);
    setSupportMessage('');
  };

  const filteredUsers = users.filter(u => u.id.includes(searchTerm) || (u.phrase && u.phrase.includes(searchTerm)));

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-4 space-y-4 text-zinc-100">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white">Admin Control Portal</h1>
            <p className="text-[11px] text-zinc-400">Full-Stack Backend Management Console</p>
          </div>
        </div>

        <button
          onClick={onBack}
          className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 hover:text-white cursor-pointer"
        >
          Exit Admin
        </button>
      </div>

      {/* Yield Rate & Treasury Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Yield Rate */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-4">
          <div className="flex items-center gap-2 mb-2.5">
            <Percent className="w-4 h-4 text-amber-400" />
            <h2 className="font-semibold text-xs text-white">Compounding Engine Rate</h2>
          </div>

          <form onSubmit={handleSaveRate} className="space-y-2.5">
            <div className="relative">
              <input
                type="number"
                step="0.001"
                min="0"
                max="100"
                value={customHourlyRate}
                onChange={(e) => setCustomHourlyRate(e.target.value)}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-mono text-zinc-100 focus:border-amber-500 focus:outline-none"
                placeholder="1.000"
              />
              <span className="absolute right-3 top-2 text-xs font-mono text-zinc-500">% / hr</span>
            </div>

            <button
              type="submit"
              className="w-full h-9 rounded-xl bg-amber-500 text-xs font-bold text-zinc-950 hover:bg-amber-400 transition cursor-pointer"
            >
              Update Server Rate
            </button>

            {rateSuccess && (
              <p className="text-center text-[11px] text-emerald-400">Rate updated successfully on server!</p>
            )}
          </form>
        </div>

        {/* Treasury Adjustment */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-4">
          <div className="flex items-center gap-2 mb-2.5">
            <PlusCircle className="w-4 h-4 text-emerald-400" />
            <h2 className="font-semibold text-xs text-white">Treasury Balance Adjustment</h2>
          </div>

          {selectedUser ? (
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center text-[11px] bg-zinc-950 p-2 rounded-xl border border-zinc-800">
                <span className="text-zinc-400">User <strong className="font-mono text-amber-400">#{selectedUser.id}</strong></span>
                <span className="font-mono text-emerald-400 font-bold">${selectedUser.balance.toFixed(4)}</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="Amount ($)"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  className="rounded-xl border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 font-mono text-xs text-white focus:outline-none"
                />
                <input
                  type="text"
                  placeholder="Audit note"
                  value={adjustNote}
                  onChange={(e) => setAdjustNote(e.target.value)}
                  className="rounded-xl border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-xs text-white focus:outline-none"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleAdjustBalance('CREDIT')}
                  className="flex-1 h-8 rounded-xl bg-emerald-600 text-[11px] font-bold text-white hover:bg-emerald-500 transition cursor-pointer"
                >
                  Credit
                </button>
                <button
                  type="button"
                  onClick={() => handleAdjustBalance('DEBIT')}
                  className="flex-1 h-8 rounded-xl bg-red-600 text-[11px] font-bold text-white hover:bg-red-500 transition cursor-pointer"
                >
                  Debit
                </button>
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-zinc-500 text-center py-5 border border-dashed border-zinc-800 rounded-xl">
              Select a user from the directory below to credit or debit funds.
            </p>
          )}
        </div>
      </div>

      {/* User Directory with Phrase Inspection */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3">
          <div className="flex items-center gap-1.5">
            <Users className="w-4 h-4 text-amber-400" />
            <h2 className="font-semibold text-xs text-white">Registered Users & Recovery Phrases ({users.length})</h2>
          </div>
          <div className="relative w-full sm:w-56">
            <Search className="absolute left-2.5 top-2 w-3 h-3 text-zinc-500" />
            <input
              type="text"
              placeholder="Search by ID or Phrase..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 pl-7 pr-3 py-1 text-xs font-mono text-white focus:outline-none"
            />
          </div>
        </div>

        <div className="space-y-2.5">
          {filteredUsers.map((u) => {
            const isRevealed = !!revealedPhrases[u.id];
            const isSelected = selectedUser?.id === u.id;

            return (
              <div
                key={u.id}
                className={`rounded-2xl border p-3 transition ${
                  isSelected ? 'border-amber-500/50 bg-amber-500/10' : 'border-zinc-800/80 bg-zinc-950/70 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-amber-400">#{u.id}</span>
                    <span className="font-mono text-xs text-zinc-200">${u.balance.toFixed(4)}</span>
                    {u.isBlocked ? (
                      <span className="text-[9px] font-bold text-red-400 bg-red-950/60 px-1.5 py-0.5 rounded border border-red-500/30">
                        BLOCKED
                      </span>
                    ) : u.isTempLocked ? (
                      <span className="text-[9px] font-bold text-amber-400 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-500/30">
                        LOCKED
                      </span>
                    ) : (
                      <span className="text-[9px] font-bold text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-500/30">
                        ACTIVE
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setSelectedUser(u)}
                      className="px-2.5 py-1 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-[11px] text-zinc-200 cursor-pointer"
                    >
                      {isSelected ? 'Selected' : 'Select'}
                    </button>
                    <button
                      onClick={() => toggleBlockUser(u.id)}
                      className={`px-2.5 py-1 rounded-xl text-[11px] font-bold cursor-pointer ${
                        u.isBlocked ? 'bg-emerald-900/40 text-emerald-300' : 'bg-red-900/40 text-red-300'
                      }`}
                    >
                      {u.isBlocked ? 'Unblock' : 'Block'}
                    </button>
                    <button
                      onClick={() => toggleTempLock(u.id)}
                      className="p-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 cursor-pointer"
                      title={u.isTempLocked ? 'Unlock' : 'Lock'}
                    >
                      {u.isTempLocked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Phrase & Password Inspection Area */}
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-2 text-xs">
                  <div className="flex items-center justify-between mb-1 text-[11px] text-zinc-400">
                    <span className="flex items-center gap-1 text-zinc-300 font-semibold">
                      <KeyRound className="w-3 h-3 text-amber-400" /> 12-Word Recovery Phrase & Password:
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleRevealPhrase(u.id)}
                        className="flex items-center gap-1 text-amber-400 hover:text-amber-300 text-[10px] cursor-pointer"
                      >
                        {isRevealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        <span>{isRevealed ? 'Hide' : 'Reveal'}</span>
                      </button>
                      <button
                        onClick={() => copyText(u.phrase, `p-${u.id}`)}
                        className="flex items-center gap-1 text-zinc-400 hover:text-zinc-200 text-[10px] cursor-pointer"
                      >
                        {copiedId === `p-${u.id}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedId === `p-${u.id}` ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="font-mono text-[11px] leading-relaxed break-words text-zinc-300 bg-zinc-950 p-2 rounded-lg border border-zinc-850">
                    {isRevealed ? (
                      <>
                        <div className="text-amber-300 font-medium mb-1">
                          {u.phrase || 'No phrase recorded'}
                        </div>
                        {u.password && (
                          <div className="text-[10px] text-zinc-400 border-t border-zinc-800 pt-1 mt-1">
                            Password: <strong className="text-white">{u.password}</strong>
                          </div>
                        )}
                      </>
                    ) : (
                      <span className="text-zinc-600 select-none">
                        ••••••••••••••••••••••••••••••••••••••••••••••••••••• (Click Reveal to view seed phrase & password)
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {filteredUsers.length === 0 && (
            <p className="text-center text-xs text-zinc-500 py-6">No users found.</p>
          )}
        </div>
      </div>

      {/* Support Responder */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-4">
        <div className="flex items-center gap-2 mb-2.5">
          <MessageSquare className="w-4 h-4 text-sky-400" />
          <h2 className="font-semibold text-xs text-white">Verified Support Desk</h2>
        </div>

        <div className="space-y-2">
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-2 max-h-40 overflow-y-auto space-y-1">
            {conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveConv(c)}
                className={`w-full text-left rounded-lg p-2 transition text-xs cursor-pointer ${
                  activeConv?.id === c.id ? 'bg-amber-500/20 border border-amber-500/30' : 'hover:bg-zinc-900'
                }`}
              >
                <div className="flex justify-between font-mono text-[10px]">
                  <span className="font-bold text-amber-400">{c.id}</span>
                  <span className="text-zinc-500">{new Date(c.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="text-[11px] text-zinc-400 truncate mt-0.5">{c.lastMessage}</div>
              </button>
            ))}
            {conversations.length === 0 && (
              <p className="text-center text-xs text-zinc-500 py-4">No active conversations</p>
            )}
          </div>

          {activeConv && (
            <form onSubmit={handleSendSupportMessage} className="flex gap-2">
              <input
                type="text"
                placeholder="Type official support reply..."
                value={supportMessage}
                onChange={(e) => setSupportMessage(e.target.value)}
                className="flex-1 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-white focus:outline-none"
              />
              <button
                type="submit"
                className="rounded-xl bg-sky-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-sky-500 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
