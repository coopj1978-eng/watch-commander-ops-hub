import { useEffect, useState } from "react";
import { X, Share, Plus, Smartphone } from "lucide-react";

// ──────────────────────────────────────────────────────────────────────────────
// PWAInstallPrompt
//
// Shows a friendly "install to home screen" banner to users who haven't yet
// installed the PWA. Two paths:
//
//   - Chromium browsers (Android Chrome, desktop Chrome/Edge): the browser
//     fires a `beforeinstallprompt` event we can defer and trigger later.
//     We show an "Install" button that calls prompt() on that event.
//
//   - iOS Safari: Apple refuses to implement beforeinstallprompt, so users
//     MUST tap Share → Add to Home Screen manually. We show a bottom sheet
//     with the step-by-step instructions instead.
//
// Dismissal is remembered for 7 days in localStorage so the banner doesn't
// badger on every visit. Already-installed users (standalone display mode
// OR navigator.standalone on iOS) never see it.
// ──────────────────────────────────────────────────────────────────────────────

const DISMISS_KEY    = "pwa-install-dismissed-at";
const DISMISS_DAYS   = 7;
// Require a few page interactions before prompting so first-time users
// don't get hit with it on the login screen.
const MIN_VIEWS_KEY  = "pwa-install-view-count";
const MIN_VIEWS      = 3;

type Variant = "android" | "ios" | null;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function detectVariant(): Variant {
  if (typeof window === "undefined") return null;

  // Already installed (Chrome / Android / desktop)
  if (window.matchMedia?.("(display-mode: standalone)").matches) return null;
  // Already installed (iOS home-screen)
  if ((window.navigator as any).standalone === true) return null;

  const ua = window.navigator.userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(ua) && !(window as any).MSStream;
  const isSafari = isIOS && /safari/.test(ua) && !/crios|fxios|opios|edgios/.test(ua);

  if (isSafari) return "ios";

  // Android / Chromium — we wait for the beforeinstallprompt event. The
  // caller will flip this to "android" only after the event fires so we
  // don't show an install button that does nothing.
  return null;
}

function wasDismissedRecently(): boolean {
  try {
    const ts = Number(localStorage.getItem(DISMISS_KEY));
    if (!ts) return false;
    const daysSince = (Date.now() - ts) / 86_400_000;
    return daysSince < DISMISS_DAYS;
  } catch {
    return false;
  }
}

function bumpViewCount(): number {
  try {
    const n = Number(localStorage.getItem(MIN_VIEWS_KEY)) || 0;
    const next = n + 1;
    localStorage.setItem(MIN_VIEWS_KEY, String(next));
    return next;
  } catch {
    return MIN_VIEWS; // be lenient if storage is blocked
  }
}

export default function PWAInstallPrompt() {
  const [variant, setVariant] = useState<Variant>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Gate: dismissed recently?
    if (wasDismissedRecently()) return;
    // Gate: enough warm-up views?
    if (bumpViewCount() < MIN_VIEWS) return;

    const initial = detectVariant();
    if (initial === "ios") {
      setVariant("ios");
      setOpen(true);
    }

    // Android / Chromium path
    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVariant("android");
      setOpen(true);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);

    const onInstalled = () => {
      setOpen(false);
      setVariant(null);
      try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {}
    };
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = () => {
    setOpen(false);
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {}
  };

  const handleAndroidInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    // Either way, don't show it again this week.
    setDeferredPrompt(null);
    setOpen(false);
    if (outcome === "accepted") {
      try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {}
    } else {
      try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {}
    }
  };

  if (!open || !variant) return null;

  return (
    <div
      role="dialog"
      aria-label="Install app"
      className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] md:inset-x-auto md:right-6 md:bottom-6 md:w-[380px]"
    >
      <div className="bg-card border border-border rounded-2xl shadow-xl p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shrink-0">
            <Smartphone className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold leading-tight">Install Watch Commander</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {variant === "ios"
                ? "Add to your home screen for one-tap access and a full-screen app experience."
                : "Get a full-screen app with one-tap access from your home screen."
              }
            </p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="shrink-0 h-8 w-8 rounded-lg hover:bg-muted flex items-center justify-center"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {variant === "ios" ? (
          <div className="text-xs space-y-2 pt-1">
            <p className="text-muted-foreground">
              On iPhone / iPad: open this site in Safari, then:
            </p>
            <ol className="space-y-1.5">
              <li className="flex items-center gap-2">
                <span className="h-5 w-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-semibold shrink-0">1</span>
                <span>Tap the</span>
                <Share className="h-4 w-4 text-brand" />
                <span>Share icon at the bottom.</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="h-5 w-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-semibold shrink-0">2</span>
                <span>Scroll and tap</span>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted text-[10px] font-semibold">
                  <Plus className="h-3 w-3" />
                  Add to Home Screen
                </span>
              </li>
              <li className="flex items-center gap-2">
                <span className="h-5 w-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-semibold shrink-0">3</span>
                <span>Tap <span className="font-semibold">Add</span>.</span>
              </li>
            </ol>
          </div>
        ) : (
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleAndroidInstall}
              className="flex-1 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold"
            >
              Install
            </button>
            <button
              type="button"
              onClick={dismiss}
              className="h-10 px-4 rounded-xl border border-border text-sm font-medium hover:bg-muted"
            >
              Not now
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
