import { FC, useState, useEffect, useRef } from 'react';
import { Zap, Pause, Play, Send, TrendingUp, AlertCircle, Sparkles } from 'lucide-react';
import { BoostPayStore } from '../services/store';
import { User, SystemConfig } from '../types';
import { RecentTransactionsSection } from './RecentTransactionsSection';

interface Props {
  user: User;
  onUpdateUser: (user: User) => void;
  onOpenSendMoney: () => void;
  config: SystemConfig;
}

export const WalletView: FC<Props> = ({
  user,
  onUpdateUser,
  onOpenSendMoney,
  config
}) => {
  const [zeroBalanceWarning, setZeroBalanceWarning] = useState(false);
  const [completionBanner, setCompletionBanner] = useState<{ amount: number } | null>(null);

  // Live session yield ticker state
  const [liveYield, setLiveYield] = useState(user.boostState.accumulatedYield);
  const [elapsedMs, setElapsedMs] = useState(user.boostState.elapsedMs);

  const elapsedMsRef = useRef(user.boostState.elapsedMs);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    elapsedMsRef.current = user.boostState.elapsedMs;
    setLiveYield(user.boostState.accumulatedYield);
    setElapsedMs(user.boostState.elapsedMs);
  }, [user.boostState.elapsedMs, user.boostState.accumulatedYield]);

  // Recalculate dynamic target duration
  const allUsers = BoostPayStore.getUsers();
  const dynamicTargetDurationMs = BoostPayStore.calculateDynamicDuration(user.balance, allUsers);

  // Compounding calculation rate per millisecond
  const ratePerMs = (config.hourlyRatePercent / 100) / 3600000;

  const handleCycleCompletion = (finalYield: number) => {
    const freshUsers = BoostPayStore.getUsers();
    const target = freshUsers.find(u => u.id === user.id);
    if (!target) return;

    target.balance += finalYield;
    target.lifetimeProfit += finalYield;
    target.boostState = {
      isActive: false,
      isPaused: false,
      startedAt: 0,
      pausedAt: 0,
      elapsedMs: 0,
      targetDurationMs: BoostPayStore.calculateDynamicDuration(target.balance, freshUsers),
      startingBalance: target.balance,
      accumulatedYield: 0
    };

    BoostPayStore.addTransaction({
      userId: target.id,
      type: 'REWARD',
      amount: finalYield,
      notes: `Compounding cycle reward completed`
    });

    BoostPayStore.saveUsers(freshUsers);
    BoostPayStore.setCurrentUser(target);
    onUpdateUser({ ...target });
    setCompletionBanner({ amount: finalYield });
    setLiveYield(0);
    setElapsedMs(0);
    elapsedMsRef.current = 0;
  };

  // Running boost effect
  useEffect(() => {
    const isRunning = user.boostState.isActive && !user.boostState.isPaused;

    if (isRunning) {
      const interval = window.setInterval(() => {
        elapsedMsRef.current += 50;
        const currentElapsed = elapsedMsRef.current;
        const accrued = user.balance * (Math.pow(1 + ratePerMs, currentElapsed) - 1);

        if (currentElapsed >= dynamicTargetDurationMs) {
          clearInterval(interval);
          handleCycleCompletion(accrued);
        } else {
          setElapsedMs(currentElapsed);
          setLiveYield(accrued);
        }
      }, 50);

      timerRef.current = interval;
      return () => clearInterval(interval);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [user.boostState.isActive, user.boostState.isPaused, user.balance, dynamicTargetDurationMs, ratePerMs]);

  const handleStartBoost = () => {
    if (user.balance <= 0) {
      setZeroBalanceWarning(true);
      setTimeout(() => setZeroBalanceWarning(false), 3500);
      return;
    }

    const freshUsers = BoostPayStore.getUsers();
    const target = freshUsers.find(u => u.id === user.id);
    if (!target) return;

    const targetDuration = BoostPayStore.calculateDynamicDuration(target.balance, freshUsers);

    target.boostState = {
      isActive: true,
      isPaused: false,
      startedAt: Date.now(),
      pausedAt: 0,
      elapsedMs: 0,
      targetDurationMs: targetDuration,
      startingBalance: target.balance,
      accumulatedYield: 0
    };

    BoostPayStore.saveUsers(freshUsers);
    BoostPayStore.setCurrentUser(target);
    onUpdateUser({ ...target });
    setElapsedMs(0);
    setLiveYield(0);
    elapsedMsRef.current = 0;
  };

  const handlePauseBoost = () => {
    const freshUsers = BoostPayStore.getUsers();
    const target = freshUsers.find(u => u.id === user.id);
    if (!target) return;

    target.boostState.isPaused = true;
    target.boostState.pausedAt = Date.now();
    target.boostState.elapsedMs = elapsedMsRef.current;
    target.boostState.accumulatedYield = liveYield;

    BoostPayStore.saveUsers(freshUsers);
    BoostPayStore.setCurrentUser(target);
    onUpdateUser({ ...target });
  };

  const handleResumeBoost = () => {
    const freshUsers = BoostPayStore.getUsers();
    const target = freshUsers.find(u => u.id === user.id);
    if (!target) return;

    target.boostState.isPaused = false;
    target.boostState.startedAt = Date.now() - target.boostState.elapsedMs;

    BoostPayStore.saveUsers(freshUsers);
    BoostPayStore.setCurrentUser(target);
    onUpdateUser({ ...target });
  };

  const formatDuration = (ms: number): string => {
    const totalSecs = Math.floor(ms / 1000);
    const hours = Math.floor(totalSecs / 3600);
    const minutes = Math.floor((totalSecs % 3600) / 60);
    const seconds = totalSecs % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    }
    return `${minutes}m ${seconds}s`;
  };

  const isBoostRunning = user.boostState.isActive && !user.boostState.isPaused;
  const isBoostPaused = user.boostState.isActive && user.boostState.isPaused;
  const progressPercent = Math.min(100, Math.max(0, (elapsedMs / (dynamicTargetDurationMs || 1)) * 100));

  // High precision decimal formatting for main balance
  const balanceStr = (user.balance || 0).toFixed(6);
  const [intPart, decPart] = balanceStr.split('.');

  // Profit calculations
  const allTxs = BoostPayStore.getTransactions().filter(t => t.userId === user.id && t.type === 'REWARD');
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  const todayProfit = allTxs
    .filter(t => t.timestamp >= oneDayAgo)
    .reduce((sum, t) => sum + t.amount, 0);

  const sevenDayProfit = allTxs
    .filter(t => t.timestamp >= sevenDaysAgo)
    .reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="w-full px-4 py-4 space-y-4">
      {/* Auto-credit completion banner */}
      {completionBanner && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/40 p-3.5 flex items-center justify-between shadow-lg animate-in slide-in-from-top">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
            <div className="text-xs text-zinc-200">
              <span className="font-bold text-emerald-400 block">Reward Credited!</span>
              +${completionBanner.amount.toFixed(6)} USD added to main balance.
            </div>
          </div>
          <button
            onClick={() => setCompletionBanner(null)}
            className="text-xs text-zinc-400 hover:text-white px-2 py-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Zero balance warning dialog */}
      {zeroBalanceWarning && (
        <div className="rounded-2xl border border-red-500/30 bg-red-950/40 p-3.5 flex items-center gap-2.5 shadow-lg">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <div className="text-xs text-red-200">
            Account balance is $0.00. Receive a transfer or credit to begin boosting.
          </div>
        </div>
      )}

      {/* Main Balance Card with High Precision Large Decimals */}
      <div className="rounded-3xl border border-zinc-800 bg-zinc-900/90 p-5 shadow-xl relative overflow-hidden">
        <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
          <span className="font-medium tracking-wide">Main Balance</span>
          <span className="text-[11px] font-mono text-zinc-500">Available Funds</span>
        </div>

        {/* Large Decimals Display */}
        <div className="flex items-baseline my-2 font-mono flex-wrap">
          <span className="text-2xl font-bold text-amber-400 mr-1">$</span>
          <span className="text-4xl font-extrabold text-white tracking-tight">
            {Number(intPart).toLocaleString()}
          </span>
          <span className="text-2xl font-bold text-amber-400">
            .{decPart}
          </span>
          <span className="text-xs font-mono text-zinc-500 ml-1.5 self-end pb-1">USD</span>
        </div>

        {/* Transfer Button */}
        <div className="mt-4">
          <button
            onClick={onOpenSendMoney}
            className={`w-full h-11 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-2 ${
              isBoostRunning
                ? 'border border-zinc-800 bg-zinc-950 text-zinc-500 cursor-not-allowed'
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700/80 active:scale-[0.98]'
            }`}
          >
            <Send className="w-3.5 h-3.5 text-amber-400" />
            {isBoostRunning ? 'Transfers Locked During Boost' : 'Send Money (P2P)'}
          </button>
        </div>
      </div>

      {/* Compounding Yield Card */}
      <div className="rounded-3xl border border-zinc-800 bg-zinc-900/90 p-5 shadow-xl relative">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-xl ${isBoostRunning ? 'bg-amber-500/20 text-amber-400 animate-pulse' : 'bg-zinc-800 text-zinc-400'}`}>
              <Zap className="w-4 h-4 fill-current" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">Dynamic Compounding</h3>
              <p className="text-[11px] text-zinc-400">
                Rate: <span className="font-mono text-amber-400">{config.hourlyRatePercent}%/hr</span> · Cycle: <span className="font-mono text-zinc-300">{formatDuration(dynamicTargetDurationMs)}</span>
              </p>
            </div>
          </div>
          {isBoostRunning && (
            <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-mono text-amber-400 font-bold">
              ACTIVE
            </span>
          )}
          {isBoostPaused && (
            <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-mono text-zinc-400 font-bold">
              PAUSED
            </span>
          )}
        </div>

        {/* Session Yield */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-3.5 mb-3.5">
          <div className="flex justify-between text-[11px] text-zinc-400 mb-1">
            <span>Accruing Reward</span>
            <span className="font-mono text-zinc-500">Auto-credits on finish</span>
          </div>

          <div className="flex items-baseline font-mono text-amber-400">
            <span className="text-lg font-bold mr-0.5">+$</span>
            <span className="text-2xl font-black tracking-tight">{liveYield.toFixed(6)}</span>
            <span className="text-xs text-zinc-500 ml-1">USD</span>
          </div>

          {/* Progress bar */}
          <div className="mt-2.5">
            <div className="flex justify-between text-[10px] font-mono text-zinc-500 mb-1">
              <span>{formatDuration(elapsedMs)}</span>
              <span>{progressPercent.toFixed(1)}%</span>
              <span>{formatDuration(dynamicTargetDurationMs)}</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
              <div
                className="h-full bg-amber-500 transition-all duration-300 rounded-full"
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div>
          {!user.boostState.isActive ? (
            <button
              onClick={handleStartBoost}
              className="w-full h-11 rounded-2xl bg-amber-500 text-xs font-bold text-zinc-950 hover:bg-amber-400 active:scale-[0.98] transition flex items-center justify-center gap-1.5"
            >
              <Zap className="w-4 h-4 fill-current" /> Start Compounding
            </button>
          ) : isBoostPaused ? (
            <button
              onClick={handleResumeBoost}
              className="w-full h-11 rounded-2xl bg-amber-500 text-xs font-bold text-zinc-950 hover:bg-amber-400 active:scale-[0.98] transition flex items-center justify-center gap-1.5"
            >
              <Play className="w-4 h-4 fill-current" /> Resume Compounding
            </button>
          ) : (
            <button
              onClick={handlePauseBoost}
              className="w-full h-11 rounded-2xl border border-zinc-700 bg-zinc-800 text-xs font-semibold text-zinc-200 hover:bg-zinc-750 active:scale-[0.98] transition flex items-center justify-center gap-1.5"
            >
              <Pause className="w-4 h-4" /> Pause (Unlocks Transfers)
            </button>
          )}
        </div>
      </div>

      {/* Profit Metrics */}
      <div className="rounded-3xl border border-zinc-800 bg-zinc-900/90 p-4 shadow-xl">
        <div className="flex items-center gap-1.5 mb-3">
          <TrendingUp className="w-4 h-4 text-emerald-400" />
          <h4 className="font-semibold text-xs text-white">Profit Metrics</h4>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center font-mono">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-2.5">
            <span className="text-[10px] text-zinc-500 block mb-0.5">Today</span>
            <span className="text-xs font-bold text-emerald-400">+${todayProfit.toFixed(4)}</span>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-2.5">
            <span className="text-[10px] text-zinc-500 block mb-0.5">7 Days</span>
            <span className="text-xs font-bold text-emerald-400">+${sevenDayProfit.toFixed(4)}</span>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-2.5">
            <span className="text-[10px] text-zinc-500 block mb-0.5">Lifetime</span>
            <span className="text-xs font-bold text-amber-400">+${user.lifetimeProfit.toFixed(4)}</span>
          </div>
        </div>
      </div>

      {/* Transactions Section */}
      <RecentTransactionsSection
        transactions={BoostPayStore.getTransactions()}
        userId={user.id}
      />
    </div>
  );
};
