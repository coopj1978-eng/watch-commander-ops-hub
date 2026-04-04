import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { backendClient } from "@/lib/backend";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Shield, Lock } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function SignUp() {
  const [searchParams] = useSearchParams();
  const inviteEmail = searchParams.get("email") ?? "";
  const isInviteFlow = !!inviteEmail;

  const [name, setName] = useState("");
  const [email, setEmail] = useState(inviteEmail);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (inviteEmail) setEmail(inviteEmail);
  }, [inviteEmail]);

  const handleSignUp = async (e: React.FormEvent) => {
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
      const response = await backendClient.localauth.signUp({
        email: email.trim().toLowerCase(),
        password,
        name: name.trim(),
      });

      localStorage.setItem("auth_token", response.token);
      window.location.href = "/";
    } catch (error: any) {
      console.error("Sign up error:", error);
      if (error?.message?.toLowerCase().includes("already exists")) {
        toast({ title: "Account already set up", description: "Your account is ready — please sign in." });
        navigate(`/sign-in?email=${encodeURIComponent(email)}`);
        return;
      }
      toast({
        title: isInviteFlow ? "Setup failed" : "Sign up failed",
        description: error?.message || "Failed to create account. Please try again.",
        variant: "destructive",
      });
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
            {isInviteFlow ? "Set up your account" : "Create Account"}
          </CardTitle>
          <CardDescription>
            {isInviteFlow
              ? "You've been invited to Watch Commander Ops Hub. Set a password to get started."
              : "Sign up to access the Operations Hub"}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSignUp} className="space-y-4">

            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="Your full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={loading}
                autoFocus={!isInviteFlow}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Input
                  id="email"
                  type="email"
                  placeholder="your.email@example.com"
                  value={email}
                  onChange={(e) => !isInviteFlow && setEmail(e.target.value)}
                  required
                  disabled={loading || isInviteFlow}
                  className={isInviteFlow ? "pr-9 bg-muted/50 text-muted-foreground" : ""}
                />
                {isInviteFlow && (
                  <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                )}
              </div>
              {isInviteFlow && (
                <p className="text-xs text-muted-foreground">
                  This email was set by your Watch Commander and cannot be changed here.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{isInviteFlow ? "Choose a Password" : "Password"}</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                minLength={8}
                autoFocus={isInviteFlow}
              />
              <p className="text-xs text-muted-foreground">At least 8 characters</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
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
              {loading
                ? (isInviteFlow ? "Setting up…" : "Creating account…")
                : (isInviteFlow ? "Set password & sign in" : "Create Account")}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => navigate("/sign-in")}
                className="text-indigo-600 hover:underline font-medium"
              >
                Sign in
              </button>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
