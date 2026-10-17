/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Wallet, Trophy, MessageSquare, Download, CheckCircle2, Shield, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { BoostPayStore } from './services/store';
import { User, SystemConfig } from './types';
import { Navbar } from './components/Navbar';
import { AuthGate } from './components/AuthGate';
import { WalletView } from './components/WalletView';
import { LeaderboardView } from './components/LeaderboardView';
import { AdminPortal } from './components/AdminPortal';
import { MessengerView } from './components/MessengerView';
import { P2PTransferModal } from './components/P2PTransferModal';
import { usePWAInstall } from './hooks/usePWAInstall';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(BoostPayStore.getCurrentUser());
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState<boolean>(false);
  const [isOnAdminRoute, setIsOnAdminRoute] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'WALLET' | 'LEADERBOARD' | 'MESSENGER'>('WALLET');
  const [chatTargetPeerId, setChatTargetPeerId] = useState<string | null>(null);

  // Admin login form states for /admin route
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [showAdminPass, setShowAdminPass] = useState(false);
  const [adminError, setAdminError] = useState('');

  // Modals state
  const [isSendMoneyOpen, setIsSendMoneyOpen] = useState(false);

  // System config state
  const [config, setConfig] = useState<SystemConfig>(BoostPayStore.getConfig());

  // PWA install hook
  const { isInstalled, isInstallLoading, justInstalled, install } = usePWAInstall();

  // Listen to /admin URL route changes
  useEffect(() => {
    const checkAdminRoute = () => {
      const path = window.location.pathname.toLowerCase();
      const hash = window.location.hash.toLowerCase();
      const isAdminPath = path === '/admin' || path.startsWith('/admin/') || hash === '#/admin' || hash === '#admin';
      setIsOnAdminRoute(isAdminPath);
    };

    checkAdminRoute();
    window.addEventListener('popstate', checkAdminRoute);
    window.addEventListener('hashchange', checkAdminRoute);

    // Initialize backend sync
    BoostPayStore.initSync().then(() => {
      const freshUser = BoostPayStore.getCurrentUser();
      if (freshUser) setCurrentUser(freshUser);
      setConfig(BoostPayStore.getConfig());
    });

    return () => {
      window.removeEventListener('popstate', checkAdminRoute);
      window.removeEventListener('hashchange', checkAdminRoute);
    };
  }, []);

  const handleAdminSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError('');
    if (adminEmail.trim().toLowerCase() === 'admin@gmail.com' && adminPass === '123456') {
      setIsAdminLoggedIn(true);
    } else {
      setAdminError('Invalid administrator credentials.');
    }
  };

  const handleExitAdmin = () => {
    setIsAdminLoggedIn(false);
    setIsOnAdminRoute(false);
    if (window.location.pathname === '/admin') {
      window.history.pushState({}, '', '/');
    }
    if (window.location.hash.includes('admin')) {
      window.location.hash = '';
    }
  };

  const handleLogout = () => {
    BoostPayStore.setCurrentUser(null);
    setCurrentUser(null);
    setIsAdminLoggedIn(false);
    setActiveTab('WALLET');
    setChatTargetPeerId(null);
  };

  const handleUserLogin = (user: User) => {
    setCurrentUser(user);
    setIsAdminLoggedIn(false);
    setActiveTab('WALLET');
  };

  const handleOpenPeerChatFromLeaderboard = (peerId: string) => {
    setChatTargetPeerId(peerId);
    setActiveTab('MESSENGER');
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans antialiased">
      {/* 1. DEDICATED ADMIN ROUTE (/admin) */}
      {isOnAdminRoute ? (
        isAdminLoggedIn ? (
          <div className="flex-1 flex flex-col">
            <Navbar
              user={null}
              isAdmin={true}
              onLogout={handleExitAdmin}
            />
            <main className="flex-1 pb-12 overflow-y-auto">
              <AdminPortal onBack={handleExitAdmin} />
            </main>
          </div>
        ) : (
          <div className="flex-1 flex flex-col justify-center items-center px-4 py-12">
            <div className="w-full max-w-md">
              <div className="text-center mb-6">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-400 mb-2">
                  <Shield className="w-6 h-6" />
                </div>
                <h2 className="text-lg font-bold text-white">Administrator Portal</h2>
                <p className="text-xs text-zinc-400">Restricted system access</p>
              </div>

              <div className="rounded-3xl border border-zinc-800 bg-zinc-900/90 p-6 shadow-2xl">
                <form onSubmit={handleAdminSignIn} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1">
                      Admin Email
                    </label>
                    <input
                      type="email"
                      placeholder="admin@gmail.com"
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        type={showAdminPass ? 'text' : 'password'}
                        placeholder="••••••"
                        value={adminPass}
                        onChange={(e) => setAdminPass(e.target.value)}
                        className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500 font-mono pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowAdminPass(!showAdminPass)}
                        className="absolute right-3 top-2.5 text-zinc-500 hover:text-zinc-300"
                      >
                        {showAdminPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {adminError && (
                    <p className="rounded-xl bg-red-950/40 border border-red-500/30 p-2.5 text-xs text-red-400">
                      {adminError}
                    </p>
                  )}

                  <button
                    type="submit"
                    className="w-full h-11 rounded-2xl bg-amber-500 text-xs font-bold text-zinc-950 hover:bg-amber-400 transition flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/20"
                  >
                    Authenticate as Admin <ArrowRight className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={handleExitAdmin}
                    className="w-full py-2 text-xs text-zinc-400 hover:text-white transition"
                  >
                    Return to User Wallet
                  </button>
                </form>
              </div>
            </div>
          </div>
        )
      ) : !currentUser ? (
        /* 2. REGULAR USER AUTH GATE */
        <div className="flex-1 flex flex-col justify-center items-center">
          <div className="w-full max-w-md">
            <AuthGate onLoginUser={handleUserLogin} />
          </div>
        </div>
      ) : (
        /* 3. LOGGED-IN RESPONSIVE USER EXPERIENCE */
        <div className="flex-1 flex flex-col relative pb-20 overflow-y-auto">
          <Navbar
            user={currentUser}
            isAdmin={false}
            onLogout={handleLogout}
          />

          <main className="flex-1 w-full max-w-4xl mx-auto py-2">
            {activeTab === 'WALLET' && (
              <WalletView
                user={currentUser}
                onUpdateUser={(updated) => setCurrentUser({ ...updated })}
                onOpenSendMoney={() => setIsSendMoneyOpen(true)}
                config={config}
              />
            )}

            {activeTab === 'LEADERBOARD' && (
              <LeaderboardView
                currentUser={currentUser}
                onSelectPeerForChat={handleOpenPeerChatFromLeaderboard}
              />
            )}

            {activeTab === 'MESSENGER' && (
              <MessengerView
                currentUser={currentUser}
                targetPeerId={chatTargetPeerId}
              />
            )}
          </main>

          {/* 4-TAB BOTTOM NAVIGATION BAR: WALLET - LEADERBOARD - INSTALL APP - MESSENGER */}
          <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur-lg">
            <div className="mx-auto flex max-w-md items-center justify-around h-16 px-3">
              {/* 1. Wallet Tab */}
              <button
                onClick={() => setActiveTab('WALLET')}
                className={`flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition ${
                  activeTab === 'WALLET' ? 'text-amber-400 font-bold' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Wallet className="w-5 h-5 stroke-[2.2]" />
                <span>Wallet</span>
              </button>

              {/* 2. Leaderboard Tab */}
              <button
                onClick={() => setActiveTab('LEADERBOARD')}
                className={`flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition ${
                  activeTab === 'LEADERBOARD' ? 'text-amber-400 font-bold' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Trophy className="w-5 h-5 stroke-[2.2]" />
                <span>Leaderboard</span>
              </button>

              {/* 3. Install App Action */}
              <div className="flex flex-col items-center justify-center">
                {isInstalled && !justInstalled ? (
                  <button
                    disabled
                    className="flex flex-col items-center justify-center gap-1 text-[11px] text-emerald-400 font-medium"
                    title="App already installed"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    <span>Installed</span>
                  </button>
                ) : justInstalled ? (
                  <div className="flex flex-col items-center justify-center gap-1 text-[11px] text-emerald-300 font-bold">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <span>Installed!</span>
                  </div>
                ) : (
                  <button
                    onClick={install}
                    disabled={isInstallLoading}
                    className="flex flex-col items-center justify-center gap-1 text-[11px] font-bold text-amber-400 hover:text-amber-300 active:scale-95 transition cursor-pointer"
                    title="Install BoostPay"
                  >
                    {isInstallLoading ? (
                      <div className="h-5 w-5 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
                    ) : (
                      <Download className="w-5 h-5 stroke-[2.5]" />
                    )}
                    <span>Install</span>
                  </button>
                )}
              </div>

              {/* 4. Messenger Tab */}
              <button
                onClick={() => setActiveTab('MESSENGER')}
                className={`flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition ${
                  activeTab === 'MESSENGER' ? 'text-amber-400 font-bold' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <MessageSquare className="w-5 h-5 stroke-[2.2]" />
                <span>Messenger</span>
              </button>
            </div>
          </nav>
        </div>
      )}

      {/* P2P Transfer Modal */}
      {currentUser && (
        <P2PTransferModal
          isOpen={isSendMoneyOpen}
          onClose={() => setIsSendMoneyOpen(false)}
          currentUser={currentUser}
          onSuccess={(updated) => {
            setCurrentUser({ ...updated });
            setIsSendMoneyOpen(false);
          }}
        />
      )}
    </div>
  );
}
