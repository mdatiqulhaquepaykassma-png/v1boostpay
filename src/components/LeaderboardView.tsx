import { FC, useState, useEffect } from 'react';
import { Trophy, MessageSquare, ShieldAlert, TrendingUp, Copy, Check, Sparkles, Award } from 'lucide-react';
import { BoostPayStore, copyToClipboard } from '../services/store';
import { User } from '../types';

interface Props {
  currentUser?: User;
  currentUserId?: string;
  onSelectPeerForChat: (peerId: string) => void;
}

export const LeaderboardView: FC<Props> = ({ currentUser: userProp, currentUserId, onSelectPeerForChat }) => {
  const [users, setUsers] = useState<User[]>(() => {
    const all = BoostPayStore.getUsers();
    return [...all].sort((a, b) => b.balance - a.balance || b.lifetimeProfit - a.lifetimeProfit);
  });

  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const all = BoostPayStore.getUsers();
    setUsers([...all].sort((a, b) => b.balance - a.balance || b.lifetimeProfit - a.lifetimeProfit));
  }, []);

  const effectiveUserId = userProp?.id || currentUserId || '';
  const myUser = users.find(u => u.id === effectiveUserId) || userProp || {
    id: effectiveUserId,
    balance: 0,
    lifetimeProfit: 0
  };

  const copyId = async (id: string) => {
    const ok = await copyToClipboard(id);
    if (ok) {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const currentUserRank = users.findIndex(u => u.id === effectiveUserId) + 1;

  const getRankBadge = (rank: number) => {
    if (rank === 1) {
      return (
        <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 font-bold text-xs border border-amber-500/30">
          <Award className="w-4 h-4" />
        </span>
      );
    }
    if (rank === 2) {
      return (
        <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-zinc-400/20 text-zinc-300 font-bold text-xs border border-zinc-400/30">
          2
        </span>
      );
    }
    if (rank === 3) {
      return (
        <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-amber-700/20 text-amber-600 font-bold text-xs border border-amber-700/30">
          3
        </span>
      );
    }
    return (
      <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-zinc-900 text-zinc-500 font-mono text-xs border border-zinc-800">
        {rank}
      </span>
    );
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-6 space-y-5 text-zinc-100">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800 pb-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" /> Community Leaderboard
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Real-time balance ranking & peer discovery
          </p>
        </div>
        <div className="text-xs text-zinc-500 font-mono">
          Total Participants: <span className="text-white font-bold">{users.length}</span>
        </div>
      </div>

      {/* Current User's Rank Spotlight Card */}
      <div className="rounded-3xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-zinc-900/90 to-zinc-900/90 p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500 text-zinc-950 font-black text-lg shadow-lg shadow-amber-500/20">
              #{currentUserRank > 0 ? currentUserRank : '-'}
            </div>
            <div>
              <span className="text-[11px] text-amber-400 font-mono uppercase tracking-wider block font-semibold">
                Your Current Standing
              </span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-sm font-bold text-white font-mono">#{myUser.id}</span>
                <span className="text-[11px] text-zinc-400">(You)</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6 self-start sm:self-center font-mono">
            <div>
              <span className="text-[10px] text-zinc-500 block">Balance</span>
              <span className="text-sm font-bold text-white">${myUser.balance.toFixed(4)}</span>
            </div>
            <div>
              <span className="text-[10px] text-zinc-500 block">Lifetime Profit</span>
              <span className="text-sm font-bold text-emerald-400">+${myUser.lifetimeProfit.toFixed(4)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Safety Advisory Banner */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 px-4 py-3 flex items-center gap-3 text-xs text-zinc-400">
        <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
        <p className="leading-relaxed">
          Be mindful when communicating with peers. Never share your 12-word recovery seed phrase or account passwords with anyone.
        </p>
      </div>

      {/* Leaderboard List */}
      <div className="rounded-3xl border border-zinc-800 bg-zinc-900/90 p-5 shadow-xl">
        <div className="flex items-center justify-between mb-4 text-xs text-zinc-400 font-medium">
          <span>Rank & User ID</span>
          <div className="flex items-center gap-8">
            <span className="hidden sm:inline">Lifetime Profit</span>
            <span>Balance</span>
            <span className="w-16 text-right">Action</span>
          </div>
        </div>

        <div className="space-y-2.5">
          {users.map((u, idx) => {
            const rank = idx + 1;
            const isMe = u.id === effectiveUserId;

            return (
              <div
                key={u.id}
                className={`flex items-center justify-between rounded-2xl border p-3.5 transition ${
                  isMe
                    ? 'border-amber-500/40 bg-amber-500/5'
                    : 'border-zinc-800/80 bg-zinc-950/60 hover:border-zinc-700 hover:bg-zinc-950'
                }`}
              >
                {/* Left: Rank & User ID */}
                <div className="flex items-center gap-3">
                  {getRankBadge(rank)}

                  <div>
                    <div className="flex items-center gap-1.5 font-mono text-xs">
                      <span className={`font-bold ${isMe ? 'text-amber-400' : 'text-zinc-200'}`}>
                        #{u.id}
                      </span>
                      {isMe && (
                        <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.2 rounded font-sans font-medium">
                          You
                        </span>
                      )}
                      <button
                        onClick={() => copyId(u.id)}
                        className="text-zinc-500 hover:text-zinc-300 p-0.5 transition"
                        title="Copy User ID"
                      >
                        {copiedId === u.id ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                    <span className="text-[10px] text-zinc-500 font-mono sm:hidden">
                      Profit: +${u.lifetimeProfit.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Right: Metrics & Chat Action */}
                <div className="flex items-center gap-4 sm:gap-8 font-mono">
                  {/* Lifetime Profit (desktop) */}
                  <div className="hidden sm:block text-right">
                    <span className="text-xs font-semibold text-emerald-400">
                      +${u.lifetimeProfit.toFixed(4)}
                    </span>
                    <span className="text-[10px] text-zinc-500 block">Yield</span>
                  </div>

                  {/* Main Balance */}
                  <div className="text-right">
                    <span className="text-xs sm:text-sm font-bold text-white">
                      ${u.balance.toFixed(4)}
                    </span>
                    <span className="text-[10px] text-zinc-500 block font-sans">USD</span>
                  </div>

                  {/* Direct Message Action */}
                  <div className="w-16 flex justify-end">
                    {isMe ? (
                      <span className="text-[11px] text-zinc-600 font-sans italic py-1 px-2 select-none">
                        Self
                      </span>
                    ) : (
                      <button
                        onClick={() => onSelectPeerForChat(u.id)}
                        className="flex items-center gap-1 rounded-xl bg-zinc-800 hover:bg-amber-500 hover:text-zinc-950 px-2.5 py-1.5 text-xs text-zinc-200 transition font-medium active:scale-95 shadow-sm"
                        title={`Message User #${u.id}`}
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Chat</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
