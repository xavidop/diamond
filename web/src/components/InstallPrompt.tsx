import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

// Chromium fires `beforeinstallprompt` with this shape (not in lib.dom yet).
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "pwa.install.dismissed";

function isStandalone() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/**
 * A lightweight "Install app" prompt. It listens for the browser's
 * `beforeinstallprompt` event and surfaces a banner with an Install action,
 * so users can add Diamond to their home screen / apps without the browser's
 * default (easily-missed) prompt.
 */
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;

    function onBeforeInstall(e: Event) {
      e.preventDefault();
      let dismissed = false;
      try {
        dismissed = localStorage.getItem(DISMISS_KEY) === "1";
      } catch {
        /* ignore */
      }
      setDeferred(e as BeforeInstallPromptEvent);
      if (!dismissed) setVisible(true);
    }

    function onInstalled() {
      setVisible(false);
      setDeferred(null);
      try {
        localStorage.removeItem(DISMISS_KEY);
      } catch {
        /* ignore */
      }
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!visible || !deferred) return null;

  const install = async () => {
    setVisible(false);
    try {
      await deferred.prompt();
      await deferred.userChoice;
    } catch {
      /* user or browser aborted */
    }
    setDeferred(null);
  };

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  return (
    <div
      role="dialog"
      aria-label="Install Diamond"
      className="fixed z-50 bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 sm:w-[360px]
                 rounded-2xl border border-white/10 bg-pitch-900/95 backdrop-blur
                 shadow-card p-4 diamond-chrome"
    >
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute right-3 top-3 text-white/30 hover:text-white/70"
      >
        <X size={16} />
      </button>

      <div className="flex items-center gap-3">
        <img
          src="/pwa-icon.svg"
          alt=""
          className="h-11 w-11 rounded-xl shrink-0"
        />
        <div className="min-w-0">
          <div className="font-display font-black uppercase tracking-wide text-white leading-none">
            Install Diamond
          </div>
          <div className="mt-1 text-xs text-pitch-300/80">
            Add it to your home screen for quick, app-like access.
          </div>
        </div>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button onClick={dismiss} className="btn">
          Not now
        </button>
        <button onClick={install} className="btn btn-accent inline-flex items-center gap-1.5">
          <Download size={14} /> Install
        </button>
      </div>
    </div>
  );
}
