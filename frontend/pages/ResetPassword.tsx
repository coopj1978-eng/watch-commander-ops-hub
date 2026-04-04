import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { backendClient } from "@/lib/backend";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Shield, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!token) setError("Invalid or missing reset token. Please request a new reset link.");
  }, [token]);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    if (password.length < 8) {
      toast({ title: "Password too short", description: "At least 8 characters required", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      await backendClient.localauth.resetPassword({ token, new_password: password });
      setDone(true);
    } catch (err: any) {
      const msg = err?.message || "Failed to reset password";
      if (msg.toLowerCase().includes("expired")) {
        setError("This reset link has expired. Please go back and request a new one.");
      } else if (msg.toLowerCase().includes("invalid")) {
        setError("This reset link is invalid or has already been used.");
      } else {
        toast({ title: "Reset failed", description: msg, variant: "destructive" });
      }
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
            {done ? "Password updated" : error ? "Link problem" : "Set new password"}
          </CardTitle>
          <CardDescription>
            {done ? "You can now sign in with your new password."
              : error ? "There was a problem with your reset link."
              : "Choose a strong password for your account."}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {/* ── Success ── */}
          {done && (
            <div className="space-y-5 text-center py-2">
              <div className="flex justify-center">
                <div className="h-14 w-14 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">Your password has been changed successfully.</p>
              <Button
                className="w-full bg-indigo-600 hover:bg-indigo-700 h-11"
                onClick={() => navigate("/sign-in")}
              >
                Sign in
              </Button>
            </div>
          )}

          {/* ── Error (invalid/expired token) ── */}
          {!done && error && (
            <div className="space-y-5 text-center py-2">
              <div className="flex justify-center">
                <div className="h-14 w-14 rounded-full bg-red-100 flex items-center justify-center">
                  <XCircle className="h-8 w-8 text-red-500" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button
                variant="outline"
                className="w-full h-11"
                onClick={() => navigate("/sign-in")}
              >
                Back to sign in
              </Button>
            </div>
          )}

          {/* ── Reset form ── */}
          {!done && !error && (
            <form onSubmit={handleReset} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">New password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  minLength={8}
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">At least 8 characters</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirm new password</Label>
                <Input
                  id="confirm"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 h-11 text-base font-medium"
                disabled={loading}
              >
                {loading ? "Updating…" : "Set new password"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
