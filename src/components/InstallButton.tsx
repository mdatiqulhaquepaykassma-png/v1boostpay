import { FC } from 'react';
import { Download, CheckCircle2 } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface Props {
  variant?: 'compact' | 'full';
  className?: string;
}

export const InstallButton: FC<Props> = ({ variant = 'compact', className = '' }) => {
  const { isInstalled, isInstallLoading, justInstalled, install } = usePWAInstall();

  // If already running inside installed standalone PWA and not recently installed, keep UI clean
  if (isInstalled && !justInstalled) {
    return (
      <span className={`inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-950/20 px-2.5 py-1.5 text-xs font-medium text-emerald-400 ${className}`}>
        <CheckCircle2 className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Installed</span>
      </span>
    );
  }

  if (justInstalled) {
    return (
      <span className={`inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/20 px-2.5 py-1.5 text-xs font-semibold text-emerald-300 animate-in fade-in duration-200 ${className}`}>
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
        <span>Installed!</span>
      </span>
    );
  }

  return (
    <button
      id="pwa-install-button"
      onClick={install}
      disabled={isInstallLoading}
      aria-label="Install BoostPay"
      title="One-click install BoostPay to your device home screen or desktop"
      className={`relative inline-flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-yellow-400 px-3 py-1.5 text-xs font-bold text-zinc-950 shadow-md shadow-amber-500/20 hover:from-amber-400 hover:to-yellow-300 active:scale-95 transition cursor-pointer ${className}`}
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
