import { FC } from 'react';
import { Download, ExternalLink, CheckCircle2 } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface Props {
  variant?: 'compact' | 'full';
  className?: string;
}

export const InstallButton: FC<Props> = ({ variant = 'compact', className = '' }) => {
  const { isInstalled, isInstallLoading, justInstalled, install } = usePWAInstall();

  const handleOpenApp = () => {
    // Open app cleanly without popups or fallback to window focus
    try {
      window.open(window.location.origin, '_blank');
    } catch {
      window.location.href = '/';
    }
  };

  if (isInstalled && !justInstalled) {
    return (
      <button
        onClick={handleOpenApp}
        aria-label="Open BoostPay App"
        className={`inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-950/40 px-3 py-1.5 text-xs font-bold text-emerald-400 hover:bg-emerald-900/50 transition cursor-pointer ${className}`}
        title="Open installed BoostPay app"
      >
        <ExternalLink className="w-3.5 h-3.5" />
        <span>Open</span>
      </button>
    );
  }

  if (justInstalled) {
    return (
      <button
        onClick={handleOpenApp}
        className={`inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/50 bg-emerald-500/20 px-3 py-1.5 text-xs font-bold text-emerald-300 animate-in fade-in duration-200 cursor-pointer ${className}`}
      >
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
        <span>Open</span>
      </button>
    );
  }

  return (
    <button
      id="pwa-install-button"
      onClick={install}
      disabled={isInstallLoading}
      aria-label="Install BoostPay"
      title="One-click install BoostPay to your device"
      className={`relative inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-bold text-zinc-950 hover:bg-amber-400 active:scale-95 transition cursor-pointer shadow-md shadow-amber-500/20 ${className}`}
    >
      {isInstallLoading ? (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-950 border-t-transparent" />
      ) : (
        <Download className="w-3.5 h-3.5 stroke-[2.5]" />
      )}
      <span>{variant === 'full' ? 'Install BoostPay App' : 'Install'}</span>
    </button>
  );
};
