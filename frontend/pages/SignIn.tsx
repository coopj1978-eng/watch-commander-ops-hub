import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { backendClient } from "@/lib/backend";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Shield, ArrowLeft, CheckCircle, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

type View = "signin" | "forgot" | "forgot-sent";

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
        ? "https://staging-watch-commander-ops-hub-8spi.encr.app"
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-1 text-center pb-4">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-700 flex items-center justify-center shadow-lg">
              <Shield className="h-9 w-9 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">
            {view === "signin" ? "Watch Commander Ops Hub" : view === "forgot" ? "Reset your password" : "Check your email"}
          </CardTitle>
          <CardDescription>
            {view === "signin" ? "Sign in to access your dashboard"
              : view === "forgot" ? "Enter your email and we'll send you a reset link"
              : `We've sent a reset link to ${forgotEmail}`}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {/* ── Sign in form ── */}
          {view === "signin" && (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your.email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <button
                    type="button"
                    onClick={() => { setForgotEmail(email); setView("forgot"); }}
                    className="text-xs text-indigo-600 hover:underline"
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
                    className="pr-10"
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
                className="w-full bg-indigo-600 hover:bg-indigo-700 h-11 text-base font-medium"
                disabled={loading}
              >
                {loading ? "Signing in…" : "Sign In"}
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
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 h-11 text-base font-medium"
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
                className="flex items-center gap-1.5 text-sm text-indigo-600 hover:underline mx-auto"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
