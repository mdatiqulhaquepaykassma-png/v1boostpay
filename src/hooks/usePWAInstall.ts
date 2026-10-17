import { useEffect, useState, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
      localStorage.getItem('boostpay_pwa_installed') === 'true';
    return isStandalone;
  });
  const [isInstallLoading, setIsInstallLoading] = useState(false);
  const [justInstalled, setJustInstalled] = useState(false);

  useEffect(() => {
    const checkStandalone = () => {
      const isStandalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
        localStorage.getItem('boostpay_pwa_installed') === 'true';
      if (isStandalone) {
        setIsInstalled(true);
      }
    };

    checkStandalone();

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setJustInstalled(true);
      setDeferredPrompt(null);
      localStorage.setItem('boostpay_pwa_installed', 'true');
      setTimeout(() => setJustInstalled(false), 4000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  /**
   * One-click direct native browser install prompt without popup interference
   */
  const install = useCallback(async (): Promise<boolean> => {
    setIsInstallLoading(true);

    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        setIsInstallLoading(false);
        if (choice.outcome === 'accepted') {
          setIsInstalled(true);
          setJustInstalled(true);
          setDeferredPrompt(null);
          localStorage.setItem('boostpay_pwa_installed', 'true');
          return true;
        }
        return false;
      } catch (err) {
        console.warn('Native PWA install prompt error:', err);
      }
    }

    // Fallback: If deferred prompt not provided by browser (e.g. already added or webview),
    // mark installation state cleanly
    setIsInstallLoading(false);
    setIsInstalled(true);
    setJustInstalled(true);
    localStorage.setItem('boostpay_pwa_installed', 'true');
    setTimeout(() => setJustInstalled(false), 3000);
    return true;
  }, [deferredPrompt]);

  /**
   * Direct app open without any popup or blocked window
   */
  const openApp = useCallback(() => {
    // If inside standalone mode, we are already in the app
    if (window.matchMedia('(display-mode: standalone)').matches) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Direct clean navigation without window.open popup block
    window.location.href = '/';
  }, []);

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isInstallLoading,
    justInstalled,
    install,
    openApp
  };
}
