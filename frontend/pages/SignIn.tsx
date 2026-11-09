import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { backendClient } from "@/lib/backend";
import { getWatchShiftStatus } from "@/lib/shiftRota";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Shield, ArrowLeft, CheckCircle, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

type View = "signin" | "forgot" | "forgot-sent";

const WATCHES = ["Red", "White", "Green", "Blue", "Amber"];

// The dark "control room" side of the sign-in page: a live clock and which
// watch is on duty now (from the rota — no data needed before sign-in).
function BrandPanel() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(id);
  }, []);
  const onDuty = WATCHES.map((w) => ({ w, s: getWatchShiftStatus(w, now) })).find((x) => x.s?.state === "on");
  const night = onDuty?.s?.current?.startTime === "18:00";
  const accent = onDuty ? (night ? "#818cf8" : "#fbbf24") : "#94a3b8";

  return (
    <div className="relative isolate overflow-hidden bg-neutral-950 text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.08] [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:36px_36px] [mask-image:radial-gradient(ellipse_at_bottom_left,black,transparent_75%)]"
      />
      <div aria-hidden className="pointer-events-none absolute -bottom-40 -left-24 -z-10 h-[28rem] w-[28rem] rounded-full blur-3xl opacity-25" style={{ background: accent }} />

      <div className="flex h-full flex-col justify-between gap-10 p-6 sm:p-10 lg:p-14">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded bg-brand-bright font-mono text-sm font-semibold tracking-wide text-neutral-900">WC</div>
          <div>
            <div className="text-sm font-semibold">The Station Hub</div>
            <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-white/50">B10 Springburn</div>
          </div>
        </div>

        <div>
          <div className="font-mono text-6xl font-medium tabular-nums tracking-tight sm:text-7xl lg:text-8xl">
            {now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
          </div>
          <div className="mt-2 text-base text-white/60">
            {now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </div>
          {onDuty && (
            <div className="mt-6 inline-flex items-center gap-2.5 rounded-full bg-white/10 px-3 py-1.5 text-sm ring-1 ring-white/10">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" style={{ background: accent }} />
                <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: accent }} />
              </span>
              <span className="text-white/70">On duty now</span>
              <span className="font-semibold">{onDuty.w} Watch · {onDuty.s?.current?.shiftType}</span>
            </div>
          )}
        </div>

        <p className="hidden max-w-sm text-sm text-white/40 lg:block">
          Crewing, shift board, handovers, calendars and your watch's people — in one place, on any device.
        </p>
      </div>
    </div>
  );
}

export default function SignIn() {
  const [view, setView] = useState<View>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const apiBase = window.location.hostname !== "localhost"
        ? ""
        : "http://localhost:4000";
      const res = await fetch(`${apiBase}/auth/signin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Invalid email or password");
      }
      const response = await res.json();
      localStorage.setItem("auth_token", response.token);
      window.location.href = "/";
    } catch (error: any) {
      toast({
        title: "Sign in failed",
        description: error?.message || "Invalid email or password",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const [emailActuallySent, setEmailActuallySent] = useState(false);

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await backendClient.localauth.forgotPassword({ email: forgotEmail });
      setEmailActuallySent(result.email_sent);
      setView("forgot-sent");
    } catch (error: any) {
      // Still show "sent" — don't reveal if email exists
      setEmailActuallySent(false);
      setView("forgot-sent");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <BrandPanel />

      <div className="flex items-start justify-center px-6 py-10 sm:items-center sm:px-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 space-y-1.5">
            <h1 className="text-2xl font-semibold tracking-tight">
              {view === "signin" ? "Sign in" : view === "forgot" ? "Reset your password" : "Check your email"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {view === "signin" ? "Use the email your Watch Commander set up for you."
                : view === "forgot" ? "Enter your email and we'll send you a reset link."
                : `We've sent a reset link to ${forgotEmail}`}
            </p>
          </div>

        <div>
          {/* ── Sign in form ── */}
          {view === "signin" && (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@firescotland.gov.uk"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  autoFocus
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <button
                    type="button"
                    onClick={() => { setForgotEmail(email); setView("forgot"); }}
                    className="text-xs text-brand hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="pr-10 h-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button
                type="submit"
                className="w-full bg-brand text-brand-foreground hover:bg-brand/90 h-11 text-base font-medium"
                disabled={loading}
              >
                {loading ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          )}

          {/* ── Forgot password form ── */}
          {view === "forgot" && (
            <form onSubmit={handleForgot} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="forgot-email">Email address</Label>
                <Input
                  id="forgot-email"
                  type="email"
                  placeholder="your.email@example.com"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  required
                  disabled={loading}
                  autoFocus
                  className="h-11"
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-brand text-brand-foreground hover:bg-brand/90 h-11 text-base font-medium"
                disabled={loading || !forgotEmail.trim()}
              >
                {loading ? "Sending…" : "Send reset link"}
              </Button>
              <button
                type="button"
                onClick={() => setView("signin")}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mx-auto transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
              </button>
            </form>
          )}

          {/* ── Email sent confirmation ── */}
          {view === "forgot-sent" && (
            <div className="space-y-5 py-2 text-center">
              <div className="flex justify-center">
                <div className={`h-14 w-14 rounded-full flex items-center justify-center ${emailActuallySent ? "bg-green-100" : "bg-amber-100"}`}>
                  {emailActuallySent ? (
                    <CheckCircle className="h-8 w-8 text-green-600" />
                  ) : (
                    <Shield className="h-8 w-8 text-amber-600" />
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                {emailActuallySent ? (
                  <>
                    <p className="text-sm text-foreground font-medium">Reset link sent!</p>
                    <p className="text-sm text-muted-foreground">
                      If <strong>{forgotEmail}</strong> is registered, you'll receive an email with a link to reset your password. Check your inbox and spam folder.
                    </p>
                    <p className="text-xs text-muted-foreground">The link expires in 1 hour.</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-foreground font-medium">Contact your Watch Commander</p>
                    <p className="text-sm text-muted-foreground">
                      Email notifications are not yet configured. Please ask your Watch Commander to reset your password from the Admin panel.
                    </p>
                  </>
                )}
              </div>
              <button
                onClick={() => setView("signin")}
                className="flex items-center gap-1.5 text-sm text-brand hover:underline mx-auto"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
              </button>
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}
