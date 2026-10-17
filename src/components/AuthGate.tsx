import { FC, useState } from 'react';
import { Shield, ArrowRight, Copy, Check, Eye, EyeOff, Lock, KeyRound, Sparkles } from 'lucide-react';
import { BoostPayStore, generateMnemonic, copyToClipboard } from '../services/store';
import { User } from '../types';

interface Props {
  onLoginUser: (user: User) => void;
}

export const AuthGate: FC<Props> = ({ onLoginUser }) => {
  const [tab, setTab] = useState<'LOGIN' | 'SIGNUP'>('LOGIN');

  // Login form state
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Signup form state
  const [newMnemonic, setNewMnemonic] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [copiedPhrase, setCopiedPhrase] = useState(false);
  const [isPhraseSaved, setIsPhraseSaved] = useState(false);
  const [signupError, setSignupError] = useState('');

  const startSignup = () => {
    const phrase = generateMnemonic();
    setNewMnemonic(phrase);
    setSignupPassword('');
    setConfirmPassword('');
    setIsPhraseSaved(false);
    setSignupError('');
    setTab('SIGNUP');
  };

  const handleCopyPhrase = async () => {
    const ok = await copyToClipboard(newMnemonic);
    if (ok) {
      setCopiedPhrase(true);
      setTimeout(() => setCopiedPhrase(false), 2000);
    }
  };

  const handleUserLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    if (!loginIdentifier.trim()) {
      setLoginError('Please enter your 12-word recovery phrase or Numeric ID');
      return;
    }

    const res = BoostPayStore.loginUser(loginIdentifier.trim(), loginPassword);
    if (!res.success || !res.user) {
      setLoginError(res.error || 'Invalid credentials.');
      return;
    }

    onLoginUser(res.user);
  };

  const completeSignup = (e: React.FormEvent) => {
    e.preventDefault();
    setSignupError('');

    if (!newMnemonic) {
      setSignupError('Secret phrase generation failed. Please refresh.');
      return;
    }

    if (!signupPassword) {
      setSignupError('Please set a security password.');
      return;
    }

    if (signupPassword.length < 4) {
      setSignupError('Password must be at least 4 characters long.');
      return;
    }

    if (signupPassword !== confirmPassword) {
      setSignupError('Passwords do not match.');
      return;
    }

    if (!isPhraseSaved) {
      setSignupError('Please check the confirmation box below.');
      return;
    }

    const newUser = BoostPayStore.registerUser(newMnemonic, signupPassword);
    onLoginUser(newUser);
  };

  return (
    <div className="flex min-h-screen w-full flex-col justify-center px-4 py-8">
      {/* Brand Header */}
      <div className="text-center mb-6">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500 text-zinc-950 font-black shadow-lg shadow-amber-500/20 mb-3">
          <Sparkles className="w-7 h-7 fill-current" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">BoostPay</h1>
        <p className="text-xs text-zinc-400 mt-1">Smart Yield Engine & P2P Transfers</p>
      </div>

      {/* Auth Card */}
      <div className="rounded-3xl border border-zinc-800 bg-zinc-900/90 p-5 shadow-2xl backdrop-blur-xl">
        {/* Tab Switcher */}
        <div className="flex rounded-2xl bg-zinc-950 p-1 mb-5 border border-zinc-800/80">
          <button
            onClick={() => { setTab('LOGIN'); setLoginError(''); }}
            className={`flex-1 rounded-xl py-2.5 text-xs font-semibold transition ${
              tab === 'LOGIN'
                ? 'bg-amber-500 text-zinc-950 shadow-md font-bold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Sign In
          </button>
          <button
            onClick={startSignup}
            className={`flex-1 rounded-xl py-2.5 text-xs font-semibold transition ${
              tab === 'SIGNUP'
                ? 'bg-amber-500 text-zinc-950 shadow-md font-bold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Sign In Form */}
        {tab === 'LOGIN' && (
          <form onSubmit={handleUserLogin} className="space-y-3.5">
            <div>
              <label className="block text-[11px] font-medium text-zinc-300 mb-1.5">
                Recovery Phrase or Numeric ID
              </label>
              <textarea
                rows={2}
                placeholder="Enter 12-word recovery phrase or 6-digit ID"
                value={loginIdentifier}
                onChange={(e) => setLoginIdentifier(e.target.value)}
                className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-100 placeholder-zinc-600 focus:border-amber-500 focus:outline-none resize-none font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-zinc-300 mb-1.5">
                Security Password
              </label>
              <div className="relative">
                <input
                  type={showLoginPassword ? 'text' : 'password'}
                  placeholder="Enter your account password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-zinc-100 placeholder-zinc-600 focus:border-amber-500 focus:outline-none pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  className="absolute right-3 top-2.5 text-zinc-500 hover:text-zinc-300"
                >
                  {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {loginError && (
              <p className="rounded-xl bg-red-950/40 border border-red-500/30 p-2.5 text-xs text-red-400">
                {loginError}
              </p>
            )}

            <button
              type="submit"
              className="w-full h-12 rounded-2xl bg-amber-500 text-xs font-bold text-zinc-950 hover:bg-amber-400 active:scale-[0.98] transition shadow-lg shadow-amber-500/20 flex items-center justify-center gap-1.5"
            >
              Sign In to Wallet <ArrowRight className="w-4 h-4" />
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={startSignup}
                className="text-xs text-zinc-400 hover:text-amber-400 transition"
              >
                New to BoostPay? Create a wallet
              </button>
            </div>
          </form>
        )}

        {/* Create Account Form */}
        {tab === 'SIGNUP' && (
          <form onSubmit={completeSignup} className="space-y-3.5">
            <div className="rounded-2xl border border-amber-500/20 bg-amber-950/20 p-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" /> 12-Word Recovery Phrase
                </span>
                <button
                  type="button"
                  onClick={handleCopyPhrase}
                  className="flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 font-medium"
                >
                  {copiedPhrase ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedPhrase ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <p className="text-[11px] text-zinc-400 mb-2.5 leading-snug">
                Write down these 12 secret words. You need them along with your password to access your funds.
              </p>

              <div className="grid grid-cols-3 gap-1.5 font-mono text-[11px]">
                {newMnemonic.split(' ').map((word, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-950/80 px-2 py-1 text-zinc-200"
                  >
                    <span className="text-zinc-600 text-[10px]">{i + 1}.</span>
                    <span className="font-semibold text-amber-300 truncate">{word}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-zinc-300 mb-1">
                Set Security Password
              </label>
              <div className="relative">
                <input
                  type={showSignupPassword ? 'text' : 'password'}
                  placeholder="Create a strong password"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-zinc-100 placeholder-zinc-600 focus:border-amber-500 focus:outline-none pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowSignupPassword(!showSignupPassword)}
                  className="absolute right-3 top-2.5 text-zinc-500 hover:text-zinc-300"
                >
                  {showSignupPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-zinc-300 mb-1">
                Confirm Password
              </label>
              <input
                type={showSignupPassword ? 'text' : 'password'}
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-zinc-100 placeholder-zinc-600 focus:border-amber-500 focus:outline-none"
              />
            </div>

            <label className="flex items-start gap-2 cursor-pointer select-none text-[11px] text-zinc-300 pt-1">
              <input
                type="checkbox"
                checked={isPhraseSaved}
                onChange={(e) => setIsPhraseSaved(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-700 text-amber-500 focus:ring-amber-500 mt-0.5"
              />
              <span>I have saved my 12-word recovery phrase safely</span>
            </label>

            {signupError && (
              <p className="rounded-xl bg-red-950/40 border border-red-500/30 p-2.5 text-xs text-red-400">
                {signupError}
              </p>
            )}

            <button
              type="submit"
              className="w-full h-12 rounded-2xl bg-amber-500 text-xs font-bold text-zinc-950 hover:bg-amber-400 active:scale-[0.98] transition shadow-lg shadow-amber-500/20 flex items-center justify-center gap-1.5"
            >
              Complete Registration <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
