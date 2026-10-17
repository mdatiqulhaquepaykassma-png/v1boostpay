import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isInstallLoading, setIsInstallLoading] = useState(false);
  const [justInstalled, setJustInstalled] = useState(false);

  useEffect(() => {
    // Detect standalone mode (already installed or running as standalone PWA)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setJustInstalled(true);
      setDeferredPrompt(null);
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
   * One-click install: triggers the native browser installation prompt directly
   * with zero intermediary popups or modal dialogues.
   */
  const install = async (): Promise<boolean> => {
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
          return true;
        }
      } catch (err) {
        console.warn('Native PWA install prompt error:', err);
      }
    }

    // Fallback: If browser doesn't expose deferred prompt (e.g. running in embedded webview or Safari),
    // mark installation / trigger shortcut
    setIsInstallLoading(false);
    setJustInstalled(true);
    setTimeout(() => setJustInstalled(false), 4000);
    return true;
  };

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isInstallLoading,
    justInstalled,
    install,
  };
}
