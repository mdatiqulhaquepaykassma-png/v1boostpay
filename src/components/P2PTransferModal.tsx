import { FC, useState } from 'react';
import { Send, X, AlertTriangle, Fingerprint, Key, ShieldCheck, CheckCircle2, ArrowRight } from 'lucide-react';
import { BoostPayStore } from '../services/store';
import { User } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onSuccess: (updatedUser: User) => void;
}

export const P2PTransferModal: FC<Props> = ({
  isOpen,
  onClose,
  currentUser,
  onSuccess
}) => {
  const [recipientId, setRecipientId] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [step, setStep] = useState<'INPUT' | 'CONFIRM' | 'SUCCESS'>('INPUT');
  const [authMethod, setAuthMethod] = useState<'BIOMETRIC' | 'PASSKEY'>('BIOMETRIC');
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  if (!isOpen) return null;

  const isBoostActive = currentUser.boostState.isActive && !currentUser.boostState.isPaused;

  const handleKeypadPress = (val: string) => {
    if (val === 'C') {
      setAmount('');
    } else if (val === 'DEL') {
      setAmount(prev => prev.slice(0, -1));
    } else if (val === '.') {
      if (!amount.includes('.')) {
        setAmount(prev => prev ? prev + '.' : '0.');
      }
    } else {
      if (amount === '0') {
        setAmount(val);
      } else {
        setAmount(prev => prev + val);
      }
    }
  };

  const setPresetAmount = (preset: number) => {
    setAmount(preset.toFixed(2));
  };

  const setMaxAmount = () => {
    setAmount(currentUser.balance.toFixed(2));
  };

  const handleProceedToConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Check if boost is running
    if (isBoostActive) {
      setError('Active boost running! You must pause your boost before sending money.');
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid transfer amount.');
      return;
    }

    if (numAmount > currentUser.balance) {
      setError('Insufficient wallet balance for this transfer.');
      return;
    }

    const cleanRecipient = recipientId.trim();
    if (!cleanRecipient || cleanRecipient === currentUser.id) {
      setError('Please enter a valid recipient User ID different from your own.');
      return;
    }

    const allUsers = BoostPayStore.getUsers();
    const recipient = allUsers.find(u => u.id === cleanRecipient);
    if (!recipient) {
      setError(`Recipient User ID #${cleanRecipient} was not found on BoostPay.`);
      return;
    }

    if (recipient.isBlocked) {
      setError('Recipient account is currently restricted.');
      return;
    }

    setStep('CONFIRM');
  };

  const handleExecuteTransfer = () => {
    setIsAuthenticating(true);
    setTimeout(() => {
      const numAmount = parseFloat(amount);
      const allUsers = BoostPayStore.getUsers();
      const sender = allUsers.find(u => u.id === currentUser.id);
      const recipient = allUsers.find(u => u.id === recipientId.trim());

      if (!sender || !recipient) {
        setError('Transaction failed: User not found.');
        setIsAuthenticating(false);
        return;
      }

      // Debit sender
      sender.balance -= numAmount;

      // Credit recipient
      recipient.balance += numAmount;

      // Add transaction records for both
      BoostPayStore.addTransaction({
        userId: sender.id,
        type: 'TRANSFER_SENT',
        amount: numAmount,
        recipientId: recipient.id,
        notes: `P2P transfer sent to #${recipient.id}`
      });

      BoostPayStore.addTransaction({
        userId: recipient.id,
        type: 'TRANSFER_RECEIVED',
        amount: numAmount,
        senderId: sender.id,
        notes: `P2P transfer received from #${sender.id}`
      });

      // Recalculate dynamic boost target durations dynamically for both
      sender.boostState.targetDurationMs = BoostPayStore.calculateDynamicDuration(sender.balance, allUsers);
      recipient.boostState.targetDurationMs = BoostPayStore.calculateDynamicDuration(recipient.balance, allUsers);

      BoostPayStore.saveUsers(allUsers);
      BoostPayStore.setCurrentUser(sender);

      setIsAuthenticating(false);
      setStep('SUCCESS');
      onSuccess(sender);
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/85 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-t-3xl sm:rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl text-zinc-100 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-amber-500/20 p-2 text-amber-400">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Send Money (P2P)</h3>
              <p className="text-[11px] text-zinc-400">Instant off-chain zero-fee transfer</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step 1: Input and Keypad */}
        {step === 'INPUT' && (
          <div className="space-y-4">
            {/* Boost Active Protection Warning */}
            {isBoostActive && (
              <div className="rounded-xl border border-amber-500/40 bg-amber-950/30 p-3 flex items-start gap-2.5 text-xs text-amber-300">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-semibold">Active Compounding Boost Running</strong>
                  Funds are currently locked in session. You must pause your boost on the wallet screen before sending funds.
                </div>
              </div>
            )}

            {/* Recipient User ID Input */}
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                Recipient Numeric User ID
              </label>
              <input
                type="text"
                placeholder="Enter 6-digit numeric User ID (e.g., 541290)"
                value={recipientId}
                onChange={(e) => setRecipientId(e.target.value.replace(/\D/g, ''))}
                maxLength={8}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm font-mono text-zinc-100 placeholder-zinc-600 focus:border-amber-500 focus:outline-none"
              />
            </div>

            {/* Amount Display */}
            <div>
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="text-zinc-400 font-medium">Transfer Amount</span>
                <span className="text-zinc-500 font-mono">
                  Available: <span className="text-emerald-400 font-bold">${currentUser.balance.toFixed(2)}</span>
                </span>
              </div>
              <div className="relative flex items-center">
                <span className="absolute left-4 text-2xl font-bold text-amber-400">$</span>
                <input
                  type="text"
                  readOnly
                  value={amount || '0.00'}
                  className="w-full rounded-2xl border border-zinc-800 bg-zinc-900 py-3.5 pl-10 pr-4 text-2xl font-mono font-bold text-white text-right focus:outline-none"
                />
              </div>
            </div>

            {/* Quick Preset Buttons */}
            <div className="grid grid-cols-4 gap-2">
              {[10, 50, 100].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setPresetAmount(val)}
                  className="rounded-xl border border-zinc-800 bg-zinc-900 py-1.5 text-xs font-mono font-semibold text-zinc-300 hover:border-amber-500/40 hover:text-amber-400 transition"
                >
                  ${val}
                </button>
              ))}
              <button
                type="button"
                onClick={setMaxAmount}
                className="rounded-xl border border-zinc-800 bg-zinc-900 py-1.5 text-xs font-mono font-semibold text-amber-400 hover:bg-amber-500/10 transition"
              >
                MAX
              </button>
            </div>

            {/* Instant Numeric Keypad (Prompt 11) */}
            <div className="grid grid-cols-3 gap-2 pt-1 font-mono">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'DEL'].map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleKeypadPress(key)}
                  className="h-11 rounded-xl border border-zinc-800/80 bg-zinc-900/80 text-base font-bold text-zinc-200 hover:bg-zinc-800 active:scale-95 transition flex items-center justify-center"
                >
                  {key}
                </button>
              ))}
            </div>

            {error && (
              <p className="rounded-lg bg-red-950/40 border border-red-500/30 p-2.5 text-xs text-red-400 font-medium">
                {error}
              </p>
            )}

            <button
              type="button"
              disabled={isBoostActive}
              onClick={handleProceedToConfirm}
              className={`w-full rounded-xl py-3 text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-lg ${
                isBoostActive
                  ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                  : 'bg-amber-500 text-zinc-950 hover:bg-amber-400 shadow-amber-500/20'
              }`}
            >
              Continue to Authorization <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Step 2: Confirmation Modal with Biometric / Passkey Validation */}
        {step === 'CONFIRM' && (
          <div className="space-y-4 py-2">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-4 text-center space-y-2">
              <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">
                Confirming P2P Transfer
              </span>
              <div className="text-3xl font-extrabold font-mono text-amber-400">
                ${parseFloat(amount).toFixed(2)} <span className="text-sm font-sans font-normal text-zinc-400">USD</span>
              </div>
              <div className="pt-2 text-xs text-zinc-300">
                To Recipient: <span className="font-mono font-bold text-white">#{recipientId}</span>
              </div>
            </div>

            {/* Auth Selector */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 space-y-2">
              <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" /> Security Verification Required
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAuthMethod('BIOMETRIC')}
                  className={`flex-1 rounded-lg py-2 text-xs font-medium border flex items-center justify-center gap-1.5 transition ${
                    authMethod === 'BIOMETRIC'
                      ? 'border-amber-500 bg-amber-500/10 text-amber-400 font-bold'
                      : 'border-zinc-800 text-zinc-400'
                  }`}
                >
                  <Fingerprint className="w-4 h-4" /> Biometric Scan
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMethod('PASSKEY')}
                  className={`flex-1 rounded-lg py-2 text-xs font-medium border flex items-center justify-center gap-1.5 transition ${
                    authMethod === 'PASSKEY'
                      ? 'border-amber-500 bg-amber-500/10 text-amber-400 font-bold'
                      : 'border-zinc-800 text-zinc-400'
                  }`}
                >
                  <Key className="w-4 h-4" /> Passkey Token
                </button>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStep('INPUT')}
                className="flex-1 rounded-xl bg-zinc-800 py-3 text-xs font-semibold text-zinc-300 hover:bg-zinc-700 transition"
              >
                Back
              </button>
              <button
                type="button"
                disabled={isAuthenticating}
                onClick={handleExecuteTransfer}
                className="flex-1 rounded-xl bg-amber-500 py-3 text-xs font-bold text-zinc-950 hover:bg-amber-400 transition flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/20"
              >
                {isAuthenticating ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-zinc-950 border-t-transparent"></span>
                    Authorizing...
                  </span>
                ) : (
                  <>Authorize Transfer</>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Success */}
        {step === 'SUCCESS' && (
          <div className="text-center py-6 space-y-4">
            <div className="inline-flex rounded-full bg-emerald-500/20 p-4 text-emerald-400 ring-8 ring-emerald-500/10">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <div>
              <h4 className="text-lg font-bold text-white">Transfer Completed</h4>
              <p className="text-xs text-zinc-400 mt-1">
                Successfully sent <strong className="text-emerald-400 font-mono">${parseFloat(amount).toFixed(2)} USD</strong> to User <strong className="font-mono text-white">#{recipientId}</strong>.
              </p>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-xl bg-zinc-800 py-2.5 text-xs font-bold text-zinc-100 hover:bg-zinc-700 transition"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
